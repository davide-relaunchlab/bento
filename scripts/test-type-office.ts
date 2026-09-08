// Hosted type mutations must use the office transaction boundary, while
// authoritative echoes preserve paragraph objects and never become new edits.
import assert from 'node:assert/strict';
import { Store } from '../type/src/store.ts';
import { emptyDoc } from '../type/src/model.ts';

const doc = emptyDoc();
doc.body.push({ id: 'second', kind: 'para', text: 'Unchanged paragraph' });
const store = new Store(doc);
const sent: string[] = [];
let undos = 0, redos = 0, notifications = 0;
store.on(() => { notifications++; });
store.delegate = {
  changed(next) { sent.push(JSON.stringify(next)); },
  undo() { undos++; return true; }, redo() { redos++; return true; },
  canUndo() { return true; }, canRedo() { return true; },
};
const unchanged = store.doc.body[1];
store.commit(next => { next.body[0].text = 'First edit'; }, { scope: { block: doc.body[0].id }, run: 'typing' });
store.commit(next => { next.body[0].text += ' continued'; }, { run: 'typing' });
assert.equal(sent.length, 2, 'each typing mutation reaches the durable queue');
assert.equal(store.undoDepth, 0, 'hosted mutations never create an independent undo history');
assert.equal(store.doc.body[1], unchanged, 'local typing preserves unrelated blocks');
assert.equal(store.canUndo, true);
assert.equal(store.canRedo, true);
assert.equal(store.undo(), true);
assert.equal(store.redo(), true);
assert.equal(undos, 1);
assert.equal(redos, 1);
assert.equal(sent.length, 2, 'undo/redo use the host, not a second changed event');

const sameRoot = store.doc;
const beforeNotify = notifications;
assert.equal(store.adopt(structuredClone(store.doc)), false);
assert.equal(store.doc, sameRoot, 'equivalent echo preserves root reference');
assert.equal(notifications, beforeNotify, 'equivalent echo does not trigger a repaint');
const remote = structuredClone(store.doc);
remote.body[0].text = 'Remote edit';
remote.body.reverse();
assert.equal(store.adopt(remote), true);
assert.equal(store.doc.body[0], unchanged, 'unchanged keyed paragraph survives reorder');
assert.equal(sent.length, 2, 'remote adoption never echoes back as a user edit');
assert.equal(store.undoDepth, 0);
assert.equal(notifications, beforeNotify + 1);
remote.body[1].text = 'Caller changed its snapshot';
assert.equal(store.doc.body[1].text, 'Remote edit', 'adoption does not retain caller-owned changed blocks');

const changed = structuredClone(store.doc);
changed.title = 'Replacement';
store.replace(changed);
assert.equal(sent.length, 3);
assert.equal(store.undoDepth, 0);
assert.throws(() => store.replace(emptyDoc()), /identity/, 'replace cannot switch the office document');
assert.throws(() => store.adopt(emptyDoc()), /identity/, 'adoption cannot switch the office document');
store.touch();
assert.equal(sent.length, 4, 'touch cannot silently bypass the host');

store.setReadOnly(true);
const frozen = JSON.stringify(store.doc);
let ran = false;
store.commit(next => { ran = true; next.title = 'Forbidden'; });
store.replace(changed);
store.touch();
assert.equal(ran, false, 'readonly is checked before invoking a mutation closure');
assert.equal(store.undo(), false);
assert.equal(store.redo(), false);
assert.equal(store.canUndo, false);
assert.equal(store.canRedo, false);
assert.equal(undos, 1);
assert.equal(redos, 1);
assert.equal(sent.length, 4);
assert.equal(JSON.stringify(store.doc), frozen);
const readerUpdate = structuredClone(store.doc);
readerUpdate.title = 'Update visible to readers';
assert.equal(store.adopt(readerUpdate), true, 'readers may receive authoritative updates');
assert.equal(sent.length, 4);

store.setReadOnly(false);
store.delegate.changed = () => { throw new Error('offline queue rejected'); };
assert.throws(() => store.commit(next => { next.title = 'Keep this draft'; }), /offline queue rejected/);
assert.equal(store.doc.title, 'Keep this draft', 'a failed queue leaves the draft available for recovery');
console.log('type office: transactions, delegated undo, identity, adoption, readonly and draft preservation passed');
