import {defineConfig} from 'vite';
import {sites} from '@openai/sites-vite-plugin';
export default defineConfig({
  plugins:[sites()],
  define:{__APP_VERSION__:JSON.stringify('0.3.0')},
  server:{host:'127.0.0.1',port:5173,strictPort:false},
  build:{rollupOptions:{input:['index.html','office/editors/type.html','office/editors/slides.html']},outDir:'dist/client',emptyOutDir:true,chunkSizeWarningLimit:2000,assetsInlineLimit:4096},
});
