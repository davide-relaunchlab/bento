import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareChange, applyPrepared, newWorkbook, validateWorkbook, readRange } from '../shared/changes.ts';
import type { DashDoc } from '../../dash/src/model.ts';

const book = () => newWorkbook('Budget', 'doc-test');
const change = (cells: Record<string, unknown>) => [{ op: 'setCanvasCells', sheet: 'sheet-1', cells }];

test('uses the real Bento formula engine and stable document identity', async () => {
  const d = book();
  const p = await prepareChange(d, change({ A1: { v: 12 }, A2: { v: 8 }, A3: { f: '=SUM(A1:A2)' } }));
  const next = await applyPrepared(d, p);
  assert.equal(next.docId, 'doc-test');
  assert.equal(readRange(next, 'sheet-1', 'A3:A3')[0].value, 20);
  assert.equal(readRange(next, 'sheet-1', 'A3:A3')[0].formula, '=SUM(A1:A2)');
  assert.deepEqual(d, book());
});

test('independent edits merge and stale writes to the same cell are refused', async () => {
  const d = book();
  const first = await prepareChange(d, change({ A1: { v: 'Alice' } }));
  const other = await prepareChange(d, change({ B1: { v: 'Bob' } }));
  const collision = await prepareChange(d, change({ A1: { v: 'Agent' } }));
  const a = await applyPrepared(d, first);
  const both = await applyPrepared(a, other);
  assert.equal(readRange(both, 'sheet-1', 'A1:B1')[1].value, 'Bob');
  await assert.rejects(applyPrepared(both, collision), /conflict/);
});

test('undo preserves later independent edits and refuses to erase a newer value', async () => {
  const d = book();
  const p = await prepareChange(d, change({ A1: { v: 10 } }));
  const edited = await applyPrepared(d, p);
  const q = await prepareChange(edited, change({ B1: { v: 99 } }));
  const other = await applyPrepared(edited, q);
  const reverted = await applyPrepared(other, p, 'undo');
  assert.equal(readRange(reverted, 'sheet-1', 'B1:B1')[0].value, 99);
  assert.equal(readRange(reverted, 'sheet-1', 'A1:A1')[0].value, null);
  const q2 = await prepareChange(edited, change({ A1: { v: 22 } }));
  await assert.rejects(applyPrepared(await applyPrepared(edited, q2), p, 'undo'), /conflict/);
});

test('batch failure never mutates the original, even after an otherwise valid operation', async () => {
  const d = book();
  await assert.rejects(prepareChange(d, [{ op: 'setTitle', title: 'Lost title' }, { op: 'not-a-real-operation' }]));
  assert.equal(d.title, 'Budget');
});

