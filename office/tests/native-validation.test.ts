import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateNativeShape} from '../shared/native-validation.ts';
import {validateWorkbook,prepareChange} from '../shared/content.ts';
import {emptyDoc} from '../../type/src/model.ts';
import {blockHtml} from '../../type/src/render.ts';
import {safeView,embedHtml} from '../../type/src/embed.ts';
import {starterDoc} from '../../slides/src/starterdeck.ts';
import {newDoc,defaultText,defaultCode,defaultTable,defaultShape,defaultImage,defaultMedia,defaultChart,builtinLayouts} from '../../slides/src/model.ts';

test('real slides starter, layouts, every insertable element and valid rich type content pass unchanged',()=>{
  const starter=starterDoc();assert.doesNotThrow(()=>validateNativeShape(starter));
  const slides=newDoc();slides.layouts=builtinLayouts();slides.slides[0].elements=[defaultText(),defaultCode(),defaultTable(),defaultShape('rect'),defaultImage('data:image/png;base64,AA=='),defaultMedia('video',''),defaultChart({series:[{type:'bar',data:[1,2]}]}),{id:'svg',type:'svg',x:0,y:0,w:100,h:100,rotation:0,opacity:1,markup:'<svg></svg>'}];
  assert.doesNotThrow(()=>validateNativeShape(slides));
  const doc=emptyDoc();doc.body[0].text='Hello';doc.body[0].marks=[{t:'b',from:0,to:5},{t:'link',from:0,to:5,href:'https://example.test'}];doc.body[0].notes=[{id:'note',at:0}];doc.footnotes.note='Text';doc.body[0].refs=[{at:0,to:'missing',style:'both'}];doc.body[0].cites=[{at:0,keys:['source'],locator:'1'}];doc.revisions=[{id:'revision',at:'2026-09-08',label:'Before',body:structuredClone(doc.body)}];
  assert.doesNotThrow(()=>validateNativeShape(doc));const snapshot=structuredClone(doc);validateNativeShape(doc);assert.deepEqual(doc,snapshot,'validation must preserve extension data and identity');
});

test('footnote identity cannot break out of its rendered attribute',()=>{
  const doc=emptyDoc();doc.body[0].notes=[{at:0,id:'"><img src=x onerror="window.__officeXss=1">'}];
  const html=blockHtml(doc.body[0]);assert.equal(html.includes('<img'),false);assert.ok(html.includes('&quot;&gt;&lt;img'));
});

test('static embeds never interpolate author SVG into active editor or print HTML',()=>{
  for(const view of ['<svg ><svg/onload="window.__officeXss=1"></svg></svg>','<svg><set attributeName="onload" to="window.__officeXss=1"/></svg>'])assert.equal(safeView(view),null);
  const html=embedHtml({id:'embed',kind:'embed',text:'',embed:{app:'bento/dash',view:'<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'}});
  assert.equal(html.includes('<svg'),false);assert.ok(html.includes('<img'));assert.ok(html.includes('data:image/svg+xml'));
  assert.ok(decodeURIComponent(html).includes('xmlns="http://www.w3.org/2000/svg"'));
});

test('known type structures reject values that crash renderers or explode table grouping',()=>{
  const mutations:Array<(d:any)=>void>=[
    d=>{d.body[0].marks=[null];},
    d=>{d.body[0].text='x';d.body[0].marks=[{t:'link',from:0,to:1,href:12}];},
    d=>{d.body[0].notes={};},d=>{d.body[0].notes=[null];},d=>{d.body[0].refs=[{at:0,to:12}];},
    d=>{d.body[0].cites=[{at:0,keys:[null]}];},d=>{d.body[0].kind='cell';d.body[0].cell={table:'t',cols:0.000001};},
    d=>{d.footnotes.note={};},d=>{d.revisions=[{id:'r',at:'today',label:'Before',body:[null]}];},
    d=>{d.fonts=[null];},d=>{d.styles={invalid:null};},d=>{d.assets={bad:{}};},
  ];
  for(const mutate of mutations){const d=emptyDoc();mutate(d);assert.throws(()=>validateNativeShape(d),{code:'invalid_document'});}
});

test('incomplete native slide elements are rejected before persistence',async()=>{
  const d=newDoc(),id=d.slides[0].id;
  const incomplete={id:'broken',type:'table',x:0,y:0,w:100,h:100,rotation:0,opacity:1};
  const next=structuredClone(d);next.slides[0].elements=[incomplete as any];assert.throws(()=>validateNativeShape(next),{code:'invalid_document'});
  // This pins the HTTP/shared entry point, not just the validation helper.
  assert.throws(()=>validateWorkbook(next),{code:'invalid_document'});
  await assert.rejects(prepareChange(d,[{op:'setElement',slide:id,id:'broken',element:incomplete}]),{code:'invalid_document'});
  const malformed=structuredClone(d);malformed.slides[0].elements=[{...defaultText(),html:null} as any];assert.throws(()=>validateNativeShape(malformed),{code:'invalid_document'});
});
