import type { Store,Patch } from '../../dash/src/store.ts';
import type {NativeEditorAdapter} from '../shared/editor-host.ts';
import {diffNative,canonical,type OfficeDocument,type NativeDocument,type NativePatch} from '../shared/content.ts';
import { prepareChange,previewChange,applyPrepared,type PreparedChange } from '../shared/content.ts';
import { api,HttpError,type Snapshot } from './api.ts';
type Pending={base?:OfficeDocument;started?:boolean;operationId:string;summary:string;patches:(Patch|NativePatch)[];prepared:Promise<PreparedChange>;request?:{baseRevision:number;operationId:string;summary:string;patches:(Patch|NativePatch)[]}};
type View={showingSheet:()=>string;showSheet:(id:string)=>void};
export class WorkbookController {
  store?:{doc:OfficeDocument;readOnly:boolean;changedRemotely:(...args:any[])=>void};
  private native?:NativeEditorAdapter;
  private nativeBaseline?:NativeDocument;
  private deferred=false;
  private view?:View;
  private queue:Pending[]=[];
  private processing?:Promise<void>;
  private epoch=0;
  private timer?:ReturnType<typeof setInterval>;
  private saveTimer?:ReturnType<typeof setTimeout>;
  private undoIds:string[]=[];
  private redoIds:string[]=[];
  private reviewing=false;
  private reversing?:Promise<void>;
  private reviewOperations=new Map<string,string>();
  private retryReview?:()=>Promise<unknown>;
  error:Error|null=null;
  private draftError:Error|null=null;
  onState:()=>void=()=>{};
  summaryFor:(patches:(Patch|NativePatch)[])=>string=()=> 'Workbook updated';
  constructor(public confirmed:Snapshot<OfficeDocument>,private request=api){}
  get root(){return '/api/workbooks/'+encodeURIComponent(this.confirmed.id);}
  get pending(){return this.queue.length>0||this.reviewing;}
  get readOnly(){return this.confirmed.role==='viewer';}
  get revision(){return this.confirmed.revision;}
  get canUndo(){return !this.pending&&!this.readOnly&&this.undoIds.length>0;}
  get canRedo(){return !this.pending&&!this.readOnly&&this.redoIds.length>0;}
  attach(store:Store,view:View) {
    this.store=store;this.view=view;store.readOnly=this.readOnly;
    store.delegate={commit:p=>this.commit(p),undo:()=>this.undo(),redo:()=>this.redo(),canUndo:()=>this.canUndo,canRedo:()=>this.canRedo,
      replaceDoc:()=>{throw new Error('Apri o importa il file dalla raccolta per conservarne identità e permessi.');}};
    this.timer=setInterval(()=>void this.refresh(),3000);
  }
  attachNative(adapter:NativeEditorAdapter) {
    this.native=adapter;this.nativeBaseline=structuredClone(adapter.read());
    this.store={get doc(){return adapter.read();},set doc(next){adapter.adopt(next as NativeDocument);},get readOnly(){return false;},set readOnly(v){adapter.setReadOnly(v);},changedRemotely:()=>{}};
    adapter.setReadOnly(this.readOnly);this.timer=setInterval(()=>void this.refresh(),3000);
  }
  notifyEditor(){this.native?.stateChanged?.();}
  get editing(){return this.native?.isEditing()??false;}
  nativeChanged(next:NativeDocument){
    try{
      if(this.readOnly||this.reviewing||!this.nativeBaseline)throw new Error('Il documento è in sola lettura.');
      next=JSON.parse(JSON.stringify(next));
      const base=this.nativeBaseline,patches=diffNative(base,next);
      if(patches.length)this.enqueue(patches,base);
      this.nativeBaseline=structuredClone(next);
      if(this.draftError){this.draftError=null;this.error=null;if(this.queue.length)this.start();this.onState();}
    }catch(error){this.draftError=error as Error;this.error=this.draftError;this.onState();throw error;}
  }
  dispose(){clearInterval(this.timer);clearTimeout(this.saveTimer);}
  private show(doc:OfficeDocument,force=false) {
    if(this.native&&doc.format!=='bento/dash'){
      if(this.draftError&&!force){this.onState();return;}
      this.native.setReadOnly(this.readOnly||this.reviewing);
      const equal=(a:NativeDocument,b:NativeDocument)=>{const {modified:_,...aa}=a,{modified:__,...bb}=b;return canonical(aa)===canonical(bb);};
      if(!force&&this.native.isEditing()&&!equal(this.native.read(),doc)){this.deferred=true;this.onState();return;}
      this.native.adopt(structuredClone(doc));this.nativeBaseline=structuredClone(doc);this.deferred=false;this.onState();return;
    }
    if(!this.store||!this.view||doc.format!=='bento/dash')return;
    this.store.doc=structuredClone(doc);this.store.readOnly=this.readOnly;
    if(!doc.sheets.some(s=>s.id===this.view!.showingSheet()))this.view.showSheet(doc.sheets[0].id);
    this.store.changedRemotely({all:true},false);
    this.onState();
  }
  commit(input:Patch|Patch[]) {
    if(this.readOnly||this.reviewing||!this.store)return;
    try {
      // Match the actual HTTP serialization, including optional import fields.
      // Explicit property deletions are represented by a drop list.
      const explicit=(Array.isArray(input)?input:[input]).map(p=>p.op==='setColumn'?{
        ...p,drop:[...new Set([...(p as typeof p&{drop?:string[]}).drop??[],...Object.keys(p.patch).filter(k=>p.patch[k]===undefined)])],
      }:p);
      const patches=JSON.parse(JSON.stringify(explicit)) as Patch[];
      this.enqueue(patches,structuredClone(this.store.doc));
    } catch(error) {this.error=error as Error;this.onState();}
  }
  private enqueue(patches:(Patch|NativePatch)[],base:OfficeDocument){
    const tail=this.native?this.queue.at(-1):undefined;
    if(tail&&!tail.started&&!tail.request&&tail.base&&tail.base.format!=='bento/dash'&&base.format!=='bento/dash'){
      const next=previewChange(base,patches).next as NativeDocument;patches=diffNative(tail.base,next);base=tail.base;this.queue.pop();
      if(!patches.length){this.epoch++;this.onState();return;}
    }
    const preview=previewChange(base,patches);
    const pending:Pending={base,operationId:crypto.randomUUID(),summary:this.summaryFor(patches),patches:preview.patches,prepared:prepareChange(base,patches)};
    // Report async validation rejection through the save queue, never an unhandled promise.
    void pending.prepared.catch(()=>{});
    this.queue.push(pending);this.epoch++;this.redoIds=[];
    if(!this.native)this.show(preview.next);else this.onState();
    if(!this.error){if(this.native){clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.start(),400);}else this.start();}
  }
  private start() {
    clearTimeout(this.saveTimer);
    if(this.processing)return;
    this.processing=this.drain().finally(()=>{this.processing=undefined;this.onState();});
  }
  private async drain() {
    while(this.queue.length) {
      const item=this.queue[0];item.started=true;
      try {
        if(!item.request) {
          await applyPrepared(this.confirmed.document,await item.prepared);
          item.request={baseRevision:this.confirmed.revision,operationId:item.operationId,summary:item.summary,patches:item.patches};
        }
        const receipt=await this.request<{changeId:string;revision:number}>(this.root+'/changes','POST',item.request);
        const snapshot=await this.request<Snapshot<OfficeDocument>>(this.root);
        if(snapshot.revision<receipt.revision)throw new Error('La versione salvata non è ancora disponibile. Riprova il salvataggio.');
        this.queue.shift();this.undoIds.push(receipt.changeId);this.confirmed=snapshot;
        await this.rebuildDraft();
      } catch(error) {
        this.error=error as Error;
        if(error instanceof HttpError&&(error.status===401||error.status===403||error.status===404))this.confirmed.role='viewer';
        if(this.store)this.store.readOnly=this.readOnly;
        this.onState();return;
      }
    }
  }
  private async rebuildDraft() {
    // Keystrokes may arrive during hashing/fetching. Never adopt a reconstruction
    // that omitted an edit added while we were awaiting its predecessor.
    while(true) {
      const epoch=this.epoch,items=this.queue.slice();let doc=this.confirmed.document;
      for(const item of items)doc=await applyPrepared(doc,await item.prepared);
      if(epoch!==this.epoch)continue;
      this.show(doc);return;
    }
  }
  async flush() {
    if(this.reversing){await this.reversing;if(this.error)throw this.error;}
    if(this.draftError)throw this.draftError;
    this.error=null;this.start();await this.processing;
    if(this.error)throw this.error;
  }
  async refresh() {
    if(this.pending||this.processing||this.error)return;
    const epoch=this.epoch;
    try {
      const snapshot=await this.request<Snapshot<OfficeDocument>>(this.root);
      if(epoch!==this.epoch||this.pending||this.processing)return;
      if(snapshot.revision<this.revision)return;
      const changed=snapshot.revision!==this.revision||snapshot.role!==this.confirmed.role;
      this.confirmed=snapshot;if(changed||this.deferred)this.show(snapshot.document);
      this.onState();
    } catch(error) {this.error=error as Error;if(error instanceof HttpError&&[401,403,404].includes(error.status)){this.confirmed.role='viewer';if(this.store)this.store.readOnly=true;}this.onState();}
  }
  undo(){if(!this.canUndo)return false;this.reversing=this.reverse(false).finally(()=>{this.reversing=undefined;});return true;}
  redo(){if(!this.canRedo)return false;this.reversing=this.reverse(true).finally(()=>{this.reversing=undefined;});return true;}
  private async reverse(redo:boolean) {
    const stack=redo?this.redoIds:this.undoIds,id=stack.at(-1)!;
    const path='/changes/'+id+'/undo';
    this.reviewing=true;if(this.store)this.store.readOnly=true;this.onState();
    try {
      const operationId=this.reviewOperations.get(path)??crypto.randomUUID();this.reviewOperations.set(path,operationId);
      const result=await this.request<{changeId:string}>(this.root+path,'POST',{operationId});
      const snapshot=await this.request<Snapshot<OfficeDocument>>(this.root);
      stack.pop();(redo?this.undoIds:this.redoIds).push(result.changeId);this.confirmed=snapshot;this.error=null;
      this.reviewOperations.delete(path);this.retryReview=undefined;
      this.show(snapshot.document,true);
    }catch(error){this.error=error as Error;this.retryReview=()=>this.reverse(redo);}
    finally{this.reviewing=false;if(this.store){this.store.readOnly=this.readOnly;this.store.changedRemotely({all:true},false);}this.onState();}
  }
  async review(path:string,operation=true) {
    await this.flush();this.reviewing=true;if(this.store)this.store.readOnly=true;this.onState();
    try {
      const operationId=this.reviewOperations.get(path)??crypto.randomUUID();this.reviewOperations.set(path,operationId);
      const result=await this.request<any>(this.root+path,'POST',operation?{operationId}:{});
      const snapshot=await this.request<Snapshot<OfficeDocument>>(this.root);this.confirmed=snapshot;
      this.reviewOperations.delete(path);this.retryReview=undefined;
      if(result.changeId)this.undoIds.push(result.changeId);this.show(snapshot.document,true);return result;
    }catch(error){this.error=error as Error;this.retryReview=()=>this.review(path,operation);throw error;}
    finally{this.reviewing=false;if(this.store)this.store.readOnly=this.readOnly;this.onState();}
  }
  async retry(){if(this.retryReview)await this.retryReview();else{await this.flush();await this.refresh();}}
  async discardLocal() {
    if(this.processing)await this.processing;
    const snapshot=await this.request<Snapshot<OfficeDocument>>(this.root);
    this.queue=[];this.epoch++;this.error=null;this.draftError=null;this.retryReview=undefined;this.confirmed=snapshot;this.show(snapshot.document,true);
  }
}