test('identity, ACL and prototype keys are never writable operations', async () => {
  for (const props of [{ docId: 'other' }, { collab: { key: 'secret' } }, { readonly: false }, JSON.parse('{"__proto__":{"polluted":true}}')]) {
    await assert.rejects(prepareChange(book(), [{ op: 'setDocProps', props }]));
  }
  await assert.rejects(prepareChange(book(), change({ A1: JSON.parse('{"v":{"constructor":{"prototype":{"polluted":true}}}}') })));
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('invalid cell addresses, duplicate sheet permutations and removal of last sheet are rejected', async () => {
  await assert.rejects(prepareChange(book(), change({ INVALID: { v: 1 } })));
  await assert.rejects(prepareChange(book(), [{ op: 'reorderSheets', order: ['sheet-1', 'sheet-1'] }]));
  await assert.rejects(prepareChange(book(), [{ op: 'setSheet', id: 'sheet-1' }]));
});

test('a shape change invalidates a prepared positional cell edit', async () => {
  const d = book();
  const p = await prepareChange(d, change({ A4: { v: 42 } }));
  const replace = await prepareChange(d, [{ op: 'setSheet', id: 'sheet-1', sheet: { id: 'sheet-1', kind: 'canvas', name: 'Different', cells: {} } }]);
  await assert.rejects(applyPrepared(await applyPrepared(d, replace), p), /conflict/);
});

test('column-property undo removes a formerly absent field after JSON storage',async()=>{
  for(const patch of [{format:'0.00'},{w:144},{formula:'1+1'}]) {
    const d:DashDoc={...book(),sheets:[{id:'t',name:'Data',kind:'table',rids:[[1,2]],columns:[{id:'n',name:'Number',type:'number'}],data:{n:{enc:'raw',v:[1,2]}},steps:[]}]};
    const p=await prepareChange(d,[{op:'setColumn',sheet:'t',col:'n',patch}]);
    const result=await applyPrepared(await applyPrepared(d,p),JSON.parse(JSON.stringify(p)),'undo');
    assert.deepEqual((result.sheets[0] as any).columns,(d.sheets[0] as any).columns);
  }
});
test('override guards include the underlying cell and column',async()=>{
  const d:DashDoc={...book(),sheets:[{id:'t',name:'Data',kind:'table',rids:[[1,2]],columns:[{id:'n',name:'Number',type:'number'}],data:{n:{enc:'raw',v:[1,2]}},steps:[]}]};
  const p=await prepareChange(d,[{op:'setOverrides',sheet:'t',keys:['n:1'],v:[{v:10}]}]);
  const q=await prepareChange(d,[{op:'setCells',sheet:'t',col:'n',rids:[1],v:[2]}]);
  await assert.rejects(applyPrepared(await applyPrepared(d,q),p),/conflict/);
});
test('formula proposals protect their inputs, while ordinary disjoint writes remain mergeable',async()=>{
  const d=book();
  const p=await prepareChange(d,change({B1:{f:'=A1+1'}}));
  const q=await prepareChange(d,change({A1:{v:100}}));
  await assert.rejects(applyPrepared(await applyPrepared(d,q),p),/conflict/);
});
test('known data fields cannot hide invalid objects behind extensible schemas',async()=>{
  const d:DashDoc={...book(),sheets:[{id:'t',name:'Data',kind:'table',rids:[[1,2]],columns:[{id:'n',name:'Number',type:'number'}],data:{n:{enc:'raw',v:[1,2]}},steps:[]}]};
  await assert.rejects(prepareChange(d,[{op:'setColumn',sheet:'t',col:'n',patch:{formula:{bad:true}}}]));
  const bad=structuredClone(d);(bad.sheets[0] as any).data.n.v[0]={bad:true};
  assert.throws(()=>validateWorkbook(bad));
});

test('table-cell undo keeps another author’s later dictionary entry', async () => {
  const d: DashDoc = { ...book(), sheets: [{ id: 't', kind: 'table', name: 'People', rids: [[1,2]], columns: [{ id: 'name', name: 'Name', type: 'text' }], data: { name: { enc: 'dict', dict: ['a','b'], idx: [0,1] } }, steps: [] }] };
  const p = await prepareChange(d, [{ op: 'setCells', sheet: 't', col: 'name', rids: [1], v: ['Alice'] }]);
  const a = await applyPrepared(d, p);
  const q = await prepareChange(a, [{ op: 'setCells', sheet: 't', col: 'name', rids: [2], v: ['Bob'] }]);
  const both = await applyPrepared(a, q);
  const undone = await applyPrepared(both, p, 'undo');
  assert.equal(readRange(undone, 't', 'A2:A2')[0].value, 'Bob');
  assert.equal(readRange(undone, 't', 'A1:A1')[0].value, 'a');
  validateWorkbook(undone);
});

test('bad row ids and mismatched value cardinality do not silently succeed', async () => {
  const d: DashDoc = { ...book(), sheets: [{ id: 't', kind: 'table', name: 'Data', rids: [[1,2]], columns: [{ id: 'n', name: 'Number', type: 'number' }], data: { n: { enc: 'raw', v: [1,2] } }, steps: [] }] };
  await assert.rejects(prepareChange(d, [{ op: 'setCells', sheet: 't', col: 'n', rids: [3], v: [3] }]));
  await assert.rejects(prepareChange(d, [{ op: 'setCells', sheet: 't', col: 'n', rids: [1,2], v: [3] }]));
});

test('document validation preserves safe extension data and rejects unsafe structures', () => {
  const d = { ...book(), extension: { source: 'user supplied' } };
  assert.deepEqual(validateWorkbook(d).extension, d.extension);
  assert.throws(() => validateWorkbook({ ...d, collab: { key: 'secret' } }));
  assert.throws(() => validateWorkbook({ ...d, sheets: [] }));
});
