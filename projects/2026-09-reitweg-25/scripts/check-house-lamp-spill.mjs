import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Lamplight spills onto the ground outside each glazed opening that reaches near the floor, and only while the lamps
// are on. The pools are drawn over the ground, not part of it: nothing is traced, batched or walked on.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/lighting.ts'],outdir:'tmp/spill-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error',loader:{'.json':'json'}});
const {buildHouseModel,SPILL}=await import('../tmp/spill-check/build-model.mjs'),{createLighting}=await import('../tmp/spill-check/lighting.mjs');
const model=buildHouseModel(true),pools=[];model.root.updateMatrixWorld(true);model.root.traverse(o=>{if(o.name==='lamp-spill')pools.push(o);});
assert(pools.length>=10,`a pool outside each glazed door (${pools.length})`);
const material=pools[0].material;
for(const pool of pools){
 assert.equal(pool.material,material,'one material for every pool');
 assert(pool.userData.dynamic&&pool.userData.skipPhotographic,'pools stay out of the static batches and the path tracer');
 const box=new T.Box3().setFromObject(pool),size=box.getSize(new T.Vector3());
 assert(Math.abs(box.min.y-SPILL.height)<1e-6&&size.y<1e-6,'pools lie flat just above the paving');
 assert(Math.max(size.x,size.z)<=SPILL.reach*(1+2*SPILL.spread)+6,'a pool stays near its door');
 const c=pool.geometry.attributes.color;let peak=0;for(let i=0;i<c.count;i++)peak=Math.max(peak,c.getX(i));
 assert(peak>.5&&c.getX(0)===0,'a pool fades in from the wall and is brightest just outside it');
}
assert(material.blending===T.AdditiveBlending&&!material.depthWrite&&material.transparent,'pools add light to what is there');
assert(!buildHouseModel(false).root.getObjectByName('lamp-spill'),'the plain model has none');
const scene=new T.Scene();scene.add(model.root);
const lighting=createLighting({shadowMap:{needsUpdate:false}},scene,model.root,{shadowSize:1024});
lighting.apply({enabled:true,day:172,minutes:780});assert(!material.visible||material.opacity===0,'no pools at noon');
lighting.apply({enabled:true,day:172,minutes:1320});assert(material.visible&&material.opacity>.9,'pools at 22:00 in June');
console.log(`Passed: ${pools.length} pools of lamplight outside the glazing, on with the lamps and off by day.`);
