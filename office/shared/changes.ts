// SPDX-License-Identifier: MIT
// Hosted transactions reuse Bento's patch and formula engines. Guards are
// computed from authoritative historical content, never supplied by a caller.
import { z } from 'zod';
import { applyPatch, readCell, _internals, type Patch } from '../../dash/src/store.ts';
import { validateDoc } from '../../dash/src/validate.ts';
import { cellKey, recalcWorkbook, workbookSources } from '../../dash/src/cellformula.ts';
import { colToLetters, lettersToCol } from '../../dash/src/a1.ts';
import { isErr } from '../../dash/src/formula.ts';
import type { DashDoc, Sheet, TableSheet, CanvasSheet } from '../../dash/src/model.ts';

export class OfficeError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) { super(message); }
}
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
import {dangerous,id,num,cell,column,columnData,dashPatchSchema as patchSchema} from './patch-schemas.ts';
const MAX_ITEMS = 100_000;
const docFields = new Set(['title', 'meta', 'theme', 'story', 'chart', 'names', 'views', 'assets']);
const sheetForbidden = new Set(['id', 'kind', 'columns', 'data', 'cells', 'rids', 'nextRid', 'collab', 'readonly', 'template', 'officeStructure']);
const clone = <T>(v: T): T => structuredClone(v);

export function canonical(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}';
}
export async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
function assertSafe(value: unknown): void {
  let count = 0;
  function visit(v: unknown, depth: number) {
    if (++count > 1_000_000 || depth > 40) throw new OfficeError('too_large', 'Struttura troppo grande o profonda.', 413);
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint' || (typeof v === 'number' && !Number.isFinite(v))) throw new OfficeError('invalid_json', 'È richiesto JSON finito.');
    if (v && typeof v === 'object') {
      if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) throw new OfficeError('invalid_json', 'Oggetto non JSON.');
      for (const [key, item] of Object.entries(v)) {
        if (dangerous.has(key)) throw new OfficeError('unsafe_key', 'Chiave riservata nel contenuto.');
        visit(item, depth + 1);
      }
    }
  }
  visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_DOCUMENT_BYTES) throw new OfficeError('too_large', 'Il contenuto supera il limite di 8 MB del salvataggio condiviso.', 413);
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function fail(message: string): never { throw new OfficeError('invalid_change', message); }
function address(v: string): { row: number; col: number } {
  const m = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(v);
  if (!m) return fail('Indirizzo di cella non valido.');
  const col = lettersToCol(m[1]), row = Number(m[2]) - 1;
  if (col >= 16384 || row >= 1048576) return fail('Indirizzo fuori dal foglio.');
  return { col, row };
}
function permutation(values: string[], expected: string[]) {
  if (values.length !== expected.length || new Set(values).size !== values.length || expected.some(x => !values.includes(x))) fail('L’ordine deve contenere ogni identificatore una sola volta.');
}
function sheetById(doc: DashDoc, wanted: string): Sheet {
  const sheet = doc.sheets.find(s => s.id === wanted);
  return sheet ?? fail('Il foglio richiesto non esiste.');
}

