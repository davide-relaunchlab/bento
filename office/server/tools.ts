import {z} from 'zod';
import {nativePatchSchema,dashPatchSchema,nativeDocFields,nativeSlideFields} from '../shared/patch-schemas.ts';
import {defaultText,defaultCode,defaultShape,defaultImage,defaultChart,defaultTable,defaultMedia,emptySlide} from '../../slides/src/model.ts';
import {digest} from '../shared/content.ts';
import { toolDefinitions } from '../shared/tools.ts';
import { OfficeError, readRange } from '../shared/changes.ts';
import { _internals,readCell } from '../../dash/src/store.ts';
import { Office, type ChangeInput } from './service.ts';

export async function invokeTool(office:Office,name:string,raw:unknown):Promise<unknown> {
  const tool=toolDefinitions.find(t=>t.name===name);if(!tool)throw new OfficeError('unknown_tool','Strumento non disponibile.',404);
  const parsed=tool.schema.safeParse(raw);if(!parsed.success)throw new OfficeError('invalid_request','Parametri dello strumento non validi.',400,parsed.error.issues);
  const input=parsed.data as Record<string,any>,id=input.workbookId as string;
  switch(name) {
    case 'read_document':return office.get(id);
    case 'get_editing_schema': {
      const w=await office.get(id),d=w.document;
      const schema=d.format==='bento/dash'?dashPatchSchema:nativePatchSchema;
      return {workbookId:w.id,revision:w.revision,format:d.format,
        canApply:w.role!=='viewer'&&(!w.agentPermission||w.agentPermission==='write'),
        canPropose:w.role!=='viewer'&&w.agentPermission!=='read',
        patchSchema:z.toJSONSchema(schema,{io:'input'}),
        documentProperties:d.format==='bento/dash'?['title','meta','theme','story','chart','names','views','assets']:nativeDocFields[d.format],
        ...(d.format==='bento/slides'?{slideProperties:nativeSlideFields,templates:{
          slide:emptySlide({id:'new-slide',background:d.theme.background}),
          text:defaultText({id:'new-text',html:'Your text'}),code:defaultCode({id:'new-code',content:'Your code'}),
          shape:defaultShape('rect',{id:'new-shape'}),image:defaultImage('asset:image-id',{id:'new-image'}),
          chart:defaultChart({xAxis:{data:['A','B']},yAxis:{},series:[{type:'bar',data:[10,20]}]},{id:'new-chart'}),
          table:defaultTable({id:'new-table'},d.theme),media:defaultMedia('video','asset:video-id',{id:'new-media'}),
          svg:{id:'new-svg',type:'svg',x:100,y:100,w:400,h:300,rotation:0,opacity:1,markup:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'},
        }}:d.format==='bento/type'?{templates:{block:{id:'new-paragraph',kind:'para',text:'Your text'}}}:{}),
        guidance:'Copy workbookId verbatim. Read current revision before editing. Proposals do not change content until a person accepts; use apply_change for authorized direct edits. setSlide/setBlock/setElement remove when value/block/element is omitted. Preserve fields when replacing existing objects. All edits are validated, atomic, recorded and undoable.'};
    }
    case 'propose_slide_text': {
      const w=await office.get(id);
      if(w.document.format!=='bento/slides')throw new OfficeError('invalid_format','Serve una presentazione.',400);
      const elementId='t-'+await digest({workbookId:id,operationId:input.operationId});
      const html=input.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
      const geometry=Object.fromEntries(['x','y','w','h','fontSize'].filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));
      const element=defaultText({id:elementId,html,...geometry});
      return office.propose(id,{baseRevision:input.baseRevision,operationId:input.operationId,summary:input.summary,patches:[{op:'setElement',slide:input.slideId,id:elementId,element}]});
    }
    case 'create_workbook':return office.createFromTool(input.title,input.format,input.operationId);
    case 'list_workbooks':return {workbooks:await office.list()};
    case 'describe_workbook': {
      const w=await office.get(id),d=w.document;
      const metadata={id:w.id,workbookId:w.id,canApply:w.role!=='viewer'&&(!w.agentPermission||w.agentPermission==='write'),format:d.format,revision:w.revision,title:d.title,docId:d.docId,role:w.role,agentPermission:w.agentPermission};
      if(d.format==='bento/type')return {...metadata,page:d.page,layout:d.layout??null,type:d.type??null,styles:d.styles??{},blockCount:d.body.length,
        blocks:d.body.map(b=>({id:b.id,kind:b.kind,textLength:b.text.length}))};
      if(d.format==='bento/slides')return {...metadata,size:d.size,theme:d.theme,slideCount:d.slides.length,
        slides:d.slides.map(s=>({id:s.id,name:s.name??null,elements:s.elements.map(e=>({id:e.id,type:e.type}))}))};
      return {...metadata,names:d.names??null,views:d.views??[],chart:d.chart??null,
        sheets:d.sheets.map(s=>({id:s.id,name:s.name,kind:s.kind,...(s.kind==='table'?{columns:s.columns,rows:_internals.totalRows(s)}:s.kind==='canvas'?{populatedCells:Object.keys(s.cells).length}:{pivot:s.pivot})}))};
    }
    case 'read_range': {const w=await office.get(id);if(w.document.format!=='bento/dash')throw new OfficeError('invalid_format','Le celle sono disponibili solo nei fogli di calcolo.',400);return {revision:w.revision,cells:readRange(w.document,input.sheetId,input.range)};}
    case 'read_dataset': {
      const w=await office.get(id);
      if(w.document.format!=='bento/dash')throw new OfficeError('invalid_format','I dataset sono disponibili solo nei fogli di calcolo.',400);
      const s=w.document.sheets.find(s=>s.id===input.sheetId);
      if(s?.kind!=='table')throw new OfficeError('invalid_request','Serve un dataset.');
      const rids:number[]=[];for(const [start,count] of s.rids)for(let i=0;i<count;i++)rids.push(start+i);
      return {revision:w.revision,columns:s.columns,rows:rids.slice(input.offset,input.offset+input.limit).map((rid,i)=>({rid,values:Object.fromEntries(s.columns.map(c=>[c.id,readCell(s.data[c.id],input.offset+i)??null])),overrides:Object.fromEntries(s.columns.flatMap(c=>s.cells?.[c.id+':'+rid]?[[c.id,s.cells[c.id+':'+rid]]]:[]))}))};
    }
    case 'read_blocks': {
      const w=await office.get(id),d=w.document;
      if(d.format!=='bento/type')throw new OfficeError('invalid_format','I blocchi sono disponibili solo nei documenti di testo.',400);
      const blocks=d.body.slice(input.offset,input.offset+input.limit),end=input.offset+blocks.length;
      return {format:d.format,revision:w.revision,blocks,total:d.body.length,nextOffset:end<d.body.length?end:null};
    }
    case 'read_slides': {
      const w=await office.get(id),d=w.document;
      if(d.format!=='bento/slides')throw new OfficeError('invalid_format','Le slide sono disponibili solo nelle presentazioni.',400);
      const slides=d.slides.slice(input.offset,input.offset+input.limit),end=input.offset+slides.length;
      return {format:d.format,revision:w.revision,slides,total:d.slides.length,nextOffset:end<d.slides.length?end:null};
    }
    case 'propose_change': case 'apply_change': {const {workbookId:_,...change}=input;return name==='propose_change'?office.propose(id,change as ChangeInput):office.change(id,change as ChangeInput);}
    case 'list_changes':return {changes:await office.history(id)};
    case 'get_change':return office.detail(id,input.changeId);
    case 'undo_change':return office.undo(id,input.changeId,input.operationId);
    case 'list_proposals':return {proposals:await office.proposalList(id)};
    default:throw new OfficeError('unknown_tool','Strumento non disponibile.',404);
  }
}
