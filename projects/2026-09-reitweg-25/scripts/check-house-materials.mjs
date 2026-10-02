import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import * as T from 'three';
import {build} from 'esbuild';
// Generated surfaces: every set and size exists, tiles are square, and each set's mean
// colour stays near the photographed surface it stands for (scripts/build-materials.mjs).
const targets={cladding:'#5f3e29',roof:'#3d3e40',oak:'#b88a58',stone:'#cdc5b7',lawn:'#5e8a33',deck:'#8e8a82',linen:'#e3dac8',plaster:'#ece4d4',bark:'#5b5042'};
const lin=h=>[1,3,5].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});
const manifest=JSON.parse(fs.readFileSync('public/assets/materials/manifest.json','utf8'));
for(const [name,target] of Object.entries(targets)){
 for(const size of manifest.sets[name].sizes)for(const kind of ['color','normal']){
  const file=`public/assets/materials/${name}-${size}-${kind}.webp`;assert(fs.existsSync(file),file);
  const meta=await sharp(file).metadata();assert.equal(meta.width,size);assert.equal(meta.height,size);assert.equal(meta.channels,4,'alpha carries roughness or height');
 }
 const {data,info}=await sharp(`public/assets/materials/${name}-512-color.webp`).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const mean=[0,0,0];for(let i=0;i<data.length;i+=3)for(let c=0;c<3;c++)mean[c]+=lin('#'+data[i+c].toString(16).padStart(2,'0').repeat(3))[0];
 const n=info.width*info.height,goal=lin(target);
 for(let c=0;c<3;c++){const ratio=mean[c]/n/goal[c];assert(ratio>.6&&ratio<1.35,`${name} channel ${c} mean within reach of the photographed colour (ratio ${ratio.toFixed(2)})`);}
}
for(const f of ['leaves-1024-color.webp','leaves-512-color.webp','water-512-normal.webp'])assert(fs.existsSync('public/assets/materials/'+f),f);
// Scanned sets (Extreme): every surface has one, CC0 with its source page, square with four channels, at its real size,
// and its mean colour near the same photographed surface (scripts/build-scanned-materials.mjs).
const scanned=JSON.parse(fs.readFileSync('public/assets/materials/scanned/manifest.json','utf8'));
assert.equal(scanned.licence,'CC0 1.0');
for(const [name,target] of Object.entries(targets)){
 const set=scanned.sets[name];assert(set,`a scanned ${name} set`);
 assert(/^https:\/\/(polyhaven\.com|ambientcg\.com)\//.test(set.page)&&set.asset&&set.source,`${name} credits its source`);
 assert(set.metres[0]>.05&&set.metres[0]<10,`${name} tile size in metres`);
 for(const kind of ['color','normal']){
  const file=`public/assets/materials/scanned/${name}-${set.size}-${kind}.webp`;assert(fs.existsSync(file),file);
  const meta=await sharp(file).metadata();assert.equal(meta.width,set.size);assert.equal(meta.height,set.size);assert.equal(meta.channels,4,`${file} alpha carries roughness or height`);
 }
 const {data,info}=await sharp(`public/assets/materials/scanned/${name}-${set.size}-color.webp`).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const mean=[0,0,0];for(let i=0;i<data.length;i+=3)for(let c=0;c<3;c++)mean[c]+=lin('#'+data[i+c].toString(16).padStart(2,'0').repeat(3))[0];
 const n=info.width*info.height,goal=lin(target);
 for(let c=0;c<3;c++){const ratio=mean[c]/n/goal[c];assert(ratio>.6&&ratio<1.35,`scanned ${name} channel ${c} mean within reach of the photographed colour (ratio ${ratio.toFixed(2)})`);}
}
// Extreme loads them, at their real size; other presets keep the generated sets.
{
 await build({entryPoints:['lib/house-model/surface-materials.ts','lib/house-model/device-tier.ts'],outdir:'tmp/scanned-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
 const {surfaceSet}=await import('../tmp/scanned-check/surface-materials.mjs'),{tiers}=await import('../tmp/scanned-check/device-tier.mjs');
 assert.equal(tiers.extreme.scanned,true);for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].scanned,false,`${q} keeps the generated sets`);
 for(const name of Object.keys(targets)){
  const set=scanned.sets[name],on=surfaceSet(name,1024,true),off=surfaceSet(name,1024,false);
  assert.equal(on.color,`/assets/materials/scanned/${name}-${set.size}-color.webp`);assert.equal(on.metres,set.metres[0],`${name} tiles at the scan's size`);
  assert(!off.color.includes('/scanned/'),`${name} generated otherwise`);
 }
}
// Shader patches find their chunks in this three.js version.
await build({entryPoints:['lib/house-model/surface-materials.ts'],outfile:'tmp/materials-check.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {finishSurfaces}=await import('../tmp/materials-check.mjs');
const tex=()=>new T.Texture(),textures={size:512,get:()=>({color:tex(),normal:tex()}),water:tex(),ready:Promise.resolve(),dispose(){}};
const root=new T.Group(),oak=new T.MeshStandardMaterial({color:'#c6aa80'}),glass=new T.MeshPhysicalMaterial({transparent:true,opacity:.38,roughness:.14}),water=new T.MeshStandardMaterial({transparent:true,opacity:.8});
oak.userData.photo='oak';water.userData.water=true;
for(const m of [oak,glass,water])root.add(new T.Mesh(new T.BoxGeometry(),m));
finishSurfaces(root,textures,{value:0});
const compile=m=>{const s={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};m.onBeforeCompile(s,null);return s;};
const o=compile(oak);assert(o.fragmentShader.includes('textureGrad(uSurfaceColor')&&o.fragmentShader.includes('roughnessFactor=surfaceTexel.a'));
// Textured surfaces keep their painted colour for the bounced-sunlight bake, whose patches also find their chunks.
const rounded=c=>c?.toArray().map(v=>+v.toFixed(4));
assert.deepEqual(rounded(oak.userData.albedo),rounded(new T.Color('#c6aa80')),'oak keeps its painted colour as albedo');
await build({entryPoints:['lib/house-model/sun-bounce.ts'],outfile:'tmp/bounce-check.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {bakeSunBounce}=await import('../tmp/bounce-check.mjs');
bakeSunBounce([new T.Mesh(new T.BoxGeometry(4,.2,4).toNonIndexed(),oak)],[root],new T.DirectionalLight(),32);
assert(compile(oak).fragmentShader.includes('uBounceLight'),'bounced sunlight reaches textured surfaces');
assert.equal(glass.transmission,0,'glass has no transmission pass');assert(compile(glass).fragmentShader.includes('pow(1.0-abs(dot(normal'));
assert(compile(water).fragmentShader.includes('uWaterNormal'));
assert(root.children.every(m=>!m.material.transparent||!m.castShadow),'transparent surfaces cast no shadow');
console.log('Passed: all generated and scanned (CC0, Extreme) surface sets present and square, mean colours near the photographed surfaces, surface/glass/water/bounce patches compile against three\'s chunks.');
