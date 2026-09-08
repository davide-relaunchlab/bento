import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';

let mf:Miniflare,temp:string;
const owner={id:'native-owner',email:'native-owner@example.test'};
const viewer={id:'native-viewer',email:'native-viewer@example.test'};
type Identity=typeof owner|string|null;
before(async()=>{
  temp=await mkdtemp(join(tmpdir(),'bento-native-api-'));
  await build({entryPoints:['office/server/worker.ts'],outfile:join(temp,'worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
  mf=new Miniflare({modules:true,modulesRoot:temp,scriptPath:join(temp,'worker.js'),compatibilityDate:'2026-07-01',d1Databases:['DB'],r2Buckets:['FILES']});
  const db=await mf.getD1Database('DB');
  for(const file of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
    for(const sql of (await readFile(join('drizzle',file),'utf8')).split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run();
    if(file.startsWith('0000_'))await db.prepare("INSERT INTO workbooks(id,doc_id,title,owner_id,revision,acl_version,content_key,created_at,updated_at) VALUES('legacy','legacy-doc','Legacy','owner',0,0,'legacy-key',1,1)").run();
  }
});
after(async()=>{await mf?.dispose();if(temp)await rm(temp,{recursive:true,force:true});});
async function api(identity:Identity,path:string,method='GET',body?:unknown){
  const headers:Record<string,string>={};
  if(typeof identity==='string')headers.authorization='Bearer '+identity;
  else if(identity){headers['oai-authenticated-user-id']=identity.id;headers['oai-authenticated-user-email']=identity.email;}
  if(body!==undefined)headers['content-type']='application/json';
  const response=await mf.dispatchFetch('http://localhost'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json() as any};
}
async function create(format:'bento/slides'|'bento/type'){
  const result=await api(owner,'/api/workbooks','POST',{title:'Native document',format});
  assert.equal(result.status,201,JSON.stringify(result.body));
  assert.equal(result.body.format,format);assert.equal(result.body.document.format,format);
  return result.body;
}

test('additive format migration preserves existing workbooks',async()=>{
  const db=await mf.getD1Database('DB');
  assert.deepEqual(await db.prepare("SELECT id,doc_id,content_key,format FROM workbooks WHERE id='legacy'").first(),{id:'legacy',doc_id:'legacy-doc',content_key:'legacy-key',format:'bento/dash'});
});
for(const format of ['bento/type','bento/slides'] as const){
  test(format+' creates, reopens, lists and reads native content through authenticated tools',async()=>{
    const w=await create(format),root='/api/workbooks/'+w.id;
    assert.equal((await api(null,root)).status,401);
    assert.equal((await api(viewer,root)).status,404);
    const fresh=await api(owner,root);assert.equal(fresh.body.document.docId,w.document.docId);
    assert.deepEqual(fresh.body.document,w.document);
    const listing=await api(owner,'/api/workbooks');assert.equal(listing.body.workbooks.find((x:any)=>x.id===w.id).format,format);
    const description=await api(owner,'/api/tools/describe_workbook','POST',{workbookId:w.id});
    assert.equal(description.status,200);assert.equal(description.body.format,format);
    const tool=format==='bento/type'?'read_blocks':'read_slides',key=format==='bento/type'?'blocks':'slides';
    const content=await api(owner,'/api/tools/'+tool,'POST',{workbookId:w.id,offset:0,limit:1});
    assert.equal(content.status,200);assert.equal(content.body[key].length,1);assert.equal(content.body[key][0].id,(format==='bento/type'?w.document.body:w.document.slides)[0].id);
    assert.equal((await api(owner,'/api/tools/'+tool,'POST',{workbookId:w.id,offset:0,limit:1000})).status,400);
    assert.equal((await api(owner,root+'/range?sheet=anything&range=A1:A1')).status,400);
    for(const other of ['read_range','read_dataset'])assert.equal((await api(owner,'/api/tools/'+other,'POST',{workbookId:w.id,sheetId:'anything',...(other==='read_range'?{range:'A1:A1'}:{})})).status,400);
    assert.equal((await api(owner,'/api/workbooks','POST',{title:'Wrong kind',format:format==='bento/type'?'bento/slides':'bento/type',document:w.document})).status,400);
    const imported=await api(owner,'/api/workbooks','POST',{title:'Imported',document:w.document});assert.equal(imported.status,201);assert.equal(imported.body.format,format);assert.equal(imported.body.docId,w.docId);
  });
  test(format+' viewer and scoped agents cannot bypass write or document boundaries',async()=>{
    const w=await create(format),root='/api/workbooks/'+w.id;
    await api(owner,root+'/members','POST',{email:viewer.email,role:'viewer'});
    assert.equal((await api(viewer,root)).status,200);
    const edit={baseRevision:0,operationId:crypto.randomUUID(),summary:'Forbidden write',patches:[{op:'invalid'}]};
    assert.equal((await api(viewer,root+'/changes','POST',edit)).status,403);
    assert.equal((await api(viewer,root+'/proposals','POST',edit)).status,403);
    const agent=await api(owner,root+'/agents','POST',{name:'Native reader',permission:'read',expiresDays:1});assert.equal(agent.status,201);
    const token=agent.body.token,tool=format==='bento/type'?'read_blocks':'read_slides';
    assert.equal((await api(token,'/api/tools/'+tool,'POST',{workbookId:w.id})).status,200);
    assert.equal((await api(token,root+'/changes','POST',edit)).status,403);
    const other=await create(format);assert.equal((await api(token,'/api/workbooks/'+other.id)).status,404);
    await api(owner,root+'/agents/'+agent.body.id,'DELETE');
    assert.equal((await api(token,'/api/tools/'+tool,'POST',{workbookId:w.id})).status,401);
  });
}

for(const format of ['bento/type','bento/slides'] as const){
  test(format+' persists independent edits, rejects conflicts, and accepts then safely undoes agent proposals',async()=>{
    const w=await create(format),root='/api/workbooks/'+w.id;
    const patch=(doc:any,text:string)=>format==='bento/type'
      ? {op:'setBlock',id:doc.body[0].id,block:{...doc.body[0],text}}
      : {op:'setSlideProps',slide:doc.slides[0].id,props:{notes:text}};
    const content=(doc:any)=>format==='bento/type'?doc.body[0].text:doc.slides[0].notes;
    const input=(baseRevision:number,patches:unknown[])=>({baseRevision,operationId:crypto.randomUUID(),summary:'Modifica documento',patches});
    const title=input(0,[{op:'setTitle',title:'New title'}]),body=input(0,[patch(w.document,'Human content')]);
    const results=await Promise.all([api(owner,root+'/changes','POST',title),api(owner,root+'/changes','POST',body)]);
    assert.deepEqual(results.map(r=>r.status),[200,200],JSON.stringify(results));
    const saved=await api(owner,root);assert.equal(saved.body.revision,2);assert.equal(saved.body.document.title,'New title');assert.equal(content(saved.body.document),'Human content');
    const replay=await api(owner,root+'/changes','POST',title);assert.equal(replay.status,200);assert.equal(replay.body.changeId,results[0].body.changeId);
    assert.equal((await api(owner,root+'/changes','POST',input(0,[{op:'setTitle',title:'Stale overwrite'}]))).status,409);
    assert.equal((await api(owner,root+'/changes/'+results[0].body.changeId+'/undo','POST',{operationId:crypto.randomUUID()})).status,200);
    const baseline=(await api(owner,root)).body;
    assert.equal(baseline.document.title,w.document.title);assert.equal(content(baseline.document),'Human content');
    const agent=await api(owner,root+'/agents','POST',{name:'Native reviewer',permission:'propose',expiresDays:1});
    const proposalInput=input(baseline.revision,[patch(baseline.document,'Agent proposal')]);
    const proposal=await api(agent.body.token,'/api/tools/propose_change','POST',{workbookId:w.id,...proposalInput});
    assert.equal(proposal.status,200,JSON.stringify(proposal.body));
    assert.equal(content((await api(owner,root)).body.document),'Human content');
    const proposedDetail=await api(owner,root+'/proposals/'+proposal.body.id);assert.ok(proposedDetail.body.differences.length>0);
    const acceptPath=root+'/proposals/'+proposal.body.id+'/accept';
    assert.equal((await api(agent.body.token,acceptPath,'POST',{operationId:crypto.randomUUID()})).status,403);
    const accepted=await api(owner,acceptPath,'POST',{operationId:crypto.randomUUID()});assert.equal(accepted.status,200,JSON.stringify(accepted.body));
    assert.equal(content((await api(owner,root)).body.document),'Agent proposal');
    assert.equal((await api(owner,root+'/changes/'+accepted.body.changeId+'/undo','POST',{operationId:crypto.randomUUID()})).status,200);
    const final=(await api(owner,root)).body;
    assert.equal(content(final.document),'Human content');assert.equal(final.docId,w.docId);assert.equal(final.format,format);
    assert.equal((await api(owner,root+'?revision=0')).body.document.docId,w.docId);
    const malicious=input(final.revision,[{op:'setDocProps',props:{docId:'forged',format:'bento/dash'}}]);
    assert.equal((await api(owner,root+'/changes','POST',malicious)).status,400);
    const stale=await api(owner,root+'/proposals','POST',input(final.revision,[patch(final.document,'Outdated suggestion')]));
    await api(owner,root+'/changes','POST',input(final.revision,[patch(final.document,'Latest content')]));
    assert.equal((await api(owner,root+'/proposals/'+stale.body.id+'/accept','POST',{operationId:crypto.randomUUID()})).status,409);
  });
}

test('native read tools are discoverable and usable over actual authenticated MCP transport',async()=>{
  for(const format of ['bento/type','bento/slides'] as const){
    const w=await create(format),root='/api/workbooks/'+w.id;
    const agent=await api(owner,root+'/agents','POST',{name:'MCP native reader',permission:'read',expiresDays:1});
    const transport=new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'),{
      requestInit:{headers:{authorization:'Bearer '+agent.body.token}},
      fetch:async(input,init)=>{
        const req=new Request(input,init),res=await mf.dispatchFetch(req.url,{method:req.method,headers:Object.fromEntries(req.headers),body:req.method==='POST'?await req.text():undefined});
        return new Response(await res.arrayBuffer(),{status:res.status,headers:Object.fromEntries(res.headers)});
      },
    });
    const client=new Client({name:'bento-native-test',version:'1.0.0'});
    try{
      await client.connect(transport);
      const tools=await client.listTools();
      assert.ok(tools.tools.some(t=>t.name==='read_blocks'));assert.ok(tools.tools.some(t=>t.name==='read_slides'));
      const name=format==='bento/type'?'read_blocks':'read_slides',key=format==='bento/type'?'blocks':'slides';
      const read=await client.callTool({name,arguments:{workbookId:w.id,limit:1}});
      assert.equal(read.isError,undefined);assert.equal(JSON.parse((read.content as any)[0].text)[key].length,1);
      const denied=await client.callTool({name:format==='bento/type'?'read_slides':'read_blocks',arguments:{workbookId:w.id}});
      assert.equal(denied.isError,true);assert.equal(JSON.parse((denied.content as any)[0].text).error.code,'invalid_format');
    }finally{await client.close();}
  }
});

for(const format of ['bento/dash','bento/type','bento/slides'] as const){
  test('create_workbook tool persists '+format+' and safely retries concurrent creation',async()=>{
    const input={title:'Prova MCP',format,operationId:crypto.randomUUID()};
    const results=await Promise.all([api(owner,'/api/tools/create_workbook','POST',input),api(owner,'/api/tools/create_workbook','POST',input)]);
    for(const result of results)assert.equal(result.status,200,JSON.stringify(result.body));
    assert.equal(results[0].body.id,results[1].body.id);
    assert.equal(results[0].body.docId,results[1].body.docId);
    const saved=await api(owner,'/api/workbooks/'+results[0].body.id);
    assert.equal(saved.body.document.format,format);assert.equal(saved.body.document.title,input.title);
    assert.equal((await api(owner,'/api/tools/create_workbook','POST',{...input,title:'Different'})).status,409);
    const again=await api(owner,'/api/tools/create_workbook','POST',input);assert.equal(again.body.id,saved.body.id);
    const history=await api(owner,'/api/tools/list_changes','POST',{workbookId:saved.body.id});
    assert.equal(history.body.changes[0].actor_kind,'browser_agent');
  });
}
test('create_workbook tool rejects invalid inputs, unauthenticated callers and document-scoped agents',async()=>{
  const input={title:'New file',format:'bento/slides',operationId:crypto.randomUUID()};
  assert.equal((await api(null,'/api/tools/create_workbook','POST',input)).status,401);
  for(const invalid of [{...input,title:'  '},{...input,format:'anything'},{title:'Missing id',format:'bento/slides'},{...input,ownerId:'someone-else'}])
    assert.equal((await api(owner,'/api/tools/create_workbook','POST',invalid)).status,400);
  const w=await create('bento/slides');
  for(const permission of ['read','propose','write']){
    const agent=await api(owner,'/api/workbooks/'+w.id+'/agents','POST',{name:'Scoped agent',permission,expiresDays:1});
    assert.equal((await api(agent.body.token,'/api/tools/create_workbook','POST',input)).status,403);
  }
});

test('slide text tool supplies native required fields and remains a proposal',async()=>{
 const w=await create('bento/slides');
 const saved=await api(owner,'/api/workbooks/'+w.id);
 const result=await api(owner,'/api/tools/propose_slide_text','POST',{workbookId:w.id,slideId:saved.body.document.slides[0].id,text:'WebMCP <title>',baseRevision:0,operationId:crypto.randomUUID(),summary:'Add title'});
 assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.status,'pending');
 assert.equal((await api(owner,'/api/workbooks/'+w.id)).body.revision,0);
});
