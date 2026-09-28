import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/entrance-garden.ts'],outdir:'tmp/entrance-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/entrance-check/build-model.mjs');
const {entranceRoute}=await import('../tmp/entrance-check/entrance-garden.mjs');
for(const realistic of [false,true]){
 const model=buildHouseModel(realistic);model.root.updateMatrixWorld(true);
 const walk=model.root.getObjectByName('front-door-walkway');assert(walk);
 const base=walk.getObjectByName('narrow-entrance-cobble-base'),step=walk.getObjectByName('front-door-shallow-step');
 const driveway=walk.getObjectByName('driveway-cobble-base');assert(driveway);
 assert.equal(walk.getObjectByName('individual-driveway-cobbles').material,walk.getObjectByName('individual-entrance-cobbles').material,'driveway and path share cobble material');
 const ray=new T.Raycaster();const hit=(x,z,objects)=>{ray.set(new T.Vector3(x,2,z),new T.Vector3(0,-1,0));return ray.intersectObjects(objects,false);};
 for(let i=1;i<entranceRoute.length;i++){const a=entranceRoute[i-1],b=entranceRoute[i];for(let k=1;k<20;k++){const t=k/20;assert(hit(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,[base]).length,'continuous route to door');}}
 for(let z=-2.25;z<=1;z+=.1)assert(hit(-25.35,z,[base,driveway]).length,'paved connection at building corner');
 assert.equal(hit(-30,-2.65,[base,driveway]).length,0,'grass island separates path and driveway near road');
 assert(hit(-30,-2.65,[walk.getObjectByName('entrance-planting-bed-3')]).length,'separating island has planted ground');
 const forecourt=walk.getObjectByName('roadside-inset-cobble-base');assert(forecourt);
 for(const [x,z] of [[-34.8,-7.7],[-36.8,0],[-38.5,4.9]])assert(hit(x,z,[forecourt]).length,'entire roadside inset including former grass wedges is paved');
 assert.equal(walk.getObjectByName('individual-roadside-inset-cobbles').material,walk.getObjectByName('individual-entrance-cobbles').material,'roadside inset uses matching cobbles');
 const x=-20,z=-2.22+(x+25.1)*1.17/11.05;
 assert(hit(x,z,[base]).length,'walk center paved');
 assert.equal(hit(x,z-1.1,[base,step]).length,0,'lawn-side bed is unpaved');
 assert.equal(hit(x,z+1.1,[base,step]).length,0,'wall-side bed is unpaved');
 // No remnant of the old broad paving remains underneath either planted edge.
 const oldPaving=[];model.site.traverse(o=>{if(o instanceof T.Mesh&&!o.isInstancedMesh&&o.material.userData?.photo==='stone')oldPaving.push(o);});
 for(const offset of [-1.1,1.1])assert.equal(hit(x,z+offset,oldPaving).length,0,'old slab removed below planting');
 assert.equal(Math.round((hit(-14.05,0,[step])[0].point.y-hit(x,z,[base])[0].point.y)*1000),85,'shallow step rises 85 mm');
 assert(walk.getObjectByName('entrance-arching-ornamental-grasses').count>1000,'planted borders present');
 model.dispose();
}
console.log('Passed in both detail settings: continuous narrow approach, planted edges, removed slab and shallow step.');
