/** Operate real controls, including dynamically mounted menus in editor frames.
 * IDs are session-local capabilities, never selectors or executable code. */
export type ControlAction={id:string;action:'click'|'double_click'|'context_menu'|'set_value'|'key'|'focus'|'select_text'|'scroll'|'pointer';dialogs?:Array<string|boolean|null>;files?:Array<{name:string;content:string;encoding:'text'|'base64';mimeType?:string}>;pointer?:Array<{type:'pointerdown'|'pointermove'|'pointerup';x:number;y:number}>;value?:string;key?:string;start?:number;end?:number;ctrl?:boolean;meta?:boolean;shift?:boolean;alt?:boolean;x?:number;y?:number};
export class InterfaceControls {
 private ids=new WeakMap<Element,string>();private elements=new Map<string,Element>();private seq=0;
 constructor(private root:Document){}
 private docs():Document[]{const out=[this.root];for(let i=0;i<out.length;i++)for(const frame of out[i].querySelectorAll('iframe')){try{if(frame.contentDocument&&!out.includes(frame.contentDocument))out.push(frame.contentDocument);}catch{}}return out;}
 private visible(el:Element){if(el.closest('[hidden],[inert],[aria-hidden="true"]'))return false;for(let n:Element|null=el;n;n=n.parentElement){const css=n.ownerDocument.defaultView!.getComputedStyle(n);if(css.display==='none'||css.visibility==='hidden')return false;}return true;}
 list(){
  const result=[];const alive=new Set<string>();
  for(const [frame,doc] of this.docs().entries())for(const el of doc.querySelectorAll('body,button,input,select,textarea,a[href],[role="button"],[role="menuitem"],[role="tab"],[role="checkbox"],[contenteditable="true"],[tabindex],canvas,[data-id],[data-el-id],svg,[data-row],[data-col],.resize-handle')){
   if(!this.visible(el))continue;let id=this.ids.get(el);if(!id){id='control-'+(++this.seq);this.ids.set(el,id);}this.elements.set(id,el);alive.add(id);
   const input=el as HTMLInputElement;const label=el.tagName==='BODY'?'Page keyboard target':el.getAttribute('aria-label')||el.getAttribute('title')||Array.from(input.labels??[]).map(l=>l.textContent).join(' ')||el.textContent||el.id||el.getAttribute('name')||'';
   const rect=el.getBoundingClientRect();
   result.push({id,frame,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},tag:el.tagName.toLowerCase(),type:input.type??null,label:label.trim().slice(0,300),disabled:!!input.disabled||el.getAttribute('aria-disabled')==='true',...(input.type==='password'?{sensitive:true}:typeof input.value==='string'?{value:input.value.slice(0,2000)}:{}),...(el.tagName==='SELECT'?{options:Array.from((el as HTMLSelectElement).options).map(o=>({value:o.value,label:o.text,disabled:o.disabled}))}:{}),...(input.type==='checkbox'||input.type==='radio'?{checked:input.checked}:{})});
  }
  for(const id of this.elements.keys())if(!alive.has(id))this.elements.delete(id);return result;
 }
 async act(args:ControlAction){
  const el=this.elements.get(args.id) as HTMLElement|undefined;
  if(!el||!el.isConnected||!this.docs().includes(el.ownerDocument)||!this.visible(el))throw new Error('Control is stale or hidden. Call list_interface_controls again.');
  if((el as HTMLInputElement).disabled||el.closest('[inert]')||el.getAttribute('aria-disabled')==='true')throw new Error('Control is disabled.');
  const win=el.ownerDocument.defaultView!;const constructors=win as unknown as typeof globalThis;
  const input=el as HTMLInputElement;
  if(args.action==='set_value'){
   if(input.readOnly||input.type==='password'||input.type==='file'||!['INPUT','TEXTAREA','SELECT'].includes(el.tagName))throw new Error('Use the dedicated import/editor tool for this control.');
   if(args.value===undefined)throw new Error('value is required');
   if(el.tagName==='SELECT'&&!Array.from((el as unknown as HTMLSelectElement).options).some(o=>o.value===args.value&&!o.disabled))throw new Error('Unknown or disabled option');
   el.focus();if(input.type==='checkbox'||input.type==='radio'){if(!['true','false'].includes(args.value))throw new Error('Checkbox value must be true or false');input.checked=args.value==='true';}else input.value=args.value;el.dispatchEvent(new constructors.Event('input',{bubbles:true}));el.dispatchEvent(new constructors.Event('change',{bubbles:true}));
  }else if(args.action==='select_text'){
   el.focus();if(typeof input.setSelectionRange==='function'&&['INPUT','TEXTAREA'].includes(el.tagName))input.setSelectionRange(args.start??0,args.end??input.value.length);
   else {const range=el.ownerDocument.createRange();const walker=el.ownerDocument.createTreeWalker(el,4),nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);const length=nodes.reduce((n,t)=>n+t.length,0),start=args.start??0,end=args.end??length;if(start>end||end>length)throw new Error('Invalid text range');const point=(offset:number)=>{for(const node of nodes){if(offset<=node.length)return {node,offset};offset-=node.length;}return {node:el as Node,offset:0};};const a=point(start),b=point(end);range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);const selection=win.getSelection();selection?.removeAllRanges();selection?.addRange(range);}
  }else if(args.action==='pointer'){
   if(!args.pointer?.length)throw new Error('pointer path is required');
   for(const point of args.pointer){const target=point.type==='pointerdown'?el:el.ownerDocument;target.dispatchEvent(new constructors.MouseEvent(point.type.replace('pointer','mouse'),{bubbles:true,cancelable:true,button:0,buttons:point.type==='pointerup'?0:1,clientX:point.x,clientY:point.y,shiftKey:args.shift,metaKey:args.meta,ctrlKey:args.ctrl,altKey:args.alt}));}
  }else if(args.action==='focus')el.focus();
  else if(args.action==='scroll')el.scrollBy(args.x??0,args.y??0);
  else if(args.action==='key'){
   if(!args.key)throw new Error('key is required');el.focus();for(const type of ['keydown','keyup'])el.dispatchEvent(new constructors.KeyboardEvent(type,{key:args.key,bubbles:true,cancelable:true,ctrlKey:args.ctrl,metaKey:args.meta,shiftKey:args.shift,altKey:args.alt}));
  }else if(args.action==='click'){
   const originalPrompt=win.prompt,originalConfirm=win.confirm,prototype=constructors.HTMLInputElement.prototype,originalClick=prototype.click;
   const answers=[...(args.dialogs??[])];
   try{
    if(args.dialogs){win.prompt=()=>{const answer=answers.shift();if(answer===undefined)throw new Error('Missing prompt response');return answer===null?null:String(answer);};win.confirm=()=>{const answer=answers.shift();if(typeof answer!=='boolean')throw new Error('Missing boolean confirmation response');return answer;};}
    if(args.files){const files=args.files.map(f=>{const content=f.encoding==='base64'?Uint8Array.from(atob(f.content),c=>c.charCodeAt(0)):f.content;if((typeof content==='string'?new TextEncoder().encode(content).length:content.length)>8*1024*1024)throw new Error('File exceeds 8 MB');return new constructors.File([content],f.name,{type:f.mimeType??''});});prototype.click=function(){if(this.type!=='file')return originalClick.call(this);const transfer=new constructors.DataTransfer();for(const file of files)transfer.items.add(file);this.files=transfer.files;this.dispatchEvent(new constructors.Event('change',{bubbles:true}));};}
    el.dispatchEvent(new constructors.MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
    el.dispatchEvent(new constructors.MouseEvent('mouseup',{bubbles:true,cancelable:true,button:0}));
    el.click();
   }finally{win.prompt=originalPrompt;win.confirm=originalConfirm;prototype.click=originalClick;}
  }
  else el.dispatchEvent(new constructors.MouseEvent(args.action==='double_click'?'dblclick':'contextmenu',{bubbles:true,cancelable:true,button:args.action==='context_menu'?2:0,clientX:args.x??0,clientY:args.y??0}));
  await new Promise(resolve=>setTimeout(resolve,0));
  return {dispatched:true,action:args.action,notice:'Handler dispatched. Read editor state or controls to verify its result. Browser print, fullscreen and system dialogs may require a user gesture.'};
 }
}
