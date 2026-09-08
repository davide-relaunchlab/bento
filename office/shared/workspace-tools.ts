import {z} from 'zod';
const id=z.string().min(1).max(200),name=z.string().trim().min(1).max(200),email=z.email().transform(s=>s.toLowerCase()),role=z.enum(['editor','viewer']);
const workbookId=id,folderId=id,operationId=z.string().min(8).max(128);
const tool=<T extends z.ZodRawShape>(name:string,description:string,shape:T,readOnly=false)=>({name,title:name.replaceAll('_',' '),description,schema:z.object(shape).strict(),readOnly});
export const workspaceTools=[
 tool('delete_workbook','Permanently delete an explicitly selected file, its history, proposals and access credentials. Owner session only; remote delegated tokens cannot delete. Read the current revision first. Deletion cannot be undone.',{workbookId,baseRevision:z.number().int().nonnegative()}),
 tool('read_revision','Read a historical document snapshot using current access rights.',{workbookId,revision:z.number().int().nonnegative()},true),
 tool('get_proposal','Inspect a proposed change and its differences.',{workbookId,proposalId:id},true),
 tool('accept_proposal','Accept a proposal as the signed-in user. Same write permission and conflict checks as the review panel.',{workbookId,proposalId:id,operationId}),
 tool('reject_proposal','Reject a proposal as the signed-in user.',{workbookId,proposalId:id}),
 tool('move_workbook','Move a file into a folder, or null for the workspace root. Requires the same ownership as the interface.',{workbookId,folderId:folderId.nullable()}),
 tool('list_members','Read file sharing permissions.',{workbookId},true),
 tool('share_workbook','Set file access for the specified email, when requested by the user.',{workbookId,email,role}),
 tool('unshare_workbook','Remove the specified file membership.',{workbookId,memberId:id}),
 tool('list_agents','List delegated credentials without secrets.',{workbookId},true),
 tool('create_agent','Create a scoped credential when requested. Returns its secret once; never put it in document content.',{workbookId,name:name.max(80),permission:z.enum(['read','propose','write']),expiresDays:z.number().int().min(1).max(90)}),
 tool('revoke_agent','Revoke a scoped credential.',{workbookId,agentId:id}),
 tool('list_folders','List accessible folders.',{},true),
 tool('create_folder','Create a workspace folder.',{name}),
 tool('rename_folder','Rename an owned folder.',{folderId,name}),
 tool('list_folder_members','Read folder sharing permissions.',{folderId},true),
 tool('share_folder','Set folder access for the specified email, when requested by the user.',{folderId,email,role}),
 tool('unshare_folder','Remove the specified folder membership.',{folderId,memberId:id}),
] as const;
