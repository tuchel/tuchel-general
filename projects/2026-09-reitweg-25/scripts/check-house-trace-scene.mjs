import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The scene handed to the resting path tracer (photographic-scene.ts) is prepared on the page's thread, so it must
// never hold that thread long enough to delay a click; it carries its own tangents, so neither tracer computes them on
// that thread; and for the WebGPU tracer instanced trees and planting stay instanced, so each archetype is converted,
// indexed and given a ray-tracing tree once rather than once per tree.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/landscape-context.ts','lib/house-model/foliage.ts','lib/house-model/photographic-scene.ts','lib/house-model/surface-materials.ts'],outdir:'tmp/trace-scene-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/trace-scene-check/${name}.mjs`);
const [{buildHouseModel},{landscapeContext},{foliageMaterials,finishFoliage},{photographicScene},{finishSurfaces}]=await Promise.all(['build-model','landscape-context','foliage','photographic-scene','surface-materials'].map(load));
// Texture sets as a browser would have them: a small grey image read back through a canvas.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(128)})})})};
const texture=()=>new T.Texture({width:4,height:4}),set={color:texture(),normal:texture()};
const textures={size:512,get:()=>set,water:texture(),ready:Promise.resolve(),dispose(){}};
const foliage=foliageMaterials('leaves'),setting=landscapeContext({foliage,density:1});
const model=buildHouseModel(true,setting.group,foliage);model.setLevel('exterior');
finishSurfaces(model.root,textures,{value:0});finishFoliage(model.root,set,set);
const source=new T.Scene();source.add(model.root);
const options={maxDistance:120,origin:new T.Vector3(-5,0,8)};

/** Converts, timing the longest stretch the event loop could not run. */
async function convert(extra={}){
 let longest=0,last=performance.now();const tick=setInterval(()=>{const now=performance.now();longest=Math.max(longest,now-last);last=now;},1);
 const started=performance.now(),local=await photographicScene(source,new T.Texture(),new AbortController().signal,()=>{},{...options,...extra});
 const total=performance.now()-started;clearInterval(tick);
 let traced=0,unique=0;const seen=new Set(),meshes=[];
 local.scene.traverse(o=>{if(!o.isMesh)return;meshes.push(o);const n=o.geometry.attributes.position.count/3;traced+=n*(o.isInstancedMesh?o.count:1);if(!seen.has(o.geometry)){seen.add(o.geometry);unique+=n;}});
 return {local,longest,total,traced,unique,meshes};
}
const flat=await convert(),kept=await convert({instances:true});
// The checks run with the clock of whatever machine runs them; a stretch of 60 ms is well under a noticeable delay.
assert(flat.longest<60,`conversion holds the thread for ${flat.longest.toFixed(0)} ms at a stretch`);
assert(kept.longest<60,`instanced conversion holds the thread for ${kept.longest.toFixed(0)} ms at a stretch`);

// Tangents: unit length, square to the normal, w = ±1, and along the texture's u direction on projected surfaces.
let checked=0;
for(const mesh of flat.meshes){
 const g=mesh.geometry,t=g.attributes.tangent,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 assert(t&&t.itemSize===4,`${mesh.name||'a mesh'} carries tangents`);
 // Projected surfaces are the ones given a roughness map from their texture set.
 const projected=!!mesh.material.roughnessMap;
 for(let f=0;f<Math.min(p.count/3,40);f++){
  const i=f*3,tan=new T.Vector3().fromBufferAttribute(t,i),w=t.getW(i);
  if(tan.lengthSq()===0)continue;
  assert(Math.abs(tan.length()-1)<1e-3&&Math.abs(Math.abs(w)-1)<1e-6,`${mesh.name} tangent is unit with w ±1`);
  assert(Math.abs(tan.dot(new T.Vector3().fromBufferAttribute(n,i)))<1e-2,`${mesh.name} tangent is square to the normal`);
  if(!projected||!uv)continue;
  const [a,b,c]=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,i+k)),[ua,ub,uc]=[0,1,2].map(k=>new T.Vector2().fromBufferAttribute(uv,i+k));
  const e1=b.clone().sub(a),e2=c.clone().sub(a),d1=ub.clone().sub(ua),d2=uc.clone().sub(ua),r=d1.x*d2.y-d2.x*d1.y;if(Math.abs(r)<1e-9)continue;
  // On a face square to its projection axis (walls, floors), the texture's u runs exactly along the tangent.
  const face=e1.clone().cross(e2).normalize();if(Math.max(Math.abs(face.x),Math.abs(face.y),Math.abs(face.z))<.999)continue;
  // Measured in the plane square to the vertex normal, as the tangent is (smooth-shaded faces).
  const normal=new T.Vector3().fromBufferAttribute(n,i),dPdu=e1.clone().multiplyScalar(d2.y).addScaledVector(e2,-d1.y).divideScalar(r);
  dPdu.addScaledVector(normal,-normal.dot(dPdu)).normalize();
  assert(tan.dot(dPdu)>.99,`${mesh.name} tangent follows the texture`);checked++;
 }
}
assert(checked>100,'projected surfaces were checked');

// Instanced: the same triangles traced, a fraction of them converted.
assert(kept.meshes.some(o=>o.isInstancedMesh&&o.name==='tree-leaves'),'modelled leaves stay instanced');
assert.equal(kept.traced,flat.traced,'instancing traces the same triangles');
assert(kept.unique<flat.unique*.25,`instanced conversion keeps ${(kept.unique/1e6).toFixed(2)} M of ${(flat.unique/1e6).toFixed(2)} M triangles`);
for(const o of kept.meshes)if(o.isInstancedMesh){const m=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);assert(Math.abs(m.determinant())>1e-12,'no collapsed instances');}}
flat.local.dispose();kept.local.dispose();
console.log(`Passed: ${(flat.traced/1e6).toFixed(2)} M traced triangles; longest hold ${flat.longest.toFixed(0)} ms (${(flat.total/1000).toFixed(1)} s in all), instanced ${kept.longest.toFixed(0)} ms (${(kept.total/1000).toFixed(1)} s) converting ${(kept.unique/1e6).toFixed(2)} M; tangents unit, square to normals, along the texture on ${checked} projected faces.`);
