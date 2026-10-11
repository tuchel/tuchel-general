import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Windows and doors where the owner's photographs put them (cameras fitted to the house's corners, verges and ridge,
// interior views read against the 2.67 m ceiling, the exposé plans as cross-evidence). A horizontal ray from just outside
// the wall finds glass inside each corrected opening and wall where the model drew it before.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/renovation-data.ts'],outdir:'tmp/openings-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/openings-check/${name}.mjs`);
const [{buildHouseModel},{planPoint:p,guestRoofFrame},{renovationState}]=await Promise.all(['build-model','site-data','renovation-data'].map(load));
const model=buildHouseModel(true),root=model.root;model.setRenovations(renovationState());model.setLevel('exterior');root.updateMatrixWorld(true);
const shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
const meshes=[];root.traverse(o=>{if(o.isMesh&&shown(o)&&!o.isInstancedMesh)meshes.push(o);});
const ray=new T.Raycaster();
// What a ray from `from` toward `to` meets first: 'glass', or the material's role.
const first=(from,to)=>{const u=new T.Vector3(...from),v=new T.Vector3(...to);ray.set(u,v.clone().sub(u).normalize());ray.far=u.distanceTo(v);const hit=ray.intersectObjects(meshes,false)[0];
 if(!hit)return 'nothing';const m=[hit.object.material].flat()[hit.face?.materialIndex??0]??[hit.object.material].flat()[0];return m.transparent?'glass':hit.object.name||'solid';};
// A point t metres along a wall from a to b at height y, probed from 0.5 m outside (away from `inside`) to 0.6 m in.
const probe=(a,b,t,y,inside)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,x=a[0]+dx*t,z=a[1]+dz*t;let nx=-dz,nz=dx;if(nx*(inside[0]-x)+nz*(inside[1]-z)<0){nx=-nx;nz=-nz;}
 return first([x-nx*.62,y,z-nz*.62],[x+nx*.6,y,z+nz*.6]);};
const glass=(what,a,b,t,y,inside)=>assert.equal(probe(a,b,t,y,inside),'glass',`${what}: glass at ${t.toFixed(2)} m along, ${y.toFixed(2)} m up`);
const solid=(what,a,b,t,y,inside)=>{const r=probe(a,b,t,y,inside);assert(r!=='glass'&&r!=='nothing',`${what}: wall at ${t.toFixed(2)} m along, ${y.toFixed(2)} m up (${r})`);};
const slab=.12,main=[0,0],N=-9.715,S=9.715,E=6.105,W=-6.105;
// Main house, east façade (along z from the north end): the bathroom door 6.45–8.95 m, the dining window's sill at
// 0.95 m above the banquette, the living-room door 15.0–17.45 m.
const east=[[E,-9.61],[E,9.61]];
solid('bathroom door begins 6.45 m along',...east,6.1,slab+1.2,main);glass('bathroom door ends 8.95 m along',...east,8.85,slab+1.2,main);
solid('dining window sill 0.95 m',...east,10.7,slab+.75,main);glass('dining window',...east,10.7,slab+1.4,main);
solid('living-room door begins 15.0 m along',...east,14.93,slab+1.2,main);glass('living-room door ends 17.45 m along',...east,17.35,slab+1.2,main);
// North gable: the garden door's east jamb at x 0.55; the upper east window centred at x 2.21 and 1.0 m wide.
const north=[[-6,N],[6,N]];
solid('north door ends at x 0.55',...north,6.62,slab+1.2,main);glass('north door',...north,5.55,slab+1.2,main);
solid('upper north-east window clear of x 1.0',...north,7,4,main);glass('upper north-east window at x 2.21',...north,8.4,4,main);
// West wall: the WC window 0.83 m wide from z −0.51, sill 1.05 m; the kitchen sliding door's fixed pane on its north half,
// the leaf parked over it, the south half open, head 2.1 m.
const west=[[W,-9.61],[W,9.61]];
solid('WC window begins at z −0.51',...west,9.0,slab+1.5,main);solid('WC window sill 1.05 m',...west,9.5,slab+.95,main);glass('WC window',...west,9.5,slab+1.5,main);
glass('kitchen door: fixed pane on the north half',...west,3.3,slab+1.2,main);
assert(!['glass'].includes(probe(...west,5.4,slab+1.2,main)),'kitchen door: south half open');
solid('kitchen door head 2.1 m',...west,5.4,slab+2.2,main);
// South gable, upstairs: both windows 0.9 m wide, tops at 5.0 m.
const south=[[-6,S],[6,S]];
for(const x of [-2.35,2.35]){glass(`upper south window at x ${x}`,...south,x+6,4,main);solid(`upper south window 0.9 m wide (x ${x})`,...south,x+6+Math.sign(x)*.49,4,main);solid(`upper south window top 5.0 m (x ${x})`,...south,x+6,5.15,main);}
// East roof windows: low row at .68 of the slope, middle row at .45, one high at .14 (z along the ridge).
{const found=[];root.traverse(o=>{if(o.name==='open-roof-window'){const v=o.getWorldPosition(new T.Vector3());if(v.x>0&&Math.abs(v.z)<11)found.push(v.z);}});
 const expected=[-7.85,-4.6,-2.2,-5,.1,1.7,3.25,4.85,6.45,8.05].sort((a,b)=>a-b);found.sort((a,b)=>a-b);
 assert.equal(found.length,expected.length,`${found.length} east roof windows`);found.forEach((z,i)=>assert(Math.abs(z-expected[i])<.06,`east roof window at z ${z.toFixed(2)}, photographed ${expected[i]}`));}
