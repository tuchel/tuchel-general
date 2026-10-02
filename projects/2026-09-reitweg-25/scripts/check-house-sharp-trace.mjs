import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// Sharp textures in the traced image (Extreme). The tracer samples at the screen's CSS resolution, a quarter of a
// Retina screen's pixels, and its textures are baked smaller than the live view's, so a stretched traced image softens
// wood grain, tiles and cladding. Each denoised image is instead divided by the colour of the surface at each traced
// pixel, from the tracer's own colour pass; the page stretches that light and multiplies it by the live view's surface
// colours at full resolution. Both colour passes leave out see-through surfaces, so both show the same surface at each
// pixel, and a floor on the colours keeps dark surfaces from amplifying what they reflect.
await build({entryPoints:['lib/house-model/live-trace-webgpu.ts','lib/house-model/albedo-pass.ts','lib/house-model/build-model.ts','lib/house-model/landscape-context.ts','lib/house-model/foliage.ts','lib/house-model/photographic-scene.ts','lib/house-model/surface-materials.ts'],outdir:'tmp/sharp-trace-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/sharp-trace-check/${name}.mjs`);
const [{demodulate},{addAlbedoOutput,renderAlbedo,seeThrough,ALBEDO_KEY,SHARP},{buildHouseModel},{landscapeContext},{foliageMaterials,finishFoliage},{photographicScene,sceneCache},{finishSurfaces}]=
 await Promise.all(['live-trace-webgpu','albedo-pass','build-model','landscape-context','foliage','photographic-scene','surface-materials'].map(load));
const {toHalfFloat:half,fromHalfFloat:full}=T.DataUtils;
const pixels=(n,f)=>{const a=new Uint16Array(n*4);for(let i=0;i<n;i++){const v=f(i);for(let c=0;c<4;c++)a[i*4+c]=half(c<3?(Array.isArray(v)?v[c]:v):1);}return a;};
const remodulate=(e,a)=>e*Math.max(a,SHARP.floor),counts={};

// A board pattern finer than a traced pixel, under light that changes smoothly: the traced pixel sees the board's
// average colour; dividing by that and multiplying by the live view's colour restores the boards.
{
 const n=16,light=i=>1+i/n,boards=[.8,.2],lo=pixels(n,()=>.5),radiance=pixels(n,i=>light(i)*.5);
 const e=demodulate(radiance,lo);
 for(let i=0;i<n;i++)assert(Math.abs(full(e[i*4])-light(i))<.01,'the light at each traced pixel, without the surface colour');
 const shown=x=>remodulate(full(e[Math.min(n-1,Math.floor(x/2))*4]),boards[x%2]);
 const contrast=shown(8)/shown(9),stretched=full(radiance[4*4])/full(radiance[4*4]);
 assert(Math.abs(contrast-4)<.05&&stretched===1,`board-to-board contrast ${contrast.toFixed(2)}, against ${stretched} for the stretched image`);
}
// Where both passes see the same colour, the traced image comes back unchanged, light and dark surfaces alike.
{
 let worst=0;const n=4096,r=i=>[(i*7919%97)/20,(i*104729%89)/30,(i*1299709%83)/40],a=i=>[(i*31%100)/100,(i*17%100)/100,(i*13%100)/100];
 const radiance=pixels(n,r),albedo=pixels(n,a),e=demodulate(radiance,albedo);
 for(let i=0;i<n;i++)for(let c=0;c<3;c++){const back=remodulate(full(e[i*4+c]),full(albedo[i*4+c])),want=full(radiance[i*4+c]);worst=Math.max(worst,Math.abs(back-want)/Math.max(want,1e-3));}
 assert(worst<.002,`unchanged where the colours agree (worst ${(worst*100).toFixed(2)}%)`);
 assert(SHARP.floor>=.03&&SHARP.floor<=.1,`a dark surface amplifies its reflections at most ${Math.round(1/SHARP.floor)}-fold, and only colour channels under ${SHARP.floor} lose detail`);
}

// The live view's colour pass: every surface material writes its colour instead of its light while the pass draws, in
// one program with the lit view; see-through surfaces and anything else are left out.
const foliage=foliageMaterials('leaves'),setting=landscapeContext({foliage,density:1});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(128)})})})};
const texture=()=>new T.Texture({width:4,height:4}),set={color:texture(),normal:texture()};
const model=buildHouseModel(true,setting.group,foliage);model.setLevel('exterior');
finishSurfaces(model.root,{size:512,get:()=>set,water:texture(),ready:Promise.resolve(),dispose(){}},{value:0});finishFoliage(model.root,set,set);
const scene=new T.Scene();scene.add(model.root);
addAlbedoOutput(scene);
let albedoUniform;
{
 const physical=new T.MeshPhysicalMaterial(),shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};
 const m=new T.Mesh(new T.BoxGeometry(),physical);const s=new T.Scene();s.add(m);addAlbedoOutput(s);
 for(const f of physical.userData.shaderFeatures)f.compile(shader);
 assert(/if\(uAlbedoPass>0\.5\)gl_FragColor=vec4\(diffuseColor\.rgb,1\.0\);/.test(shader.fragmentShader.split('#include <dithering_fragment>')[1]??''),'the surface colour replaces the lit colour, after everything else');
 albedoUniform=shader.uniforms.uAlbedoPass;assert(albedoUniform?.value===0,'off for the lit view');
}
// The pass draws only patched, solid surfaces on white, then puts everything back.
{
 const drawn=new Set();let target,during;const clears=[];
 const renderer={getRenderTarget:()=>null,setRenderTarget:t=>{target=t;},getClearColor:c=>c.set(0,0,0),getClearAlpha:()=>0,setClearColor:(c,a)=>{clears.push([new T.Color(c).getHex(),a]);},clear(){},
  render:s=>{during=albedoUniform.value;s.traverseVisible(o=>{if(o.isMesh)drawn.add(o);});}};
 const camera=new T.PerspectiveCamera(),out=new T.WebGLRenderTarget(4,4),before=[];scene.traverse(o=>before.push(o.visible));
 const background=scene.background=new T.Color(1,0,0);
 renderAlbedo(renderer,scene,camera,out);
 assert(during===1&&albedoUniform.value===0,'colours while the pass draws, light again after');
 assert(clears[0][0]===0xffffff&&clears[0][1]===1,'on white');
 assert(target===null&&clears.at(-1)[0]===0&&clears.at(-1)[1]===0,'back to the view, its clear colour restored');
 let i=0,same=true;scene.traverse(o=>{if(o.visible!==before[i++])same=false;});assert(same&&scene.background===background,'every object shown as before');
 for(const o of drawn)for(const m of [o.material].flat()){assert(!seeThrough(m),`${o.name||'a mesh'}: see-through surfaces stay out`);assert(m.userData.shaderFeatures?.some(f=>f.key===ALBEDO_KEY),`${o.name||'a mesh'}: drawn with its colour output`);}
 counts.drawn=drawn.size;assert(drawn.size>500,`${drawn.size} meshes in the colour pass`);
}

