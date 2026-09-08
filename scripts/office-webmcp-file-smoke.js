async page=>{
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tools?.has('create_workbook'));
 const call=async(name,input={})=>{const r=await page.evaluate(async({name,input})=>window.__tools.get(name).execute(input),{name,input});if(r?.isError)throw new Error(JSON.stringify(r));return r;};
 const w=await call('create_workbook',{title:'Picker QA',format:'bento/slides',operationId:'picker-qa-'+Date.now()});
 await page.goto('http://127.0.0.1:5173/?workbook='+w.id);await page.frameLocator('iframe').getByRole('button',{name:'Immagine',exact:true}).waitFor();
 const controls=await call('list_interface_controls'),button=controls.controls.find(c=>c.tag==='button'&&c.label.includes("Aggiungi un'immagine"));
 await call('use_interface_control',{id:button.id,action:'click',files:[{name:'pixel.png',mimeType:'image/png',encoding:'base64',content:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII='}]});
 await page.waitForFunction(()=>window.__BENTO_NATIVE_HOST__.document.slides[0].elements.some(e=>e.type==='image'));
 const doc=await call('read_document');return {imageSaved:doc.document.slides[0].elements.some(e=>e.type==='image'),revision:doc.revision};
}
