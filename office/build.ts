import {build as viteBuild} from 'vite';
import {build as bundle} from 'esbuild';
import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await viteBuild();
await bundle({entryPoints:['office/server/worker.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,define:{OFFICE_INDEX_HTML:JSON.stringify(await readFile('dist/client/index.html','utf8'))}});
execFileSync('npm',['run','build:single'],{cwd:'dash',stdio:'inherit'});
await mkdir('dist/client/standalone',{recursive:true});
await copyFile('dash/dist-single/Bento_Dash.bento.html','dist/client/standalone/Bento_Dash.bento.html');
