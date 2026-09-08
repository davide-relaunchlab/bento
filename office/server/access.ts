import { getChatGPTUser } from '../../app/chatgpt-auth.ts';
import { digest, OfficeError } from '../shared/changes.ts';
import { Storage } from './storage.ts';
export type Role = 'owner'|'editor'|'viewer';
export type Permission = 'read'|'propose'|'write'|'manage';
export type Actor = { id:string; name:string; kind:'person'|'agent'|'browser_agent'; userId:string; email?:string; token?:TokenRow };
export type WorkbookRow = { id:string; doc_id:string; title:string; format:'bento/dash'|'bento/slides'|'bento/type'; owner_id:string; folder_id:string|null; revision:number; acl_version:number; content_key:string; created_at:number; updated_at:number };
export type TokenRow = { id:string; workbook_id:string; creator_id:string; name:string; permission:'read'|'propose'|'write'; expires_at:number; revoked_at:number|null };
export type Access = { workbook:WorkbookRow; role:Role; actor:Actor };
export async function identify(request:Request, db:Storage):Promise<Actor> {
  const auth=request.headers.get('authorization');
  if (auth) {
    if (!/^Bearer bento_[A-Za-z0-9_-]{40,100}$/.test(auth)) throw new OfficeError('unauthorized','Credenziale agente non valida.',401);
    const token=await db.one<TokenRow>('SELECT id,workbook_id,creator_id,name,permission,expires_at,revoked_at FROM agent_tokens WHERE token_hash=?',[await digest(auth.slice(7))]);
    if (!token || token.revoked_at!==null || token.expires_at<=Date.now()) throw new OfficeError('unauthorized','Credenziale agente scaduta o revocata.',401);
    return {id:token.id,name:token.name,kind:'agent',userId:token.creator_id,token};
  }
  const user=getChatGPTUser(request);
  if (!user) throw new OfficeError('unauthorized','Accedi per aprire lo spazio di lavoro.',401);
  // An email invitation binds to the first authenticated account accepting it.
  // It cannot later migrate to another account merely sharing that email.
  await db.statement('UPDATE members SET user_id=?, display_name=? WHERE email=? AND user_id IS NULL',[user.userId,user.displayName,user.email]).run();
  await db.statement('UPDATE folder_members SET user_id=?,display_name=? WHERE email=? AND user_id IS NULL',[user.userId,user.displayName,user.email]).run();
  return {id:user.userId,name:user.displayName,kind:'person',userId:user.userId,email:user.email};
}
export async function authorize(db:Storage, actor:Actor, id:string, permission:Permission='read'):Promise<Access> {
  if(actor.token && actor.token.workbook_id!==id) throw new OfficeError('not_found','Documento non disponibile.',404);
  const selection=workbookAccessQuery(actor.userId);
  const row=await db.one<WorkbookRow & {role:Role}>(selection.sql+' AND id=?',[...selection.args,id]);
  if(!row) throw new OfficeError('not_found','Documento non disponibile.',404);
  if(actor.token) {
    const token=await db.one<TokenRow>('SELECT * FROM agent_tokens WHERE id=? AND revoked_at IS NULL AND expires_at>?',[actor.token.id,Date.now()]);
    if(!token) throw new OfficeError('unauthorized','Credenziale agente scaduta o revocata.',401);
    actor={...actor,token};
    if(row.role==='viewer' && token.permission!=='read') throw new OfficeError('forbidden','La delega dell’agente non è più attiva.',403);
    if(permission==='manage' || (permission==='write'&&token.permission!=='write') || (permission==='propose'&&token.permission==='read')) throw new OfficeError('forbidden','Questo agente non ha il permesso richiesto.',403);
  }
  if((permission==='manage'&&row.role!=='owner') || ((permission==='write'||permission==='propose')&&row.role==='viewer')) throw new OfficeError('forbidden','Il tuo ruolo non consente questa operazione.',403);
  return {workbook:row,role:row.role,actor};
}
// Used inside the SAME D1 batch as the mutation: permission cannot be revoked
// between a read-side check and a write-side commit.
export function accessCondition(access:Access):{sql:string;args:unknown[]} {
  const w=access.workbook, token=access.actor.token;
  return {sql:`id=? AND acl_version=?${token?' AND EXISTS (SELECT 1 FROM agent_tokens WHERE id=? AND revoked_at IS NULL AND expires_at>?)':''}`,
    args:[w.id,w.acl_version,...(token?[token.id,Date.now()]:[])]};
}
export function personOnly(actor:Actor):void { if(actor.token || (actor.kind!=='person' && actor.kind!=='browser_agent')) throw new OfficeError('forbidden','Questa operazione richiede una persona autorizzata.',403); }

// One effective role, shared by list and every read/write authorization.
export function workbookAccessQuery(userId:string){
 const member=(role?:string)=>`EXISTS(SELECT 1 FROM members m WHERE m.workbook_id=w.id AND m.user_id=?${role?" AND m.role='"+role+"'":''})`;
 const folder=(role?:string)=>`EXISTS(SELECT 1 FROM folder_members fm WHERE fm.folder_id=w.folder_id AND fm.user_id=?${role?" AND fm.role='"+role+"'":''})`;
 return {sql:`SELECT * FROM (SELECT w.*,CASE WHEN w.owner_id=? THEN 'owner' WHEN ${member('editor')} OR ${folder('editor')} THEN 'editor' WHEN ${member()} OR ${folder()} THEN 'viewer' ELSE NULL END AS role FROM workbooks w) WHERE role IS NOT NULL`,args:[userId,userId,userId,userId,userId]};
}
