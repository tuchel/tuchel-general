import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const base='/tuchel-general/reitweg-25/';
const studio='https://reitweg-25-design-studio.tuchel.chatgpt.site';
const root=fileURLToPath(new URL('.',import.meta.url));

export default defineConfig({
 base,
 resolve:{alias:{'@':root}},
 plugins:[{
  name:'pages-public-asset-paths',
  enforce:'pre',
  // Existing authored TS/JSON asset literals also feed Three.js loaders. Vite
  // handles HTML/CSS/module URLs; scope this rewrite to local source literals.
  transform(code,id){
   if(!id.startsWith(root)||id.includes('/node_modules/')||! /\.(?:[cm]?[jt]sx?|json)(?:\?|$)/.test(id))return;
   return {code:code.replace(/(["'`])\/assets\//g,`$1${base}assets/`).replace(new RegExp(`${base}assets/(expose|operating-costs|kitchen-footprint-review)\\.pdf`,'g'),`${studio}/assets/$1.pdf`),map:null};
  },
 },react()],
 build:{outDir:'dist-pages',emptyOutDir:true},
 // The path-tracing worker loads its renderer, tracer and denoiser on demand, which needs module workers.
 worker:{format:'es'},
});