export function validateWorkbook(input: unknown): DashDoc {
  assertSafe(input);
  if (!object(input) || input.format !== 'bento/dash' || input.version !== 1 || (input.policy !== undefined && input.policy !== 'bento-dash-1')) fail('Formato o versione non supportati per la modifica condivisa.');
  if (!id.safeParse(input.docId).success || !z.string().min(1).max(300).safeParse(input.title).success) fail('Identità o titolo del foglio non validi.');
  for (const k of ['collab','readonly','template','blobs','sync','_sync']) if (k in input) fail('Le credenziali e lo stato locale non appartengono al contenuto condiviso.');
  if(input.officeSheetGenerations!==undefined&&!z.record(id,num).safeParse(input.officeSheetGenerations).success)fail('Generazioni dei fogli non valide.');
  if (!Array.isArray(input.sheets) || input.sheets.length === 0 || input.sheets.length > 100) fail('Serve almeno un foglio, fino a un massimo di 100.');
  const seen = new Set<string>();
  for (const s of input.sheets) {
    if (!object(s) || !id.safeParse(s.id).success || typeof s.name !== 'string' || s.name.length > 300 || seen.has(s.id as string)) fail('Struttura o identità del foglio non valida.');
    seen.add(s.id as string);
    if (s.kind === 'canvas') {
      if (!object(s.cells) || Object.keys(s.cells).length > MAX_ITEMS) fail('Celle non valide.');
      for (const [a, c] of Object.entries(s.cells)) { address(a); if (!cell.safeParse(c).success) fail('Contenuto di cella non valido.'); }
    } else if (s.kind === 'table') {
      if (!Array.isArray(s.columns) || s.columns.length > 16384 || !object(s.data) || !Array.isArray(s.rids) || !Array.isArray(s.steps)) fail('Dataset non valido.');
      const columns = new Set<string>();
      let rows = 0;
      for (const r of s.rids) {
        if (!Array.isArray(r) || r.length !== 2 || !Number.isSafeInteger(r[0]) || r[0] < 1 || !Number.isSafeInteger(r[1]) || r[1] < 1 || !Number.isSafeInteger(r[0]+r[1])) fail('Identificatori di riga non validi.');
        rows += r[1];
      }
      if (rows > 250000) throw new OfficeError('too_large', 'Questo dataset supera 250.000 righe condivise.', 413);
      for (const c of s.columns) {
        if (!object(c) || !column.safeParse(c).success || columns.has(c.id as string)) fail('Colonna non valida o duplicata.');
        columns.add(c.id as string);
      }
      for (const d of Object.values(s.data)) if (!columnData.safeParse(d).success) fail('Codifica o valori del dataset non modificabili in questa versione.');
      if(s.cells!==undefined && (!object(s.cells)||Object.values(s.cells).some(c=>!cell.safeParse(c).success)))fail('Override del dataset non validi.');
      if(s.totals!==undefined && (!object(s.totals)||Object.values(s.totals).some(v=>typeof v!=='string'&&(!object(v)||typeof v.f!=='string'))))fail('Totali non validi.');
      if(s.steps.some(step=>!object(step)||typeof step.op!=='string'))fail('Passaggi del dataset non validi.');
    } else if (s.kind === 'pivot') {if(!object(s.pivot))fail('Specifica pivot non valida.');}
    else fail('Tipo di foglio non supportato dalla suite.');
    if(s.officeStructure!==undefined&&!num.safeParse(s.officeStructure).success)fail('Generazione del foglio non valida.');
    if(s.comments!==undefined&&!Array.isArray(s.comments))fail('Commenti non validi.');
  }
  const doc = input as unknown as DashDoc;
  const result = validateDoc(doc);
  if (!result.ok || result.counts.repairable) fail('Il documento contiene una struttura incoerente: ' + result.findings.filter(f => f.severity !== 'suspicious').map(f => f.code).join(', '));
  return doc;
}

