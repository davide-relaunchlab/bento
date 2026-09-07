import {z} from 'zod';
import {toolDefinitions} from '../shared/tools.ts';
import {api} from './api.ts';
type ModelContext={registerTool(tool:{name:string;title?:string;description:string;inputSchema:object;execute:(input:unknown)=>Promise<unknown>;annotations?:{readOnlyHint?:boolean;untrustedContentHint?:boolean}},options?:{signal?:AbortSignal}):void};
export function registerWebMCP(after:()=>Promise<void>,before:()=>Promise<void>):{available:boolean;dispose:()=>void} {
  const context=(document as Document&{modelContext?:ModelContext}).modelContext;
  if(!context?.registerTool)return {available:false,dispose:()=>{}};
  const controller=new AbortController();
  for(const tool of toolDefinitions)context.registerTool({
    name:tool.name,title:tool.title,description:tool.description,inputSchema:z.toJSONSchema(tool.schema),
    annotations:{readOnlyHint:tool.readOnly,untrustedContentHint:true},
    execute:async input=>{
      await before();
      const result=await api('/api/tools/'+tool.name,'POST',input);
      await after();
      return result;
    },
  },{signal:controller.signal});
  return {available:true,dispose:()=>controller.abort()};
}
