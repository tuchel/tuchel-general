import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Walking at eye level: walls stop the walker, doors and gates let it through, and stairs carry it to the upper floor.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/walk.ts','lib/house-model/experience-data.ts','lib/house-model/lighting.ts','lib/house-model/pool.ts','lib/house-model/site-openings.ts'],outdir:'tmp/walk-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/walk-check/build-model.mjs');
const {planPoint:p,sitePoint:site}=await import('../tmp/walk-check/site-data.mjs');
const {createWalker}=await import('../tmp/walk-check/walk.mjs');
const {places}=await import('../tmp/walk-check/experience-data.mjs');
const model=buildHouseModel(true);model.setLevel('exterior');model.root.updateMatrixWorld(true);
// As the viewer's merged scene does, keep only what the whole-house view draws; its upper-floor rooms show through the roofs.
const meshes=[];model.root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&model.rendered(o))meshes.push(o);});
model.upper.visible=true;model.upper.traverse(o=>{if(o.isMesh&&!o.userData.alsoExterior)o.visible=false;});model.basement.visible=true;
// The viewer's surrounding ground (in Detailed a lawn-coloured plane just below the lot) is walked on too, with the same
// openings the viewer cuts: the pool, the guest basement's outside stair and the hall stairwell.
{const {terrainWithPoolOpening}=await import('../tmp/walk-check/pool.mjs'),{groundOpenings}=await import('../tmp/walk-check/site-openings.mjs');
 const stage=new T.Mesh(terrainWithPoolOpening(groundOpenings()),new T.MeshStandardMaterial());stage.position.y=-.035;stage.updateMatrixWorld(true);meshes.push(stage);}
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
// The guest stair lands on the upper floor with no gap, as the whole-house view draws it: down the top flight's centre
// line, from past the last tread to past the floor edge, the first surface is at floor height.
{const stair=model.root.getObjectByName('guest-ground-turning-stair'),probe=new T.Raycaster();stair.updateMatrixWorld(true);
 for(let lx=2.35;lx<=3.2;lx+=.05){const w=new T.Vector3(lx,3.6,-.055).applyMatrix4(stair.matrixWorld);probe.set(w,new T.Vector3(0,-1,0));probe.far=1.2;
  const h=probe.intersectObjects(meshes.filter(o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;}),false)[0];
  assert(h&&h.point.y>3.05,`no gap at the top of the guest stair (${lx.toFixed(2)} m along the flight: ${h?h.point.y.toFixed(2)+' m':'nothing'})`);}}
// Between floors the house is solid: seen from inside the stair openings at the height of the ground-floor ceiling and
// the floor above (as when walking the stairs), a level sightline stops at the opening's edge, never runs on between them.
{const visible=meshes.filter(o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;}),probe=new T.Raycaster();
 for(const [[cx,cz],[x0,z0,x1,z1]] of [[[927,560],[906,458,1044,668]],[[1000,560],[906,458,1044,668]],[[150,850],[92,782,215,932]],[[180,900],[92,782,215,932]]])
  for(const y of [2.82,2.88,2.95,3.02])for(const d of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]){const [x,z]=p(cx,cz);probe.set(new T.Vector3(x,y,z),new T.Vector3(...d));probe.far=40;
   const h=probe.intersectObjects(visible,false)[0],hx=h&&h.point.x/(12/434)+1012,hz=h&&h.point.z/(12/434)+529.5;
   assert(h&&hx>x0-8&&hx<x1+8&&hz>z0-8&&hz<z1+8,`sightline from ${cx},${cz} at ${y} m runs on between floors (to ${h?hx.toFixed(0)+','+hz.toFixed(0):'nothing'})`);}}
// No falling: a drop deeper than a stair step stops the walker, off the upstairs gallery into the atrium, through the
// rail into the basement stairwell, or sideways off the stair up.
const stroll=(from,toward,floor,moves)=>{camera.position.set(...from);camera.lookAt(...toward);camera.updateMatrixWorld();const walker=createWalker(camera,()=>meshes);walker.reset(floor);
 for(const [seconds,input] of moves)for(let t=0;t<seconds;t+=1/30)walker.step(1/30,{run:false,...input});return camera.position.y-1.65;};
{const [gx,gz]=p(1075,560),[wx,wz]=p(975,560),[sx,sz]=p(927,640);
 const gallery=stroll([gx,3.07+1.65,gz],[gx-10,3.07+1.65,gz],3.07,[[2,{forward:1,strafe:0}]]);assert(gallery>3,`the gallery edge stops the walker (feet at ${gallery.toFixed(2)} m)`);
 const well=stroll([wx,1.77,wz],[wx-10,1.77,wz],.12,[[2,{forward:1,strafe:0}]]);assert(well>0,`the stairwell rail stops the walker (feet at ${well.toFixed(2)} m)`);
 const side=stroll([sx,1.77,sz],[sx,1.77,sz-10],.12,[[1.1,{forward:1,strafe:0}],[1.5,{forward:0,strafe:1}]]);assert(side>.9,`the stair's open side stops the walker (feet at ${side.toFixed(2)} m)`);}
