import {nativePatchSchema,nativeDocFields,nativeSlideFields} from './patch-schemas.ts';
// SPDX-License-Identifier: MIT
// One transaction boundary for the three native bento document formats.
import {validateNativeShape} from './native-validation.ts';
import * as dash from './changes.ts';
import type {DashDoc} from '../../dash/src/model.ts';
import {newDoc,emptySlide,defaultText,defaultCode,defaultShape,defaultImage,defaultChart,defaultTable,defaultMedia,type BentoDoc} from '../../slides/src/model.ts';
import {emptyDoc,type TypeDoc} from '../../type/src/model.ts';
export {OfficeError,digest,canonical,MAX_DOCUMENT_BYTES} from './changes.ts';
export type OfficeDocument=DashDoc|BentoDoc|TypeDoc;
export type OfficeFormat=OfficeDocument['format'];
export type NativeDocument=BentoDoc|TypeDoc;
export type NativePatch={op:string;id?:string;slide?:string;block?:unknown;element?:unknown;value?:unknown;at?:number;order?:string[];props?:Record<string,unknown>;drop?:string[];title?:string};
type Scope={kind:'block'|'slide'|'element'|'order'|'docField'|'slideField'|'doc';key?:string;slide?:string};
type Guard={scope:Scope;hash:string};
export type NativePreparedChange={kind:'native';format:NativeDocument['format'];docId:string;patches:NativePatch[];inverse:NativePatch[];guards:Guard[];undoGuards:Guard[];differences:{scope:Scope;before:unknown;after:unknown}[];warnings:[]};
export type PreparedChange=dash.PreparedChange|NativePreparedChange;
const copy=<T>(v:T):T=>structuredClone(v);
const fail=(message='Contenuto del documento non valido.'):never=>{throw new dash.OfficeError('invalid_document',message);};
const record=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const safeId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&!['__proto__','prototype','constructor'].includes(v);
const fields={'bento/type':new Set<string>(nativeDocFields['bento/type']),'bento/slides':new Set<string>(nativeDocFields['bento/slides'])};
const slideFields=new Set(nativeSlideFields);
function safeJSON(input:unknown){let count=0;const walk=(v:any,depth:number)=>{if(++count>1_000_000||depth>40)fail();if(v===null||typeof v==='string'||typeof v==='boolean')return;if(typeof v==='number'&&Number.isFinite(v))return;if(typeof v!=='object'||!v)fail();if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)fail();for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))fail();walk(v[k],depth+1);}};walk(input,0);if(new TextEncoder().encode(JSON.stringify(input)).length>dash.MAX_DOCUMENT_BYTES)throw new dash.OfficeError('too_large','Il documento supera 8 MB.',413);}
function unique(items:any[]){const ids=new Set<string>();for(const item of items){if(!record(item)||!safeId(item.id)||ids.has(item.id))fail('Identità mancanti o duplicate.');ids.add(item.id);}}
export function validateWorkbook(input:unknown):OfficeDocument {
 if(record(input)&&input.format==='bento/dash')return dash.validateWorkbook(input);
 safeJSON(input);const d=input as any;
 if(!record(d)||!['bento/type','bento/slides'].includes(d.format)||d.version!==1||!safeId(d.docId)||typeof d.title!=='string'||!d.title.trim()||d.title.length>300)fail();
 for(const k of ['collab','readonly','template','blobs','sync','_sync'])if(k in d)fail('Le credenziali locali non fanno parte del contenuto condiviso.');
 if(d.format==='bento/type'){
  if(!record(d.page)||!['width','height','marginX','marginTop','marginBottom'].every(k=>typeof d.page[k]==='number'&&d.page[k]>=0)||d.page.width<=0||d.page.height<=0||!Array.isArray(d.body)||!d.body.length||d.body.length>100000||!record(d.footnotes)||!Array.isArray(d.revisions)||!Array.isArray(d.signatures))fail();
  unique(d.body);for(const b of d.body)if(!['para','h1','h2','h3','quote','ul','ol','cell','image','caption','toc','math','embed'].includes(b.kind)||typeof b.text!=='string'||(b.marks!==undefined&&!Array.isArray(b.marks)))fail();
 }else{
  if(!record(d.size)||!(d.size.width>0)||!(d.size.height>0)||!record(d.theme)||!['background','color','accent','fontFamily'].every(k=>typeof d.theme[k]==='string')||!Array.isArray(d.slides)||!d.slides.length||d.slides.length>10000)fail();
  unique(d.slides);for(const s of d.slides){if(!Array.isArray(s.elements)||typeof s.background!=='string'||typeof s.notes!=='string'||!['none','fade','slide','zoom','morph'].includes(s.transition))fail();unique(s.elements);for(const e of s.elements){if(typeof e.type!=='string'||!['x','y','w','h','rotation','opacity'].every(k=>typeof e[k]==='number'&&Number.isFinite(e[k])))fail();}}
 }
 validateNativeShape(d);
 return d as OfficeDocument;
}
export function newWorkbook(title:string,format:OfficeFormat='bento/dash'):OfficeDocument {
 if(format==='bento/dash')return dash.newWorkbook(title);
 const doc=format==='bento/type'?emptyDoc():newDoc();doc.title=title;return doc;
}
function units(d:NativeDocument,kind:'block'|'slide'|'element',slide?:string):any[]{
 if(kind==='block'&&d.format==='bento/type')return d.body;
 if(kind==='slide'&&d.format==='bento/slides')return d.slides;
 if(kind==='element'&&d.format==='bento/slides'){const s=d.slides.find(s=>s.id===slide);if(s)return s.elements;}
 return fail('Il blocco o la slide non è disponibile.');
}
function valueAt(d:NativeDocument,s:Scope):unknown{
 if(s.kind==='doc'){const {modified,...content}=d;return content;}
 if(s.kind==='docField')return (d as any)[s.key!];
 if(s.kind==='slideField')return d.format==='bento/slides'?(d.slides.find(v=>v.id===s.slide) as any)?.[s.key!]:undefined;
 if(s.kind==='order'){try{return units(d,s.key as 'block'|'slide'|'element',s.slide).map(v=>v.id);}catch{return undefined;}}
 try{return units(d,s.kind,s.slide).find(v=>v.id===s.key);}catch{return undefined;}
}
function applyOne(d:NativeDocument,p:NativePatch):Scope[]{
 const scope:Scope[]=[];
 const concrete=(next:NativePatch):Scope[]=>{for(const key of Object.keys(p))delete (p as any)[key];Object.assign(p,next);return applyOne(d,p);};
 const parsed=nativePatchSchema.safeParse(p);
 if(!parsed.success)throw new dash.OfficeError('invalid_document','Operazione o parametri non supportati. Usa get_editing_schema per le operazioni e i modelli disponibili.',400,parsed.error.issues);
 if(p.op==='addSlide'){
  if(d.format!=='bento/slides')fail('Serve una presentazione.');
  const deck=d as BentoDoc;
  if(deck.slides.some(s=>s.id===p.id))fail('La slide esiste già. Usa setSlideProps per modificarla.');
  if(p.props&&Object.keys(p.props).some(k=>!slideFields.has(k)&&k!=='elements'))fail('Proprietà della slide non modificabile.');
  return concrete({op:'setSlide',id:p.id,value:emptySlide({background:deck.theme.background,...p.props,id:p.id}),...(p.at===undefined?{}:{at:p.at})});
 }
 if(p.op==='addElement'||p.op==='updateElement'){
  const list=units(d,'element',p.slide),existing=list.find(e=>e.id===p.id);
  let element:any;
  if(p.op==='updateElement'){
   if(!existing)fail('Elemento assente. Rileggi read_slides per gli identificatori validi.');
   if([...Object.keys(p.props??{}),...(p.drop??[])].some(k=>k==='id'||k==='type'))fail('Identità e tipo dell’elemento non possono cambiare.');
   element={...existing,...p.props};for(const key of p.drop??[])delete element[key];
  }else{
   if(existing)fail('Elemento già presente. Usa updateElement.');
   const v=p.element as any;if(!record(v)||typeof v.type!=='string'||(v.id!==undefined&&v.id!==p.id))fail();
   const partial={...v,id:p.id};
   switch(v.type){
    case 'text':element=defaultText(partial);break;
    case 'code':element=defaultCode(partial);break;
    case 'shape':element=defaultShape(v.shape??'rect',partial);break;
    case 'image':element=defaultImage(v.src,partial);break;
    case 'chart':element=defaultChart(v.option??{},partial);break;
    case 'table':element=defaultTable(partial,d.format==='bento/slides'?d.theme:undefined);break;
    case 'media':element=defaultMedia(v.kind??'video',v.src,partial);break;
    case 'svg':element={x:100,y:100,w:400,h:300,rotation:0,opacity:1,...partial};break;
    default:fail('Tipo di elemento non supportato.');
   }
  }
  return concrete({op:'setElement',slide:p.slide,id:p.id,element,...(p.at===undefined?{}:{at:p.at})});
 }
 const set=(kind:'block'|'slide'|'element',value:unknown)=>{
  if(!safeId(p.id))fail();const list=units(d,kind,p.slide),at=list.findIndex(v=>v.id===p.id);scope.push({kind,key:p.id,...(p.slide?{slide:p.slide}:{})});
  if(value!==undefined&&(!record(value)||value.id!==p.id))fail('L’identità del contenuto non può cambiare.');
  if(at<0||value===undefined){scope.push({kind:'order',key:kind,...(p.slide?{slide:p.slide}:{})});}
  if(value===undefined){if(at>=0)list.splice(at,1);}else if(at>=0)list[at]=copy(value);else{if(p.at!==undefined&&(!Number.isInteger(p.at)||p.at<0||p.at>list.length))fail();list.splice(p.at??list.length,0,copy(value));}
 };
 if(p.op==='setBlock')set('block',p.block);
 else if(p.op==='setSlide')set('slide',p.value);
 else if(p.op==='setElement')set('element',p.element);
 else if(['reorderBlocks','reorderSlides','reorderElements'].includes(p.op)){
  const kind=p.op==='reorderBlocks'?'block':p.op==='reorderSlides'?'slide':'element',list=units(d,kind,p.slide);
  if(!Array.isArray(p.order)||p.order.length!==list.length||new Set(p.order).size!==list.length||p.order.some(id=>!list.some(v=>v.id===id)))fail('L’ordine deve contenere tutte le identità una sola volta.');
  scope.push({kind:'order',key:kind,...(p.slide?{slide:p.slide}:{})});const ordered=p.order!.map(id=>list.find(v=>v.id===id)!);list.splice(0,list.length,...ordered);
 }else if(p.op==='setDocProps'||p.op==='setSlideProps'||p.op==='setTitle'){
  const slide=p.op==='setSlideProps',target=slide?(d.format==='bento/slides'?d.slides.find(s=>s.id===p.slide):undefined):d;if(!target)fail();
  const props=p.op==='setTitle'?{title:p.title}:p.props;if(!record(props)||p.drop!==undefined&&(!Array.isArray(p.drop)||p.drop.some(k=>!safeId(k))))fail();
  for(const key of new Set([...Object.keys(props!),...(p.drop??[])])){
   if(!(slide?slideFields:fields[d.format]).has(key))fail('Proprietà non modificabile: '+key);
   scope.push({kind:slide?'slideField':'docField',key,...(slide?{slide:p.slide}:{})});if(p.drop?.includes(key))delete (target as any)[key];else (target as any)[key]=copy(props![key]);
  }
 }else fail('Operazione non supportata per questo documento: '+p.op);
 return scope;
}
export function diffNative(before:NativeDocument,after:NativeDocument):NativePatch[]{
 if(before.format!==after.format||before.docId!==after.docId)fail('L’identità del documento non può cambiare.');
 const out:NativePatch[]=[];
 const props=(a:any,b:any,keys:Set<string>,slide?:string)=>{const value:Record<string,unknown>={},drop:string[]=[];for(const key of keys)if(dash.canonical(a[key])!==dash.canonical(b[key])){if(b[key]===undefined)drop.push(key);else value[key]=copy(b[key]);}if(Object.keys(value).length||drop.length)out.push({op:slide?'setSlideProps':'setDocProps',...(slide?{slide}:{}),props:value,...(drop.length?{drop}:{})});};
 const list=(a:any[],b:any[],kind:'Block'|'Slide'|'Element',slide?:string)=>{
  const extra=slide?{slide}:{};for(const x of a)if(!b.some(y=>y.id===x.id))out.push({op:'set'+kind,id:x.id,...extra});
  for(const x of b){const old=a.find(y=>y.id===x.id);if(kind==='Slide'&&old){props(old,x,slideFields,x.id);list(old.elements,x.elements,'Element',x.id);}else if(dash.canonical(old)!==dash.canonical(x))out.push({op:'set'+kind,id:x.id,...extra,[kind==='Block'?'block':kind==='Element'?'element':'value']:copy(x)});}
  const intermediate=[...a.filter(x=>b.some(y=>y.id===x.id)).map(x=>x.id),...b.filter(x=>!a.some(y=>y.id===x.id)).map(x=>x.id)];if(dash.canonical(intermediate)!==dash.canonical(b.map(x=>x.id)))out.push({op:'reorder'+kind+'s',order:b.map(x=>x.id),...extra});
 };
 props(before,after,fields[before.format]);
 if(before.format==='bento/type'&&after.format==='bento/type')list(before.body,after.body,'Block');
 else if(before.format==='bento/slides'&&after.format==='bento/slides')list(before.slides,after.slides,'Slide');
 return out;
}
export function previewChange(base:OfficeDocument,input:unknown){
 if(base.format==='bento/dash')return dash.previewChange(base,input);
 validateWorkbook(base);safeJSON(input);if(!Array.isArray(input)||!input.length||input.length>500||input.some(p=>!record(p)))fail('La modifica deve contenere da 1 a 500 operazioni.');
 const patches=copy(input) as NativePatch[],next=copy(base);const scopes=patches.flatMap(p=>applyOne(next,p));validateWorkbook(next);
 const list=[...new Map(scopes.map(s=>[dash.canonical(s),s])).values()],inverse=diffNative(next,base);
 if(!inverse.length)throw new dash.OfficeError('no_change','La modifica non cambia il contenuto.');
 if(new TextEncoder().encode(JSON.stringify(inverse)).length>dash.MAX_DOCUMENT_BYTES)fail('Modifica troppo grande da annullare.');
 // applyOne materializes aliases in patches so defaults cannot drift at commit.
 return {next,patches,inverse,list};
}
export async function prepareChange(base:OfficeDocument,input:unknown,options:{protectRead?:boolean}={}):Promise<PreparedChange>{
 if(base.format==='bento/dash')return dash.prepareChange(base,input,options);
 const {next,patches,inverse,list}=previewChange(base,input) as {next:NativeDocument;patches:NativePatch[];inverse:NativePatch[];list:Scope[]};
 const guard=async(d:NativeDocument,scopes:Scope[])=>Promise.all(scopes.map(async scope=>({scope,hash:await dash.digest(valueAt(d,scope))})));
 return {kind:'native',format:base.format,docId:base.docId,patches,inverse,guards:await guard(base,options.protectRead?[...list,{kind:'doc'}]:list),undoGuards:await guard(next,list),differences:list.map(scope=>({scope,before:copy(valueAt(base,scope)??null),after:copy(valueAt(next,scope)??null)})),warnings:[]};
}
export async function applyPrepared(current:OfficeDocument,prepared:PreparedChange,direction:'forward'|'undo'='forward'):Promise<OfficeDocument>{
 if(!('kind' in prepared)){if(current.format!=='bento/dash')fail();return dash.applyPrepared(current as DashDoc,prepared,direction);}
 if(current.format!==prepared.format||current.docId!==prepared.docId)fail('L’identità del documento non corrisponde.');
 const doc=current as NativeDocument,conflicts:Scope[]=[];for(const g of direction==='undo'?prepared.undoGuards:prepared.guards)if(await dash.digest(valueAt(doc,g.scope))!==g.hash)conflicts.push(g.scope);
 if(conflicts.length)throw new dash.OfficeError('conflict','Il contenuto è cambiato. Rileggi le parti indicate prima di applicare.',409,conflicts);
 return previewChange(doc,direction==='undo'?prepared.inverse:prepared.patches).next;
}