function parsePatches(input: unknown): Patch[] {
  assertSafe(input);
  const result = z.array(patchSchema).min(1).max(500).safeParse(input);
  if (!result.success) throw new OfficeError('invalid_change', 'Operazione non valida.', 400, result.error.issues.map(x => ({ path: x.path, message: x.message })));
  return result.data as unknown as Patch[];
}
function checkPatch(doc: DashDoc, p: Patch): void {
  if (p.op === 'setDocProps') {
    for (const key of [...Object.keys(p.props), ...(p.drop ?? [])]) if (!docFields.has(key)) fail('Proprietà del documento non modificabile: ' + key);
  }
  if (p.op === 'setSheetProps') {
    for (const key of [...Object.keys(p.props), ...(p.drop ?? [])]) if (sheetForbidden.has(key)) fail('Proprietà strutturale del foglio non modificabile.');
  }
  if (p.op === 'setColumn' && [...Object.keys(p.patch),...((p as ColumnPatch).drop??[])].some(k => ['id','collab','readonly'].includes(k))) fail('Identità della colonna non modificabile.');
  if (p.op === 'reorderSheets') permutation(p.order, doc.sheets.map(s => s.id));
  if (p.op === 'setSheet' && p.sheet && p.id !== p.sheet.id) fail('Identità del foglio discordanti.');
  if (p.op === 'setView' && p.view && p.id !== p.view.id) fail('Identità della vista discordanti.');
  if (typeof (p as {sheet?: unknown}).sheet !== 'string') return;
  const s = sheetById(doc, (p as {sheet:string}).sheet);
  if (p.op === 'setCanvasCells') for (const a of Object.keys(p.cells)) address(a);
  if (p.op === 'setCanvasSizes') {
    for (const c of Object.keys(p.cols ?? {})) address(c + '1');
    for (const r of Object.keys(p.rows ?? {})) address('A' + r);
  }
  if (p.op === 'setCells' || p.op === 'insertRows' || p.op === 'deleteRows') {
    if (s.kind !== 'table' || new Set(p.rids).size !== p.rids.length || p.rids.some(r => r < 1)) fail('Righe non valide.');
    const exists = (rid: number) => _internals.ridIndex(s as TableSheet, rid) >= 0;
    if (p.op === 'insertRows' ? p.rids.some(exists) : p.rids.some(r => !exists(r))) fail('Una riga è assente o già presente.');
    if (p.op === 'setCells' && p.v.length !== p.rids.length) fail('Ogni riga deve avere esattamente un valore.');
    if (p.op === 'insertRows' && ((p.at && p.at.length !== p.rids.length) || Object.values(p.values ?? {}).some(v => v.length !== p.rids.length))) fail('Numero di righe e valori discordante.');
  }
  if (p.op === 'setOverrides') {
    if (s.kind !== 'table' || p.keys.length !== p.v.length || new Set(p.keys).size !== p.keys.length) fail('Override non validi.');
    for (const k of p.keys) {
      const at = k.lastIndexOf(':'), col = k.slice(0,at), rid = Number(k.slice(at+1));
      if (at < 1 || !s.columns.some(c => c.id === col) || _internals.ridIndex(s, rid) < 0) fail('Override riferito a una cella assente.');
    }
  }
  if (p.op === 'reorderColumns') {
    if (s.kind !== 'table') fail('Serve un dataset.');
    permutation(p.order, s.columns.map(c => c.id));
  }
}

