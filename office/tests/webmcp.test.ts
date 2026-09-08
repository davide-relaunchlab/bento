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
