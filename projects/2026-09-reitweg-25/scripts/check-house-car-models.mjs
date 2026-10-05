import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// Modelled cars (Detailed and Extreme): the garage's Tesla Model Y and a 1975 911 Turbo (930) are modelled cars from
// glTF files, in their modelled colours, in place of the traced-profile ones. Each file is compressed (meshopt,
// quantized, WebP) and carries its maker's credit; each car is turned so its nose points along +x like the traced cars,
// centred on its footprint with its wheels on the floor, scaled to its own published length (the 930's, not a modern
// 911's), without the flat display props it was exported with, and read as plain floats by the batching and the path
// tracer. A car whose file fails to load keeps its traced stand-in. Balanced shows no cars; Model keeps the traced ones.
await build({entryPoints:['lib/house-model/car-models.ts','lib/house-model/device-tier.ts','lib/house-model/build-model.ts'],outdir:'tmp/car-models-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {CAR_MODELS,fitCar}=await import('../tmp/car-models-check/car-models.mjs');
const {tiers}=await import('../tmp/car-models-check/device-tier.mjs'),{buildHouseModel}=await import('../tmp/car-models-check/build-model.mjs');

// Which cars each preset shows.
assert.deepEqual(Object.fromEntries(Object.entries(tiers).map(([q,t])=>[q,t.cars])),{extreme:'modelled',detailed:'modelled',balanced:'none',model:'traced'});
assert.equal(buildHouseModel(true,undefined,undefined,false).root.getObjectByName('garage-cars'),undefined,'without cars, the garage is empty');

// A glTF-like car as exported: nose along +z, y up, off-centre, one part quantized, a transmissive lamp lens, and a
// baked shadow plane on the ground.
{const root=new T.Group(),body=new T.Mesh(new T.BoxGeometry(2.12,1.65,4.78),new T.MeshPhysicalMaterial({clearcoat:1}));
 body.position.set(1.786,.825,1.07);root.add(body);
 const nose=new T.Mesh(new T.BoxGeometry(.2,.1,.1),new T.MeshPhysicalMaterial({transmission:1,opacity:.25}));nose.name='nose';nose.position.set(1.786,.8,3.4);root.add(nose);
 // Quantized positions, as KHR_mesh_quantization leaves them: 16-bit normalized, scaled back by the node.
 const q=new T.BoxGeometry(1,1,1),p=q.getAttribute('position'),ints=new Int16Array(p.count*3);for(let i=0;i<p.count*3;i++)ints[i]=Math.round(p.array[i]*2*32767);
 q.setAttribute('position',new T.BufferAttribute(ints,3,true));const part=new T.Mesh(q,new T.MeshStandardMaterial());part.scale.setScalar(.25);part.position.set(1.786,.3,0);root.add(part);
 const shadow=new T.Mesh(new T.PlaneGeometry(3,6).rotateX(-Math.PI/2),new T.MeshBasicMaterial());shadow.name='shadow';shadow.position.set(1.786,.01,1.07);root.add(shadow);
 const car=fitCar(root,CAR_MODELS.modelY);car.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(car),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());
 assert.equal(car.name,CAR_MODELS.modelY.name);assert(!car.getObjectByName('shadow'),'the baked shadow is left out');
 assert(Math.abs(size.x-CAR_MODELS.modelY.length)<.002,`scaled to the published length along x (${size.x.toFixed(3)} m)`);
 assert(Math.abs(centre.x)<.002&&Math.abs(centre.z)<.002&&Math.abs(box.min.y)<.002,'centred on its footprint, wheels on the floor');
 assert(new T.Vector3().setFromMatrixPosition(car.getObjectByName('nose').matrixWorld).x>2,'the nose points along +x, as the traced cars');
 car.traverse(o=>{if(!o.isMesh)return;for(const a of Object.values(o.geometry.attributes))assert(a.array instanceof Float32Array,'plain float attributes');assert(o.castShadow&&o.receiveShadow,'casts and takes shadows');});
 const lens=car.getObjectByName('nose').material;assert(lens.transmission===0&&lens.transparent,'lamp lenses are see-through without the transmission pass');}

// The 930 is scaled to its own 4,291 mm, not a modern 911's 4,553 mm.
assert.equal(CAR_MODELS.porsche.length,4.291);
// The files: small enough to load beside the viewer's own code, credited, decodable by the viewer.
{const credits=fs.readFileSync('public/assets/models/CREDITS.md','utf8');
 for(const [spec,author,licence,cc] of [[CAR_MODELS.modelY,'BloxBloger','CC-BY-NC-4.0','CC BY-NC 4.0'],[CAR_MODELS.porsche,'Lionsharp Studios','CC-BY-4.0','CC BY 4.0']]){
  const data=fs.readFileSync(`public${spec.url}`),json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  assert(data.length<=3_500_000,`${spec.name}: ${(data.length/1e6).toFixed(2)} MB`);
  assert(json.asset.extras?.license?.startsWith(licence)&&json.asset.extras?.author?.includes(author),`${spec.name}: the maker and licence travel with the file`);
  for(const e of json.extensionsRequired??[])assert(['EXT_meshopt_compression','KHR_mesh_quantization','EXT_texture_webp'].includes(e),`${e} is decoded`);
  assert(credits.includes(author)&&credits.includes(cc),`${spec.name}: credited beside the file`);}}

// The wiring: Detailed and Extreme load it alongside the viewer's code, before the house is built, so it is batched,
// lit, reflected and traced like the rest; a failed load keeps the traced car.
{const read=f=>fs.readFileSync(f,'utf8'),models=read('lib/house-model/car-models.ts'),cars=read('lib/house-model/garage-cars.ts'),model=read('lib/house-model/build-model.ts'),viewer=read('lib/house-model/viewer.ts'),page=read('components/studio/model/house-model.tsx');
 assert(/setMeshoptDecoder\(MeshoptDecoder\)/.test(models),'meshopt decoding');
 assert(/model\?\?buildCar\(spec\)/.test(cars)&&/models\.modelY/.test(cars)&&/models\.porsche/.test(cars),'the garage uses each modelled car it has');
 assert(/if\(cars!==false\)ground\.add\(garageCars\(cars\)\)/.test(model)&&/buildHouseModel\(realistic,setting\?\.group,foliage,tier\.cars==='none'\?false:options\.cars\)/.test(viewer),'threaded through the house build');
 assert(/tiers\[quality\]\.cars==='modelled'\?import\('@\/lib\/house-model\/car-models'\)/.test(page)&&/\.catch\(/.test(page),'loaded for the photographic presets, falling back on failure');
 assert(/BloxBloger/.test(page)&&/Lionsharp Studios/.test(page),'credited in About this model');}
console.log(`Passed: a modelled car turns nose-first along +x, sits centred with its wheels on the floor at its published length (Model Y ${CAR_MODELS.modelY.length} m, 930 ${CAR_MODELS.porsche.length} m), drops its ground props and reads as plain floats; both files are under 3.5 MB, credited and decodable; Detailed and Extreme load them before the house is built and keep a traced car whose file fails; Balanced shows none.`);