// Guest wing: the garage doors 0.7–3.3 and 3.85–6.35 m along, head 2.05 m; the WC window 5.0–5.9 m and the sauna window
// 9.1–10.0 m, both with sills at 1.0 m; the north windows' sills at 0.95 m.
const guest=p(230,870),garage=[p(116,535),p(93,766)],guestWest=[p(93,766),p(49,1208)],guestNorth=[p(116,535),p(475,573)];
assert.notEqual(probe(...garage,.5,slab+1,guest),'garage-door','garage door 1 begins 0.7 m along');
for(const t of [3.15,6.2]){const r=probe(...garage,t,slab+1,guest);assert(r==='garage-door',`a garage door at ${t} m along (${r})`);}
assert.notEqual(probe(...garage,1.5,slab+2.12,guest),'garage-door','garage door head 2.05 m');
glass('guest WC window',...guestWest,5.45,slab+1.2,guest);glass('guest WC window begins 5.0 m along',...guestWest,5.04,slab+1.6,guest);
solid('sauna window begins 9.1 m along',...guestWest,9.05,slab+1.5,guest);solid('sauna window sill 1.0 m',...guestWest,9.5,slab+.95,guest);
glass('guest north window sill 0.95 m',...guestNorth,5.4,slab+1,guest);
// The guest north gable's upper window: 2.0 m wide, from the upper floor.
{const {center,length,rotation}=guestRoofFrame,gx=center[0]-Math.sin(rotation)*length/2,gz=center[1]-Math.cos(rotation)*length/2,ax=Math.cos(rotation),az=-Math.sin(rotation);
 const gable=[[gx-ax*3,gz-az*3],[gx+ax*3,gz+az*3]];
 glass('guest gable window from the upper floor',...gable,3,3.05,guest);solid('guest gable window 2.0 m wide',...gable,3+1.08,4,guest);}
// Guest roof windows: about 1.2 m further north, 1.9 m apart.
{const zs=[];root.traverse(o=>{if(o.name==='open-roof-window'){const v=o.getWorldPosition(new T.Vector3());if(v.x<-12)zs.push(v.z);}});zs.sort((a,b)=>a-b);
 assert.equal(zs.length,3,'three guest roof windows');[8.6,10.45,12.3].forEach((z,i)=>assert(Math.abs(zs[i]-z)<.4,`guest roof window at z ${zs[i].toFixed(2)}, photographed ${z}`));}
// The link: an oak entrance door and an oak side panel, not glass; the north glazing on posts 2.2 m apart; the
// courtyard opening's head at 1.9 m.
const courtyard=p(625,620),linkNorth=[p(478,574),p(811,574)],linkSouth=[p(464,667),p(811,667)];
for(const t of [.3,1]){const r=probe(...linkNorth,t,slab+1.2,courtyard);assert(r==='oak-door',`the entrance is oak at ${t} m along (${r})`);}
for(const t of [2,4.2,6.41])solid(`a glazing post at ${t} m along`,...linkNorth,t,slab+1.2,courtyard);
glass('north glazing between posts',...linkNorth,2.6,slab+1.2,courtyard);
solid('courtyard opening head 1.9 m',...linkSouth,7.9,slab+2.05,courtyard);glass('courtyard opening',...linkSouth,7.9,slab+1.5,courtyard);
console.log('Passed: east doors and the dining window, north door and upper window, west WC window and kitchen door, upper south windows, east and guest roof windows, garage doors, guest windows and gable window, link door, posts and courtyard opening as photographed.');
