import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/static-batch.ts','lib/house-model/sun-bounce-core.ts','lib/house-model/sky-visibility.ts','lib/house-model/site-data.ts'],outdir:'tmp/bounce-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/bounce-check/build-model.mjs');
const {batchStatic}=await import('../tmp/bounce-check/static-batch.mjs');
const {createTracer,smoothIntoAtlas}=await import('../tmp/bounce-check/sun-bounce-core.mjs');
const {PROBE_GRID}=await import('../tmp/bounce-check/sky-visibility.mjs');
const {planPoint}=await import('../tmp/bounce-check/site-data.mjs');
// The house as the viewer traces it: opaque batches of the building, in the whole-house state.
const model=buildHouseModel(true);
const batches=batchStatic({root:model.root,states:model.stateCount,apply:model.applyState,rendered:model.rendered,externalRoots:[model.trees]});
batches.sync(model.stateOf('exterior',{}));model.root.updateMatrixWorld(true);
const occluders=batches.meshes.filter(b=>b.parent===model.root&&[b.material].flat().every(m=>!m.transparent&&!m.alphaTest&&m.userData.photo!=='lawn'));
let count=0;for(const o of occluders)count+=o.geometry.attributes.position.count;
const positions=new Float32Array(count*3),batch=new Uint16Array(count),albedo=new Float32Array(occluders.length*3),visible=new Uint8Array(occluders.length);
let at=0;occluders.forEach((o,b)=>{const p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++,at++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);positions.set([v.x,v.y,v.z],at*3);batch[at]=b;}const c=[o.material].flat()[0].color;albedo.set([c.r,c.g,c.b],b*3);let s=o;visible[b]=1;while(s){if(!s.visible)visible[b]=0;s=s.parent;}});
const size=PROBE_GRID.box.getSize(new T.Vector3()),grid={min:PROBE_GRID.box.min.toArray(),cell:PROBE_GRID.cell,nx:Math.round(size.x/PROBE_GRID.cell),ny:Math.round(size.y/PROBE_GRID.cell),nz:Math.round(size.z/PROBE_GRID.cell)};
let t=performance.now();const tracer=createTracer(positions,batch,albedo,grid,32);tracer.setVisible(visible);const traceMs=performance.now()-t;
// Low morning sun from the east, through the family room's garden windows.
t=performance.now();const shaded=tracer.shade(new T.Vector3(1,.35,.1).normalize().toArray());const {light,direction}=smoothIntoAtlas([shaded],grid);const shadeMs=performance.now()-t;
assert(light.every(Number.isFinite)&&direction.every(Number.isFinite),'finite light');
const {nx,ny}=grid;
const probe=(x,y,z)=>{const i=Math.floor((x-grid.min[0])/grid.cell),j=Math.floor((y-grid.min[1])/grid.cell),k=Math.floor((z-grid.min[2])/grid.cell);return (k*nx*ny+j*nx+i)*4;};
const lum=a=>.2126*light[a]+.7152*light[a+1]+.0722*light[a+2];
// Just under the family room ceiling (2.7 m), mid-room; and the middle of the basement, which no sun reaches.
const [fx,fz]=planPoint(1020,784),room=lum(probe(fx,2.3,fz)),basement=lum(probe(0,-1.8,0));
// Expected order: a sun patch filling about 4% of the view, oak (reflectance about 0.5) lit at sin 19° gives about 0.0066.
assert(room>.003,`the family room ceiling gathers morning sunlight bounced off the floor (${room.toFixed(4)} per unit of sun)`);
assert(direction[probe(fx,2.3,fz)+1]<0,'it arrives from below');
assert(basement<room/10,`the basement stays dark (${basement.toFixed(5)})`);
// The same sun from the west does not enter the east windows: the bounce follows the sun, not a uniform fill.
const west=smoothIntoAtlas([tracer.shade(new T.Vector3(-1,.35,.1).normalize().toArray())],grid).light,a=probe(fx,2.3,fz),westRoom=.2126*west[a]+.7152*west[a+1]+.0722*west[a+2];
assert(westRoom<room/3,`a west sun leaves the family room ceiling darker (${westRoom.toFixed(4)})`);
console.log(`Passed: morning sun bounces up to the family room ceiling (${room.toFixed(4)} per unit of sun, from below; ${westRoom.toFixed(4)} with a west sun) and not into the basement; traced ${shaded.probes.length} points in ${(traceMs/1000).toFixed(1)} s on one thread, lit in ${Math.round(shadeMs)} ms.`);
