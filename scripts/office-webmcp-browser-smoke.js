async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__tools=new Map();document.modelContext={registerTool:t=>window.__tools.set(t.name,t)};});
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tools?.has('create_workbook'));
 const call=async(name,input={})=>{await page.waitForFunction(name=>window.__tools?.has(name),name);const r=await page.evaluate(async({name,input})=>window.__tools.get(name).execute(input),{name,input});if(r?.isError)throw new Error(name+': '+JSON.stringify(r));return r;};
 const results=[];
 for(const kind of ['type','slides','dash']){
  const w=await call('create_workbook',{title:'Parity QA '+kind,format:'bento/'+kind,operationId:'parity-qa-'+kind+'-'+Date.now()});
  await page.goto('http://127.0.0.1:5173/?workbook='+w.id);
  await page.waitForFunction(async()=>{const t=window.__tools?.get('get_editor_commands');return t&&(await t.execute({})).commands?.length>0;});
  if(kind!=='dash')await page.frameLocator('iframe').locator('input').first().waitFor({state:'visible'});else await page.locator('.dw-workbench-heading input').waitFor({state:'visible'});
  const commands=await call('get_editor_commands');
  await page.waitForFunction(async kind=>(await window.__tools.get('list_interface_controls').execute({})).controls.some(c=>c.tag==='input'&&c.value==='Parity QA '+kind),kind);
  const controls=await call('list_interface_controls');
  const title=controls.controls.find(c=>c.tag==='input'&&c.value==='Parity QA '+kind);
  if(!title)throw new Error('Missing title '+kind+' '+JSON.stringify(controls).slice(0,1000));
  await call('use_interface_control',{id:title.id,action:'set_value',value:'Verified '+kind});
  const doc=await call('read_document');if(doc.document.title!=='Verified '+kind)throw new Error('Title not persisted '+kind);
  if(kind==='slides'){
   await call('apply_change',{baseRevision:doc.revision,operationId:'parity-text-'+Date.now(),summary:'Text for measurement',patches:[{op:'addElement',slide:doc.document.slides[0].id,id:'qa-text',element:{type:'text',html:'Native measurement',w:600,h:100}}]});
   await call('editor_command',{command:'select_elements',input:{ids:['qa-text']}});
   const measure=await call('editor_command',{command:'measure_element',input:{id:'qa-text'}});if(!(measure.result.height>0))throw new Error('Bad measurement');
  }else if(kind==='type'){
   const block=doc.document.body[0];await call('apply_change',{baseRevision:doc.revision,operationId:'parity-type-'+Date.now(),summary:'Text for selection',patches:[{op:'setBlock',id:block.id,block:{...block,text:'Native text'}}]});
   await call('editor_command',{command:'select_text',input:{id:block.id,at:0,to:6}});
   await call('editor_command',{command:'toggle_mark',input:{mark:'bold'}});
   const saved=await call('read_document');if(!saved.document.body[0].marks?.length)throw new Error('Formatting not saved');
   await call('editor_command',{command:'paginate'});
   await call('editor_command',{command:'sign',input:{name:'Local QA'}});
   const verified=await call('editor_command',{command:'verify_signatures'});if(!verified.result.entries.every(e=>e.ok))throw new Error('Invalid signature');
  }else{
   await call('editor_command',{command:'select_cell',input:{row:0,col:0}});
   await call('editor_command',{command:'paste_tsv',input:{text:'12\t24\n36\t48'}});
   const copied=await call('editor_command',{command:'copy_tsv'});if(!copied.result.text.includes('12'))throw new Error('Paste failed');
   await call('editor_command',{command:'validate'});
  }
  const exported=await call('export_document');if(!exported.content.includes('bento-doc'))throw new Error('Export missing document');
  await page.screenshot({path:'/tmp/parity-'+kind+'.png'});
  results.push({kind,commands:commands.commands.map(c=>c.name),controls:controls.controls.length,revision:(await call('read_editor_state')).revision});
 }
 const imported=await call('import_file',{name:'parity.csv',content:'Name,Value\nA,10\nB,20',encoding:'text'});if(!imported.id)throw new Error('Import failed');
 return {results,imported:!!imported.id,errors};
}
