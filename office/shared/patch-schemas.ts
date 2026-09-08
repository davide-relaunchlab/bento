import {z} from 'zod';
const MAX_ITEMS = 100_000;
export const dangerous = new Set(['__proto__', 'prototype', 'constructor']);
export const id = z.string().min(1).max(200).refine(v => !dangerous.has(v));
const text = z.string().max(32_000);
const scalar = z.union([text, z.number().finite(), z.boolean(), z.null()]);
const bag = z.record(z.string(), z.unknown());
export const cell = z.object({ v: scalar.optional(), was:scalar.optional(), f: text.optional(), xlsxF:text.optional(), note: text.optional(),
  format:text.optional(),color:text.optional(),bg:text.optional(),bold:z.boolean().optional(),italic:z.boolean().optional(),underline:z.boolean().optional(),wrap:z.boolean().optional(),
  align:text.optional(),border:text.optional(),borderColor:text.optional(),borderStyle:text.optional(),againstHash:text.optional(),froze:text.optional(),by:text.optional(),at:text.optional(),why:text.optional(),
}).passthrough();
export const column = z.object({id,name:text,type:z.enum(['text','number','money','percent','date','bool','enum']),formula:text.optional(),format:text.optional(),unit:text.optional(),
  parsed:text.optional(),scale:z.number().finite().optional(),role:z.enum(['key','fk','label']).optional(),failed:z.number().int().nonnegative().optional(),w:z.number().finite().positive().optional()}).passthrough();
export const columnData=z.discriminatedUnion('enc',[
  z.object({enc:z.literal('raw'),v:z.array(scalar).max(250000)}).passthrough(),
  z.object({enc:z.literal('dict'),dict:z.array(text).max(250000),idx:z.array(z.number().int().nonnegative().nullable()).max(250000)}).passthrough(),
]);
export const num = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ids = z.array(id).max(MAX_ITEMS);
const numbers = z.array(num).max(MAX_ITEMS);
const values = z.array(scalar).max(MAX_ITEMS);
const props = { props: bag, drop: z.array(id).max(100).optional() };
const schemas = [
  z.object({ op: z.literal('setCanvasCells'), sheet: id, cells: z.record(z.string(), cell.nullable()) }).strict(),
  z.object({ op: z.literal('setCells'), sheet: id, col: id, rids: numbers, v: values }).strict(),
  z.object({ op: z.literal('setOverrides'), sheet: id, keys: ids, v: z.array(cell.nullable()).max(MAX_ITEMS), dropEmpty: z.boolean().optional() }).strict(),
  z.object({ op: z.literal('insertRows'), sheet: id, rids: numbers, at: numbers.optional(), values: z.record(id, values).optional(), overrides: z.record(id, cell).optional(), dropEmptyCells: z.boolean().optional() }).strict(),
  z.object({ op: z.literal('deleteRows'), sheet: id, rids: numbers }).strict(),
  z.object({ op: z.literal('setColumn'), sheet: id, col: id, patch: bag, drop:z.array(id).max(100).optional(),data: bag.optional() }).strict(),
  z.object({ op: z.literal('addColumn'), sheet: id, column: z.object({ id, name: text, type: z.string() }).passthrough(), at: num.optional(), data: bag.optional() }).strict(),
  z.object({ op: z.literal('removeColumn'), sheet: id, col: id }).strict(),
  z.object({ op: z.literal('reorderColumns'), sheet: id, order: ids }).strict(),
  z.object({ op: z.literal('setMeasure'), name: id, measure: bag.optional(), dropEmpty: z.boolean().optional() }).strict(),
  z.object({ op: z.literal('setTitle'), title: z.string().min(1).max(300) }).strict(),
  z.object({ op: z.literal('setSheetProps'), sheet: id, ...props }).strict(),
  z.object({ op: z.literal('setDocProps'), ...props }).strict(),
  z.object({ op: z.literal('setView'), id, view: bag.optional(), at: num.optional(), dropEmpty: z.boolean().optional() }).strict(),
  z.object({ op: z.literal('setSheet'), id, sheet: bag.optional(), at: num.optional() }).strict(),
  z.object({ op: z.literal('reorderSheets'), order: ids }).strict(),
  z.object({ op: z.literal('setComment'), sheet: id, id, comment: bag.optional(), at: num.optional() }).strict(),
  z.object({ op: z.literal('setCanvasSizes'), sheet: id, cols: z.record(z.string(), z.number().finite().positive().max(5000).nullable()).optional(), rows: z.record(z.string(), z.number().finite().positive().max(5000).nullable()).optional() }).strict(),
  z.object({ op: z.literal('applySteps'), sheet: id, steps: z.array(bag).max(500) }).strict(),
  z.object({ op: z.literal('refreshBinding'), sheet: id, cols: z.record(id, bag) }).strict(),
] as const;
export const dashPatchSchema = z.discriminatedUnion('op', schemas);

const nativeBag=z.record(z.string(),z.unknown());
export const nativeDocFields={
 'bento/type':['title','subtitle','meta','page','footnotes','comments','layout','styles','type','revisions','signatures','track','fonts','assets','bibliography','citeStyle','sections'],
 'bento/slides':['title','meta','size','theme','present','assets','fonts','layouts'],
} as const;
export const nativeSlideFields=['background','transition','notes','themeRefs','name','stateOf','hidden','hover','comments'];
export const nativePatchSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('setBlock'),id,block:nativeBag.optional().describe('Complete block; omit to delete. New paragraph: {id,kind:"para",text:"..."}.'),at:num.optional()}).strict(),
 z.object({op:z.literal('setSlide'),id,value:nativeBag.optional().describe('Complete slide; omit to delete. Prefer addSlide for a new slide with defaults.'),at:num.optional()}).strict(),
 z.object({op:z.literal('addSlide'),id,props:nativeBag.optional().describe('Optional slide properties; defaults supply background, transition, notes and elements.'),at:num.optional()}).strict(),
 z.object({op:z.literal('setElement'),slide:id,id,element:nativeBag.optional().describe('Complete element; omit to delete. Prefer addElement for defaults or updateElement for partial edits.'),at:num.optional()}).strict(),
 z.object({op:z.literal('addElement'),slide:id,id,element:nativeBag.describe('At least type: text, code, shape, image, svg, chart, table or media. Native defaults fill missing fields. Text uses html; image/media use src.'),at:num.optional()}).strict(),
 z.object({op:z.literal('updateElement'),slide:id,id,props:nativeBag.describe('Changed element fields only, including geometry, content, styling, grouping and animation. Identity and type cannot change.'),drop:z.array(id).optional()}).strict(),
 z.object({op:z.literal('reorderBlocks'),order:ids}).strict(),
 z.object({op:z.literal('reorderSlides'),order:ids}).strict(),
 z.object({op:z.literal('reorderElements'),slide:id,order:ids}).strict(),
 z.object({op:z.literal('setDocProps'),...props}).strict(),
 z.object({op:z.literal('setSlideProps'),slide:id,...props}).strict(),
 z.object({op:z.literal('setTitle'),title:z.string().min(1).max(300)}).strict(),
]);
// A union (rather than another discriminated union) allows shared op names.
export const editingPatchSchema=z.union([nativePatchSchema,dashPatchSchema]);