type Scope = { kind: 'cell'|'tableCell'|'override'|'sheet'|'docField'|'doc'; sheet?: string; key?: string; rid?: number };
export type Guard = { scope: Scope; hash: string };
export type Difference = { scope: Scope; before: unknown; after: unknown };
export type PreparedChange = { patches: Patch[]; inverse: Patch[]; guards: Guard[]; undoGuards: Guard[]; differences: Difference[]; warnings: ReturnType<typeof validateDoc>['findings'] };
function scopes(p: Patch): Scope[] {
  switch (p.op) {
    case 'setCanvasCells': return Object.keys(p.cells).map(key => ({ kind: 'cell', sheet: p.sheet, key }));
    case 'setCells': return p.rids.map(rid => ({ kind: 'tableCell', sheet: p.sheet, key: p.col, rid }));
    case 'setOverrides': return p.keys.map(key => ({ kind:'override', sheet:p.sheet, key }));
    case 'setTitle': return [{kind:'docField', key:'title'}];
    case 'setDocProps': return [...Object.keys(p.props), ...(p.drop ?? [])].map(key => ({kind:'docField', key}));
    case 'reorderSheets': case 'setSheet': return [{kind:'doc'}];
    default: return typeof (p as {sheet?:unknown}).sheet === 'string' ? [{kind:'sheet', sheet:(p as {sheet:string}).sheet}] : [{kind:'doc'}];
  }
}
function valueAt(doc: DashDoc, scope: Scope): unknown {
  if (scope.kind === 'doc') {const {modified:_,...content}=doc;return content;}
  if (scope.kind === 'docField') return doc[scope.key!];
  const sheet = doc.sheets.find(s => s.id === scope.sheet);
  if (!sheet) return undefined;
  if (scope.kind === 'sheet') return sheet;
  if (scope.kind === 'cell') return { kind:sheet.kind, structure:(doc.officeSheetGenerations as Record<string,number>|undefined)?.[sheet.id]??sheet.officeStructure??0, cell:(sheet as CanvasSheet).cells?.[scope.key!] ?? null };
  if (scope.kind === 'override') {
    if(sheet.kind!=='table')return undefined;
    const at=scope.key!.lastIndexOf(':'),col=scope.key!.slice(0,at),rid=Number(scope.key!.slice(at+1)),row=_internals.ridIndex(sheet,rid);
    return {kind:sheet.kind,structure:(doc.officeSheetGenerations as Record<string,number>|undefined)?.[sheet.id]??sheet.officeStructure??0,column:sheet.columns.find(c=>c.id===col),exists:row>=0,raw:row<0?null:readCell(sheet.data[col],row),cell:sheet.cells?.[scope.key!]??null};
  }
  if (sheet.kind !== 'table') return undefined;
  const row = _internals.ridIndex(sheet, scope.rid!);
  return { structure:(doc.officeSheetGenerations as Record<string,number>|undefined)?.[sheet.id]??sheet.officeStructure??0,column:sheet.columns.find(c => c.id === scope.key), exists:row >= 0, value:row < 0 ? null : readCell(sheet.data[scope.key!], row) };
}
async function guardsFor(doc: DashDoc, list: Scope[]): Promise<Guard[]> {
  return Promise.all(list.map(async scope => ({scope, hash:await digest(valueAt(doc,scope))})));
}
type ColumnPatch=Extract<Patch,{op:'setColumn'}>&{drop?:string[]};
function semanticInverse(p: Patch): Patch {
  // Dictionary indices are an implementation detail; trimming after another
  // user's edit would remove strings now used by unrelated rows.
  const v = clone(p);
  if (v.op === 'setCells') delete v.dictLen;
  if(v.op==='setColumn') {
    const drop=Object.entries(v.patch).filter(([,value])=>value===undefined).map(([key])=>key);
    if(drop.length)(v as ColumnPatch).drop=drop;
  }
  return JSON.parse(JSON.stringify(v)) as Patch;
}

