import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Walking at eye level: walls stop the walker, doors and gates let it through, and stairs carry it to the upper floor.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/walk.ts','lib/house-model/experience-data.ts','lib/house-model/lighting.ts'],outdir:'tmp/walk-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/walk-check/build-model.mjs');
const {planPoint:p,sitePoint:site}=await import('../tmp/walk-check/site-data.mjs');
const {createWalker}=await import('../tmp/walk-check/walk.mjs');
const {places}=await import('../tmp/walk-check/experience-data.mjs');
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
// Family room: east through the glazed garden door onto the terrace; south into a solid wall, which stops the walker.
const [lx,lz]=p(991,727),east=walk([lx,1.8,lz],[lx+10,1.8,lz],12),south=walk([lx,1.8,lz],[lx,1.8,lz+10],12);
assert(east.x>6.4,`walker goes out through the garden door (x ${east.x.toFixed(2)})`);
assert(south.z>lz+1&&south.z<9.61-.12-.25,`a wall stops the walker (z ${south.z.toFixed(2)})`);
// Hall to sitting room through the glazed double doors.
const [hx,hz]=p(998,640),[,dz]=p(998,669),[,rz]=p(998,705),hall=walk([hx,1.8,hz],[hx,1.8,rz+10],4);
assert(hall.z>dz+.4,`walker passes the hall's glazed doors (z ${hall.z.toFixed(2)} vs ${dz.toFixed(2)})`);
// Front wall: from the lane through the pedestrian gate into the forecourt.
const a=site(365,422),b=site(346,610),len=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/len,(b[1]-a[1])/len],g=[a[0]+u[0]*1.8,a[1]+u[1]*1.8];
let n=[-u[1],u[0]];if(n[0]*(0-g[0])+n[1]*(0-g[1])<0)n=[-n[0],-n[1]];
const lane=[g[0]-n[0]*2.5,g[1]-n[1]*2.5],gate=walk([lane[0],1.65,lane[1]],[g[0]+n[0]*10,1.6,g[1]+n[1]*10],4.5),through=(gate.x-g[0])*n[0]+(gate.z-g[1])*n[1];
assert(through>1,`walker goes through the front gate (${through.toFixed(2)} m past the wall)`);
// Main stair: from the hall at its foot, walking north up the flight to the upper floor.
const [sx,sz]=p(927,533.5),top=walk([sx,1.8,sz+2.9],[sx,1.8,sz-10],8);
assert(top.y-1.65>3,`walker climbs the stair to the upper floor (feet at ${(top.y-1.65).toFixed(2)} m)`);
// Leaning out of the upstairs roof window, a walk back into the room starts on the upper floor, not on the roof.
const up=places.upstairs;camera.position.set(...up.position);camera.lookAt(up.position[0]-10,up.position[1],up.position[2]);camera.updateMatrixWorld();
{const walker=createWalker(camera,()=>meshes);walker.reset(up.floor);for(let t=0;t<2.5;t+=1/30)walker.step(1/30,{forward:1,strafe:0,run:false});}
// The roof there is 5.5 m up; the route crosses the gallery bathroom, whose WC is low enough to step onto.
assert(camera.position.y-1.65<3.07+.46&&camera.position.x<up.position[0]-1.5,`walk from the roof window comes back in on the upper floor (x ${camera.position.x.toFixed(2)}, eye ${camera.position.y.toFixed(2)})`);
// Starting places: the courtyard lawn and the master bedroom upstairs each start on their floor with room to walk;
// a walking pace covers about 2.1 m a second (1.5× an everyday 1.4 m/s), so a second's walk from the lawn is over 2 m.
for(const [key,floor] of [['court',0],['bedroom',3.07]]){const q=places[key];assert(q,`${key} place exists`);
 const start=new T.Vector3(...q.position),end=walk(q.position,q.target,1),moved=Math.hypot(end.x-start.x,end.z-start.z);
 assert(Math.abs(end.y-1.65-floor)<.35,`${key}: the walk starts on its floor (feet at ${(end.y-1.65).toFixed(2)} m)`);
 assert(moved>(key==='court'?2:.8),`${key}: a second's walk covers ${moved.toFixed(2)} m`);}
// Exposure follows where the walker stands: the family room sees almost no sky and keeps the room exposure (4×); out
// through the garden door, the terrace is exposed as outdoors.
const {roomExposure}=await import('../tmp/walk-check/lighting.mjs');
const openness=position=>{camera.position.copy(position);camera.updateMatrixWorld();return createWalker(camera,()=>meshes).openness();};
const inside=roomExposure(openness(new T.Vector3(lx,1.65,lz))),outside=roomExposure(openness(east));
assert(inside>3.5,`the family room keeps the room exposure (×${inside.toFixed(2)})`);
assert(outside<1.1,`the terrace is exposed as outdoors (×${outside.toFixed(2)})`);
console.log(`Passed: the courtyard and master bedroom places start on their floors at a 2.1 m/s pace; the garden door, hall doors and front gate let the walker through, a wall stops it (${south.z.toFixed(2)} m), and the main stair reaches the upper floor (feet at ${(top.y-1.65).toFixed(2)} m); the family room keeps the room exposure (×${inside.toFixed(2)}) and the terrace is exposed as outdoors (×${outside.toFixed(2)}).`);
