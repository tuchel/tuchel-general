// What preparing Extreme's path-traced scene costs on the page's thread, measured in Node (no graphics card), for the
// flattened scene (the WebGL tracer) and the instanced one (the WebGPU tracer). Run from the project root:
//   mkdir -p tmp && node scripts/measure-house-trace-prep.mjs
// Times are this machine's; the ray-tracing trees are built on one thread here, in background workers in the page.
import * as T from 'three';
import {build} from 'esbuild';
import {MeshBVH,SAH} from 'three-mesh-bvh';
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/landscape-context.ts','lib/house-model/foliage.ts','lib/house-model/photographic-scene.ts'],outdir:'tmp/trace-prep',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/trace-prep/${name}.mjs`);
const [{buildHouseModel},{landscapeContext},{foliageMaterials},{photographicScene}]=await Promise.all(['build-model','landscape-context','foliage','photographic-scene'].map(load));
const {setCommonAttributes}=await import('three-gpu-pathtracer/src/core/utils/GeometryPreparationUtils.js');
const {StaticGeometryGenerator}=await import('three-gpu-pathtracer/src/core/utils/StaticGeometryGenerator.js');
const {PathtracerBVHComputeData}=await import('three-gpu-pathtracer/src/webgpu/nodes/PathtracerBVHComputeData.js');
const foliage=foliageMaterials('leaves'),setting=landscapeContext({foliage,density:1});
const model=buildHouseModel(true,setting.group,foliage);model.setLevel('exterior');
const source=new T.Scene();source.add(model.root);
const s=ms=>(ms/1000).toFixed(1)+' s',time=f=>{const t=performance.now();f();return performance.now()-t;};
for(const instances of [false,true]){
 let longest=0,last=performance.now();const tick=setInterval(()=>{const now=performance.now();longest=Math.max(longest,now-last);last=now;},1);
 const t=performance.now(),local=await photographicScene(source,new T.Texture(),new AbortController().signal,()=>{},{maxDistance:120,origin:new T.Vector3(-5,0,8),instances});
 const conversion=performance.now()-t;clearInterval(tick);
 const geometries=new Set();let traced=0;
 local.scene.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);traced+=o.geometry.attributes.position.count/3*(o.isInstancedMesh?o.count:1);});
 let unique=0;for(const g of geometries)unique+=g.attributes.position.count/3;
 const trees=time(()=>{for(const g of geometries)g.boundsTree=new MeshBVH(g,{strategy:SAH,targetLeafSize:5});});
 const attributes=time(()=>{for(const g of geometries)setCommonAttributes(g,['normal','tangent']);});
 const packing=instances?time(()=>new PathtracerBVHComputeData(local.scene).update()):time(()=>{const g=new StaticGeometryGenerator(local.scene);g.attributes=['position','normal','tangent','uv','color'];g.generate();});
 console.log(`${instances?'instanced (WebGPU)':'flattened (WebGL) '}: ${(traced/1e6).toFixed(2)} M triangles traced, ${(unique/1e6).toFixed(2)} M converted; conversion ${s(conversion)} (longest hold ${longest.toFixed(0)} ms), trees ${s(trees)}, attributes ${s(attributes)}, ${instances?'scene buffers':'merged geometry'} ${s(packing)}`);
 local.dispose();
}
