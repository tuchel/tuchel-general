import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/pool.ts'],outdir:'tmp/pool-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/pool-check/build-model.mjs');
const {poolOpening,terrainWithPoolOpening}=await import('../tmp/pool-check/pool.mjs');
// Where the aerial photograph puts it (the pool and its deck, 7.53 px a metre, calibrated on the house and the neighbors'
// surveyed buildings), as the owner's pool-side photograph confirms: its east end beyond the main house's east wall.
assert(Math.hypot(poolOpening.x-2.8,poolOpening.z-18.8)<.3,`the pool is centred at (2.8, 18.8), not (${poolOpening.x.toFixed(2)}, ${poolOpening.z.toFixed(2)})`);
assert(poolOpening.x+poolOpening.width/2>6.105+4,'the pool reaches 4 m past the main house\'s east wall');
for(const realistic of [false,true]){
 const model=buildHouseModel(realistic),pool=model.root.getObjectByName('flush-in-ground-pool');model.root.updateMatrixWorld(true);assert(pool);
 // No tree trunk stands in the pool or on its deck.
 {const trees=model.root.getObjectByName('garden-trees');if(trees)for(const set of trees.userData.treeSets)for(const m of set.matrices){const v=new T.Vector3().setFromMatrixPosition(m);
  assert(!(Math.abs(v.x-poolOpening.x)<poolOpening.width/2+.8&&Math.abs(v.z-poolOpening.z)<poolOpening.depth/2+.8),`a tree at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) stands clear of the pool`);}}
 const boards=pool.getObjectByName('weathered-grey-pool-deck-boards'),rim=pool.getObjectByName('pool-pale-edge'),water=pool.getObjectByName('pool-water');
 for(const o of [boards,rim])assert(new T.Box3().setFromObject(o).max.y<.02,'surround meets lawn without a raised platform');
 assert(new T.Box3().setFromObject(water).max.y<0,'water recessed below lawn');
 const terrain=new T.Mesh(terrainWithPoolOpening(),new T.MeshBasicMaterial());terrain.position.y=-.035;terrain.updateMatrixWorld();
 // Rays through the opening must see water first and then the basin, never soil or stage.
 for(const dx of [-7,0,7])for(const dz of [-1.6,0,1.6]){
  const ray=new T.Raycaster(new T.Vector3(poolOpening.x+dx,3,poolOpening.z+dz),new T.Vector3(0,-1,0));
  assert.equal(ray.intersectObject(terrain).length,0,'terrain must not fill pool');
  const hits=ray.intersectObject(model.site,true).filter(h=>h.object instanceof T.Mesh);
  assert.equal(hits[0]?.object.name,'pool-water','no lawn or soil above water');
  assert(hits.some(h=>h.object.name==='pool-floor'),'basin floor visible through opening');
 }
 model.dispose();terrain.geometry.dispose();terrain.material.dispose();
}
console.log('Passed: surround flush with lawn, recessed water, open soil/lawn/terrain aperture and intact basin in both detail modes.');
