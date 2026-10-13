import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Guest Wing Skylights (renovation option): two more roof windows over the guest study and two over the guest bedroom, on
// the three existing windows' rhythm in the west slope, each pair as central in its room as that rhythm allows.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/renovation-data.ts','lib/house-model/site-data.ts','lib/house-model/solar-layout.ts'],outdir:'tmp/skylights-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/skylights-check/build-model.mjs');
const {renovations,offered,renovationState}=await import('../tmp/skylights-check/renovation-data.mjs');
const {viewpoints,planPoint,guestRoofFrame,GUEST_ROOF,UPPER_PLAN_X_OFFSET}=await import('../tmp/skylights-check/site-data.mjs');
const {roofSkylights,guestSkylightsAdded}=await import('../tmp/skylights-check/solar-layout.mjs');

const option=renovations.find(r=>r.id==='skylights');
assert(option&&offered.includes(option),'the guest wing skylights are offered in the Changes panel');
assert.equal(option.title,'Guest Wing Skylights');
assert(option.view in viewpoints,'the skylights have their own overview');

// The rooms along the guest roof (metres from its middle, south positive), from the upper plan: the study from the north
// gable to the landing's wall; the bedroom, under the west slope, from the shower room's wall to the south gable. Each
// wall's face 0.1 m in from its traced line.
const {center:[cx,cz],rotation}=guestRoofFrame;
const along=([x,z])=>{const [px,pz]=planPoint(x,z),dx=px+UPPER_PLAN_X_OFFSET-cx,dz=pz-cz;return dx*Math.sin(rotation)+dz*Math.cos(rotation);};
const rooms={study:[along([222,544])+.1,along([207,780])-.1],bedroom:[along([186,1035])+.1,along([163,1209])-.1]};
// A window's reveal reaches 0.43 m either side of its centre along the roof.
const REVEAL=.43,existing=roofSkylights('guest'),added=guestSkylightsAdded,row=[...existing,...added];
const step=existing[1].z-existing[0].z;
assert(Math.abs(step-1.9)<.01&&Math.abs(existing[2].z-existing[1].z-step)<.01,'the three windows stand 1.9 m apart');
for(const w of row){assert.equal(w.side,-1,'on the west slope');
 const k=(w.z-existing[0].z)/step;assert(Math.abs(k-Math.round(k))<.005,`on the 1.9 m rhythm (${w.z})`);}
// The new windows sit high enough to open from the room: the bottom of the ceiling opening at shoulder height, about 1.5 m
// above the guest floor, and the whole opening above the knee wall, which stands 0.9 m high about 3.3 m out from the ridge.
{const half=(guestRoofFrame.width+GUEST_ROOF.overhang*2)/2,rise=GUEST_ROOF.ridge-GUEST_ROOF.eave,span=Math.hypot(half,rise),sin=rise/span,cos=half/span;
 const CEILING=.28,FLOOR=3.1,t=.15+CEILING*cos;
 for(const w of added){const u=w.fraction*span,sill=GUEST_ROOF.ridge-(u+.72)*sin-t*cos-FLOOR,out=(u+.72)*cos+t*sin;
  assert(Math.abs(sill-1.5)<.05,`the window at ${w.z} opens from shoulder height (${sill.toFixed(2)} m above the floor)`);
  assert(out<3.2,`the window at ${w.z} is clear of the knee wall (${out.toFixed(2)} m out)`);}}
for(const [name,[a,b]] of Object.entries(rooms)){
 const mine=added.filter(w=>w.z-REVEAL>=a&&w.z+REVEAL<=b);assert.equal(mine.length,2,`two new windows over the ${name}`);
 // As central as the rhythm allows: no other pair of neighbouring places on it, inside the room, sits nearer its middle.
 const places=[];for(let k=-10;k<=10;k++){const z=existing[0].z+k*step;if(z-REVEAL>=a&&z+REVEAL<=b)places.push(z);}
 const mid=(a+b)/2,off=(p,q)=>Math.abs((p+q)/2-mid),chosen=off(mine[0].z,mine[1].z);
 assert(Math.abs(mine[1].z-mine[0].z-step)<.01,`the ${name}'s pair are neighbours on the rhythm`);
 for(let i=1;i<places.length;i++)assert(chosen<=off(places[i-1],places[i])+1e-9,`the ${name}'s pair sits as central as the rhythm allows`);
}
assert.equal(added.length,4,'four new windows');

const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
for(const realistic of [false,true]){
 const model=buildHouseModel(realistic),root=model.root;model.setLevel('exterior');
 const on=skylights=>{model.setRenovations({...renovationState(),skylights});root.updateMatrixWorld(true);};
 const roof=root.getObjectByName('guest-roof'),half=(guestRoofFrame.width+GUEST_ROOF.overhang*2)/2,rise=GUEST_ROOF.ridge-GUEST_ROOF.eave;
 // A ray along the slope's normal through a window's centre, from 1 m outside to 1 m inside the roof: what it meets.
 const through=w=>{const local=new T.Vector3(w.side*half*w.fraction,GUEST_ROOF.ridge-rise*w.fraction,w.z),normal=new T.Vector3(w.side*rise,half,0).normalize();
  const from=local.clone().add(normal).applyMatrix4(roof.matrixWorld),to=local.clone().sub(normal).applyMatrix4(roof.matrixWorld),ray=new T.Raycaster(from,to.clone().sub(from).normalize(),0,from.distanceTo(to));
  return ray.intersectObject(root,true).filter(h=>h.object.isMesh&&visible(h.object));};
 // A window: the first thing met is not the slope but a frame or pane on it (within 0.2 m of the surface).
 const glazed=hits=>hits[0]&&!/roof-slope|ceiling/.test(hits[0].object.name)&&hits[0].distance<1.2;
 const closed=hits=>hits.some(h=>/roof-slope|ceiling/.test(h.object.name));
 on(false);
 for(const w of existing){const hits=through(w);assert(glazed(hits),`a window at ${w.z} (${hits[0]?.object.name})`);if(realistic)assert(!closed(hits),`the window at ${w.z} opens through roof and ceiling`);}
 for(const w of added)assert(!glazed(through(w))&&closed(through(w)),`without the option, roof at ${w.z}`);
 on(true);
 assert(visible(root.getObjectByName('renovation-skylights')),'the option shows');
 for(const w of row){const hits=through(w);assert(glazed(hits),`a window at ${w.z} (${hits[0]?.object.name})`);if(realistic)assert(!closed(hits),`the window at ${w.z} opens through roof and ceiling`);}
 model.dispose();
}
console.log(`Passed: Guest Wing Skylights adds ${added.length} roof windows at ${added.map(w=>w.z).join(', ')} m along the guest roof (study ${rooms.study.map(v=>v.toFixed(2)).join(' to ')}, bedroom ${rooms.bedroom.map(v=>v.toFixed(2)).join(' to ')}), on the existing ${step.toFixed(2)} m rhythm.`);
