import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { Client,StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

let mf:Miniflare, temp:string;
const alice={id:'alice',email:'alice@example.test'}, bob={id:'bob',email:'bob@example.test'}, eve={id:'eve',email:'eve@example.test'};
type Identity=typeof alice|string|null;
before(async()=>{
  temp=await mkdtemp(join(tmpdir(),'bento-office-api-'));
  await build({entryPoints:['office/server/worker.ts'],outfile:join(temp,'worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
  mf=new Miniflare({modules:true,modulesRoot:temp,scriptPath:join(temp,'worker.js'),compatibilityDate:'2026-07-01',d1Databases:['DB'],r2Buckets:['FILES']});
  const db=await mf.getD1Database('DB');
  for(const file of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()) {
    const sql=await readFile(join('drizzle',file),'utf8');
    for(const statement of sql.split('--> statement-breakpoint').filter(v=>v.trim())) await db.prepare(statement).run();
  }
});
after(async()=>{await mf?.dispose();if(temp)await rm(temp,{recursive:true,force:true});});
async function api(identity:Identity,path:string,method='GET',body?:unknown){
  const headers:Record<string,string>={};
  if(typeof identity==='string') headers.authorization='Bearer '+identity;
  else if(identity){headers['oai-authenticated-user-id']=identity.id;headers['oai-authenticated-user-email']=identity.email;}
  if(body!==undefined)headers['content-type']='application/json';
  const response=await mf.dispatchFetch('http://localhost'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json() as any};
}
const write=(baseRevision:number,cells:Record<string,unknown>,operationId=crypto.randomUUID())=>({baseRevision,operationId,summary:'Aggiorna valori',patches:[{op:'setCanvasCells',sheet:'sheet-1',cells}]});
async function create(){const r=await api(alice,'/api/workbooks','POST',{title:'Budget'});assert.equal(r.status,201);return r.body;}

test('real HTTP storage, concurrent independent edits, idempotent replay, conflict and safe undo',async()=>{
  const w=await create(), root='/api/workbooks/'+w.id;
  const a=write(0,{A1:{v:12}}), b=write(0,{B1:{v:8}});
  const both=await Promise.all([api(alice,root+'/changes','POST',a),api(alice,root+'/changes','POST',b)]);
  assert.deepEqual(both.map(x=>x.status),[200,200]);
  const read=await api(alice,root);assert.equal(read.body.revision,2);assert.equal(read.body.document.sheets[0].cells.A1.v,12);assert.equal(read.body.document.sheets[0].cells.B1.v,8);
  const replay=await api(alice,root+'/changes','POST',a);assert.equal(replay.status,200);assert.equal(replay.body.changeId,both[0].body.changeId);assert.equal((await api(alice,root)).body.revision,2);
  assert.equal((await api(alice,root+'/changes','POST',{...a,summary:'Changed payload'})).status,409);
  assert.equal((await api(alice,root+'/changes','POST',write(0,{A1:{v:99}}))).status,409);
  const undo=await api(alice,root+'/changes/'+both[0].body.changeId+'/undo','POST',{operationId:crypto.randomUUID()});assert.equal(undo.status,200);
  const final=await api(alice,root);assert.equal(final.body.document.sheets[0].cells.A1,undefined);assert.equal(final.body.document.sheets[0].cells.B1.v,8);
  assert.equal((await api(alice,root+'?revision=1')).status,200);
});
test('sharing is enforced for two people and cannot be bypassed through another workbook',async()=>{
  const w=await create(), root='/api/workbooks/'+w.id;
  assert.equal((await api(null,root)).status,401);assert.equal((await api(bob,root)).status,404);
  const grant=await api(alice,root+'/members','POST',{email:bob.email,role:'viewer'});assert.equal(grant.status,200);
  assert.equal((await api(bob,root)).status,200);
  assert.equal((await api(bob,root+'/changes','POST',write(0,{A1:{v:'forbidden'}}))).status,403);
  assert.equal((await api(bob,root+'/members','POST',{email:eve.email,role:'editor'})).status,403);
  const second=await create();assert.equal((await api(bob,'/api/workbooks/'+second.id)).status,404);
  await api(alice,root+'/members','POST',{email:bob.email,role:'editor'});
  assert.equal((await api(bob,root+'/changes','POST',write(0,{A1:{v:'allowed'}}))).status,200);
  assert.equal((await api(alice,root+'/members/'+grant.body.id,'DELETE')).status,200);
  assert.equal((await api(bob,root)).status,404);
});
test('agent proposals are visible, need a person to accept, then revocation stops the agent',async()=>{
  const w=await create(),root='/api/workbooks/'+w.id;
  const created=await api(alice,root+'/agents','POST',{name:'Analista',permission:'propose',expiresDays:7});assert.equal(created.status,201);
  const token=created.body.token;
  assert.equal((await api(token,root+'/changes','POST',write(0,{A1:{v:10}}))).status,403);
  const draft=write(0,{A1:{v:12},A2:{v:8},A3:{f:'=SUM(A1:A2)'}});
  const p=await api(token,root+'/proposals','POST',draft);assert.equal(p.status,201);
  assert.equal((await api(token,root+'/proposals','POST',draft)).body.id,p.body.id);
  assert.equal((await api(alice,root)).body.revision,0);
  assert.equal((await api(token,root+'/proposals/'+p.body.id+'/accept','POST',{operationId:crypto.randomUUID()})).status,403);
  const accepted=await api(alice,root+'/proposals/'+p.body.id+'/accept','POST',{operationId:crypto.randomUUID()});assert.equal(accepted.status,200);
  const range=await api(token,root+'/range?sheet=sheet-1&range=A3:A3');assert.equal(range.body.cells[0].value,20);
  const history=await api(alice,root+'/changes');assert.equal(history.body.changes[0].kind,'accept');
  const listing=await api(alice,root+'/agents');assert.equal(JSON.stringify(listing.body).includes(token),false);assert.equal(JSON.stringify(listing.body).includes('token_hash'),false);
  assert.equal((await api(alice,root+'/agents/'+created.body.id,'DELETE')).status,200);
  assert.equal((await api(token,root)).status,401);
});
test('stale proposals, partial batches, forged fields and browser cross-origin writes are rejected',async()=>{
  const w=await create(),root='/api/workbooks/'+w.id;
  const p=await api(alice,root+'/proposals','POST',write(0,{A1:{v:1}}));
  await api(alice,root+'/changes','POST',write(0,{A1:{v:2}}));
  assert.equal((await api(alice,root+'/proposals/'+p.body.id+'/accept','POST',{operationId:crypto.randomUUID()})).status,409);
  assert.equal((await api(alice,root+'/changes','POST',{...write(1,{B1:{v:7}}),actorId:'eve'})).status,400);
  const bad=write(1,{B1:{v:7}});bad.patches.push({op:'setTitle',title:'valid but then fails'} as any,{op:'unknown'} as any);
  assert.equal((await api(alice,root+'/changes','POST',bad)).status,400);
  assert.equal((await api(alice,root)).body.revision,1);
  const response=await mf.dispatchFetch('http://localhost'+root+'/changes',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json','oai-authenticated-user-id':alice.id,'oai-authenticated-user-email':alice.email},body:JSON.stringify(write(1,{A1:{v:4}}))});assert.equal(response.status,403);
});
test('delegated credentials stop after collaborator removal and cannot grant more permissions',async()=>{
  const w=await create(),root='/api/workbooks/'+w.id;
  const member=await api(alice,root+'/members','POST',{email:bob.email,role:'editor'});
  const agent=await api(bob,root+'/agents','POST',{name:'Assistant',permission:'write',expiresDays:1});assert.equal(agent.status,201);
  assert.equal((await api(agent.body.token,root+'/members','POST',{email:eve.email,role:'editor'})).status,403);
  await api(alice,root+'/members/'+member.body.id,'DELETE');
  assert.equal((await api(agent.body.token,root+'/changes','POST',write(0,{A1:{v:4}}))).status,404);
});

test('an actual MCP client discovers tools, proposes a change and reads the accepted formula',async()=>{
  const w=await create(),root='/api/workbooks/'+w.id;
  const agent=await api(alice,root+'/agents','POST',{name:'MCP analyst',permission:'propose',expiresDays:1});
  const transport=new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'),{
    requestInit:{headers:{authorization:'Bearer '+agent.body.token}},
    fetch:async(input,init)=>{
      const req=new Request(input,init);
      const res=await mf.dispatchFetch(req.url,{method:req.method,headers:Object.fromEntries(req.headers),body:req.method==='POST'?await req.text():undefined});
      return new Response(await res.arrayBuffer(),{status:res.status,headers:Object.fromEntries(res.headers)});
    },
  });
  const client=new Client({name:'bento-office-test',version:'1.0.0'});
  try {
    await client.connect(transport);
    const available=await client.listTools();assert.ok(available.tools.some(t=>t.name==='propose_change'));
    const proposal=await client.callTool({name:'propose_change',arguments:{workbookId:w.id,...write(0,{A1:{v:2},A2:{f:'=A1*5'}})}});
    assert.equal(proposal.isError,undefined);
    const proposalId=JSON.parse((proposal.content as any)[0].text).id;
    await api(alice,root+'/proposals/'+proposalId+'/accept','POST',{operationId:crypto.randomUUID()});
    const result=await client.callTool({name:'read_range',arguments:{workbookId:w.id,sheetId:'sheet-1',range:'A2:A2'}});
    assert.equal(JSON.parse((result.content as any)[0].text).cells[0].value,10);
    const denied=await client.callTool({name:'apply_change',arguments:{workbookId:w.id,...write(1,{A1:{v:99}})}});assert.equal(denied.isError,true);
    const invalid=await client.callTool({name:'read_range',arguments:{workbookId:w.id,sheetId:'sheet-1',range:'NOPE'}});assert.equal(invalid.isError,true);
  } finally {await client.close();}
});

test('volatile formulas read one persisted time per revision and structural undo survives timestamp updates',async()=>{
  const w=await create(),root='/api/workbooks/'+w.id;
  await api(alice,root+'/changes','POST',write(0,{A1:{f:'=NOW()'}}));
  const a=await api(alice,root+'/range?sheet=sheet-1&range=A1:A1');
  const b=await api(alice,root+'/range?sheet=sheet-1&range=A1:A1');
  assert.equal(a.body.cells[0].value,b.body.cells[0].value);
  const add=await api(alice,root+'/changes','POST',{baseRevision:1,operationId:crypto.randomUUID(),summary:'Nuovo foglio',patches:[{op:'setSheet',id:'another',sheet:{id:'another',name:'Sheet 2',kind:'canvas',cells:{}}}]});assert.equal(add.status,200);
  assert.equal((await api(alice,root+'/changes/'+add.body.changeId+'/undo','POST',{operationId:crypto.randomUUID()})).status,200);
});
