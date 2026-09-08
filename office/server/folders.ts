import {Storage} from './storage.ts';
import {personOnly,type Actor} from './access.ts';
import {OfficeError} from '../shared/changes.ts';
export type Folder={id:string;owner_id:string;owner_name:string;name:string;created_at:number;updated_at:number;role:'owner'|'editor'|'viewer'};
export async function folderAccess(db:Storage,actor:Actor,id:string,manage=false):Promise<Folder>{
 personOnly(actor);
 const row=await db.one<Folder>(`SELECT f.*,CASE WHEN f.owner_id=? THEN 'owner' ELSE m.role END AS role FROM folders f LEFT JOIN folder_members m ON m.folder_id=f.id AND m.user_id=? WHERE f.id=? AND (f.owner_id=? OR m.user_id IS NOT NULL)`,[actor.userId,actor.userId,id,actor.userId]);
 if(!row)throw new OfficeError('not_found','Cartella non disponibile.',404);
 if(manage&&row.role!=='owner')throw new OfficeError('forbidden','Solo il proprietario può organizzare e condividere questa cartella.',403);
 return row;
}
export class Folders{
 constructor(private db:Storage,private actor:Actor){}
 async list(){personOnly(this.actor);return this.db.all<Folder>(`SELECT f.*,CASE WHEN f.owner_id=? THEN 'owner' ELSE m.role END AS role,(SELECT COUNT(*) FROM workbooks w WHERE w.folder_id=f.id) AS file_count FROM folders f LEFT JOIN folder_members m ON m.folder_id=f.id AND m.user_id=? WHERE f.owner_id=? OR m.user_id IS NOT NULL ORDER BY f.name COLLATE NOCASE`,[this.actor.userId,this.actor.userId,this.actor.userId]);}
 async create(name:string){personOnly(this.actor);const id=crypto.randomUUID(),now=Date.now();await this.db.statement('INSERT INTO folders(id,owner_id,owner_name,name,created_at,updated_at) VALUES(?,?,?,?,?,?)',[id,this.actor.userId,this.actor.name,name,now,now]).run();return folderAccess(this.db,this.actor,id);}
 async rename(id:string,name:string){await folderAccess(this.db,this.actor,id,true);await this.db.statement('UPDATE folders SET name=?,updated_at=? WHERE id=? AND owner_id=?',[name,Date.now(),id,this.actor.userId]).run();return folderAccess(this.db,this.actor,id);}
 async members(id:string){await folderAccess(this.db,this.actor,id);return this.db.all('SELECT id,email,display_name,role,CASE WHEN user_id IS NULL THEN 1 ELSE 0 END AS pending FROM folder_members WHERE folder_id=? ORDER BY created_at',[id]);}
 async share(id:string,email:string,role:'editor'|'viewer'){
  await folderAccess(this.db,this.actor,id,true);if(email===this.actor.email)throw new OfficeError('owner_role','Il tuo spazio rimane sotto il tuo controllo.');
  await this.db.env.DB.batch([
   this.db.statement('INSERT INTO folder_members(id,folder_id,email,display_name,role,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(folder_id,email) DO UPDATE SET role=excluded.role',[crypto.randomUUID(),id,email,email,role,Date.now()]),
   this.db.statement('UPDATE workbooks SET acl_version=acl_version+1 WHERE folder_id=?',[id]),
  ]);return {shared:true};
 }
 async unshare(id:string,memberId:string){
  await folderAccess(this.db,this.actor,id,true);
  const result=await this.db.env.DB.batch([
   this.db.statement('DELETE FROM folder_members WHERE folder_id=? AND id=?',[id,memberId]),
   this.db.statement('UPDATE workbooks SET acl_version=acl_version+1 WHERE folder_id=?',[id]),
  ]);if(result[0].meta.changes!==1)throw new OfficeError('not_found','Accesso non disponibile.',404);return {removed:true};
 }
}
