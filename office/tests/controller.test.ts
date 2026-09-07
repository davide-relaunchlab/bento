import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkbookController} from '../client/controller.ts';
import {type Snapshot,type api} from '../client/api.ts';
import {Store,type Patch} from '../../dash/src/store.ts';
import {newWorkbook,prepareChange,applyPrepared,type PreparedChange} from '../shared/changes.ts';

function harness(document=newWorkbook('Test','controller-doc')){
  let saved:Snapshot={id:'workbook',title:document.title,revision:0,role:'owner',document,agentPermission:null};
  const receipts=new Map<string,any>(),changes=new Map<string,PreparedChange>();
  let failRead=false,loseReply=false;
  const operations:string[]=[];
  const request=(async(path:string,method='GET',input?:any)=>{
    if(method==='GET'){if(failRead)throw new Error('offline');return structuredClone(saved);}
    operations.push(input.operationId);
    if(receipts.has(input.operationId))return receipts.get(input.operationId);
    let next;
    if(path.endsWith('/undo'))next=await applyPrepared(saved.document,changes.get(path.split('/').at(-2)!)!,'undo');
    else next=await applyPrepared(saved.document,await prepareChange(saved.document,input.patches));
    const prepared=await prepareChange(saved.document,input.patches??changes.get(path.split('/').at(-2)!)!.inverse);
    const changeId=crypto.randomUUID();changes.set(changeId,prepared);
    saved={...saved,revision:saved.revision+1,document:next};
    const receipt={changeId,revision:saved.revision};receipts.set(input.operationId,receipt);
    if(loseReply){loseReply=false;throw new Error('reply lost');}return receipt;
  }) as typeof api;
  const c=new WorkbookController(structuredClone(saved),request),store=new Store(structuredClone(document));
  c.attach(store,{showingSheet:()=>store.doc.sheets[0].id,showSheet:()=>{}});
  return {c,store,operations,changes,get saved(){return saved;},failRead(v:boolean){failRead=v;},loseReply(){loseReply=true;}};
}
const cells=(value:number):Patch=>({op:'setCanvasCells',sheet:'sheet-1',cells:{A1:{v:value}}});

test('queued keystrokes persist in order and uncertain replies reuse the logical operation',async()=>{
  const h=harness();try{
    h.loseReply();h.store.commit(cells(1));h.store.commit(cells(2));
    await assert.rejects(h.c.flush(),/reply lost/);assert.equal(h.c.pending,true);
    await h.c.retry();assert.equal(h.saved.revision,2);assert.equal((h.store.doc.sheets[0] as any).cells.A1.v,2);
    assert.equal(h.operations[0],h.operations[1]);assert.notEqual(h.operations[1],h.operations[2]);
  }finally{h.c.dispose();}
});
test('failed reload retains the unsaved draft and its pending transaction',async()=>{
  const h=harness();try{
    h.failRead(true);h.store.commit(cells(17));await assert.rejects(h.c.flush(),/offline/);
    await assert.rejects(h.c.discardLocal(),/offline/);
    assert.equal(h.c.pending,true);assert.equal((h.store.doc.sheets[0] as any).cells.A1.v,17);
    h.failRead(false);await h.c.retry();assert.equal(h.saved.revision,1);assert.equal(h.c.pending,false);
  }finally{h.c.dispose();}
});
test('column property deletion survives the UI to HTTP serialization boundary',async()=>{
  const doc=newWorkbook('Dataset','column-doc');doc.sheets=[{id:'data',kind:'table',name:'Data',rids:[[1,1]],columns:[{id:'n',name:'Amount',type:'number',format:'0.00',formula:'1+1',validate:{kind:'number'}}],data:{n:{enc:'raw',v:[1]}},steps:[]}] as any;
  const h=harness(doc);try{
    h.store.commit({op:'setColumn',sheet:'data',col:'n',patch:{format:undefined,formula:undefined,validate:undefined}});
    await h.c.flush();const column=(h.saved.document.sheets[0] as any).columns[0];
    for(const key of ['format','formula','validate'])assert.equal(key in column,false);
  }finally{h.c.dispose();}
});
test('review retry uses one operation even when the committed snapshot reply fails',async()=>{
  const h=harness();try{
    h.store.commit(cells(3));await h.c.flush();
    const historyId=[...h.changes.keys()][0];
    h.failRead(true);await assert.rejects(h.c.review('/changes/'+historyId+'/undo'),/offline/);
    assert.equal(h.saved.revision,2);h.failRead(false);await h.c.retry();
    assert.equal(h.saved.revision,2);assert.equal(h.operations.at(-1),h.operations.at(-2));
    assert.equal((h.store.doc.sheets[0] as any).cells.A1,undefined);
  }finally{h.c.dispose();}
});
