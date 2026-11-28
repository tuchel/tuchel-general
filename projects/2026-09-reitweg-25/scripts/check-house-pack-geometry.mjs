import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// The moving ray trace takes its scene on the page's thread (it shares the view's device). The library packs every
// vertex attribute through a Vector4 per vertex, which was most of a 2.4 s freeze (M3 Max, 2.5 M vertices); the Pages
// build swaps in a plain copy for ordinary float attributes (build/pack-geometry-plugin.ts). It must write the same
// numbers, and the build must fail rather than silently lose the swap if the library changes.
await build({entryPoints:['build/pack-geometry-plugin.ts'],outdir:'tmp/pack-geometry-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const {packGeometry,PACK_FILE}=await import('../tmp/pack-geometry-check/pack-geometry-plugin.mjs');
const file='node_modules/'+PACK_FILE,source=fs.readFileSync(file,'utf8'),plugin=packGeometry();
const patched=plugin.transform(source,'/x/'+file)?.code;
assert(patched&&patched!==source&&plugin.transform('x','/x/other.js')===undefined,'only that file is changed');
assert.throws(()=>plugin.transform('export function appendGeometryData(){}','/x/'+file),'a library without the anchor stops the build');
assert(fs.readFileSync('vite.pages.config.ts','utf8').includes('packGeometry()'),'the Pages build uses it');
fs.mkdirSync('node_modules/three-mesh-bvh/src/webgpu/utils/.check',{recursive:true});
const copy='node_modules/three-mesh-bvh/src/webgpu/utils/.check/patched.js';fs.writeFileSync(copy,patched.replaceAll("from './","from '../").replaceAll("from '../../","from '../../../"));
const [{appendGeometryData:slow},{appendGeometryData:fast}]=await Promise.all([import('../'+file),import('../'+copy)]);
const g=new T.TorusKnotGeometry(1,.3,40,8);g.setAttribute('color',new T.BufferAttribute(new Uint8Array(g.attributes.position.count*3).map((_,i)=>i*7),3,true));
g.setAttribute('tangent',new T.BufferAttribute(new Float32Array(g.attributes.position.count*4).map((_,i)=>Math.sin(i)),4));
const names=['position','normal','uv','color','tangent','missing'],struct={getLength:()=>names.length*4,membersLayout:names.map(name=>({name}))};
const data={getDefaultAttributeValue:(name,v)=>v.set(name.length,2,3,1)},range={vertexStart:5,vertexCount:g.attributes.position.count-9};
const run=f=>{const out=new ArrayBuffer((range.vertexCount+3)*struct.getLength()*4);f({geometry:g},range,3,out,struct,data);return new Float32Array(out);};
assert.deepEqual(run(fast),run(slow),'the same numbers as the library writes');
fs.rmSync('node_modules/three-mesh-bvh/src/webgpu/utils/.check',{recursive:true});
console.log('Passed: the plain copy writes what the library writes (floats of 2, 3 and 4 parts, a normalized byte attribute left to the library, a missing one).');
