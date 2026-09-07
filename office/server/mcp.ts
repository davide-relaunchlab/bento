import { McpServer,createMcpHandler } from '@modelcontextprotocol/server';
import { toolDefinitions } from '../shared/tools.ts';
import { OfficeError } from '../shared/changes.ts';
import { invokeTool } from './tools.ts';
import { Office } from './service.ts';

export async function mcpFetch(request:Request,office:Office,parsedBody:unknown):Promise<Response> {
  // Created per authenticated request. No server instance closes over another
  // visitor's identity, and no secret is exposed in tool metadata.
  const handler=createMcpHandler(()=>{
    const server=new McpServer({name:'bento-office',version:'0.1.0'});
    for(const tool of toolDefinitions)server.registerTool(tool.name,{
      title:tool.title,description:tool.description,inputSchema:tool.schema,
      annotations:{readOnlyHint:tool.readOnly,destructiveHint:tool.name==='undo_change',openWorldHint:false},
    },async(input:Record<string,unknown>)=>{
      try {const result=await invokeTool(office,tool.name,input);return {content:[{type:'text' as const,text:JSON.stringify(result)}]};}
      catch(error) {const e=error instanceof OfficeError?error:new OfficeError('internal','Operazione non riuscita.',500);return {isError:true,content:[{type:'text' as const,text:JSON.stringify({error:{code:e.code,message:e.message,details:e.details??null}})}]};}
    });
    return server;
  },{legacy:'stateless',responseMode:'auto'});
  return handler.fetch(request,{parsedBody});
}
