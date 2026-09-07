// Optional host boundary. Standalone bento files have no host and retain the
// original save, recovery, relay and agent APIs.
import type { Store } from './store.ts';
export interface OfficeHost {
  readOnly:boolean;
  pending():boolean;
  save():Promise<void>;
  about():void;
  attach(store:Store,view:{showingSheet:()=>string;showSheet:(id:string)=>void}):void;
  api:Record<string,unknown>;
}
export function officeHost():OfficeHost|undefined {
  return typeof window==='undefined'?undefined:(window as unknown as {__BENTO_OFFICE_HOST__?:OfficeHost}).__BENTO_OFFICE_HOST__;
}
