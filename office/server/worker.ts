import { z } from 'zod';
import { OfficeError, MAX_DOCUMENT_BYTES, readRange } from '../shared/changes.ts';
import { identify } from './access.ts';
import { Storage, type Env } from './storage.ts';
import { Office } from './service.ts';
import { invokeTool } from './tools.ts';
import { mcpFetch } from './mcp.ts';

const operationId=z.string().min(8).max(128);
const revision=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const changeInput=z.object({baseRevision:revision,operationId,summary:z.string().trim().min(1).max(300),patches:z.array(z.unknown()).min(1).max(500)}).strict();
const mutation=z.object({operationId}).strict();
function json(body:unknown,status=200) {return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}});}
export async function body<T extends z.ZodType>(request:Request,schema:T):Promise<z.infer<T>> {
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new OfficeError('content_type','È richiesto application/json.',415);
  if(Number(request.headers.get('content-length'))>MAX_DOCUMENT_BYTES)throw new OfficeError('too_large','Richiesta troppo grande.',413);
  const reader=request.body?.getReader();if(!reader)throw new OfficeError('invalid_json','Corpo JSON richiesto.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true) {const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>MAX_DOCUMENT_BYTES){await reader.cancel();throw new OfficeError('too_large','Richiesta troppo grande.',413);}chunks.push(r.value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  let input:unknown;try {input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new OfficeError('invalid_json','JSON non valido.');}
  const result=schema.safeParse(input);if(!result.success)throw new OfficeError('invalid_request','Parametri non validi.',400,result.error.issues.map(x=>({path:x.path,message:x.message})));
  return result.data;
}
export function checkOrigin(request:Request) {
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new OfficeError('origin','Origine della richiesta non consentita.',403);
}
export async function apiFetch(request:Request,env:Env):Promise<Response> {
  try {
    checkOrigin(request);
    const url=new URL(request.url),path=url.pathname.split('/').filter(Boolean),method=request.method;
    if(url.pathname==='/api/health'&&method==='GET')return json({ok:true,product:'bento/office'});
    const db=new Storage(env),actor=await identify(request,db),office=new Office(db,actor);
    if(url.pathname==='/mcp'||url.pathname==='/api/mcp') {
      if(method!=='POST')return new Response(null,{status:405,headers:{allow:'POST'}});
      return mcpFetch(request,office,await body(request,z.unknown()));
    }
    if(url.pathname==='/api/session'&&method==='GET')return json({actor:{id:actor.id,name:actor.name,kind:actor.kind,email:actor.email??null}});
    if(path[0]==='api'&&path[1]==='tools'&&path.length===3&&method==='POST'){
      // Attribution is assigned at the tool boundary; privileges remain the
      // authenticated person's ACL. It cannot approve its own proposals.
      const toolOffice=actor.kind==='person'?new Office(db,{...actor,kind:'browser_agent',name:actor.name+' · WebMCP'}):office;
      return json(await invokeTool(toolOffice,path[2],await body(request,z.unknown())));
    }
    if(path[0]!=='api'||path[1]!=='workbooks')throw new OfficeError('not_found','Percorso non disponibile.',404);
    if(path.length===2) {
      if(method==='GET')return json({workbooks:await office.list()});
      if(method==='POST'){const input=await body(request,z.object({title:z.string().trim().min(1).max(300),document:z.unknown().optional(),format:z.enum(['bento/dash','bento/slides','bento/type']).optional()}).strict());return json(await office.create(input.title,input.document,input.format),201);}
    }
    const id=path[2],section=path[3],item=path[4],action=path[5];
    if(!id||id.length>200)throw new OfficeError('not_found','Documento non disponibile.',404);
    if(path.length===3&&method==='GET') {
      const raw=url.searchParams.get('revision');let version: number|undefined;
      if(raw!==null){const parsed=revision.safeParse(Number(raw));if(!parsed.success)throw new OfficeError('invalid_request','Versione non valida.');version=parsed.data;}
      return json(await office.get(id,version));
    }
    if(section==='range'&&path.length===4&&method==='GET') {const book=await office.get(id);if(book.document.format!=='bento/dash')throw new OfficeError('invalid_format','Le celle sono disponibili solo nei fogli di calcolo.',400);return json({revision:book.revision,cells:readRange(book.document,url.searchParams.get('sheet')??'',url.searchParams.get('range')??'')});}
    if(section==='changes') {
      if(path.length===4&&method==='GET'){const before=url.searchParams.get('before');return json({changes:await office.history(id,before===null?undefined:revision.parse(Number(before)))});}
      if(path.length===4&&method==='POST')return json(await office.change(id,await body(request,changeInput)));
      if(path.length===5&&method==='GET')return json(await office.detail(id,item));
      if(path.length===6&&action==='undo'&&method==='POST')return json(await office.undo(id,item,(await body(request,mutation)).operationId));
    }
    if(section==='proposals') {
      if(path.length===4&&method==='GET')return json({proposals:await office.proposalList(id)});
      if(path.length===4&&method==='POST')return json(await office.propose(id,await body(request,changeInput)),201);
      if(path.length===5&&method==='GET')return json(await office.proposalDetail(id,item));
      if(path.length===6&&method==='POST'&&action==='accept')return json(await office.accept(id,item,(await body(request,mutation)).operationId));
      if(path.length===6&&method==='POST'&&action==='reject'){await body(request,z.object({}).strict());return json(await office.reject(id,item));}
    }
    if(section==='members') {
      if(path.length===4&&method==='GET')return json({members:await office.members(id)});
      if(path.length===4&&method==='POST'){const input=await body(request,z.object({email:z.email().max(254).transform(v=>v.toLowerCase()),role:z.enum(['editor','viewer'])}).strict());return json(await office.share(id,input.email,input.role));}
      if(path.length===5&&method==='DELETE')return json(await office.unshare(id,item));
    }
    if(section==='agents') {
      if(path.length===4&&method==='GET')return json({agents:await office.agents(id)});
      if(path.length===4&&method==='POST'){const input=await body(request,z.object({name:z.string().trim().min(1).max(80),permission:z.enum(['read','propose','write']),expiresDays:z.number().int().min(1).max(90)}).strict());return json(await office.createAgent(id,input.name,input.permission,input.expiresDays),201);}
      if(path.length===5&&method==='DELETE')return json(await office.revokeAgent(id,item));
    }
    throw new OfficeError('not_found','Percorso non disponibile.',404);
  } catch(error) {
    if(error instanceof OfficeError)return json({error:{code:error.code,message:error.message,details:error.details??null}},error.status);
    if(error instanceof z.ZodError)return json({error:{code:'invalid_request',message:'Parametri non validi.'}},400);
    // Do not return database, content, or credential details to clients/logs.
    return json({error:{code:'internal',message:'Operazione non riuscita. Il contenuto salvato resta disponibile.'}},500);
  }
}
// The production build embeds Vite's final HTML. Assets are served by Sites
// from dist/client; the application Worker owns the entry route and APIs.
declare const OFFICE_INDEX_HTML:string;
export default {fetch(request:Request,env:Env){
  const path=new URL(request.url).pathname;
  if((path==='/'||path==='/index.html')&&['GET','HEAD'].includes(request.method)&&typeof OFFICE_INDEX_HTML==='string')
    return new Response(request.method==='HEAD'?null:OFFICE_INDEX_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'same-origin'}});
  return apiFetch(request,env);
}};
