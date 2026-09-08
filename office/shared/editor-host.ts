import type {EditorAutomation} from './automation.ts';
import type {MountWorkbench} from '../../kernel/src/workbench.ts';
import type {BentoDoc} from '../../slides/src/model.ts';
import type {TypeDoc} from '../../type/src/model.ts';
export type NativeDocument=BentoDoc|TypeDoc;
export interface NativeEditorAdapter {
  read():NativeDocument;
  stateChanged?():void;
  /** Adopt authoritative content without a new edit or local undo checkpoint. */
  adopt(next:NativeDocument):void;
  setReadOnly(value:boolean):void;
  /** Prevent replacement of objects held by active text/panel/gesture closures. */
  isEditing():boolean;
}
export interface NativeEditorHost {
  mountWorkbench?:MountWorkbench;
  attachAutomation?(automation:EditorAutomation):void;
  readonly format:'bento/slides'|'bento/type';
  readonly document:NativeDocument;
  readonly readOnly:boolean;
  pending():boolean;
  save():Promise<void>;
  exportHTML():Promise<void>;
  about():void;
  /** Synchronous validation + queued transaction. Can throw; preserve the draft. */
  changed(next:NativeDocument):void;
  attach(adapter:NativeEditorAdapter):void;
  undo():boolean;
  redo():boolean;
  canUndo():boolean;
  canRedo():boolean;
  api:{readonly document:NativeDocument;readonly revision:number;call(name:string,input:unknown):Promise<unknown>};
}
