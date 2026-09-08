import {build as viteBuild} from 'vite';
import {build as bundle} from 'esbuild';
import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await viteBuild();
await bundle({entryPoints:['office/server/worker.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,define:{OFFICE_INDEX_HTML:JSON.stringify(await readFile('dist/client/index.html','utf8'))}});
await mkdir('dist/client/standalone',{recursive:true});
for(const [app,name] of [['dash','Dash'],['type','Type'],['slides','Slides']]){
  execFileSync('npm',['run','build:single'],{cwd:app,stdio:'inherit'});
  await copyFile(`${app}/dist-single/Bento_${name}.bento.html`,`dist/client/standalone/Bento_${name}.bento.html`);
}
