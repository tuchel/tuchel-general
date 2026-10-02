import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// The path tracer runs in a worker (live-trace-worker.ts): the page sends the traced scene as plain data
// (trace-transfer.ts), the worker rebuilds it. The rebuilt scene matches the page's mesh for mesh; a second send carries
// only what changed; a new sun sends lights and sky alone.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/landscape-context.ts','lib/house-model/foliage.ts','lib/house-model/photographic-scene.ts','lib/house-model/trace-transfer.ts'],outdir:'tmp/worker-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/worker-check/${name}.mjs`);
const [{buildHouseModel},{landscapeContext},{foliageMaterials},{photographicScene,sceneCache},{sceneSender,sceneStore,cameraData,applyCamera,pieces}]=await Promise.all(['build-model','landscape-context','foliage','photographic-scene','trace-transfer'].map(load));
const foliage=foliageMaterials('leaves'),setting=landscapeContext({foliage,density:1});
const model=buildHouseModel(true,setting.group,foliage);model.setLevel('exterior');
const source=new T.Scene();source.add(model.root);
const sun=new T.DirectionalLight('#fff4de',3);sun.position.set(-25,55,25);sun.target.position.set(0,0,0);source.add(sun,sun.target);
const sky=new T.DataTexture(new Float32Array(8*4*4).fill(.5),8,4,T.RGBAFormat,T.FloatType);sky.mapping=T.EquirectangularReflectionMapping;sky.minFilter=sky.magFilter=T.LinearFilter;
const cache=sceneCache(),options={maxDistance:120,origin:new T.Vector3(-5,0,8),instances:true,cache};
const local=await photographicScene(source,sky,new AbortController().signal,()=>{},options);

// Geometry and textures go ahead in pieces of about 2 MB (a large geometry an attribute at a time), so no one message
// holds the page long to clone; the scene follows with its meshes and materials.
const sender=sceneSender(),store=sceneStore();
const whole=sender.scene(local.scene),{parts,rest}=pieces(whole,2e6);
const sizeOf=part=>part.geometries.reduce((s,g)=>s+Object.values(g.attributes).reduce((t,a)=>t+a.array.byteLength,g.index?.byteLength??0),0)+part.textures.reduce((s,t)=>s+t.data.byteLength,0);
const biggest=Math.max(...whole.geometries.flatMap(g=>Object.values(g.attributes).map(a=>a.array.byteLength)));
assert(parts.length>10&&parts.every(p=>sizeOf(p)<=Math.max(2e6,biggest)),'pieces of about 2 MB');
assert.equal(rest.geometries.length+rest.textures.length,0,'the scene follows without them');
for(const part of parts)store.add(structuredClone(part));
const rebuilt=store.scene(structuredClone(rest));
const summary=scene=>{const rows=[];scene.updateMatrixWorld(true);scene.traverse(o=>{if(!o.isMesh)return;const n=o.geometry.attributes.position.count/3;rows.push({name:o.name,traced:n*(o.isInstancedMesh?o.count:1),attributes:Object.keys(o.geometry.attributes).sort().join(),matrix:o.matrixWorld.elements.map(e=>+e.toFixed(5)).join()});});return rows;};
const a=summary(local.scene),b=summary(rebuilt);
assert.equal(b.length,a.length,'every mesh arrives');
assert.deepEqual(b.map(r=>r.traced),a.map(r=>r.traced),'with the same triangles and instances');
assert.deepEqual(b.map(r=>r.attributes),a.map(r=>r.attributes),'and the same attributes');
assert.deepEqual(b.map(r=>r.matrix),a.map(r=>r.matrix),'in the same place');
// Materials keep their values and maps; instances their transforms and colours.
const meshes=[],copies=[];local.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});rebuilt.traverse(o=>{if(o.isMesh)copies.push(o);});
let textured=0;
meshes.forEach((m,i)=>{
 const x=m.material,y=copies[i].material;
 for(const k of ['roughness','metalness','opacity','alphaTest','side','transmission','ior','vertexColors'])assert.equal(y[k],x[k],`${m.name} ${k}`);
 assert.equal(y.color.getHex(),x.color.getHex(),`${m.name} colour`);
 for(const k of ['map','normalMap','roughnessMap']){assert.equal(!!y[k],!!x[k],`${m.name} ${k}`);if(x[k]){textured++;assert.equal(y[k].image.width,x[k].image.width);assert.equal(y[k].repeat.x,x[k].repeat.x,`${m.name} ${k} repeat`);}}
 if(m.isInstancedMesh){assert.deepEqual([...copies[i].instanceMatrix.array.slice(0,m.count*16)],[...m.instanceMatrix.array.slice(0,m.count*16)],`${m.name} instances`);if(m.instanceColor)assert.deepEqual([...copies[i].instanceColor.array],[...m.instanceColor.array.slice(0,m.count*3)],`${m.name} colours`);}
});
assert(textured>0,'texture maps travel');
const light=rebuilt.children.find(o=>o.isDirectionalLight);assert(light&&light.intensity===3,'the sun travels');
assert(rebuilt.environment?.image.width===8&&rebuilt.environment.minFilter===T.LinearFilter&&rebuilt.environment.magFilter===T.LinearFilter,'the sky travels, filtered');

