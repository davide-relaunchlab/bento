import test from 'node:test';
import assert from 'node:assert/strict';
import {registerWebMCP} from '../client/webmcp.ts';
test('browser context defaults to the open file and preserves actionable errors',async()=>{
 const registered=new Map<string,any>();
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch;
 Object.assign(globalThis,{document:{modelContext:{registerTool:(t:any)=>registered.set(t.name,t)}}});
 let received:any;
 globalThis.fetch=async(_url,options)=>{received=JSON.parse(options!.body as string);return Response.json({error:{code:'invalid_document',message:'Missing fontFamily',details:{field:'fontFamily'}}},{status:400});};
 try{
 const registration=registerWebMCP(async()=>{},async()=>{},()=>({page:'editor',app:'slides',workbookId:'current-id',title:'Current',revision:3}));
 assert.equal((await registered.get('get_page_context').execute({})).workbookId,'current-id');
 const result=await registered.get('propose_change').execute({baseRevision:3});
 assert.equal((received as any).workbookId,'current-id');assert.equal(result.isError,true);assert.equal(result.error.code,'invalid_document');
 assert.match(result.error.message,/fontFamily/);registration.dispose();
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;}
});

test('dashboard requires a target; context follows navigation and explicit targets are preserved',async()=>{
 const registered=new Map<string,any>();const oldDoc=globalThis.document,oldFetch=globalThis.fetch;
 Object.assign(globalThis,{document:{modelContext:{registerTool:(t:any)=>registered.set(t.name,t)}}});
 let current:any={page:'dashboard'},received:any;
 globalThis.fetch=async(_url,options)=>{received=JSON.parse(options!.body as string);return Response.json({ok:true});};
 try{
 registerWebMCP(async()=>{},async()=>{},()=>current);
 assert.equal((await registered.get('describe_workbook').execute({})).error.code,'missing_context');assert.equal(received,undefined);
 current={page:'editor',app:'type',workbookId:'document-b'};
 assert.equal((await registered.get('get_page_context').execute({})).app,'type');
 await registered.get('read_blocks').execute({});assert.equal((received as any).workbookId,'document-b');
 await registered.get('read_blocks').execute({workbookId:'explicit-file'});assert.equal((received as any).workbookId,'explicit-file');
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;}
});

test('a successful edit remains successful if refreshing the editor fails',async()=>{
 const registered=new Map<string,any>();const oldDoc=globalThis.document,oldFetch=globalThis.fetch;
 Object.assign(globalThis,{document:{modelContext:{registerTool:(t:any)=>registered.set(t.name,t)}}});
 globalThis.fetch=async()=>Response.json({changeId:'saved-change',revision:5});
 try{
  registerWebMCP(async()=>{throw new Error('Refresh failed');},async()=>{},()=>({page:'editor',workbookId:'current'}));
  const result=await registered.get('apply_change').execute({});
  assert.equal(result.isError,undefined);assert.equal(result.changeId,'saved-change');assert.match(result.refreshWarning,/riuscita/);
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;}
});

test('unknown explicit target gets recovery guidance and never falls back to another file',async()=>{
 const registered=new Map<string,any>();const oldDoc=globalThis.document,oldFetch=globalThis.fetch;let received:any;
 Object.assign(globalThis,{document:{modelContext:{registerTool:(t:any)=>registered.set(t.name,t)}}});
 globalThis.fetch=async(_url,options)=>{received=JSON.parse(options!.body as string);return Response.json({error:{code:'not_found',message:'Documento non disponibile.'}},{status:404});};
 try{
  registerWebMCP(async()=>{},async()=>{},()=>({page:'editor',workbookId:'current'}));
  const result=await registered.get('apply_change').execute({workbookId:'wrong-id'});
  assert.equal(received.workbookId,'wrong-id');assert.equal(result.error.code,'not_found');assert.match(result.error.recovery,/get_page_context/);
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;}
});
test('deleting the open workbook returns to the archive without refreshing a removed document',async()=>{
 const registered=new Map<string,any>();const oldDoc=globalThis.document,oldFetch=globalThis.fetch,oldLocation=globalThis.location;let target='',refreshed=false;
 Object.assign(globalThis,{document:{modelContext:{registerTool:(t:any)=>registered.set(t.name,t)}},location:{assign:(url:string)=>{target=url;}}});
 globalThis.fetch=async()=>Response.json({deleted:true,workbookId:'current'});
 try{
  registerWebMCP(async()=>{refreshed=true;},async()=>{},()=>({page:'editor',workbookId:'current'}));
  const result=await registered.get('delete_workbook').execute({baseRevision:0});assert.equal(result.deleted,true);assert.equal(target,'/');assert.equal(refreshed,false);
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;globalThis.location=oldLocation;}
});
