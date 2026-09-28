import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/pool.ts'],outdir:'tmp/pool-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/pool-check/build-model.mjs');
const {poolOpening,terrainWithPoolOpening}=await import('../tmp/pool-check/pool.mjs');
for(const realistic of [false,true]){
 const model=buildHouseModel(realistic),pool=model.root.getObjectByName('flush-in-ground-pool');model.root.updateMatrixWorld(true);assert(pool);
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