function applyHosted(doc:DashDoc,p:Patch):Patch {
  // A hosted-only JSON spelling for property deletion is decoded immediately
  // before Bento's writer and encoded in its inverse, keeping the delta small.
  let patch=clone(p);
  if(patch.op==='setColumn')for(const key of (patch as ColumnPatch).drop??[])patch.patch[key]=undefined;
  if(patch.op==='setSheet') {
    const existing=doc.sheets.find(s=>s.id===patch.id);
    const generations=(doc.officeSheetGenerations??={}) as Record<string,number>;
    const generation=Number(generations[patch.id]??existing?.officeStructure??0)+1;
    generations[patch.id]=generation;
    if(patch.sheet)patch.sheet.officeStructure=generation;
  }
  let inverse:Patch;
  try {inverse=applyPatch(doc,patch).inverse;}catch(error){throw new OfficeError('invalid_change',error instanceof Error?error.message:'Operazione non applicabile.');}
  if(patch.op==='setColumn') {
    const sheet=sheetById(doc,patch.sheet) as TableSheet,col=sheet.columns.find(c=>c.id===patch.col)!;
    for(const [key,value]of Object.entries(patch.patch))if(value===undefined)delete col[key];
  }
  return semanticInverse(inverse);
}
function writesFormula(p:Patch):boolean {
  if(p.op==='setCanvasCells')return Object.values(p.cells).some(c=>!!c?.f);
  if(p.op==='setOverrides')return p.v.some(c=>!!c?.f);
  if(p.op==='setColumn')return typeof p.patch.formula==='string';
  return p.op==='addColumn'&&!!p.column.formula;
}
export function previewChange(base:DashDoc,input:unknown) {
  validateWorkbook(base);
  const patches = parsePatches(input), next = clone(base), inverse: Patch[] = [];
  let inverseBytes=0;
  const list = Array.from(new Map(patches.flatMap(scopes).map(s => [canonical(s),s])).values());
  for (const p of patches) {
    checkPatch(next, p);
    const back=applyHosted(next,p);
    inverseBytes+=new TextEncoder().encode(JSON.stringify(back)).length;
    if(inverseBytes>MAX_DOCUMENT_BYTES)throw new OfficeError('too_large','La modifica è troppo grande da annullare in un solo passaggio. Dividila in parti più piccole.',413);
    inverse.unshift(back);
  }
  validateWorkbook(next);
  return {next,patches,inverse,list};
}
export async function prepareChange(base: DashDoc, input: unknown, options:{protectRead?:boolean}={}): Promise<PreparedChange> {
  const {next,patches,inverse,list}=previewChange(base,input);
  const readScopes:Scope[]=(options.protectRead||patches.some(writesFormula))?[{kind:'doc'}]:[];
  return { patches, inverse, guards:await guardsFor(base,[...list,...readScopes]), undoGuards:await guardsFor(next,list), differences:list.map(scope => ({scope, before:clone(valueAt(base,scope) ?? null), after:clone(valueAt(next,scope) ?? null)})), warnings:validateDoc(next).findings };
}
export async function applyPrepared(current: DashDoc, prepared: PreparedChange, direction: 'forward'|'undo' = 'forward'): Promise<DashDoc> {
  const guards = direction === 'undo' ? prepared.undoGuards : prepared.guards;
  const conflicts: Scope[] = [];
  for (const guard of guards) if (await digest(valueAt(current,guard.scope)) !== guard.hash) conflicts.push(guard.scope);
  if (conflicts.length) throw new OfficeError('conflict', 'conflict: il contenuto è cambiato. Rileggi le parti indicate prima di applicare.', 409, conflicts);
  const next = clone(current);
  for (const p of direction === 'undo' ? prepared.inverse : prepared.patches) {
    checkPatch(next,p);
    applyHosted(next,p);
  }
  return validateWorkbook(next);
}

export function newWorkbook(title: string, docId: string = crypto.randomUUID()): DashDoc {
  return { format:'bento/dash', version:1, policy:'bento-dash-1', docId, title, sheets:[{id:'sheet-1',kind:'canvas',name:'Foglio 1',cells:{}}] };
}
export function readRange(doc: DashDoc, sheetId: string, range: string): Array<{address:string; value:unknown; formula:string|null; error:string|null}> {
  sheetById(doc,sheetId);
  const parts = range.split(':');
  if (parts.length > 2) fail('Intervallo non valido.');
  const from = address(parts[0]), to = address(parts[1] ?? parts[0]);
  if (to.row < from.row || to.col < from.col || (to.row-from.row+1)*(to.col-from.col+1) > 2000) fail('Richiedi un intervallo di massimo 2.000 celle.');
  const sources = workbookSources(doc), source = sources.find(s => s.id === sheetId)!;
  const computed = recalcWorkbook(sources,doc.modified).get(sheetId);
  const rows = [];
  for (let r=from.row;r<=to.row;r++) for(let c=from.col;c<=to.col;c++) {
    const key=cellKey(r,c), value = computed?.values.has(key) ? computed.values.get(key) : source.source.valueAt(r,c);
    rows.push({ address:colToLetters(c)+(r+1), value:isErr(value) ? null : (value ?? null), formula:source.source.formulaAt(r,c) ?? null, error:isErr(value) ? String(value) : null });
  }
  return rows;
}
