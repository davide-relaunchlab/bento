import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { OfficeError } from '../shared/changes.ts';
export type Env = { DB: D1Database; FILES: R2Bucket };
export class Storage {
  constructor(public env: Env) {}
  statement(sql: string, args: unknown[] = []) { return this.env.DB.prepare(sql).bind(...args); }
  async one<T>(sql: string, args: unknown[] = []): Promise<T | null> { return this.statement(sql,args).first<T>(); }
  async all<T>(sql: string, args: unknown[] = []): Promise<T[]> { return (await this.statement(sql,args).all<T>()).results; }
  async json<T>(key: string): Promise<T> {
    const blob = await this.env.FILES.get(key);
    if (!blob) throw new OfficeError('storage_unavailable','Contenuto momentaneamente non disponibile.',503);
    return blob.json<T>();
  }
  async put(value: unknown): Promise<string> {
    const key = 'office/' + crypto.randomUUID() + '.json';
    await this.env.FILES.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
    return key;
  }
  async discardUnreferenced(keys:string[]):Promise<void> {
    // An uncertain D1 reply is not proof of rollback. Only remove blobs after
    // a successful read proves that no committed state references them.
    for(const key of keys) {
      try {
        const used=await this.one(`SELECT 1 AS present FROM workbooks WHERE content_key=? UNION ALL SELECT 1 FROM changes WHERE content_key=? OR prepared_key=? UNION ALL SELECT 1 FROM proposals WHERE prepared_key=? LIMIT 1`,[key,key,key,key]);
        if(!used)await this.env.FILES.delete(key);
      } catch { /* Keep a harmless orphan rather than risk deleting a commit. */ }
    }
  }
}
