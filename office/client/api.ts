import type { DashDoc } from '../../dash/src/model.ts';
export type Snapshot<D=DashDoc>={id:string;title:string;revision:number;role:'owner'|'editor'|'viewer';document:D;agentPermission:string|null};
export class HttpError extends Error {
  constructor(public status:number,public code:string,message:string,public details?:unknown){super(message);}
}
export async function api<T=any>(path:string,method='GET',data?:unknown,signal?:AbortSignal):Promise<T> {
  const response=await fetch(path,{method,headers:data===undefined?{}:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal,credentials:'same-origin'});
  const body=await response.json();
  if(!response.ok)throw new HttpError(response.status,body.error?.code??'request_failed',body.error?.message??response.statusText,body.error?.details);
  return body as T;
}
