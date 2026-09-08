import {startTheme} from '../../kernel/src/theme.ts';
import {workbench} from '../editors/workbench.ts';
import {brand,brandSymbol} from './brand.ts';
import './brand.css';
import '../../dash/src/styles.css';
import './styles.css';
import {activateI18n,LOCALE_CHOICES,locale,setLocale,t} from '../../dash/src/i18n.ts';
import {ot} from './i18n.ts';
import {api,HttpError,type Snapshot} from './api.ts';
import {WorkbookController} from './controller.ts';
import {registerWebMCP} from './webmcp.ts';
import {chatGPTSignInPath} from '../../app/chatgpt-auth.ts';
import {newWorkbook,validateWorkbook} from '../shared/content.ts';
import type {OfficeDocument,OfficeFormat} from '../shared/content.ts';
import type {NativeEditorHost,NativeDocument} from '../shared/editor-host.ts';
import type {DashDoc} from '../../dash/src/model.ts';
import type {OfficeHost} from '../../dash/src/officehost.ts';

const root=document.getElementById('office-root')!;
const editor=document.getElementById('app')!;
let controller:WorkbookController|undefined;
let currentPanel:string|undefined;
let refreshArchive:(()=>Promise<void>)|undefined;
let panelGeneration=0;
let globalNotice='';
let webMCP={available:false,dispose:()=>{}};
let actor:{id:string;name:string;kind:string;email:string};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const icon=(name:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${({
  book:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M4 13h16M4 18h16M10 8v13"/>',
  text:'<path d="M6 3h9l4 4v14H5V3h1M14 3v5h5M8 12h8M8 16h6"/>',slide:'<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M12 17v4M8 21h8M7 8h10M7 12h6"/>',
  back:'<path d="m14 6-6 6 6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',share:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  history:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2"/>',agent:'<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',check:'<path d="m5 12 4 4L19 6"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
} as Record<string,string>)[name]??''}</svg>`;
const favicon=document.createElement('link');favicon.rel='icon';favicon.type='image/webp';favicon.href=brandSymbol;document.head.append(favicon);
const mark=`<span class="office-wordmark">${brand}</span>`;
const button=(id:string,name:string,label:string,extra='')=>`<button type="button" class="office-button ${extra}" data-office="${id}" title="${escape(label)}">${icon(name)}<span>${escape(label)}</span></button>`;
function languagePicker(){return `<select id="office-language" aria-label="${escape(t('Language'))}">${LOCALE_CHOICES.map(l=>`<option value="${l.code}" ${l.code===locale()?'selected':''}>${l.label}</option>`).join('')}</select>`;}
function wireLanguage(){document.getElementById('office-language')?.addEventListener('change',e=>{setLocale((e.target as HTMLSelectElement).value);location.reload();});}
function notice(error:unknown,global=false){const panel=document.getElementById('office-panel'),message=error instanceof Error?error.message:String(error);const banner=!global&&panel&&!panel.hidden?document.getElementById('office-panel-notice'):document.getElementById('office-notice');if(banner){banner.textContent=message;banner.hidden=false;if(banner.id==='office-notice'){globalNotice=message;const problem=document.getElementById('office-problem');if(problem)problem.hidden=false;}}}
function busy(button:HTMLButtonElement,work:()=>Promise<unknown>){button.disabled=true;void work().catch(notice).finally(()=>{button.disabled=false;});}
function bind(id:string,action:(event:MouseEvent)=>void){document.querySelector<HTMLButtonElement>(`[data-office="${id}"]`)?.addEventListener('click',action);}

async function start(){
  activateI18n();
  document.documentElement.lang=locale();
  startTheme();
  root.innerHTML=`<header class="office-header">${mark}${languagePicker()}</header><main class="office-opening" role="status">${escape(ot('Loading…'))}</main>`;wireLanguage();
  try {
    actor=(await api('/api/session')).actor;
    const id=new URL(location.href).searchParams.get('workbook');
    if(id)await openWorkbook(id);else await archive();
    webMCP=registerWebMCP(async()=>{await controller?.refresh();await refreshArchive?.();if(currentPanel)await renderPanel(currentPanel);},async()=>{if(controller?.pending)await controller.flush();},()=>controller?{page:'editor',app:controller.confirmed.document.format.split('/')[1],workbookId:controller.confirmed.id,title:controller.confirmed.title,revision:controller.revision,role:controller.confirmed.role}:{page:'dashboard'});
  }catch(error){
    if(error instanceof HttpError&&error.status===401){
      root.innerHTML=`<header class="office-header">${mark}${languagePicker()}</header><main class="office-welcome"><div class="office-file-mark">${icon('book')}</div><h1>${escape(ot('Sign in to your workspace'))}</h1><p>${escape(ot('Documents, slides and spreadsheets. Shared with people and agents.'))}</p><a class="office-button office-primary" href="${escape(chatGPTSignInPath(location.pathname+location.search))}">${escape(ot('Continue with ChatGPT'))}</a></main>`;wireLanguage();
    }else{root.innerHTML=`<header class="office-header">${mark}</header><main class="office-welcome"><h1>${escape(ot('Could not open'))}</h1><p id="office-notice" role="alert"></p><a href="/">${escape(ot('Files'))}</a></main>`;notice(error);}
  }
}
async function archive(){
  document.title='dowitme';
  const {mountDashboard}=await import('./dashboard.ts');
  refreshArchive=await mountDashboard(root,{actor,importFile:pickImport,languagePicker,wireLanguage});
}
const formatName=(format:string)=>ot(format==='bento/type'?'Document':format==='bento/slides'?'Presentation':'Spreadsheet');
const roleName=(role:string)=>ot(role==='owner'?'Owner':role==='editor'?'Editor':'Viewer');
async function openWorkbook(id:string){
  const snapshot=await api<Snapshot<OfficeDocument>>('/api/workbooks/'+encodeURIComponent(id));
  controller=new WorkbookController(snapshot);controller.summaryFor=patches=>ot(patches.every(p=>['setCanvasCells','setCells','setOverrides'].includes(p.op))?'Changes to cells':'File updated');
  root.innerHTML=`<header class="office-header office-editor-header"><a class="office-back" href="/" title="${escape(ot('Files'))}">${icon('back')}${mark}</a><span id="office-save-status" class="office-save-status" role="status"></span><nav class="office-actions" aria-label="dowitme">${button('changes','history',ot('Changes'))}${button('sharing','share',ot('Sharing'))}${button('agents','agent',ot('Agents'))}${button('export','download',ot('Export HTML'))}</nav></header>
    <div id="office-problem" class="office-problem" hidden><p id="office-notice" role="alert"></p><div class="office-actions">${button('retry','check',ot('Retry save'))}${button('draft','download',ot('Download your draft'))}${button('reload','history',ot('Reload saved version'))}</div></div><aside id="office-panel" class="office-panel" hidden></aside>`;
  document.body.classList.add('office-editing');editor.hidden=false;
  controller.onState=()=>{
    controller!.notifyEditor();
    document.title=(controller!.store?.doc.title??controller!.confirmed.title)+' — dowitme';
    const status=document.getElementById('office-save-status')!;
    status.textContent=controller!.error?ot('Not saved'):controller!.pending?ot('Saving to workspace…'):controller!.readOnly?roleName('viewer'):ot('Saved to workspace');
    status.classList.toggle('is-pending',controller!.pending);
    const dirty=document.querySelector<HTMLElement>('.dx-dirty');if(dirty)dirty.hidden=!controller!.pending;
    const problem=document.getElementById('office-problem')!;problem.hidden=!controller!.error&&!globalNotice;
    if(controller!.error)notice(controller!.error,true);
    const title=document.querySelector<HTMLInputElement>('.dx-title');if(title&&document.activeElement!==title)title.value=controller!.store?.doc.title??controller!.confirmed.title;
  };
  if(snapshot.document.format==='bento/dash'){
    const host:OfficeHost={mountWorkbench:workbench('Spreadsheet'),readOnly:controller.readOnly,pending:()=>controller!.pending,save:async()=>{await controller!.flush();},about:()=>void renderPanel('settings'),attach:(store,view)=>{controller!.attach(store,view);controller!.onState();},
      api:{get document(){return structuredClone(controller!.store?.doc??controller!.confirmed.document) as DashDoc;},get revision(){return controller!.revision;},call:callTool}};
    (window as unknown as {__BENTO_OFFICE_HOST__:OfficeHost}).__BENTO_OFFICE_HOST__=host;
    document.getElementById('bento-doc')!.textContent=JSON.stringify(snapshot.document).replace(/</g,'\\u003c');
    await import('../../dash/src/main.ts');
  }else{
    const format=snapshot.document.format;
    const {configureApp}=await import('../../kernel/src/app.ts');configureApp({appId:format.replace('/','-'),appName:format,manifestUrl:''});
    const host:NativeEditorHost={format,get document(){return structuredClone(controller!.confirmed.document) as NativeDocument;},get readOnly(){return controller!.readOnly;},
      pending:()=>controller!.pending,save:()=>controller!.flush(),exportHTML:()=>exportHTML(),about:()=>void renderPanel('settings'),changed:next=>controller!.nativeChanged(next),
      attach:adapter=>{controller!.attachNative(adapter);controller!.onState();},undo:()=>controller!.undo(),redo:()=>controller!.redo(),canUndo:()=>controller!.canUndo,canRedo:()=>controller!.canRedo,
      api:{get document(){return structuredClone(controller!.store?.doc??controller!.confirmed.document) as NativeDocument;},get revision(){return controller!.revision;},call:callTool}};
    (window as unknown as {__BENTO_NATIVE_HOST__:NativeEditorHost}).__BENTO_NATIVE_HOST__=host;
    const frame=document.createElement('iframe');frame.className='office-native-editor';frame.allowFullscreen=true;frame.title=formatName(format);frame.src='/office/editors/'+(format==='bento/type'?'type':'slides')+'.html';editor.append(frame);
  }
  async function callTool(name:string,input:unknown){await controller!.flush();const result=await api('/api/tools/'+name,'POST',input);await controller!.refresh();return result;}
  const importFindings=sessionStorage.getItem('office-import-findings');if(importFindings){sessionStorage.removeItem('office-import-findings');await renderPanel('changes');notice(importFindings);}
  for(const name of ['changes','sharing','agents'])bind(name,()=>void renderPanel(name));
  bind('export',()=>void exportHTML().catch(notice));bind('draft',()=>void exportHTML(true).catch(notice));
  bind('retry',()=>{globalNotice='';void controller!.retry().catch(notice);});
  bind('reload',()=>{if(window.confirm(ot('Discard changes?'))){globalNotice='';void controller!.discardLocal().catch(notice);}});
  // A dropped file must not navigate away from a shared draft. Imports are
  // explicit from the library (new workbook) or dash's Data menu (new sheets).
  document.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();});
  document.addEventListener('drop',event=>{if(event.dataTransfer?.files.length)event.preventDefault();});
}
function panelShell(title:string){
  const panel=document.getElementById('office-panel')!;panel.hidden=false;document.body.classList.add('office-panel-open');
  panel.innerHTML=`<header><h2>${escape(title)}</h2>${button('close-panel','close',t('Close'))}</header><p id="office-panel-notice" class="office-notice" role="alert" hidden></p><div id="office-panel-body" class="office-panel-body"></div>`;
  bind('close-panel',()=>{panel.hidden=true;currentPanel=undefined;panelGeneration++;document.body.classList.remove('office-panel-open');});
  // Let typing remain in this panel instead of reaching the spreadsheet's
  // document-level keyboard and clipboard handlers.
  for(const type of ['keydown','paste'])panel.addEventListener(type,event=>event.stopPropagation());
  return document.getElementById('office-panel-body')!;
}
async function renderPanel(name:string){
  if(!controller)return;currentPanel=name;const generation=++panelGeneration;
  const body=panelShell(ot(name==='changes'?'Changes':name==='sharing'?'Sharing':name==='agents'?'Agents':'Settings'));
  body.textContent=ot('Loading…');
  try {
    if(name==='changes') {
      const [proposals,history]=await Promise.all([api(controller.root+'/proposals'),api(controller.root+'/changes')]);
      if(generation!==panelGeneration)return;
      body.innerHTML=`<h3>${escape(ot('Proposals'))}</h3><div class="office-proposals">${proposals.proposals.filter((p:any)=>p.status==='pending').map((p:any)=>`<button class="office-change" data-proposal="${escape(p.id)}"><strong>${escape(p.summary)}</strong><span>${escape(p.actor_name)}</span></button>`).join('')||`<p class="office-muted">${escape(ot('No proposals to review'))}</p>`}</div><h3>${escape(ot('History'))}</h3>${history.changes.map((c:any)=>`<button class="office-change" data-change="${escape(c.id)}"><strong>${escape(c.summary)}</strong><span>${escape(c.actor_name)} · ${escape(new Date(c.created_at).toLocaleString(locale(),{dateStyle:'short',timeStyle:'short'}))}</span></button>`).join('')}`;
      body.querySelectorAll<HTMLElement>('[data-proposal]').forEach(el=>el.onclick=()=>void inspectChange(el.dataset.proposal!,true));
      body.querySelectorAll<HTMLElement>('[data-change]').forEach(el=>el.onclick=()=>void inspectChange(el.dataset.change!,false));
    }else if(name==='sharing') {
      const result=await api(controller.root+'/members');if(generation!==panelGeneration)return;
      const owner=controller.confirmed.role==='owner';
      body.innerHTML=`<p>${escape(ot('Share this link with the people you grant access to. Access to the site is managed separately.'))}</p>${button('copy-link','share',ot('Copy workbook link'))}<div class="office-members">${result.members.map((m:any)=>`<div class="office-member"><span><strong>${escape(m.display_name)}</strong><small>${escape(roleName(m.role))}${m.inherited?' · '+escape(ot('From folder'))+' '+escape(m.folder_name):''}</small></span>${owner&&m.role!=='owner'&&!m.inherited?`<button class="office-text-button" data-revoke="${escape(m.id)}">${escape(ot('Revoke'))}</button>`:''}</div>`).join('')}</div>${owner?`<form id="office-share-form"><label>${escape(ot('Email'))}<input name="email" type="email" required autocomplete="email"></label><label>${escape(ot('Permissions'))}<select name="role"><option value="editor">${escape(ot('Editor'))}</option><option value="viewer">${escape(ot('Viewer'))}</option></select></label><button class="office-button office-primary">${escape(ot('Grant access'))}</button></form>`:''}`;
      bind('copy-link',()=>void navigator.clipboard.writeText(location.href).then(()=>{document.querySelector('[data-office="copy-link"] span')!.textContent=t('Copied');}).catch(notice));
      body.querySelectorAll<HTMLButtonElement>('[data-revoke]').forEach(el=>el.onclick=()=>busy(el,async()=>{await api(controller!.root+'/members/'+el.dataset.revoke,'DELETE');await renderPanel('sharing');}));
      body.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();const form=event.target as HTMLFormElement,data=new FormData(form);busy(form.querySelector('button')!,async()=>{await api(controller!.root+'/members','POST',{email:data.get('email'),role:data.get('role')});await renderPanel('sharing');});});
    }else if(name==='agents') {
      const result=await api(controller.root+'/agents');if(generation!==panelGeneration)return;
      body.innerHTML=`<p class="office-protocol">${escape(ot(webMCP.available?'WebMCP available in this browser':'WebMCP is not available in this browser'))}</p><label>MCP<input readonly value="${escape(location.origin+'/api/mcp')}" aria-label="MCP endpoint"></label><div class="office-members">${result.agents.map((a:any)=>`<div class="office-member"><span><strong>${escape(a.name)}</strong><small>${escape(a.revoked_at?ot('Revoked'):a.permission==='write'?ot('Direct editing'):a.permission==='propose'?ot('Propose only'):ot('Viewer'))}</small></span>${!a.revoked_at?`<button class="office-text-button" data-agent="${escape(a.id)}">${escape(ot('Revoke'))}</button>`:''}</div>`).join('')}</div>${!controller.readOnly?`<form id="office-agent-form"><h3>${escape(ot('Create agent connection'))}</h3><label>${escape(ot('Connection name'))}<input name="name" required maxlength="80" autocomplete="off"></label><label>${escape(ot('Permissions'))}<select name="permission"><option value="propose">${escape(ot('Propose only'))}</option><option value="read">${escape(ot('Viewer'))}</option><option value="write">${escape(ot('Direct editing'))}</option></select></label><label>${escape(ot('Expires in days'))}<input name="days" type="number" value="7" min="1" max="90" required></label><button class="office-button office-primary">${escape(ot('Create'))}</button></form><div id="office-new-key"></div>`:''}`;
      body.querySelectorAll<HTMLButtonElement>('[data-agent]').forEach(el=>el.onclick=()=>busy(el,async()=>{await api(controller!.root+'/agents/'+el.dataset.agent,'DELETE');await renderPanel('agents');}));
      body.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();const form=event.target as HTMLFormElement,data=new FormData(form);busy(form.querySelector('button')!,async()=>{const result=await api(controller!.root+'/agents','POST',{name:data.get('name'),permission:data.get('permission'),expiresDays:Number(data.get('days'))});form.hidden=true;const key=document.getElementById('office-new-key')!;key.innerHTML=`<p>${escape(ot('Copy this key now. It is shown only once.'))}</p><textarea readonly aria-label="Bearer token"></textarea>`;key.querySelector('textarea')!.value=result.token;});});
    }else {
      body.innerHTML=`<p>${escape(ot('Documents, slides and spreadsheets. Shared with people and agents.'))}</p><label>${escape(t('Language'))}${languagePicker()}</label><p>dowitme · MIT</p><p>${escape(ot('Based on'))} <a href="https://github.com/nyblnet/bento" target="_blank" rel="noopener noreferrer">bento</a> · © 2026 The Bento authors</p><a href="https://github.com/davide-relaunchlab/dowitme" target="_blank" rel="noopener noreferrer">${escape(ot('Source code'))}</a>`;wireLanguage();
    }
  }catch(error){if(generation===panelGeneration)body.textContent=error instanceof Error?error.message:String(error);}
}
function scopeLabel(scope:any){const doc=controller!.confirmed.document;return doc.format==='bento/dash'?doc.sheets.find(s=>s.id===scope.sheet)?.name??scope.sheet:scope.slide??(scope.kind==='block'?ot('Document'):scope.kind==='slide'?ot('Presentation'):undefined);}
function displayDifference(kind:string,value:any):string{
  if(value==null)return ot('Empty');
  if(kind==='cell') {const content=value.f??value.v; const style={...value};delete style.f;delete style.v;return String(content??ot('Empty'))+(Object.keys(style).length?'\n'+JSON.stringify(style,null,2):'');}
  return typeof value==='object'?JSON.stringify(value,null,2):String(value);
}
async function inspectChange(id:string,proposal:boolean){
  const generation=++panelGeneration,body=panelShell(ot(proposal?'Proposals':'Changes'));
  body.textContent=ot('Loading…');
  try {
    const detail=await api(controller!.root+(proposal?'/proposals/':'/changes/')+id);if(generation!==panelGeneration)return;
    body.innerHTML=`<h3>${escape(detail.summary)}</h3><p class="office-muted">${escape(detail.actorName)}</p><div class="office-differences">${detail.differences.map((d:any)=>{const before=d.scope.kind==='cell'?d.before?.cell:d.before,after=d.scope.kind==='cell'?d.after?.cell:d.after;return `<section class="office-difference"><h4>${escape([scopeLabel(d.scope),d.scope.key,d.scope.rid].filter(v=>v!==undefined).join(' · ')||detail.summary)}</h4><span>${escape(ot('Before'))}</span><pre>${escape(displayDifference(d.scope.kind,before))}</pre><span>${escape(ot('After'))}</span><pre>${escape(displayDifference(d.scope.kind,after))}</pre></section>`;}).join('')}</div><div class="office-review-actions">${!controller!.readOnly?(proposal?`${button('accept','check',ot('Accept changes'),'office-primary')}${button('reject','close',ot('Reject proposal'))}`:detail.kind!=='create'?button('undo-change','history',ot('Undo this change')):''):''}</div>`;
    bind('accept',event=>busy(event.currentTarget as HTMLButtonElement,async()=>{await controller!.review('/proposals/'+id+'/accept');await renderPanel('changes');}));
    bind('reject',event=>busy(event.currentTarget as HTMLButtonElement,async()=>{await controller!.review('/proposals/'+id+'/reject',false);await renderPanel('changes');}));
    bind('undo-change',event=>busy(event.currentTarget as HTMLButtonElement,async()=>{await controller!.review('/changes/'+id+'/undo');await renderPanel('changes');}));
  }catch(error){if(generation===panelGeneration)body.textContent=error instanceof Error?error.message:String(error);}
}
async function exportHTML(draft=false){
  if(!controller)return;if(!draft)await controller.flush();
  const doc=structuredClone(draft?(controller.store?.doc??controller.confirmed.document):controller.confirmed.document);
  const name=doc.format==='bento/type'?'Type':doc.format==='bento/slides'?'Slides':'Dash';
  const response=await fetch('/standalone/Bento_'+name+'.bento.html');if(!response.ok)throw new Error(ot('Export failed'));
  const shell=new DOMParser().parseFromString(await response.text(),'text/html');
  const {serializeWith,downloadFile,suggestedFileName}=await import('../../kernel/src/save.ts');
  downloadFile(serializeWith(shell,await exportContent(doc)),suggestedFileName(doc,draft?'draft':''));
}
async function exportContent(doc:OfficeDocument):Promise<OfficeDocument>{
  if(doc.format==='bento/dash')return (await import('../../dash/src/model.ts')).docForExport(doc);
  if(doc.format==='bento/type')return (await import('../../type/src/model.ts')).docForExport(doc);
  const {collab:_,blobs:__,...content}=doc;return content;
}

function pickImport(){
  const input=document.createElement('input');input.type='file';input.accept='.csv,.tsv,.xlsx,.html';
  input.onchange=()=>{const file=input.files?.[0];if(file)void importFile(file).catch(notice);};input.click();
}
async function importFile(file:File){
  if(file.size>8*1024*1024)throw new Error(ot('The file exceeds 8 MB.'));
  let doc:OfficeDocument=newWorkbook(file.name.replace(/\.(xlsx|csv|tsv|bento\.html|html)$/i,''));
  if(/\.xlsx$/i.test(file.name)){
    const {importXlsx,installNames}=await import('../../dash/src/xlsx.ts');const result=await importXlsx(new Uint8Array(await file.arrayBuffer()),{source:file.name,at:new Date().toISOString(),names:true,idPrefix:'import-'+crypto.randomUUID().slice(0,8)});(doc as DashDoc).sheets=result.sheets;installNames(doc as DashDoc,result.names);
    if(result.findings.length)sessionStorage.setItem('office-import-findings',result.findings.map(f=>f.message).join('\n'));
  }else if(/\.(csv|tsv)$/i.test(file.name)){
    const {importDelimited}=await import('../../dash/src/import.ts');const result=importDelimited(await file.text(),{name:doc.title,sheetId:'sheet-1',source:file.name,at:new Date().toISOString()});(doc as DashDoc).sheets=[result.sheet];
  }else{
    const html=await file.text();const raw=/<script\b[^>]*\bid=["']bento-doc["'][^>]*>([\s\S]*?)<\/script\s*>/i.exec(html)?.[1];if(!raw)throw new Error(ot('This file does not contain a dowitme workbook.'));
    const parsed=JSON.parse(raw);if(!parsed.docId)throw new Error(ot('This file cannot be edited in this workspace.'));
    const {readonly:_,template:__,collab:___,blobs:____,...content}=await exportContent(parsed);doc=content as OfficeDocument;
  }
  doc=validateWorkbook(JSON.parse(JSON.stringify(doc)));
  const created=await api('/api/workbooks','POST',{title:doc.title,document:doc});location.href='/?workbook='+encodeURIComponent(created.id);
}
window.addEventListener('beforeunload',event=>{if(controller?.pending||controller?.editing||controller?.error){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{controller?.dispose();webMCP.dispose();});
void start();
