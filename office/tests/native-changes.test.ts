import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultText} from '../../slides/src/model.ts';
import {newWorkbook,diffNative,prepareChange,applyPrepared,validateWorkbook,type NativeDocument} from '../shared/content.ts';

export function nativeFixture(format:'bento/type'|'bento/slides'):NativeDocument {
  const d=newWorkbook('Native regression',format) as NativeDocument;
  if(d.format==='bento/type')d.body=[{id:'a',kind:'para',text:'Alpha'},{id:'b',kind:'para',text:'Beta'},{id:'c',kind:'para',text:'Gamma'}];
  else {
    const slide=d.slides[0];slide.id='slide';
    slide.elements=['a','b','c'].map((id,i)=>defaultText({id,html:id,x:i*100,y:0,w:100,h:50}));
    d.slides.push({...structuredClone(slide),id:'other',elements:[]});
  }
  return d;
}
const contentKey=(d:NativeDocument)=>d.format==='bento/type'?'text':'html';
const items=(d:NativeDocument):any[]=>d.format==='bento/type'?d.body:d.slides[0].elements;
async function mutation(base:NativeDocument,fn:(d:NativeDocument)=>void){const next=structuredClone(base);fn(next);return prepareChange(base,diffNative(base,next));}
const conflict=(error:any)=>error?.code==='conflict'&&error?.status===409;
for(const format of ['bento/type','bento/slides'] as const){
 test(`${format}: independent targets merge, same target conflicts and undo preserves remote content`,async()=>{
  const base=nativeFixture(format);
  const local=await mutation(base,d=>{items(d)[0][contentKey(d)]='Local';});
  const remote=await mutation(base,d=>{items(d)[1][contentKey(d)]='Remote';});
  const collision=await mutation(base,d=>{items(d)[0][contentKey(d)]='Collision';});
  const merged=await applyPrepared(await applyPrepared(base,local),remote) as NativeDocument;
  assert.equal(items(merged)[0][contentKey(merged)],'Local');assert.equal(items(merged)[1][contentKey(merged)],'Remote');
  await assert.rejects(applyPrepared(merged,collision),conflict);
  const undone=await applyPrepared(merged,local,'undo') as NativeDocument;
  assert.equal(items(undone)[0][contentKey(undone)],items(base)[0][contentKey(base)]);assert.equal(items(undone)[1][contentKey(undone)],'Remote');
  const later=await mutation(merged,d=>{items(d)[0][contentKey(d)]='Newer';});
  await assert.rejects(applyPrepared(await applyPrepared(merged,later),local,'undo'),conflict);
 });
 test(`${format}: reorder and its undo preserve a concurrent content edit`,async()=>{
  const base=nativeFixture(format),reorder=await mutation(base,d=>{items(d).reverse();});
  const remote=await mutation(base,d=>{items(d)[1][contentKey(d)]='Remote';});
  const merged=await applyPrepared(await applyPrepared(base,remote),reorder) as NativeDocument;
  assert.deepEqual(items(merged).map(x=>x.id),['c','b','a']);
  const undone=await applyPrepared(merged,reorder,'undo') as NativeDocument;
  assert.deepEqual(items(undone).map(x=>x.id),['a','b','c']);assert.equal(items(undone)[1][contentKey(undone)],'Remote');
 });
 test(`${format}: deletion undo restores position without replacing an independently edited target`,async()=>{
  const base=nativeFixture(format),deletion=await mutation(base,d=>{items(d).splice(1,1);});
  const deleted=await applyPrepared(base,deletion) as NativeDocument;
  const remote=await mutation(deleted,d=>{items(d)[0][contentKey(d)]='Remote';});
  const reverted=await applyPrepared(await applyPrepared(deleted,remote),deletion,'undo') as NativeDocument;
  assert.deepEqual(items(reverted).map(x=>x.id),['a','b','c']);assert.equal(items(reverted)[0][contentKey(reverted)],'Remote');
  assert.equal(items(reverted)[1][contentKey(reverted)],items(base)[1][contentKey(base)]);
  validateWorkbook(reverted);
 });
 test(`${format}: deletion never erases a target changed after preparation`,async()=>{
  const base=nativeFixture(format),deletion=await mutation(base,d=>{items(d).splice(1,1);});
  const remote=await mutation(base,d=>{items(d)[1][contentKey(d)]='Remote';});
  await assert.rejects(applyPrepared(await applyPrepared(base,remote),deletion),conflict);
 });
}
for(const [key,value] of [['citeStyle','numeric'],['sections',{numbered:true}]] as const){
 test(`bento/type: real editor ${key} setting persists and can be undone`,async()=>{
  const base=nativeFixture('bento/type'),next=structuredClone(base);
  (next as any)[key]=value;
  const patches=diffNative(base,next);
  assert.notEqual(patches.length,0,`${key} is an actual editor setting, not a transient view preference`);
  const prepared=await prepareChange(base,patches);
  const saved=await applyPrepared(base,prepared);
  assert.deepEqual((saved as any)[key],value);
  const undone=await applyPrepared(saved,prepared,'undo');
  assert.equal(key in undone,false);
 });
}
