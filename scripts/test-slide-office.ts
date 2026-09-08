#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 The Bento authors
// Hosted persistence boundary; run with node --import tsx scripts/test-slide-office.ts.
import assert from 'node:assert/strict';
import {Store} from '../slides/src/store.ts';
import {newDoc,emptySlide,defaultText,type BentoDoc} from '../slides/src/model.ts';

const doc = newDoc();
doc.slides = [emptySlide({id:'first'}),emptySlide({id:'second'})];
doc.slides[1].elements.push(defaultText({id:'text'}));
const store = new Store(doc);
const edits:BentoDoc[] = [];
let undos=0,redos=0;
store.delegate={changed:next=>edits.push(structuredClone(next)),undo:()=>{undos++;return true;},redo:()=>{redos++;return true;}};
store.goTo(1);store.select(['text']);
const live = store.doc;
store.commit(()=>{store.doc.title='Hosted title';});
assert.equal(edits.length,1);
assert.equal(edits[0].title,'Hosted title');
assert.equal(store.doc,live,'ordinary commits preserve live object identity');
// Continuous panel controls bypass commit: one checkpoint, many touch events.
store.checkpoint();
store.slide.elements[0].x=14;store.touch();
store.slide.elements[0].x=28;store.touch();
assert.equal(edits.length,3);
assert.equal(edits[1].slides[1].elements[0].x,14);
assert.equal(edits[2].slides[1].elements[0].x,28);
store.undo();store.redo();
assert.equal(undos,1);assert.equal(redos,1);
assert.equal(store.slide.elements[0].x,28,'hosted undo cannot restore a local snapshot');
assert.throws(()=>store.replaceDoc(newDoc()),/bento\/office/);

store.readOnly=true;
store.commit(()=>{store.doc.title='Unauthorized';});
store.checkpoint();store.touch();store.undo();store.redo();store.replaceDoc(newDoc());
assert.equal(store.doc.title,'Hosted title');assert.equal(edits.length,3);
assert.equal(undos,1);assert.equal(redos,1);
store.readOnly=false;

let currents=0,selections=0;
store.on('current',()=>currents++);store.on('selection',()=>selections++);
store.adopt(structuredClone(store.doc));
assert.equal(store.doc,live,'equal echoes preserve references and focus');
assert.equal(currents,0);assert.equal(selections,0);
const remote=structuredClone(store.doc);
remote.slides.unshift(emptySlide({id:'inserted'}));
store.adopt(remote);
assert.equal(store.slide.id,'second');assert.deepEqual(store.selection,['text']);
assert.equal(currents,0);assert.equal(selections,0);
assert.equal(edits.length,3,'remote adoption never enters outgoing persistence');
remote.slides=remote.slides.filter(s=>s.id!=='second');
store.adopt(remote);
assert.equal(store.slide.id,'first');assert.deepEqual(store.selection,[]);
assert.equal(currents,1);assert.equal(selections,1);
assert.throws(()=>store.adopt({...remote,docId:'different'}),/Invalid/);
assert.throws(()=>store.adopt({...remote,slides:[]}),/Invalid/);

store.delegate.changed=()=>{throw new Error('Retain draft');};
assert.throws(()=>store.commit(()=>{store.doc.title='Recoverable draft';}),/Retain draft/);
assert.equal(store.doc.title,'Recoverable draft');assert.equal(store.dirty,true);
console.log('slide office: hosted changes, continuous inputs, undo/redo, viewer, identity, adoption and draft retention passed');