// A second send after one hidden mesh carries no geometry, material or texture; the worker lets the hidden one go.
// The hidden mesh is the only one with its material, so the worker lets that material go too.
const uses=new Map();local.scene.traverse(o=>{if(o.isMesh)uses.set(o.material,(uses.get(o.material)??0)+1);});
let hidden;for(const [o,{mesh}] of cache.meshes)if(!hidden&&!o.isInstancedMesh&&uses.get(mesh.material)===1&&o.geometry.attributes.position.count>100)hidden=o;
assert(hidden,'a mesh with a material of its own');hidden.visible=false;
const next=await photographicScene(source,sky,new AbortController().signal,()=>{},options);
const delta=structuredClone(sender.scene(next.scene));
assert.equal(delta.geometries.length+delta.materials.length+delta.textures.length,0,'nothing already sent is sent again');
assert.equal(delta.meshes.length,a.length-1,'the mesh list without the hidden one');
const before=store.scene(delta);store.prune(before);
let alive=0;before.traverse(o=>{if(o.isMesh)alive++;});assert.equal(alive,a.length-1);
// Shown again, the mesh comes back whole: what the worker let go is sent again (the page keeps converted materials).
hidden.visible=true;
const again=await photographicScene(source,sky,new AbortController().signal,()=>{},options);
const back=store.scene(structuredClone(sender.scene(again.scene)));store.prune(back);
const looks=scene=>{const rows=[];scene.traverse(o=>{if(o.isMesh)rows.push(`${o.name} ${o.geometry.attributes.position.count} ${o.material.type} ${o.material.color.getHexString()} ${o.material.roughness}`);});return rows;};
assert.deepEqual(looks(back),looks(again.scene),'every mesh shown again has its geometry and material');
// A map still loading is left out, and its material sent again once it has loaded.
const late=new T.Texture(),plain=[];local.scene.traverse(o=>{if(o.isMesh&&!o.material.map&&!plain.length)plain.push(o);});
const withLate=plain[0].material;withLate.map=late;
const loading=sender.scene(local.scene);
assert(loading.materials.some(m=>m.id===withLate.uuid&&!m.maps.map),'a map still loading is left out');
late.image={data:new Uint8Array(16).fill(200),width:2,height:2};
const loaded=sender.scene(local.scene);
assert(loaded.materials.some(m=>m.id===withLate.uuid&&m.maps.map===late.uuid)&&loaded.textures.some(t=>t.id===late.uuid),'and sent once it has loaded');
withLate.map=null;sender.scene(next.scene);
// A new sun: lights and sky only.
const lit=sender.lights(next.scene);assert.deepEqual(Object.keys(lit).sort(),['environment','lights']);
// The camera travels as numbers.
const camera=new T.PerspectiveCamera(36,1.6,.1,3000);camera.position.set(3,1.65,-2);camera.lookAt(10,1,4);
const copy=new T.PerspectiveCamera();applyCamera(copy,structuredClone(cameraData(camera)));
const near=(p,q)=>p.elements.every((e,i)=>Math.abs(e-q.elements[i])<1e-6);
assert(near(copy.matrixWorld,camera.matrixWorld)&&near(copy.projectionMatrix,camera.projectionMatrix),'the camera arrives');

// The page tries the worker first, the page's own tracer second; workers are bundled as modules.
const live=fs.readFileSync('lib/house-model/live-trace.ts','utf8');
assert(/createWorkerTracer\(scene,camera,controller\.signal\)[^]*if\(!gpu&&!controller\.signal\.aborted\)gpu=await m\.createWebGPUTracer/.test(live),'worker first, the page second');
for(const f of ['vite.pages.config.ts','vite.config.ts'])assert(/worker:\s*\{\s*format:\s*['"]es['"]/.test(fs.readFileSync(f,'utf8')),`${f} bundles module workers`);
// The worker works only while the page keeps asking for samples; a newer scene cancels one still being built, and only
// the scene the tracer takes decides what the worker lets go.
const workerSource=fs.readFileSync('lib/house-model/live-trace-worker.ts','utf8');
assert(/now-lastTick>QUIET/.test(workerSource),'the worker rests when the page stops asking');
assert(/building\?\.abort\(\)/.test(workerSource)&&/tracer\.rescene\(next,controller\.signal\)/.test(workerSource),'a newer scene cancels an older one');
// Images from before a reset are not shown after it.
const webgpu=fs.readFileSync('lib/house-model/live-trace-webgpu.ts','utf8');
assert(/const deliver=async\(data:SceneData\)=>\{const \{parts,rest\}=pieces\(data\);for\(const part of parts\)\{send\(\{kind:'parts',parts:part\}\);await new Promise\(r=>setTimeout\(r,0\)\);\}return rest;\}/.test(webgpu),'the page sends pieces, handing back its thread between them');
assert(/case 'parts':store\.add\(data\.parts\)/.test(workerSource),'the worker takes them');
assert((webgpu.match(/await deliver\(sender\.scene\(/g)??[]).length===2,'for the first scene and every new one');
assert(/data\.view!==view/.test(webgpu)&&/view=data\.view/.test(workerSource)&&/kind:'image',view,/.test(workerSource),'images carry the view they were traced for');
local.dispose();next.dispose();again.dispose();cache.dispose();
console.log(`Passed: ${a.length} meshes rebuilt in the worker with their triangles, attributes, places, materials, texture maps (${textured} here), instances, sun and sky; a rebuild sends only the mesh list, and a mesh shown again comes back whole; a new sun sends lights and sky; the camera arrives; a newer scene cancels an older one; images from an earlier view are dropped.`);
