import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// Room reflections (Extreme). Six rooms each get a reflection of themselves, captured once from the middle of the room
// at standing height: floors, cabinet fronts and window glass seen from inside reflect the room rather than the sky.
// Each room's box comes from rays cast to its walls, floor and ceiling; a reflection is looked up where its ray meets
// that box, so it lines up with the walls, and blurred with the surface's roughness. Views from outside are unchanged.
await build({entryPoints:['lib/house-model/room-probes.ts','lib/house-model/build-model.ts'],outdir:'tmp/room-probes-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const [{ROOM_PROBES,probeRooms,roomBoxes,octEncode,octDecode,boxProject},{buildHouseModel}]=await Promise.all(['room-probes','build-model'].map(n=>import(`../tmp/room-probes-check/${n}.mjs`)));

// Directions survive the octahedral layout the maps are stored in.
{let worst=0;for(let i=0;i<2000;i++){const y=1-2*(i+.5)/2000,r=Math.sqrt(1-y*y),a=i*2.399963,d=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
 const uv=octEncode(d);assert(uv.x>=0&&uv.x<=1&&uv.y>=0&&uv.y<=1,'inside the map');worst=Math.max(worst,octDecode(uv).angleTo(d));}
 assert(worst<1e-6,`directions come back (worst ${worst.toExponential(1)} rad)`);}
// A reflected ray is looked up where it meets the room's box, as seen from the probe: a point near a wall reflects
// that wall's own patch, not the patch straight ahead of the probe.
{const box=new T.Box3(new T.Vector3(-3,0,-4),new T.Vector3(3,2.6,4)),centre=new T.Vector3(0,1.45,0);
 const p=new T.Vector3(2,0,3),r=new T.Vector3(1,1,0).normalize(),d=boxProject(p,r,box,centre),hit=new T.Vector3(3,1,3);
 assert(d.angleTo(hit.clone().sub(centre).normalize())<1e-6,'the reflection lines up with the wall it meets');
 assert(d.angleTo(r)>.3,'rather than the plain reflected direction');}

// The rooms: six, each boxed by its walls, floor and ceiling in the whole-house view.
const model=buildHouseModel(true);model.setLevel('exterior');model.root.updateMatrixWorld(true);
// Glass and doors bound a room as its walls do.
const solids=[];model.root.traverse(o=>{if(!o.isMesh)return;for(let a=o;a;a=a.parent)if(!a.visible)return;solids.push(o);});
const rooms=probeRooms(),boxes=roomBoxes(rooms,solids);
assert.equal(rooms.length,ROOM_PROBES.rooms.length,'one probe per room');assert(rooms.length>=6,'six rooms or more');
for(const [i,room] of rooms.entries()){
 const {box,centre}=boxes[i],size=box.getSize(new T.Vector3());
 assert(box.containsPoint(centre),`${room.id}: the probe is inside its box`);
 assert(size.x>=2.4&&size.z>=2.4&&size.x<=ROOM_PROBES.reach*2&&size.z<=ROOM_PROBES.reach*2,`${room.id}: a room-sized box (${size.x.toFixed(1)} × ${size.z.toFixed(1)} m)`);
 assert(size.y>=2.2&&size.y<=6.5,`${room.id}: floor to ceiling ${size.y.toFixed(2)} m`);
 assert(Math.abs(centre.y-box.min.y-ROOM_PROBES.height)<.05,`${room.id}: the probe at standing height`);
}
// The family room's box runs from the west façade to the east wall of the room.
{const living=boxes[rooms.findIndex(r=>r.id==='living')].box;assert(Math.abs(living.min.x-(-6+.12+.225))<.2,`the family room's west wall (${living.min.x.toFixed(2)})`);
 // Every box stays within the house's outline (±9.61 m north and south, 6 m east): glass and doors bound rooms too.
 for(const [i,{box}] of boxes.entries())assert(box.min.z>=-9.61&&box.max.z<=9.61&&box.max.x<=6,`${rooms[i].id}: inside the house (${box.min.z.toFixed(2)} to ${box.max.z.toFixed(2)}, east ${box.max.x.toFixed(2)})`);}

// The wiring: Extreme only, baked in the whole-house view, a face a frame; used only while the camera is in a room.
{const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),viewer=read('viewer.ts'),probes=read('room-probes.ts'),tiers=read('device-tier.ts');
 assert(/extreme:\{[^}]*roomProbes:true/.test(tiers)&&/detailed:\{[^}]*roomProbes:false/.test(tiers),'Extreme reflects its rooms');
 assert(/createRoomProbes\(/.test(viewer)&&/level==='exterior'/.test(viewer)&&/probes\??\.step\(/.test(viewer),'baked in the whole-house view');
 assert(/before\(shader\.fragmentShader,'lights_fragment_end'/.test(probes)&&/uRoomActive/.test(probes),'replaces sky reflections before lighting is summed, only while active');
 assert(/textureLod\(/.test(probes)&&/roughness/.test(probes),'blurred with roughness');}
console.log(`Passed: ${rooms.length} rooms boxed by their walls (${rooms.map((r,i)=>{const s=boxes[i].box.getSize(new T.Vector3());return `${r.id} ${s.x.toFixed(1)}×${s.z.toFixed(1)}×${s.y.toFixed(1)}`;}).join(', ')} m); reflections line up with the wall they meet and survive the map's layout.`);
