import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/static-batch.ts','lib/house-model/sun-bounce-core.ts','lib/house-model/sky-visibility.ts','lib/house-model/site-data.ts'],outdir:'tmp/bounce-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/bounce-check/build-model.mjs');
const {batchStatic}=await import('../tmp/bounce-check/static-batch.mjs');
const {createTracer,smoothIntoAtlas,smooth,toAtlas,bounceGain}=await import('../tmp/bounce-check/sun-bounce-core.mjs');
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
// Extreme traces further bounces through the grid itself: every landing is lit by the previous bounce as the materials
// read it, and the next bounce is gathered from there. Each bounce is weaker than the last, light reaches points the
// first bounce did not. Four bounces raise the family room ceiling more than the single bounce's factor (1/(1 − 0.4) ≈
// 1.67) did: its white plaster returns more than the 0.4 the factor assumes for the house as a whole.
const fields=[smooth([shaded],grid)];for(let b=1;b<4;b++)fields.push(smooth([tracer.bounce(fields[b-1])],grid));
const energy=f=>{let e=0;for(let i=0;i<f.light.length;i+=4)e+=.2126*f.light[i]+.7152*f.light[i+1]+.0722*f.light[i+2];return e;};
const energies=fields.map(energy);
for(let b=1;b<4;b++)assert(energies[b]<energies[b-1]*.7&&energies[b]>energies[b-1]*.03,`bounce ${b+1} is weaker than bounce ${b} (${(energies[b]/energies[b-1]).toFixed(2)})`);
const lit=f=>{let n=0;for(let i=0;i<f.light.length;i+=4)if(.2126*f.light[i]+.7152*f.light[i+1]+.0722*f.light[i+2]>1e-4)n++;return n;};
const sum={light:fields[0].light.map((_,i)=>fields.reduce((t,f)=>t+f.light[i],0)),direction:fields[0].direction.map((_,i)=>fields.reduce((t,f)=>t+f.direction[i],0))};
assert(lit(sum)>lit(fields[0])*1.05,`further bounces reach more of the house (${lit(fields[0])} → ${lit(sum)} points)`);
const summed=toAtlas(sum,grid).light,ratio=(.2126*summed[a]+.7152*summed[a+1]+.0722*summed[a+2])/room;
assert(ratio>1.67&&ratio<4,`four bounces on the family room ceiling: ${ratio.toFixed(2)}× the first`);
assert(Math.abs(bounceGain(1)-1/(1-.4))<.01&&Math.abs(bounceGain(4)-(1+.4**4/.6))<1e-6,'the factor stands in only for bounces not traced');
{const fs=await import('node:fs'),tiers=fs.readFileSync('lib/house-model/device-tier.ts','utf8'),worker=fs.readFileSync('lib/house-model/sun-bounce.worker.ts','utf8');
 assert(/extreme:\{[^}]*bounces:4/.test(tiers)&&/detailed:\{[^}]*bounces:1/.test(tiers),'Extreme traces four bounces, Detailed one');
 assert(/bakeSunBounce\(.*tier\.sunBounce,tier\.bounces\)/.test(fs.readFileSync('lib/house-model/viewer.ts','utf8')),'the viewer asks for them');
 assert(/peers/.test(worker)&&/tracer\.bounce\(/.test(worker),'the workers pass bounces among themselves, off the page');}
console.log(`Passed: morning sun bounces up to the family room ceiling (${room.toFixed(4)} per unit of sun, from below; ${westRoom.toFixed(4)} with a west sun) and not into the basement; traced ${shaded.probes.length} points in ${(traceMs/1000).toFixed(1)} s on one thread, lit in ${Math.round(shadeMs)} ms; on Extreme four bounces lift that ceiling ${ratio.toFixed(2)}×, each weaker than the last (${energies.slice(1).map((e,i)=>(e/energies[i]).toFixed(2)).join(', ')}), and reach ${lit(sum)-lit(fields[0])} more points.`);
