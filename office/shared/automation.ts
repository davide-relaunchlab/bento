import {z} from 'zod';
export type EditorCommand={name:string;description:string;schema:z.ZodObject;readOnly?:boolean;run:(input:any)=>unknown|Promise<unknown>};
export function editorAutomation(state:()=>unknown,readOnly:()=>boolean,commands:EditorCommand[],flushActive:()=>void|Promise<void>=()=>{}){return {
 flushActive,
 state,
 commands:()=>commands.map(c=>({name:c.name,description:c.description,inputSchema:z.toJSONSchema(c.schema,{io:'input'}),readOnly:!!c.readOnly})),
 execute:async(name:string,input:unknown)=>{const c=commands.find(c=>c.name===name);if(!c)throw new Error('Unknown editor command. Call get_editor_commands.');const args=c.schema.parse(input);if(!c.readOnly&&readOnly())throw new Error('Document is read-only.');return await c.run(args)??{executed:true};},
};}
export type EditorAutomation=ReturnType<typeof editorAutomation>;
