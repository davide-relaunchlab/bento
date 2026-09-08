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
const editor = new Editor(document.getElementById('app')!,store,host);
const narrow=matchMedia('(max-width: 700px)');
narrow.addEventListener('change',()=>{if(narrow.matches){editor.closePanel('left');editor.closePanel('right');}});
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
