import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Walking at eye level: walls stop the walker, and stairs carry it to the upper floor.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/walk.ts'],outdir:'tmp/walk-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/walk-check/build-model.mjs');
const {planPoint:p}=await import('../tmp/walk-check/site-data.mjs');
const {createWalker}=await import('../tmp/walk-check/walk.mjs');
const model=buildHouseModel(true);model.setLevel('exterior');model.root.updateMatrixWorld(true);
// As the viewer's merged scene does, keep only what the whole-house view draws; its upper-floor rooms show through the roofs.
const meshes=[];model.root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&model.rendered(o))meshes.push(o);});
model.upper.visible=true;model.upper.traverse(o=>{if(o.isMesh&&!o.userData.alsoExterior)o.visible=false;});
const camera=new T.PerspectiveCamera(60,1.5,.1,500);
const walk=(from,toward,seconds)=>{
 camera.position.set(...from);camera.lookAt(...toward);camera.updateMatrixWorld();
 const walker=createWalker(camera,()=>meshes);walker.reset();
 for(let t=0;t<seconds;t+=1/30)walker.step(1/30,{forward:1,strafe:0,run:false});
 return camera.position.clone();
};
// Family room, walking east toward the garden wall: the walker stops short of it.
const [lx,lz]=p(991,727),east=walk([lx,1.8,lz],[lx+10,1.8,lz],12);
// The garden door's glass sits mid-wall, 0.12 m inside the 6 m outline.
assert(east.x>lx+3,'walker crosses the family room');assert(east.x<6-.12-.25,`walker stops short of the garden door (x ${east.x.toFixed(2)})`);
// Main stair: from the hall at its foot, walking north up the flight to the upper floor.
const [sx,sz]=p(927,533.5),top=walk([sx,1.8,sz+2.9],[sx,1.8,sz-10],8);
assert(top.y-1.65>3,`walker climbs the stair to the upper floor (feet at ${(top.y-1.65).toFixed(2)} m)`);
console.log(`Passed: walls stop the walker (${east.x.toFixed(2)} m), and the main stair reaches the upper floor (feet at ${(top.y-1.65).toFixed(2)} m).`);
