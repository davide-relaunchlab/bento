import type { OfficeDocument } from '../shared/content.ts';
import { applyPrepared, prepareChange, newWorkbook, validateWorkbook, digest, OfficeError, type PreparedChange } from '../shared/content.ts';
import { authorize, workbookAccessQuery, accessCondition, personOnly, type Actor, type WorkbookRow } from './access.ts';
import {folderAccess} from './folders.ts';
import { Storage } from './storage.ts';

export type ChangeInput = { baseRevision:number; operationId:string; summary:string; patches:unknown[] };
type ChangeRow = { id:string; revision:number; request_hash:string; prepared_key:string|null; content_key:string; summary:string; actor_id:string; actor_name:string; actor_kind:string; kind:string; related_id:string|null; created_at:number };
type ProposalRow = { id:string; workbook_id:string; base_revision:number; operation_id:string; request_hash:string; prepared_key:string; actor_id:string; actor_name:string; actor_kind:string; summary:string; status:'pending'|'accepted'|'rejected'; change_id:string|null; created_at:number };
const conflict=()=>new OfficeError('conflict','Il contenuto o i permessi sono cambiati. Ricarica e riprova.',409);
const missing=()=>new OfficeError('not_found','Elemento non disponibile.',404);

export class Office {
  constructor(public db:Storage,public actor:Actor) {}

