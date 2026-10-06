import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import * as T from 'three';
fs.mkdirSync('tmp/batch-check',{recursive:true});
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/static-batch.ts','lib/house-model/landscape-context.ts','lib/house-model/renovation-data.ts'],outdir:'tmp/batch-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/batch-check/build-model.mjs');
const {batchStatic}=await import('../tmp/batch-check/static-batch.mjs');
const {landscapeContext}=await import('../tmp/batch-check/landscape-context.mjs');
const triangles=g=>(g.index?g.index.count:g.attributes.position.count)/3;
for(const realistic of [false,true]){
 const setting=realistic?landscapeContext().group:undefined,model=buildHouseModel(realistic,setting);
 // Reference: what the unmerged scene renders in each state, by material; meshes that move (the distant land, which
 // follows the camera) are drawn on their own, outside the batches.
 const expected=[];
 for(let s=0;s<model.stateCount;s++){
  model.applyState(s);const by=new Map();
  model.root.traverse(o=>{if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh||o.userData.dynamic||!model.rendered(o))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(Array.isArray(o.material)&&o.geometry.groups.length)for(const g of o.geometry.groups)by.set(mats[g.materialIndex].uuid,(by.get(mats[g.materialIndex].uuid)||0)+g.count/3);else by.set(mats[0].uuid,(by.get(mats[0].uuid)||0)+triangles(o.geometry));});
  expected.push(by);
 }
 const batches=batchStatic({root:model.root,states:model.stateCount,apply:model.applyState,rendered:model.rendered,externalRoots:[model.trees,...model.toggled]});
 for(let s=0;s<model.stateCount;s++){
  model.applyState(s);batches.sync(s);const by=new Map();
  for(const b of batches.meshes){let shown=true;for(let o=b;o;o=o.parent)if(!o.visible&&o!==model.upper)shown=false;if(!b.visible||!shown)continue;by.set(b.material.uuid,(by.get(b.material.uuid)||0)+triangles(b.geometry));}
  for(const [uuid,count] of expected[s])assert.equal(Math.round(by.get(uuid)||0),Math.round(count),`state ${s}: batched triangles match source for each material`);
  for(const uuid of by.keys())assert(expected[s].has(uuid),`state ${s}: no batch shows a hidden material`);
 }
 // Renovations toggled outside the states (Layout Updates): batches follow their groups, on and off, on every floor.
 const {renovationState}=await import('../tmp/batch-check/renovation-data.mjs');
 const count=()=>{const source=new Map(),merged=new Map(),add=(map,uuid,n)=>map.set(uuid,(map.get(uuid)||0)+n);
  model.root.traverse(o=>{if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh||o.userData.batch||o.userData.dynamic||!model.rendered(o))return;const mats=[o.material].flat();
   if(Array.isArray(o.material)&&o.geometry.groups.length)for(const g of o.geometry.groups)add(source,mats[g.materialIndex].uuid,g.count/3);else add(source,mats[0].uuid,triangles(o.geometry));});
  for(const b of batches.meshes){let shown=b.visible;for(let o=b;o;o=o.parent)if(!o.visible&&o!==model.upper)shown=false;if(shown)add(merged,b.material.uuid,triangles(b.geometry));}return [source,merged];};
 for(const level of ['exterior','ground','upper'])for(const nook of [true,false])for(const east of [false,true]){const state={...renovationState(),east,nook};
  model.setLevel(level);model.setRenovations(state);batches.sync(model.stateOf(level,state));const [source,merged]=count();
  for(const uuid of new Set([...source.keys(),...merged.keys()]))assert.equal(Math.round(merged.get(uuid)||0),Math.round(source.get(uuid)||0),`${level}, nook ${nook}, east ${east}: batched triangles match the scene for each material`);}
 let sources=0;model.root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!o.userData.batch&&!o.userData.dynamic){sources++;assert(!o.layers.isEnabled(0),'source meshes leave the render layer');}});
 for(const b of batches.meshes){assert(b.layers.isEnabled(0));for(const n of b.matrixWorld.elements)assert(Number.isFinite(n));}
 assert(batches.meshes.length*5<sources,`${batches.meshes.length} batches replace ${sources} meshes`);
 console.log(`Passed (${realistic?'realism':'natural'}): ${sources} meshes → ${batches.meshes.length} batches; triangles per material match in all ${model.stateCount} floor × renovation states and with Layout Updates on or off.`);
 model.dispose();
}
