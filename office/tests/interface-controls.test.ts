import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {InterfaceControls} from '../client/interface-controls.ts';
test('actual handlers, values, stale references and disabled controls',async()=>{
 const dom=new JSDOM('<button title="Insert">+</button><label>Name<input></label><button disabled>No</button>');
 const d=dom.window.document;let clicks=0,value='';d.querySelector('button')!.onclick=()=>clicks++;d.querySelector('input')!.oninput=e=>{value=(e.target as HTMLInputElement).value;};
 const controls=new InterfaceControls(d);const entries=controls.list();
 const b=entries.find(e=>e.label==='Insert')!;await controls.act({id:b.id,action:'click'});assert.equal(clicks,1);
 const input=entries.find(e=>e.tag==='input')!;await controls.act({id:input.id,action:'set_value',value:'Works'});assert.equal(value,'Works');
 await assert.rejects(controls.act({id:entries.find(e=>e.label==='No')!.id,action:'click'}),/disabled/);
 d.querySelector('button')!.remove();await assert.rejects(controls.act({id:b.id,action:'click'}),/stale/);
});
test('same-origin frame controls and content are discoverable without exposing passwords',()=>{
 const dom=new JSDOM('<iframe></iframe><input type="password" value="secret"><button hidden>Hidden</button>');
 dom.window.document.querySelector('iframe')!.contentDocument!.body.innerHTML='<button>Inside</button>';
 const entries=new InterfaceControls(dom.window.document).list();assert(entries.some(e=>e.label==='Inside'));assert(!JSON.stringify(entries).includes('secret'));assert(!entries.some(e=>e.label==='Hidden'));
});
test('mousedown commands, explicit checkbox state and partial rich text selection',async()=>{
 const dom=new JSDOM('<button>Format</button><input type="checkbox"><div contenteditable="true">One <b>two</b> three</div>');
 const d=dom.window.document;let down=0;d.querySelector('button')!.onmousedown=()=>down++;
 const ui=new InterfaceControls(d),all=ui.list();await ui.act({id:all.find(c=>c.tag==='button')!.id,action:'click'});assert.equal(down,1);
 await ui.act({id:all.find(c=>c.tag==='input')!.id,action:'set_value',value:'true'});assert.equal(d.querySelector('input')!.checked,true);
 await ui.act({id:all.find(c=>c.tag==='div')!.id,action:'select_text',start:4,end:7});assert.equal(dom.window.getSelection()!.toString(),'two');
});
test('dialog responses are scoped to a single handler and restored',async()=>{
 const dom=new JSDOM('<button>Prompt</button>'),d=dom.window.document;let answer:string|null=null;const original=dom.window.prompt;
 d.querySelector('button')!.onclick=()=>{answer=dom.window.prompt('Name');};const ui=new InterfaceControls(d);
 await ui.act({id:ui.list().find(c=>c.tag==='button')!.id,action:'click',dialogs:['Named']});assert.equal(answer,'Named');assert.equal(dom.window.prompt,original);
});