  async list() {
    if(this.actor.token) {
      const access=await authorize(this.db,this.actor,this.actor.token.workbook_id);
      return [{...this.metadata(access.workbook),role:access.role}];
    }
    const selection=workbookAccessQuery(this.actor.userId);
    const rows=await this.db.all<WorkbookRow&{role:string}>(selection.sql+' ORDER BY updated_at DESC LIMIT 1000',selection.args);
    return rows.map(row=>({...this.metadata(row),role:row.role}));
  }
  metadata(w:WorkbookRow) { return {id:w.id,folderId:w.folder_id??null,ownerId:w.owner_id,docId:w.doc_id,title:w.title,format:w.format,revision:w.revision,updatedAt:w.updated_at,createdAt:w.created_at}; }
  async snapshot(id:string,revision:number):Promise<OfficeDocument> {
    const row=await this.db.one<{content_key:string}>('SELECT content_key FROM changes WHERE workbook_id=? AND revision=?',[id,revision]);
    if(!row)throw new OfficeError('unknown_revision','Versione non disponibile. Rileggi il documento.',409);
    return this.db.json<OfficeDocument>(row.content_key);
  }
  async get(id:string,revision?:number) {
    const a=await authorize(this.db,this.actor,id),w=a.workbook;
    return {...this.metadata(w),revision:revision??w.revision,currentRevision:w.revision,role:a.role,agentPermission:a.actor.token?.permission??null,
      document:revision===undefined?await this.db.json<OfficeDocument>(w.content_key):await this.snapshot(id,revision)};
  }
  async createFromTool(title:string,format:OfficeDocument['format'],operationId:string) {
    // A document-scoped bearer token must never gain workspace creation rights.
    if(this.actor.token || this.actor.kind==='agent')throw new OfficeError('forbidden','La delega è limitata a un documento esistente.',403);
    const identity=await digest({userId:this.actor.userId,operationId});
    const requestHash=await digest({title,format});
    const result=await this.create(title,undefined,format,undefined,{id:'created-'+identity,requestHash});
    return {id:result.id,docId:result.docId,title:result.title,format:result.format,revision:result.revision,url:'/?workbook='+encodeURIComponent(result.id)};
  }
  private async createdReplay(id:string,requestHash:string) {
    const existing=await this.db.one<{request_hash:string}>('SELECT request_hash FROM changes WHERE workbook_id=? AND revision=0',[id]);
    if(!existing)return null;
    if(existing.request_hash!==requestHash)throw conflict();
    return this.get(id);
  }
  async create(title:string,document?:unknown,format?:OfficeDocument['format'],folderId?:string|null,creation?:{id:string;requestHash:string}) {
    if(creation){
      if(this.actor.token || this.actor.kind==='agent')throw new OfficeError('forbidden','La delega è limitata a un documento esistente.',403);
      const replay=await this.createdReplay(creation.id,creation.requestHash);if(replay)return replay;
    }else personOnly(this.actor);
    if(folderId)await folderAccess(this.db,this.actor,folderId,true);
    const doc=validateWorkbook(document??newWorkbook(title,format)),id=creation?.id??crypto.randomUUID(),now=Date.now(),changeId=crypto.randomUUID();
    if(format && doc.format!==format)throw new OfficeError('invalid_format','Il formato del documento non corrisponde al tipo richiesto.',400);
    doc.modified=new Date(now).toISOString();
    const key=await this.db.put(doc);
    try {
      await this.db.env.DB.batch([
        this.db.statement('INSERT INTO workbooks(id,doc_id,title,format,owner_id,revision,acl_version,content_key,created_at,updated_at,folder_id) VALUES(?,?,?,?,?,0,0,?,?,?,?)',[id,doc.docId,doc.title,doc.format,this.actor.userId,key,now,now,folderId??null]),
        this.db.statement('INSERT INTO members(id,workbook_id,user_id,email,display_name,role,created_at) VALUES(?,?,?,?,?,?,?)',[crypto.randomUUID(),id,this.actor.userId,this.actor.email!,this.actor.name,'owner',now]),
        this.db.statement('INSERT INTO changes(workbook_id,revision,id,operation_id,request_hash,content_key,actor_id,actor_name,actor_kind,summary,kind,created_at) VALUES(?,0,?,?,?,?,?,?,?,?,?,?)',[id,changeId,'create',creation?.requestHash??'create',key,this.actor.id,this.actor.name,this.actor.kind,'Crea documento','create',now]),
      ]);
    } catch(error) {
      await this.db.discardUnreferenced([key]);
      if(creation){const replay=await this.createdReplay(id,creation.requestHash);if(replay)return replay;}
      throw error;
    }
    return this.get(id);
  }
  async move(id:string,folderId:string|null){
    personOnly(this.actor);const a=await authorize(this.db,this.actor,id,'manage'),c=accessCondition(a);
    if(folderId)await folderAccess(this.db,this.actor,folderId,true);
    const result=await this.db.statement(`UPDATE workbooks SET folder_id=?,acl_version=acl_version+1 WHERE ${c.sql}`,[folderId,...c.args]).run();
    if(result.meta.changes!==1)throw conflict();return this.get(id);
  }
  async replay(id:string,operationId:string,requestHash:string) {
    const row=await this.db.one<ChangeRow>('SELECT * FROM changes WHERE workbook_id=? AND operation_id=?',[id,operationId]);
    if(!row)return null;
    if(row.request_hash!==requestHash)throw new OfficeError('idempotency_conflict','Questo identificatore è già stato usato per una richiesta diversa.',409);
    return {changeId:row.id,revision:row.revision,replayed:true};
  }
  async change(id:string,input:ChangeInput) {
    await authorize(this.db,this.actor,id,'write');
    const hash=await digest({actor:this.actor.id,kind:'edit',input});
    const replay=await this.replay(id,input.operationId,hash);if(replay)return replay;
    const base=await this.snapshot(id,input.baseRevision),prepared=await prepareChange(base,input.patches);
    return this.commit(id,input.operationId,hash,input.summary,prepared,'edit');
  }
  async commit(id:string,operationId:string,requestHash:string,summary:string,original:PreparedChange,kind:'edit'|'undo'|'accept',relatedId?:string) {
    for(let attempt=0;attempt<5;attempt++) {
      const access=await authorize(this.db,this.actor,id,'write');
      const replay=await this.replay(id,operationId,requestHash);if(replay)return replay;
      if(kind==='accept') {
        const proposal=await this.db.one<ProposalRow>('SELECT * FROM proposals WHERE workbook_id=? AND id=?',[id,relatedId]);
        if(!proposal||proposal.status!=='pending')throw conflict();
      }
      const w=access.workbook,current=await this.db.json<OfficeDocument>(w.content_key);
      // Check the author's original read before rebasing the inverse onto the
      // actual committed state. Neither guard list is accepted from HTTP.
      const document=await applyPrepared(current,original,kind==='undo'?'undo':'forward');
      if(document.docId!==current.docId || document.format!==current.format || document.format!==w.format)throw new OfficeError('invalid_identity','Identità e formato del documento non possono cambiare.',400);
      const now=Date.now();document.modified=new Date(now).toISOString();
      const prepared=await prepareChange(current,kind==='undo'?original.inverse:original.patches);
      const [contentKey,preparedKey]=await Promise.all([this.db.put(document),this.db.put(prepared)]);
      const changeId=crypto.randomUUID(),version=w.revision+1,condition=accessCondition(access);
      try {
        const operations=[
          this.db.statement(`UPDATE workbooks SET revision=?,title=?,content_key=?,updated_at=? WHERE ${condition.sql} AND revision=?${kind==='accept'?' AND EXISTS(SELECT 1 FROM proposals WHERE id=? AND workbook_id=? AND status=\'pending\')':''}`,
            [version,document.title,contentKey,now,...condition.args,w.revision,...(kind==='accept'?[relatedId,id]:[])]),
          this.db.statement(`INSERT INTO changes(workbook_id,revision,id,operation_id,request_hash,content_key,prepared_key,actor_id,actor_name,actor_kind,summary,kind,related_id,created_at)
            SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM workbooks WHERE id=? AND content_key=?)`,
            [id,version,changeId,operationId,requestHash,contentKey,preparedKey,this.actor.id,this.actor.name,this.actor.kind,summary,kind,relatedId??null,now,id,contentKey]),
        ];
        if(kind==='accept')operations.push(this.db.statement('UPDATE proposals SET status=\'accepted\',decision_by=?,change_id=?,decided_at=? WHERE id=? AND workbook_id=? AND EXISTS(SELECT 1 FROM changes WHERE workbook_id=? AND id=?)',[this.actor.id,changeId,now,relatedId,id,id,changeId]));
        const result=await this.db.env.DB.batch(operations);
        if(result[0].meta.changes===1)return {changeId,revision:version,replayed:false};
      } catch(error) {
        // Another request may have committed this operation id concurrently.
        const done=await this.replay(id,operationId,requestHash);
        await this.db.discardUnreferenced([contentKey,preparedKey]);
        if(done)return done;
        throw error;
      }
      await this.db.discardUnreferenced([contentKey,preparedKey]);
    }
    throw conflict();
  }
  async history(id:string,before=Number.MAX_SAFE_INTEGER) {
    await authorize(this.db,this.actor,id);
    return this.db.all<Omit<ChangeRow,'request_hash'|'content_key'|'prepared_key'>>('SELECT id,revision,actor_id,actor_name,actor_kind,summary,kind,related_id,created_at FROM changes WHERE workbook_id=? AND revision<? ORDER BY revision DESC LIMIT 50',[id,before]);
  }
  async detail(id:string,changeId:string) {
    await authorize(this.db,this.actor,id);
    const row=await this.db.one<ChangeRow>('SELECT * FROM changes WHERE workbook_id=? AND id=?',[id,changeId]);if(!row)throw missing();
    const prepared=row.prepared_key?await this.db.json<PreparedChange>(row.prepared_key):null;
    return {id:row.id,revision:row.revision,summary:row.summary,actorName:row.actor_name,actorKind:row.actor_kind,kind:row.kind,createdAt:row.created_at,differences:prepared?.differences??[],warnings:prepared?.warnings??[]};
  }
  async undo(id:string,changeId:string,operationId:string) {
    await authorize(this.db,this.actor,id,'write');
    const hash=await digest({actor:this.actor.id,kind:'undo',changeId,operationId});
    const done=await this.replay(id,operationId,hash);if(done)return done;
    const row=await this.db.one<ChangeRow>('SELECT * FROM changes WHERE workbook_id=? AND id=?',[id,changeId]);
    if(!row?.prepared_key)throw new OfficeError('not_reversible','Questa operazione non può essere annullata.',400);
    return this.commit(id,operationId,hash,'Annulla: '+row.summary,await this.db.json<PreparedChange>(row.prepared_key),'undo',changeId);
  }
  async propose(id:string,input:ChangeInput) {
    const access=await authorize(this.db,this.actor,id,'propose'),hash=await digest({actor:this.actor.id,input});
    const previous=await this.db.one<ProposalRow>('SELECT * FROM proposals WHERE workbook_id=? AND operation_id=?',[id,input.operationId]);
    if(previous) {if(previous.request_hash!==hash)throw conflict();return {id:previous.id,status:previous.status,replayed:true};}
    const base=await this.snapshot(id,input.baseRevision),prepared=await prepareChange(base,input.patches,{protectRead:true});
    const key=await this.db.put(prepared),proposalId=crypto.randomUUID(),now=Date.now(),condition=accessCondition(access);
    try {
      const r=await this.db.statement(`INSERT INTO proposals(id,workbook_id,operation_id,request_hash,base_revision,prepared_key,actor_id,actor_name,actor_kind,summary,status,created_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,'pending',? WHERE EXISTS(SELECT 1 FROM workbooks WHERE ${condition.sql})`,
        [proposalId,id,input.operationId,hash,input.baseRevision,key,this.actor.id,this.actor.name,this.actor.kind,input.summary,now,...condition.args]).run();
      if(r.meta.changes!==1)throw conflict();
    } catch(error) {
      await this.db.discardUnreferenced([key]);
      const raced=await this.db.one<ProposalRow>('SELECT * FROM proposals WHERE workbook_id=? AND operation_id=?',[id,input.operationId]);
      if(raced&&raced.request_hash===hash)return {id:raced.id,status:raced.status,replayed:true};
      throw error;
    }
    return {id:proposalId,status:'pending',replayed:false};
  }
  async proposalList(id:string) {
    await authorize(this.db,this.actor,id);
    return this.db.all('SELECT id,base_revision,actor_id,actor_name,actor_kind,summary,status,change_id,created_at,decision_by,decided_at FROM proposals WHERE workbook_id=? ORDER BY created_at DESC LIMIT 100',[id]);
  }
  async proposalDetail(id:string,proposalId:string) {
    await authorize(this.db,this.actor,id);
    const row=await this.db.one<ProposalRow>('SELECT * FROM proposals WHERE workbook_id=? AND id=?',[id,proposalId]);if(!row)throw missing();
    const prepared=await this.db.json<PreparedChange>(row.prepared_key);
    return {id:row.id,baseRevision:row.base_revision,summary:row.summary,status:row.status,actorName:row.actor_name,actorKind:row.actor_kind,createdAt:row.created_at,differences:prepared.differences,warnings:prepared.warnings};
  }
  async accept(id:string,proposalId:string,operationId:string) {
    personOnly(this.actor);await authorize(this.db,this.actor,id,'write');
    const hash=await digest({actor:this.actor.id,kind:'accept',proposalId,operationId});
    const done=await this.replay(id,operationId,hash);if(done)return done;
    const row=await this.db.one<ProposalRow>('SELECT * FROM proposals WHERE workbook_id=? AND id=?',[id,proposalId]);
    if(!row)throw missing();if(row.status!=='pending')throw conflict();
    return this.commit(id,operationId,hash,row.summary,await this.db.json<PreparedChange>(row.prepared_key),'accept',proposalId);
  }
  async reject(id:string,proposalId:string) {
    personOnly(this.actor);const a=await authorize(this.db,this.actor,id,'write'),c=accessCondition(a);
    const r=await this.db.statement(`UPDATE proposals SET status='rejected',decision_by=?,decided_at=? WHERE workbook_id=? AND id=? AND status='pending' AND EXISTS(SELECT 1 FROM workbooks WHERE ${c.sql})`,[this.actor.id,Date.now(),id,proposalId,...c.args]).run();
    if(r.meta.changes!==1)throw conflict();return {status:'rejected'};
  }
  async members(id:string) {
    personOnly(this.actor);await authorize(this.db,this.actor,id);
    const direct=await this.db.all('SELECT id,email,display_name,role,CASE WHEN user_id IS NULL THEN 1 ELSE 0 END AS pending FROM members WHERE workbook_id=? ORDER BY created_at',[id]);
    const inherited=await this.db.all('SELECT fm.id,fm.email,fm.display_name,fm.role,1 AS inherited,f.name AS folder_name,CASE WHEN fm.user_id IS NULL THEN 1 ELSE 0 END AS pending FROM folder_members fm JOIN folders f ON f.id=fm.folder_id JOIN workbooks w ON w.folder_id=f.id WHERE w.id=?',[id]);
    return [...direct,...inherited];
  }
  async share(id:string,email:string,role:'editor'|'viewer') {
    const access=await authorize(this.db,this.actor,id,'manage'),condition=accessCondition(access),memberId=crypto.randomUUID(),now=Date.now();
    const current=await this.db.one<{role:string}>('SELECT role FROM members WHERE workbook_id=? AND email=?',[id,email]);
    if(current?.role==='owner')throw new OfficeError('owner_role','Il proprietario mantiene il controllo del documento.',400);
    const r=await this.db.env.DB.batch([
      this.db.statement(`INSERT INTO members(id,workbook_id,email,display_name,role,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM workbooks WHERE ${condition.sql}) ON CONFLICT(workbook_id,email) DO UPDATE SET role=excluded.role`,[memberId,id,email,email,role,now,...condition.args]),
      this.db.statement(`UPDATE workbooks SET acl_version=acl_version+1 WHERE ${condition.sql}`,condition.args),
    ]);
    if(r[0].meta.changes!==1)throw conflict();
    return this.db.one('SELECT id,email,display_name,role FROM members WHERE workbook_id=? AND email=?',[id,email]);
  }
  async unshare(id:string,memberId:string) {
    const access=await authorize(this.db,this.actor,id,'manage'),c=accessCondition(access);
    const r=await this.db.env.DB.batch([
      this.db.statement(`DELETE FROM members WHERE workbook_id=? AND id=? AND role<>'owner' AND EXISTS(SELECT 1 FROM workbooks WHERE ${c.sql})`,[id,memberId,...c.args]),
      this.db.statement(`UPDATE workbooks SET acl_version=acl_version+1 WHERE ${c.sql}`,c.args),
    ]);
    if(r[0].meta.changes!==1)throw missing();return {removed:true};
  }
  async agents(id:string) {
    personOnly(this.actor);const a=await authorize(this.db,this.actor,id);
    return this.db.all(`SELECT id,name,creator_id,permission,expires_at,revoked_at,created_at FROM agent_tokens WHERE workbook_id=?${a.role==='owner'?'':' AND creator_id=?'} ORDER BY created_at DESC`,[id,...(a.role==='owner'?[]:[this.actor.id])]);
  }
  async createAgent(id:string,name:string,permission:'read'|'propose'|'write',expiresDays:number) {
    personOnly(this.actor);const access=await authorize(this.db,this.actor,id,'write'),condition=accessCondition(access);
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const token='bento_'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const agentId=crypto.randomUUID(),now=Date.now(),expiresAt=now+expiresDays*86400000;
    const r=await this.db.statement(`INSERT INTO agent_tokens(id,workbook_id,creator_id,name,token_hash,permission,expires_at,created_at)
      SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM workbooks WHERE ${condition.sql})`,[agentId,id,this.actor.id,name,await digest(token),permission,expiresAt,now,...condition.args]).run();
    if(r.meta.changes!==1)throw conflict();return {id:agentId,name,permission,expiresAt,token};
  }
  async revokeAgent(id:string,agentId:string) {
    personOnly(this.actor);const a=await authorize(this.db,this.actor,id,'write'),c=accessCondition(a);
    const r=await this.db.statement(`UPDATE agent_tokens SET revoked_at=? WHERE workbook_id=? AND id=?${a.role==='owner'?'':' AND creator_id=?'} AND EXISTS(SELECT 1 FROM workbooks WHERE ${c.sql})`,[Date.now(),id,agentId,...(a.role==='owner'?[]:[this.actor.id]),...c.args]).run();
    if(r.meta.changes!==1)throw missing();return {revoked:true};
  }
}