// Basement stair: from its landing off the hall, walking south down the flight under the stair up to the basement.
const [bx,bz]=p(926,474),down=walk([bx,1.8,bz],[bx,1.8,bz+10],5);
assert(down.y-1.65<-2,`walker goes down the basement stair from the hall (feet at ${(down.y-1.65).toFixed(2)} m)`);
// At the foot of the stair the basement hall opens to the east: the walk carries on into it.
{const [fx,fz]=p(926,620),feet=stroll([fx,-2.3+1.65,fz],[fx+10,-2.3+1.65,fz],-2.3,[[1.5,{forward:1,strafe:0}]]);
 assert(feet<-2&&camera.position.x-fx>2,`walker carries on into the basement hall (${(camera.position.x-fx).toFixed(2)} m, feet at ${feet.toFixed(2)} m)`);}
// Starting places: the courtyard lawn and the master bedroom upstairs each start on their floor with room to walk;
// a walking pace covers about 2.1 m a second (1.5× an everyday 1.4 m/s), so a second's walk from the lawn is over 2 m.
// Curbside stands on the road outside the front wall and looks east across it to the house.
{const q=places.lane;assert.equal(q.short,'Curbside');assert(q.position[0]<-37&&q.target[0]>q.position[0]+10,`curbside looks east from the road (${q.position[0]} → ${q.target[0]})`);}
for(const [key,floor] of [['court',0],['bedroom',3.07],['lane',0]]){const q=places[key];assert(q,`${key} place exists`);
 const start=new T.Vector3(...q.position),end=walk(q.position,q.target,1),moved=Math.hypot(end.x-start.x,end.z-start.z);
 assert(Math.abs(end.y-1.65-floor)<.35,`${key}: the walk starts on its floor (feet at ${(end.y-1.65).toFixed(2)} m)`);
 assert(moved>(key==='bedroom'?.8:2),`${key}: a second's walk covers ${moved.toFixed(2)} m`);}
// Exposure follows where the walker stands: the family room sees almost no sky and keeps the room exposure (4×); out
// through the garden door, the terrace is exposed as outdoors.
const {roomExposure}=await import('../tmp/walk-check/lighting.mjs');
const openness=position=>{camera.position.copy(position);camera.updateMatrixWorld();return createWalker(camera,()=>meshes).openness();};
const inside=roomExposure(openness(new T.Vector3(lx,1.65,lz))),outside=roomExposure(openness(east));
assert(inside>3.5,`the family room keeps the room exposure (×${inside.toFixed(2)})`);
assert(outside<1.1,`the terrace is exposed as outdoors (×${outside.toFixed(2)})`);
// A place's caption describes where it starts: once the walker is a metre from there it no longer applies and is
// hidden, until a place is chosen again.
{const read=f=>fs.readFileSync(f,'utf8'),viewer=read('lib/house-model/viewer.ts'),page=read('components/studio/model/house-model.tsx');
 const wander=+(viewer.match(/const WANDER=([\d.]+)/)?.[1]??NaN);assert(wander>=.5&&wander<=1.5,`the caption goes after ${wander} m`);
 assert(/placeStart\.copy\(rig\.lens\.position\);wandered=false;options\.onWander\?\.\(false\);/.test(viewer)&&/if\(!wandered&&rig\.lens\.position\.distanceTo\(placeStart\)>WANDER\)\{wandered=true;options\.onWander\?\.\(true\);\}/.test(viewer),'the viewer reports leaving the start of a place');
 assert(/onWander:setWandered/.test(page)&&/caption&&!selected&&!\(place&&wandered\)/.test(page),'the page hides the caption until a place is chosen again');}
console.log(`Passed: the curbside, courtyard and master bedroom places start on their floors at a 2.1 m/s pace; the garden door, hall doors and front gate let the walker through, a wall stops it (${south.z.toFixed(2)} m), and the main stair reaches the upper floor (feet at ${(top.y-1.65).toFixed(2)} m) and the basement (feet at ${(down.y-1.65).toFixed(2)} m); the family room keeps the room exposure (×${inside.toFixed(2)}) and the terrace is exposed as outdoors (×${outside.toFixed(2)}).`);
