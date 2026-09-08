import {z} from 'zod';
import {editorAutomation} from '../shared/automation.ts';
import {validateDoc} from '../../slides/src/validate.ts';
import {measureText,measureElement} from '../../slides/src/measure.ts';
import {workbench} from './workbench.ts';
import '../client/brand.css';
document.documentElement.classList.add('dw-host');
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 The Bento authors
import '../../slides/src/styles.css';
import {configureApp} from '../../kernel/src/app.ts';
import {startTheme} from '../../kernel/src/theme.ts';
import {applyDirection} from '../../slides/src/i18n.ts';
import {resolveThemeRefs} from '../../slides/src/palette.ts';
import {injectFonts} from '../../slides/src/fonts.ts';
import {Store} from '../../slides/src/store.ts';
import {Editor} from '../../slides/src/editor/editor.ts';
import type {BentoDoc} from '../../slides/src/model.ts';
import {getNativeHost} from './host.ts';

const host = getNativeHost('bento/slides');
configureApp({appId:'bento-slides',appName:'dowitme · slides',manifestUrl:''});
startTheme();
applyDirection();
const doc = structuredClone(host.document) as BentoDoc;
resolveThemeRefs(doc);
if(doc.fonts?.length)injectFonts(doc);
const store = new Store(doc);
store.readOnly = host.readOnly;
store.delegate = {
  changed: next => host.changed(structuredClone(next)),
  undo: () => host.undo(),
  redo: () => host.redo(),
};
const editor = new Editor(document.getElementById('app')!,store,{...host,mountWorkbench:workbench('Presentation')});
const narrow=matchMedia('(max-width: 700px)');
let wasNarrow=false;
function fitPanels(){const isNarrow=innerWidth<=700;if(isNarrow&&!wasNarrow){editor.closePanel('left');editor.closePanel('right');}wasNarrow=isNarrow;}
fitPanels();narrow.addEventListener('change',fitPanels);addEventListener('resize',fitPanels);
host.attach({
  stateChanged: () => store.setDirty(host.pending()),
  read: () => structuredClone(store.doc),
  adopt: next => {
    if(next.format !== 'bento/slides')throw new Error('Invalid editor format.');
    store.adopt(next as BentoDoc);
    if(store.doc.fonts?.length)injectFonts(store.doc);
    store.setDirty(host.pending());
  },
  setReadOnly: value => {editor.setHostedReadOnly(value);store.setDirty(host.pending());},
  isEditing: () => editor.isEditing(),
});

host.attachAutomation?.(editorAutomation(()=>({format:store.doc.format,slideId:store.slide?.id,index:store.currentIndex,selection:store.selection.slice(),readOnly:store.readOnly}),()=>store.readOnly,[
 {name:'select_slide',description:'Select an existing slide by stable id.',schema:z.object({id:z.string()}).strict(),readOnly:true,run:({id})=>{const i=store.doc.slides.findIndex(s=>s.id===id);if(i<0)throw new Error('Unknown slide');store.goTo(i);}},
 {name:'select_elements',description:'Select elements on the current slide for formatting, alignment or grouping controls.',schema:z.object({ids:z.array(z.string())}).strict(),readOnly:true,run:({ids})=>{if(ids.some((id:string)=>!store.slide.elements.some(e=>e.id===id)))throw new Error('Unknown element on current slide');store.select(ids);}},
 {name:'validate',description:'Run the actual renderer/document diagnostics.',schema:z.object({}).strict(),readOnly:true,run:()=>validateDoc(store.doc)},
 {name:'measure_text',description:'Measure text with the real renderer before placing it.',schema:z.object({html:z.string(),w:z.number().positive(),h:z.number().positive().optional(),fontSize:z.number().positive().optional(),fontFamily:z.string().optional(),fontWeight:z.number().optional(),lineHeight:z.number().positive().optional(),letterSpacing:z.number().optional()}).strict(),readOnly:true,run:input=>measureText(input,store.doc)},
 {name:'measure_element',description:'Measure an existing text element.',schema:z.object({id:z.string()}).strict(),readOnly:true,run:({id})=>{const el=store.doc.slides.flatMap(s=>s.elements).find(e=>e.id===id);if(el?.type!=='text')throw new Error('Unknown text element');return measureElement(el,store.doc);}},
 {name:'present',description:'Start presentation. Fullscreen may require a real user gesture.',schema:z.object({fromStart:z.boolean().default(false),fullscreen:z.boolean().default(false)}).strict(),readOnly:true,run:({fromStart,fullscreen})=>editor.present(fromStart,fullscreen)},
 {name:'print',description:'Open browser print using the native slide print layout.',schema:z.object({}).strict(),readOnly:true,run:()=>{editor.exportPdf();return {printDialogRequested:true};}},
 {name:'speaker_view',description:'Open speaker view. Browser popup policy applies.',schema:z.object({}).strict(),readOnly:true,run:()=>editor.openSpeakerView()},
],()=>editor.flushActiveEdit()));