// The tracer's surfaces against the live view's: the same ones see-through, and the same colour (a leaf's colour is
// raised in the trace by 1/(1 − transmission), so its colour pass scales it back).
{
 const cache=sceneCache(),traced=await photographicScene(scene,new T.Texture(),new AbortController().signal,()=>{},{maxDistance:120,origin:new T.Vector3(-5,0,8),instances:true,cache});
 let pairs=0,leaves=0;
 for(const [live,{material:trace}] of cache.materials){
  pairs++;
  assert.equal(seeThrough(trace),seeThrough(live),`${live.name||live.type}: see-through in both or neither`);
  if(seeThrough(live))continue;
  const k=1-(trace.transmission??0);if(k<1)leaves++;
  const surface=live.userData.surfaceUniforms?.uSurfaceTint?.value,want=live.color.clone();if(surface)want.multiply(surface);
  for(const c of ['r','g','b'])assert(Math.abs(trace.color[c]*k-want[c])<1e-4,`${live.name||live.type}: the same colour in both passes (${c} ${(trace.color[c]*k).toFixed(3)} vs ${want[c].toFixed(3)})`);
 }
 counts.pairs=pairs;counts.leaves=leaves;assert(pairs>40&&leaves>0,`${pairs} materials compared, ${leaves} of them leaves`);
 traced.dispose();cache.dispose();
}

// The wiring: the tracer's colour pass, the division and its flag, the page's colour pass and the multiplication.
{
 const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),gpu=read('live-trace-webgpu.ts'),worker=read('live-trace-worker.ts'),post=read('post.ts'),viewer=read('viewer.ts');
 assert(/mrt\(\{output:diffuseColor\}\)/.test(gpu)&&/seeThrough/.test(gpu)&&/1-\(m\.transmission\?\?0\)|1-m\.transmission/.test(gpu),'the tracer draws its surface colours, see-through ones left out, leaves scaled back');
 assert(/demodulate\(/.test(gpu)&&/demodulated:/.test(gpu),'denoised images are divided by them and say so');
 assert(/demodulated:result\.demodulated/.test(worker)&&/demodulated=data\.demodulated/.test(gpu),'the worker passes the flag on');
 assert(/post\.present\([^;]*traced\.demodulated/.test(viewer),'the viewer hands it to the finish');
 assert(/renderAlbedo\(/.test(post)&&/uniform sampler2D albedo/.test(post)&&new RegExp(`max\\(texture2D\\(albedo,vUv\\)\\.rgb,vec3\\(\\$\\{SHARP\\.floor\\}\\)\\)`).test(post),'the finish multiplies by the live view’s colours at full resolution');
 assert(/addAlbedoOutput\(/.test(viewer),'Extreme’s materials get their colour output');
}
console.log(`Passed: a board pattern finer than a traced pixel comes back at 4.00× contrast instead of 1 (the stretched image); where both colour passes agree the traced image is unchanged; the tracer and the live view leave out the same see-through surfaces and give the rest the same colours (${counts.pairs} materials, ${counts.leaves} of them leaves; ${counts.drawn} meshes in the live pass); the floor on colours is ${SHARP.floor}.`);
