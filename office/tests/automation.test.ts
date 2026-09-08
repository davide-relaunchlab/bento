import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {editorAutomation} from '../shared/automation.ts';
test('editor commands validate before execution, await completion, enforce read-only and reject arbitrary methods',async()=>{
 let locked=false,value=0;
 const a=editorAutomation(()=>({value}),()=>locked,[{name:'set',description:'Set',schema:z.object({value:z.number()}).strict(),run:async i=>{await Promise.resolve();value=i.value;return value;}}]);
 assert.equal(await a.execute('set',{value:7}),7);assert.deepEqual(a.state(),{value:7});
 await assert.rejects(a.execute('set',{value:'wrong'}));assert.equal(value,7);
 locked=true;await assert.rejects(a.execute('set',{value:8}),/read-only/);
 await assert.rejects(a.execute('constructor',{}),/Unknown/);
 assert.equal(a.commands()[0].inputSchema.additionalProperties,false);
});
