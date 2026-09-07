import type { Store,Patch } from '../../dash/src/store.ts';
import type { DashDoc } from '../../dash/src/model.ts';
import { prepareChange,previewChange,applyPrepared,type PreparedChange } from '../shared/changes.ts';
import { api,HttpError,type Snapshot } from './api.ts';
type Pending={operationId:string;summary:string;patches:Patch[];prepared:Promise<PreparedChange>;request?:{baseRevision:number;operationId:string;summary:string;patches:Patch[]}};
type View={showingSheet:()=>string;showSheet:(id:string)=>void};
export class WorkbookController {
  store?:Store;
  private view?:View;
  private queue:Pending[]=[];
  private processing?:Promise<void>;
  private epoch=0;
  private timer?:ReturnType<typeof setInterval>;
  private undoIds:string[]=[];
  private redoIds:string[]=[];
  private reviewing=false;
  private reviewOperations=new Map<string,string>();
  private retryReview?:()=>Promise<unknown>;
  error:Error|null=null;
  onState:()=>void=()=>{};
  summaryFor:(patches:Patch[])=>string=()=> 'Workbook updated';
  constructor(public confirmed:Snapshot,private request=api){}
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
  dispose(){clearInterval(this.timer);}
  private show(doc:DashDoc) {
    if(!this.store||!this.view)return;
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
      const base=structuredClone(this.store.doc),preview=previewChange(base,patches);
      const pending:Pending={operationId:crypto.randomUUID(),summary:this.summaryFor(patches),patches:preview.patches,prepared:prepareChange(base,patches)};
      // Store the item BEFORE notifying the grid, so dirty/readback cannot
      // claim that this optimistic state has already been saved.
      this.queue.push(pending);this.epoch++;this.redoIds=[];this.show(preview.next);
      if(!this.error)this.start();
    } catch(error) {this.error=error as Error;this.onState();}
  }
  private start() {
    if(this.processing)return;
    this.processing=this.drain().finally(()=>{this.processing=undefined;this.onState();});
  }
  private async drain() {
    while(this.queue.length) {
      const item=this.queue[0];
      try {
        if(!item.request) {
          await applyPrepared(this.confirmed.document,await item.prepared);
          item.request={baseRevision:this.confirmed.revision,operationId:item.operationId,summary:item.summary,patches:item.patches};
        }
        const receipt=await this.request<{changeId:string;revision:number}>(this.root+'/changes','POST',item.request);
        const snapshot=await this.request<Snapshot>(this.root);
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
    this.error=null;this.start();await this.processing;
    if(this.error)throw this.error;
  }
  async refresh() {
    if(this.pending||this.processing||this.error)return;
    const epoch=this.epoch;
    try {
      const snapshot=await this.request<Snapshot>(this.root);
      if(epoch!==this.epoch||this.pending||this.processing)return;
      if(snapshot.revision<this.revision)return;
      const changed=snapshot.revision!==this.revision||snapshot.role!==this.confirmed.role;
      this.confirmed=snapshot;if(changed)this.show(snapshot.document);
      this.onState();
    } catch(error) {this.error=error as Error;if(error instanceof HttpError&&[401,403,404].includes(error.status)){this.confirmed.role='viewer';if(this.store)this.store.readOnly=true;}this.onState();}
  }
  undo(){if(!this.canUndo)return false;void this.reverse(false);return true;}
  redo(){if(!this.canRedo)return false;void this.reverse(true);return true;}
  private async reverse(redo:boolean) {
    const stack=redo?this.redoIds:this.undoIds,id=stack.at(-1)!;
    const path='/changes/'+id+'/undo';
    this.reviewing=true;if(this.store)this.store.readOnly=true;this.onState();
    try {
      const operationId=this.reviewOperations.get(path)??crypto.randomUUID();this.reviewOperations.set(path,operationId);
      const result=await this.request<{changeId:string}>(this.root+path,'POST',{operationId});
      const snapshot=await this.request<Snapshot>(this.root);
      stack.pop();(redo?this.undoIds:this.redoIds).push(result.changeId);this.confirmed=snapshot;this.error=null;
      this.reviewOperations.delete(path);this.retryReview=undefined;
      this.show(snapshot.document);
    }catch(error){this.error=error as Error;this.retryReview=()=>this.reverse(redo);}
    finally{this.reviewing=false;if(this.store){this.store.readOnly=this.readOnly;this.store.changedRemotely({all:true},false);}this.onState();}
  }
  async review(path:string,operation=true) {
    await this.flush();this.reviewing=true;if(this.store)this.store.readOnly=true;this.onState();
    try {
      const operationId=this.reviewOperations.get(path)??crypto.randomUUID();this.reviewOperations.set(path,operationId);
      const result=await this.request<any>(this.root+path,'POST',operation?{operationId}:{});
      const snapshot=await this.request<Snapshot>(this.root);this.confirmed=snapshot;
      this.reviewOperations.delete(path);this.retryReview=undefined;
      if(result.changeId)this.undoIds.push(result.changeId);this.show(snapshot.document);return result;
    }catch(error){this.error=error as Error;this.retryReview=()=>this.review(path,operation);throw error;}
    finally{this.reviewing=false;if(this.store)this.store.readOnly=this.readOnly;this.onState();}
  }
  async retry(){if(this.retryReview)await this.retryReview();else{await this.flush();await this.refresh();}}
  async discardLocal() {
    if(this.processing)await this.processing;
    const snapshot=await this.request<Snapshot>(this.root);
    this.queue=[];this.epoch++;this.error=null;this.retryReview=undefined;this.confirmed=snapshot;this.show(snapshot.document);
  }
}
