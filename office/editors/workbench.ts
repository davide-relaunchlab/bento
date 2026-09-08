import type {MountWorkbench} from '../../kernel/src/workbench.ts';
import {ot} from '../client/i18n.ts';
import './workbench.css';

const paths={plus:'M12 5v14M5 12h14',view:'M4 4h16v16H4zM9 4v16',more:'M5 12h.01M12 12h.01M19 12h.01',close:'m6 6 12 12M6 18 18 6'};
const icon=(key:keyof typeof paths)=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key]}"/></svg>`;
let sequence=0;
/** Compose live engine controls. Resize moves nodes, never clones listeners. */
export function workbench(format:'Document'|'Presentation'|'Spreadsheet'):MountWorkbench {
 return parts=>{
  const doc=parts.header.ownerDocument;
  const row=(className:string,nodes:HTMLElement[]=[])=>{const el=doc.createElement('div');el.className=className;el.append(...nodes);return el;};
  const prefix=`dw-tools-${++sequence}`;
  const compact=matchMedia('(max-width:1199px)');
  const cleanLabel=(button:HTMLButtonElement)=>button.getAttribute('aria-label')||button.textContent?.trim()||button.title;
  // Icon-only engine actions gain visible text when presented in a panel.
  for(const node of [...parts.navigation,...parts.actions]){
   for(const b of [node,...node.querySelectorAll('button')]){
    if(!(b instanceof HTMLButtonElement)||(b.textContent?.trim()&&!/^[?⋯…▾▴]+$/.test(b.textContent.trim())))continue;
    const label=doc.createElement('span');label.className='dw-control-label';
    label.textContent=(b.title||cleanLabel(b)).split(/ — |: | \(/)[0];b.append(label);
   }
  }
  const panels:HTMLElement[]=[];
  const disclosures=(name:string,glyph:keyof typeof paths,nodes:HTMLElement[],suffix:string)=>{
   const trigger=doc.createElement('button');trigger.type='button';trigger.className='dw-disclosure';
   trigger.innerHTML=icon(glyph);const label=doc.createElement('span');label.textContent=name;trigger.append(label);
   trigger.title=name;trigger.setAttribute('aria-label',name);trigger.setAttribute('aria-expanded','false');
   const panel=row('dw-tool-panel');panel.id=prefix+'-'+suffix;panel.setAttribute('popover','auto');
   panel.setAttribute('role','dialog');panel.setAttribute('aria-label',name);trigger.setAttribute('aria-controls',panel.id);
   const heading=doc.createElement('h2');heading.textContent=name;
   const close=doc.createElement('button');close.type='button';close.className='dw-panel-close';
   close.innerHTML=icon('close');close.setAttribute('aria-label',ot('Close tools'));
   // Keep widget outside-press handlers from resizing the sheet between
   // pointerdown and click on its close button.
   close.addEventListener('pointerdown',event=>event.stopPropagation());
   close.addEventListener('click',()=>{panel.hidePopover();trigger.focus();});
   const content=row('dw-panel-content',nodes);panel.append(row('dw-panel-heading',[heading,close]),content);
   parts.header.append(panel);panels.push(panel);
   trigger.addEventListener('mousedown',e=>e.preventDefault());
   trigger.addEventListener('click',event=>{
    if(panel.matches(':popover-open')){panel.hidePopover();return;}
    if(suffix==='more')parts.prepareActions?.();
    const r=trigger.getBoundingClientRect();
    panel.style.setProperty('--dw-pop-top',`${r.bottom+8}px`);
    panel.style.setProperty('--dw-pop-left',`${Math.max(12,Math.min(r.left,innerWidth-380))}px`);
    panel.showPopover();
    if(event.detail===0)close.focus();
   });
   panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();panel.hidePopover();trigger.focus();}});
   panel.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
   // A leaf command returns to the document. A widget that opens a submenu
   // stays open; its existing keyboard/mouse handlers remain authoritative.
   content.addEventListener('mousedown',event=>{
    if((event.target as Element).closest('.t-menu button'))queueMicrotask(()=>panel.hidePopover());
   });
   content.addEventListener('click',event=>{
    const b=(event.target as Element).closest('button');if(!b||b.disabled)return;
    const sibling=b.nextElementSibling;
    if(sibling?.matches('.ed-menu,.t-menu,.dx-menu,.ed-share-pop'))return;
    if(b.parentElement?.querySelector(':scope > .ed-menu,:scope > .t-menu,:scope > .dx-menu')&&!b.closest('.ed-menu,.t-menu,.dx-menu'))return;
    // Theme is an in-panel setting whose updated value should remain visible.
    if(b.id==='theme')return;
    panel.hidePopover();
   });
   return {trigger,panel,content};
  };
  const heading=row('dw-workbench-heading',[parts.title]);parts.title.setAttribute('aria-label',ot('Name'));
  const history=row('dw-workbench-history',parts.history);
  const primary=row('dw-workbench-primary',parts.primary);
  const status=row('dw-workbench-status',parts.status??[]);
  const toolHome=row('dw-workbench-tools');
  const viewHome=row('dw-workbench-navigation');
  parts.header.replaceChildren();
  const tools=disclosures(ot(format==='Presentation'?'Insert':'Tools'),'plus',[], 'insert');
  const view=disclosures(ot('View'),'view',[], 'view');
  const more=disclosures(ot('More'),'more',parts.actions,'more');
  more.trigger.classList.add('dw-more');
  const toolbar=row('dw-workbench-toolbar',[history,tools.trigger,view.trigger,toolHome,viewHome]);
  toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label',ot(format));
  parts.header.prepend(row('dw-workbench-titlebar',[heading,status,primary,more.trigger]),toolbar);
  parts.header.classList.add('dw-workbench');
  let previous:boolean|undefined;
  const arrange=()=>{
   if(previous===compact.matches)return;previous=compact.matches;
   for(const panel of panels)if(panel.matches(':popover-open'))panel.hidePopover();
   (compact.matches?tools.content:toolHome).append(...parts.tools);
   (compact.matches?view.content:viewHome).append(...parts.navigation);
   tools.trigger.hidden=!compact.matches;view.trigger.hidden=!compact.matches||parts.navigation.length===0;
   toolHome.hidden=compact.matches;viewHome.hidden=compact.matches;
  };
  arrange();compact.addEventListener('change',arrange);
 };
}
