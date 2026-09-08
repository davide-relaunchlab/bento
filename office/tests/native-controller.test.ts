import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkbookController} from '../client/controller.ts';
import {type Snapshot,type api} from '../client/api.ts';
import {newWorkbook,diffNative,prepareChange,applyPrepared,type PreparedChange,type NativeDocument,type OfficeDocument} from '../shared/content.ts';
import type {NativeEditorAdapter} from '../shared/editor-host.ts';

function fixture(){const doc=newWorkbook('Native','bento/type') as Extract<NativeDocument,{format:'bento/type'}>;doc.body=[{id:'a',kind:'para',text:'Alpha'},{id:'b',kind:'para',text:'Beta'}];return doc;}
function harness(){
 let saved:Snapshot<OfficeDocument>={id:'native',title:'Native',revision:0,role:'owner',document:fixture(),agentPermission:null};
 let local=structuredClone(saved.document) as ReturnType<typeof fixture>,editing=false,reader=false,adoptions=0,rejectWrites=false;
 let writeGate:Promise<void>|undefined,signalWrite:(()=>void)|undefined;
 const changes=new Map<string,PreparedChange>(),history=new Map<number,OfficeDocument>([[0,structuredClone(saved.document)]]);
 const request=(async(path:string,method='GET',input?:any)=>{
  if(method==='GET')return structuredClone(saved);
  if(rejectWrites)throw new Error('offline');
  if(writeGate){const gate=writeGate;writeGate=undefined;signalWrite?.();await gate;}
  let prepared:PreparedChange;
  if(path.endsWith('/undo')){
   const original=changes.get(path.split('/').at(-2)!)!;
   await applyPrepared(saved.document,original,'undo');
   prepared=await prepareChange(saved.document,original.inverse);
  }else prepared=await prepareChange(history.get(input.baseRevision)!,input.patches);
  const next=await applyPrepared(saved.document,prepared),changeId=crypto.randomUUID();
  changes.set(changeId,prepared);saved={...saved,revision:saved.revision+1,document:next};history.set(saved.revision,structuredClone(next));
  return {changeId,revision:saved.revision};
 }) as typeof api;
 const controller=new WorkbookController(structuredClone(saved),request);
 const adapter:NativeEditorAdapter={read:()=>structuredClone(local),adopt(next){local=structuredClone(next) as typeof local;adoptions++;},setReadOnly(v){reader=v;},isEditing:()=>editing};
 controller.attachNative(adapter);
 return {controller,edit(id:string,text:string){local.body.find(b=>b.id===id)!.text=text;controller.nativeChanged(local);},focus(v:boolean){editing=v;},rejectWrites(v:boolean){rejectWrites=v;},
  async remote(id:string,text:string){const next=structuredClone(saved.document) as typeof local;next.body.find(b=>b.id===id)!.text=text;const prepared=await prepareChange(saved.document,diffNative(saved.document as NativeDocument,next));saved={...saved,revision:saved.revision+1,document:await applyPrepared(saved.document,prepared)};history.set(saved.revision,structuredClone(saved.document));},
  holdNextWrite(){let release!:()=>void;writeGate=new Promise<void>(r=>{release=r;});const entered=new Promise<void>(r=>{signalWrite=r;});return {release,entered};},
  get writes(){return changes.size;},get revision(){return saved.revision;},
  get local(){return local;},get saved(){return saved.document as typeof local;},get adoptions(){return adoptions;},get reader(){return reader;}};
}
async function settled(h:ReturnType<typeof harness>){for(let n=0;n<200&&h.controller.pending;n++)await new Promise(r=>setTimeout(r,5));assert.equal(h.controller.pending,false,'operation settles');if(h.controller.error)throw h.controller.error;}
test('native typing remains local during deferred remote adoption and next edit preserves remote block',async()=>{
 const h=harness();try{
  h.focus(true);await h.remote('b','Other author');await h.controller.refresh();
  assert.equal(h.local.body[1].text,'Beta');assert.equal(h.adoptions,0,'active editor has not been repainted');
  h.edit('a','Typed');await h.controller.flush();
  assert.equal(h.saved.body[0].text,'Typed');assert.equal(h.saved.body[1].text,'Other author');
  h.edit('a','Typed more');await h.controller.flush();
  assert.equal(h.saved.body[0].text,'Typed more');assert.equal(h.saved.body[1].text,'Other author','old visible block is not emitted as a new deletion/replacement');
  h.focus(false);await h.controller.refresh();assert.equal(h.local.body[1].text,'Other author');
  h.edit('a','After adoption');await h.controller.flush();assert.equal(h.saved.body[1].text,'Other author');
 }finally{h.controller.dispose();}
});
test('native explicit undo and redo adopt even with editor focus and preserve independent remote edit',async()=>{
 const h=harness();try{
  h.focus(true);h.edit('a','Local');await h.controller.flush();await h.remote('b','Other author');await h.controller.refresh();
  assert.equal(h.controller.undo(),true);await settled(h);
  assert.equal(h.local.body[0].text,'Alpha');assert.equal(h.local.body[1].text,'Other author');assert.equal(h.reader,false);
  assert.equal(h.controller.redo(),true);await settled(h);assert.equal(h.local.body[0].text,'Local');assert.equal(h.local.body[1].text,'Other author');
 }finally{h.controller.dispose();}
});
test('native rejected network mutation retains draft and retry persists it',async()=>{
 const h=harness();try{
  h.focus(true);h.rejectWrites(true);h.edit('a','Unsaved draft');await assert.rejects(h.controller.flush(),/offline/);
  assert.equal(h.local.body[0].text,'Unsaved draft');assert.equal(h.saved.body[0].text,'Alpha');assert.equal(h.controller.pending,true);
  h.rejectWrites(false);await h.controller.retry();assert.equal(h.saved.body[0].text,'Unsaved draft');assert.equal(h.controller.pending,false);
 }finally{h.controller.dispose();}
});
test('native same-target conflict preserves the rejected draft instead of repainting over it',async()=>{
 const h=harness();try{
  h.focus(true);await h.remote('a','Remote same paragraph');await h.controller.refresh();h.edit('a','My conflicting draft');
  await assert.rejects(h.controller.flush(),(e:any)=>e.code==='conflict');
  assert.equal(h.local.body[0].text,'My conflicting draft');assert.equal(h.saved.body[0].text,'Remote same paragraph');assert.equal(h.controller.pending,true);
 }finally{h.controller.dispose();}
});
test('native burst coalesces into one durable edit and explicit flush does not wait for the idle timer',async()=>{
 const h=harness();try{
  h.focus(true);for(const text of ['A','Al','Alp','Alpha typed'])h.edit('a',text);
  assert.equal(h.writes,0);await h.controller.flush();assert.equal(h.writes,1);assert.equal(h.saved.body[0].text,'Alpha typed');
  assert.equal(h.controller.undo(),true);await settled(h);assert.equal(h.local.body[0].text,'Alpha');
 }finally{h.controller.dispose();}
});
test('native coalescing cannot replace an in-flight operation and keeps a burst added during the write',async()=>{
 const h=harness();try{
  h.focus(true);const gate=h.holdNextWrite();h.edit('a','First');const flushing=h.controller.flush();await gate.entered;
  h.edit('a','First plus');h.edit('a','First plus another');h.edit('b','Second paragraph');
  gate.release();await flushing;
  assert.equal(h.writes,2,'one in-flight edit and one coalesced tail');
  assert.equal(h.saved.body[0].text,'First plus another');assert.equal(h.saved.body[1].text,'Second paragraph');
  assert.equal(h.controller.pending,false);
 }finally{h.controller.dispose();}
});
test('native reverted unsent burst produces no durable change and leaves the next baseline correct',async()=>{
 const h=harness();try{
  h.focus(true);h.edit('a','Temporary');h.edit('a','Alpha');assert.equal(h.controller.pending,false);
  await h.controller.flush();assert.equal(h.writes,0);
  h.edit('b','Next edit');await h.controller.flush();assert.equal(h.writes,1);assert.equal(h.saved.body[0].text,'Alpha');assert.equal(h.saved.body[1].text,'Next edit');
 }finally{h.controller.dispose();}
});
test('native synchronous validation failure exposes an error, preserves draft, and blocks flush until corrected',async()=>{
 const h=harness();try{
  h.local.title='x'.repeat(301);assert.throws(()=>h.controller.nativeChanged(h.local));
  assert.ok(h.controller.error);await assert.rejects(h.controller.flush());assert.equal(h.local.title.length,301);assert.equal(h.saved.title,'Native');
  h.local.title='Corrected title';h.controller.nativeChanged(h.local);await h.controller.flush();assert.equal(h.saved.title,'Corrected title');assert.equal(h.controller.error,null);
 }finally{h.controller.dispose();}
});
