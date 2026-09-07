import {createServer} from 'vite';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(resolve(root,'.office-dev'),{recursive:true});
await build({entryPoints:[resolve(root,'office/server/worker.ts')],outfile:resolve(root,'.office-dev/worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
const mf=new Miniflare({modules:true,modulesRoot:resolve(root,'.office-dev'),scriptPath:resolve(root,'.office-dev/worker.js'),compatibilityDate:'2026-07-01',d1Databases:['DB'],r2Buckets:['FILES'],d1Persist:resolve(root,'.office-dev/d1'),r2Persist:resolve(root,'.office-dev/r2')});
const db=await mf.getD1Database('DB');
await db.prepare('CREATE TABLE IF NOT EXISTS office_local_migrations(name TEXT PRIMARY KEY)').run();
for(const name of(await readdir(resolve(root,'drizzle'))).filter(n=>n.endsWith('.sql')).sort()) {
  if(await db.prepare('SELECT name FROM office_local_migrations WHERE name=?').bind(name).first())continue;
  const statements=(await readFile(resolve(root,'drizzle',name),'utf8')).split('--> statement-breakpoint').filter(s=>s.trim());
  await db.batch([...statements.map(sql=>db.prepare(sql)),db.prepare('INSERT INTO office_local_migrations(name) VALUES(?)').bind(name)]);
}
const server=await createServer({root,plugins:[{
  name:'office-local-api',enforce:'post',configureServer(vite){
    vite.middlewares.use(async(req,res,next)=>{
      if(req.url?.split('?')[0]==='/standalone/Bento_Dash.bento.html'){
        try{const html=await readFile(resolve(root,'dash/dist-single/Bento_Dash.bento.html'));res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);}
        catch{res.writeHead(404);res.end('Build dash first: npm run build:single');}
        return;
      }
      if(!req.url?.startsWith('/api/')&&req.url?.split('?')[0]!=='/mcp')return next();
      try {
        const chunks:Buffer[]=[];let bytes=0;
        for await(const part of req){bytes+=part.length;if(bytes>9*1024*1024){res.writeHead(413);res.end();return;}chunks.push(part);}
        const headers=Object.fromEntries(Object.entries(req.headers).filter(([,v])=>v!==undefined).map(([k,v])=>[k,Array.isArray(v)?v.join(', '):v!]));
        const response=await mf.dispatchFetch('http://'+req.headers.host+req.url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
      }catch{res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'local_runtime',message:'Servizio locale non disponibile.'}}));}
    });
  },
}]});
await server.listen();server.printUrls();
async function close(){await server.close();await mf.dispose();process.exit(0);}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
