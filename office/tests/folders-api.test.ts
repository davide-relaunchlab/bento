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
  temp=await mkdtemp(join(tmpdir(),'bento-folders-api-'));
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


test('personal spaces are isolated, folders inherit roles, and direct access remains explicit',async()=>{
 const folder=(await api(owner,'/api/folders','POST',{name:'Progetto'})).body;
 assert.equal((await api(viewer,'/api/folders')).body.folders.length,0);
 assert.equal((await api(viewer,'/api/folders/'+folder.id)).status,404);
 const created=await api(owner,'/api/workbooks','POST',{title:'Documento',format:'bento/type',folderId:folder.id});
 assert.equal(created.status,201,JSON.stringify(created.body));const w=created.body,root='/api/workbooks/'+w.id;
 assert.equal(w.folderId,folder.id);assert.equal(w.ownerId,owner.id);
 assert.equal((await api(viewer,root)).status,404);
 assert.equal((await api(viewer,'/api/workbooks','POST',{title:'Forbidden',folderId:folder.id})).status,404);
 assert.equal((await api(owner,'/api/folders/'+folder.id+'/members','POST',{email:viewer.email,role:'viewer'})).status,200);
 assert.equal((await api(viewer,root)).body.role,'viewer');
 assert.equal((await api(viewer,'/api/workbooks')).body.workbooks.some((v:any)=>v.id===w.id),true);
 const b=w.document.body[0],edit={baseRevision:0,operationId:'folder-edit-0001',summary:'Edit',patches:[{op:'setBlock',id:b.id,block:{...b,text:'Team edit'}}]};
 assert.equal((await api(viewer,root+'/changes','POST',edit)).status,403);
 assert.equal((await api(viewer,'/api/folders/'+folder.id,'PATCH',{name:'No'})).status,403);
 await api(owner,'/api/folders/'+folder.id+'/members','POST',{email:viewer.email,role:'editor'});
 assert.equal((await api(viewer,root)).body.role,'editor');
 assert.equal((await api(viewer,root+'/changes','POST',edit)).status,200);
 const agent=(await api(viewer,root+'/agents','POST',{name:'Folder agent',permission:'write',expiresDays:1})).body;
 assert.ok(agent.token);assert.equal((await api(agent.token,root)).status,200);
 assert.equal((await api(agent.token,'/api/folders')).status,403);
 const membership=(await api(owner,'/api/folders/'+folder.id+'/members')).body.members[0];
 await api(owner,'/api/folders/'+folder.id+'/members/'+membership.id,'DELETE');
 assert.equal((await api(viewer,root)).status,404);assert.equal((await api(agent.token,root)).status,404);
 assert.equal((await api(viewer,'/api/folders')).body.folders.length,0);
 // A direct grant survives removal of an independent folder grant.
 await api(owner,root+'/members','POST',{email:viewer.email,role:'viewer'});
 assert.equal((await api(viewer,root)).body.role,'viewer');
});
test('moving files changes inherited access without changing content, identity or direct grants',async()=>{
 const a=(await api(owner,'/api/folders','POST',{name:'A'})).body;
 const b=(await api(owner,'/api/folders','POST',{name:'B'})).body;
 const foreign=(await api(viewer,'/api/folders','POST',{name:'Foreign'})).body;
 const w=(await api(owner,'/api/workbooks','POST',{title:'Sheet',folderId:a.id})).body,root='/api/workbooks/'+w.id;
 await api(owner,'/api/folders/'+a.id+'/members','POST',{email:viewer.email,role:'editor'});
 assert.equal((await api(viewer,root)).status,200);
 assert.equal((await api(viewer,root+'/location','PATCH',{folderId:foreign.id})).status,403);
 assert.equal((await api(owner,root+'/location','PATCH',{folderId:foreign.id})).status,404);
 const moved=await api(owner,root+'/location','PATCH',{folderId:b.id});assert.equal(moved.status,200);
 assert.equal(moved.body.folderId,b.id);assert.deepEqual(moved.body.document,w.document);assert.equal(moved.body.revision,w.revision);
 assert.equal((await api(viewer,root)).status,404);
 await api(owner,'/api/folders/'+b.id+'/members','POST',{email:viewer.email,role:'viewer'});
 await api(owner,root+'/members','POST',{email:viewer.email,role:'editor'});
 assert.equal((await api(viewer,root)).body.role,'editor');
 const members=(await api(owner,root+'/members')).body.members;assert.ok(members.some((m:any)=>m.inherited===1&&m.folder_name==='B'));
 await api(owner,root+'/location','PATCH',{folderId:null});assert.equal((await api(viewer,root)).body.role,'editor');
 const folders=(await api(owner,'/api/folders')).body.folders;assert.equal(folders.find((f:any)=>f.id===b.id).file_count,0);
 assert.equal((await api(owner,'/api/folders/'+a.id,'PATCH',{name:'Renamed'})).body.name,'Renamed');
});
test('folder ACL changes invalidate the write-side guard captured before revocation',async()=>{
 const folder=(await api(owner,'/api/folders','POST',{name:'Atomic'})).body;
 const w=(await api(owner,'/api/workbooks','POST',{title:'Atomic file',folderId:folder.id})).body;
 const db=await mf.getD1Database('DB');const before=await db.prepare('SELECT acl_version FROM workbooks WHERE id=?').bind(w.id).first<{acl_version:number}>();
 await api(owner,'/api/folders/'+folder.id+'/members','POST',{email:viewer.email,role:'editor'});
 const after=await db.prepare('SELECT acl_version FROM workbooks WHERE id=?').bind(w.id).first<{acl_version:number}>();assert.equal(after!.acl_version,before!.acl_version+1);
 const stale=await db.prepare('UPDATE workbooks SET title=? WHERE id=? AND acl_version=?').bind('Stale',w.id,before!.acl_version).run();assert.equal(stale.meta.changes,0);
});
