import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts'],outdir:'tmp/interior-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/interior-check/build-model.mjs');
const {planPoint:p,UPPER_PLAN_X_OFFSET}=await import('../tmp/interior-check/site-data.mjs');
const model=buildHouseModel(process.argv.includes('--realism'));model.setLevel('ground');model.root.updateMatrixWorld(true);
const ray=new T.Raycaster();
function crosses(a,b,objects){const start=new T.Vector3(...a),end=new T.Vector3(...b);ray.set(start,end.clone().sub(start).normalize());ray.far=start.distanceTo(end);return ray.intersectObjects(objects,true).filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});}
const point=(x,z,y=.7)=>{const q=p(x,z);return [q[0],y,q[1]];};
const ground=model.root.getObjectByName('ground-floor');
assert(ground,'ground floor exists');
assert.equal(crosses(point(1135,653),point(1135,699),[ground]).length,0,'dining to sitting room passage is open');
assert.equal(crosses(point(214,923),point(214,964),[ground]).length,0,'yoga to wellness passage is open');
assert.equal(crosses(point(786,360,1.2),point(802,360,1.2),[ground]).length,0,'kitchen sliding door has an open south half');
const storage=model.root.getObjectByName('entry-storage-clear-of-courtyard-door');assert(storage);assert.equal(crosses(point(755,630),point(755,685),[storage]).length,0,'storage clears courtyard door');
assert(model.root.getObjectByName('front-door-walkway'),'front door walkway present');assert(model.root.getObjectByName('kitchen-terrace-table'),'outdoor table present');
assert.equal(crosses(point(777,630),point(920,630),[ground]).length,0,'connector to main atrium is open through both wall planes');
assert.equal(crosses(point(850,625),point(850,580),[ground]).length,0,'hall WC south doorway is accessible');
// The basement stair opens off the hall beneath the open stair up: the floor is open over its flight, the flight shows
// from the hall, and a rail guards the open side.
{const [x,z]=p(926,540),floor=crosses([x,1,z],[x,-.5,z],[ground]).filter(h=>h.object.isMesh)[0];assert(!floor,`the hall floor is open over the basement flight (floor at ${floor?.point.y.toFixed(2)} m)`);
 // Where the stair up passes well overhead (about 1.9 m), a ray from the hall at rail height meets the rail at the edge.
 const [ex,gz]=p(975,510),[gx]=p(946,510),guard=crosses([ex,1.12,gz],[gx-.4,1.12,gz],[ground]).filter(h=>h.object.isMesh)[0];assert(guard&&guard.point.x>gx-.05&&guard.point.x<gx+.15,'a rail guards the stairwell on the hall side');}
// The hall sideboard stands beside the dining-room doorway, never across it: clear at its top's height over the whole
// opening.
for(let z=616;z<=661;z+=5)assert.equal(crosses(point(1005,z,.97),point(1068,z,.97),[ground]).length,0,`hall to dining doorway is clear at z ${z}`);
assert(model.root.getObjectByName('hall-sideboard'),'hall sideboard present');
// The hall WC as photographed from its door and drawn on the ground plan: the toilet in the north bay, its cistern
// against the east wall and facing the window; the vanity, about 1 m long, filling the recess east of the room south of
// it, open to the room, its back to the east wall under a black-framed mirror.
{const toilet=model.root.getObjectByName('hall-wc-toilet'),basin=model.root.getObjectByName('hall-wc-basin'),mirror=model.root.getObjectByName('hall-wc-mirror');assert(toilet&&basin&&mirror,'hall WC toilet, vanity and mirror');
 const [eastWall]=p(893,0),[recess]=p(869,0),t=new T.Box3().setFromObject(toilet),v=new T.Box3().setFromObject(basin),m=new T.Box3().setFromObject(mirror);
 assert(t.max.x<eastWall-.085&&t.max.x>eastWall-.14,`the toilet's cistern stands against the east wall (${t.max.x.toFixed(2)}, wall face ${(eastWall-.09).toFixed(2)})`);
 assert(toilet.getWorldDirection(new T.Vector3()).x>.9,'the toilet faces west, toward the window');
 assert(v.max.x<eastWall-.085&&v.max.x>eastWall-.14&&v.min.x>recess-.05,`the vanity stands in the recess against the east wall (x ${v.min.x.toFixed(2)} to ${v.max.x.toFixed(2)})`);
 assert(basin.getWorldDirection(new T.Vector3()).x>.9,'the vanity faces west, toward the window');
 assert(v.max.z-v.min.z>.95&&v.max.z-v.min.z<1.15,`the vanity is about 1 m long (${(v.max.z-v.min.z).toFixed(2)})`);
 assert(m.min.y>1.1&&m.max.y<2.2&&m.min.z>v.min.z&&m.max.z<v.max.z&&m.max.x<eastWall-.085,'the mirror hangs on the east wall over the vanity');
 assert.equal(crosses(point(860,578,1.2),point(878,578,1.2),[ground]).length,0,'the recess is open to the room');}
assert(crosses(point(170,851),point(245,851),[ground]).length>0,'yoga partition is present');
assert.equal(crosses(point(171,910),point(231,910),[ground]).length,0,'yoga doorway remains clear');
// The link's west end: a full-height timber door stands closed in the passage to the garage corridor (photographs from
// the hall and the link's east end); a walker passes it like any door.
{const door=model.root.getObjectByName('garage-corridor-door');assert(door,'the garage corridor door');const b=new T.Box3().setFromObject(door);
 assert(b.max.y-b.min.y>2&&b.max.y-b.min.y<2.12,`the garage corridor door is full height (${(b.max.y-b.min.y).toFixed(2)} m)`);
 assert(crosses(point(455,602),point(498,602),[door]).length>0,'the garage corridor door stands closed in its opening');assert(door.userData.passable,'a walker passes the garage corridor door');}
const cars=model.root.getObjectByName('garage-cars');assert.equal(cars.children.length,2,'two garage cars');
// Each car's body matches its published length, width and height within 1 cm, and its wheelbase exactly.
for(const car of cars.children){const {length,width,height,wheelbase}=car.userData.spec,body=car.getObjectByName('car-body');body.geometry.computeBoundingBox();const size=body.geometry.boundingBox.getSize(new T.Vector3());
 for(const [got,want,what] of [[size.x,length,'length'],[size.z,width,'width'],[size.y+body.geometry.boundingBox.min.y,height,'height']])assert(Math.abs(got-want)<.01,`${car.name} ${what} ${got.toFixed(3)} ≠ ${want}`);
 const axles=[...new Set(car.children.filter(c=>c.name==='car-wheel').map(w=>w.position.x.toFixed(4)))].map(Number);assert(Math.abs(Math.abs(axles[0]-axles[1])-wheelbase)<1e-6,`${car.name} wheelbase`);}
assert(cars.getObjectByName('Porsche 911 Carrera GTS')&&cars.getObjectByName('Tesla Model Y Performance'),'a Porsche 911 Carrera GTS and a Tesla Model Y Performance');
assert(model.root.getObjectByName('guest-corner-sauna'),'corner sauna present');
model.setLevel('upper');model.root.updateMatrixWorld(true);const slab=model.root.getObjectByName('guest-floor-with-atrium');assert(slab);const [ax,az]=p(231,860);const [bx,bz]=p(310,866);
assert.equal(crosses([ax+UPPER_PLAN_X_OFFSET,5,az],[ax+UPPER_PLAN_X_OFFSET,2,az],[slab]).length,0,'guest atrium is a hole, not a floor patch');
assert(crosses([bx+UPPER_PLAN_X_OFFSET,5,bz],[bx+UPPER_PLAN_X_OFFSET,2,bz],[slab]).length>0,'guest gallery floor remains beside hole');
// The south bedroom's bed stands with its headboard against the west wall, facing the room.
{const bed=model.root.getObjectByName('south-bedroom-bed-against-west-wall');assert(bed,'south bedroom bed present');const b=new T.Box3().setFromObject(bed),c=b.getCenter(new T.Vector3()).setY(3.7);
 const ours=o=>{for(let a=o;a;a=a.parent)if(a===bed)return true;return false;},wall=crosses([c.x,c.y,c.z],[c.x-3,c.y,c.z],[bed.parent]).find(h=>!ours(h.object));
 assert(wall&&b.max.z-b.min.z<b.max.x-b.min.x+.01&&b.min.x-wall.point.x<.05,`south bedroom headboard is against the west wall (gap ${wall?(b.min.x-wall.point.x).toFixed(2):'?'} m)`);}
const mainSlab=model.root.getObjectByName('main-floor-with-atrium');assert(mainSlab);
for(const [x,z] of [[1035,540],[1035,630],[978,530]]){const [px,pz]=p(x,z);assert.equal(crosses([px+UPPER_PLAN_X_OFFSET,5,pz],[px+UPPER_PLAN_X_OFFSET,2,pz],[mainSlab]).length,0,'full main atrium is an open slab cutout');}
for(const [x,z] of [[930,550],[1140,550],[1050,440]]){const [px,pz]=p(x,z);assert(crosses([px+UPPER_PLAN_X_OFFSET,5,pz],[px+UPPER_PLAN_X_OFFSET,2,pz],[mainSlab]).length>0,'main gallery remains around atrium');}
const upper=model.root.getObjectByName('north-shared-bathroom').parent;
const upstairs=(x,z,y=3.65)=>{const q=p(x,z);return [q[0]+UPPER_PLAN_X_OFFSET,y,q[1]];};
assert.equal(crosses(upstairs(984,363),upstairs(1030,363),[upper]).length,0,'west bedroom bathroom entrance clear');
assert.equal(crosses(upstairs(1144,363),upstairs(1096,363),[upper]).length,0,'east bedroom bathroom entrance clear');
assert.equal(crosses(upstairs(1032,313),upstairs(1096,313),[upper]).length,0,'shower remains one connected zone');
assert(crosses(upstairs(1032,362),upstairs(1096,362),[upper]).length>0,'partition separates vanity areas');
for(const x of [1032,1096])assert(model.root.getObjectByName('north-bath-vanity-'+x),'both vanity units present');
assert.equal(crosses(upstairs(1026,842),upstairs(1061,842),[upper]).length,0,'wider south bedroom bathroom doorway clear');
assert.equal(crosses(upstairs(953,739),upstairs(953,710),[upper]).length,0,'south toilet room doorway clear');
assert.equal(crosses(upstairs(994,740),upstairs(994,699),[upper]).length,0,'south shower walk-in access clear');
assert.equal(crosses(upstairs(1144,437),upstairs(1180,437),[upper]).length,0,'gallery bathroom entrance clear');
for(const name of ['upper-south-wc','upper-south-shower','upper-gallery-wc','upper-gallery-basin'])assert(model.root.getObjectByName(name),name+' present');
assert(crosses(upstairs(930,395),upstairs(930,422),[upper]).length>0,'northwest bedroom south wall restored');
assert.equal(crosses(upstairs(982,395),upstairs(982,422),[upper]).length,0,'northwest gallery doorway remains open');
const nwBed=model.root.getObjectByName('northwest-bed-against-divider');assert(nwBed);
const bedBounds=new T.Box3().setFromObject(nwBed);const dividerFace=p(1064,225)[0]+UPPER_PLAN_X_OFFSET-.09;assert(Math.abs(bedBounds.max.x-dividerFace)<.03,'northwest headboard touches divider');
assert.equal(crosses(upstairs(245,819),upstairs(290,819),[upper]).length,0,'mezzanine railing has a landing opening');
assert.equal(crosses(upstairs(283,996),upstairs(244,996),[upper]).length,0,'guest bathroom door remains open');
for(const name of ['guest-upper-bath-toilet','guest-upper-bath-shower','guest-bedroom-corner-vanity','guest-study-daybed-against-wall'])assert(model.root.getObjectByName(name),name+' present');
const lowerStair=model.root.getObjectByName('guest-ground-turning-stair');assert(lowerStair);
// The upper-floor view stands on the real ground floor: full-height walls, ceilings closed except over the stairs.
assert(model.rendered(lowerStair.children[0])&&model.rendered(model.root.getObjectByName('main-open-timber-stair').children[0]),'upper-floor view keeps both stairs from the ground floor');
assert(crosses(point(780,440,2.55),point(812,440,2.55),[ground]).length>0,'ground-floor walls stay full height under the upper floor');
assert.equal(model.ceilings.visible,true,'ground-floor ceiling closes the ground floor in the upper-floor view');
for(const [x,z] of [[1035,540],[1035,630],[978,530],[231,860]]){const [px,pz]=p(x,z);assert.equal(crosses([px+UPPER_PLAN_X_OFFSET,4,pz],[px+UPPER_PLAN_X_OFFSET,2,pz],[model.ceilings]).length,0,'ceiling open over the stairs and atrium');}
assert(model.upper.getObjectByName('guest-ground-turning-stair')===undefined,'no stand-in stair copies on the upper floor');
model.root.traverse(o=>{if(o instanceof T.Mesh){for(const n of o.matrixWorld.elements)assert(Number.isFinite(n),'finite transform');}});
if(model.detail){
 model.setLevel('exterior');model.root.updateMatrixWorld(true);
 const ceilings=model.ceilings;let enclosed=0;model.upper.traverse(o=>{if(!o.userData.alsoExterior)return;enclosed++;assert(model.rendered(o),'roofs-on view keeps upper-floor rooms in place');for(let a=o;a&&a!==model.upper;a=a.parent)assert(!a.name.includes('stair'),'cutaway stairs stay out of the roofs-on view');assert(new T.Box3().setFromObject(o).min.y>=2.85);});assert(enclosed>100,'upper-floor furnishings shown behind the roof');
 for(const [x,z] of [[1035,540],[1035,630],[978,530]]){const [px,pz]=p(x,z);assert.equal(crosses([px+UPPER_PLAN_X_OFFSET,4,pz],[px+UPPER_PLAN_X_OFFSET,2,pz],[ceilings]).length,0,'ceiling preserves full main atrium');}
 const [cx,cz]=p(231,860);assert.equal(crosses([cx+UPPER_PLAN_X_OFFSET,4,cz],[cx+UPPER_PLAN_X_OFFSET,2,cz],[ceilings]).length,0,'ceiling preserves guest stairwell');
 assert.equal(ceilings.visible,true);model.setLevel('ground');assert.equal(ceilings.visible,false,'ceilings hide for a cutaway');
}
// Plan corrections: doorways and walls from the exposé ground and basement plans.
model.setLevel('ground');model.root.updateMatrixWorld(true);
assert.equal(crosses(point(955,430),point(980,430),[ground]).length,0,'kitchen runs to the Flur wall; the dashed overhead line is not a wall');
assert.equal(crosses(point(966,480),point(966,445),[ground]).length,0,'kitchen to hall doorway open');
assert.equal(crosses(point(1015,480),point(1015,445),[ground]).length,0,'Flur to hall doorway open');
assert.equal(crosses(point(1016,370),point(1016,405),[ground]).length,0,'bedroom to Flur doorway open');
assert(crosses(point(1037,370),point(1037,405),[ground]).length>0,'bedroom closed to the Flur beside its doorway');
assert.equal(crosses(point(864,480),point(864,440),[ground]).length,0,'pantry door clear of the tall units');
assert.equal(crosses(point(1151,375),point(1151,420),[ground]).length,0,'bath reached through the glazed double doors');
assert(crosses(point(1195,375),point(1195,405),[ground]).length>0,'pier between the bath doors and the east wall');
assert.equal(crosses(point(1121,400),point(1121,420),[ground]).length,0,'shower entered from the bath');
assert.equal(crosses(point(205,1066),point(150,1066),[ground]).length,0,'wellness room open to the sauna front and shower');
assert(model.root.getObjectByName('guest-wc-toilet')&&model.root.getObjectByName('wellness-fireplace'),'guest WC toilet and wellness fireplace present');
assert.equal(crosses(point(90,893,.5),point(128,893,.5),[lowerStair]).length,0,'guest stair ends before the entrance door swing');
assert(crosses(point(415,650),point(415,690),[ground]).length>0,'garage closed toward the loggia');
model.setLevel('basement');model.root.updateMatrixWorld(true);
const basement=model.root.getObjectByName('basement'),below=(x,z,y=-1.8)=>{const q=p(x,z);return [q[0]+basement.position.x,y,q[1]];};
for(const [a,b,label] of [[[1050,423],[1080,423],'Abstell'],[[1050,510],[1080,510],'HWR'],[[900,645],[930,645],'wine room'],[[1031,655],[1031,685],'hobby room']])assert.equal(crosses(below(...a),below(...b),[basement]).length,0,label+' door open');
assert(crosses(below(1142,440),below(1142,480),[basement]).length>0,'Abstell and HWR are separate rooms');
const mainStair=model.root.getObjectByName('main-open-timber-stair');
assert(Math.abs(below(946,538)[0]-new T.Box3().setFromObject(mainStair).getCenter(new T.Vector3()).x)<.15,'basement stair (basement sheet x 946) sits under the main stair');
model.setLevel('exterior');model.root.updateMatrixWorld(true);
assert(Math.abs(new T.Box3().setFromObject(model.root.getObjectByName('main-roof-slope-1')).max.y-8)<.2,'main ridge near 8 m (4.90 m room height)');
// Upper rooms: partitions rise above standing eye height to the ceiling; with detail, a plastered ceiling hangs under the
// slate, and from the south-east room the lower half of a low east roof window shows above the knee wall.
model.upper.visible=true;model.root.updateMatrixWorld(true);
// Full-height fittings now that rooms are walled to the ceiling: the sauna stands 2.1 m high and door leaves are door height.
const height=name=>{const b=new T.Box3().setFromObject(model.root.getObjectByName(name));return b.max.y-b.min.y;};
assert(height('guest-corner-sauna')>2.1,`sauna is 2.1 m high (${height('guest-corner-sauna').toFixed(2)} m)`);
for(const name of ['north-bath-bedroom-door-1000','north-bath-bedroom-door-1128','guest-upper-bath-open-door'])assert(height(name)>2,`${name} is door height`);
assert(crosses(upstairs(1190,650,3.07+1.68),upstairs(1190,690,3.07+1.68),[model.upper]).length>0,'upper bedroom walls rise above eye height');
if(process.argv.includes('--realism')){
 const [rx,rz]=p(1128,766),eye=new T.Vector3(rx+UPPER_PLAN_X_OFFSET,3.07+1.6,rz),visible=[];model.root.traverse(o=>{if(o.isMesh&&model.rendered(o))visible.push(o);});
 const up=new T.Raycaster(eye.clone().setZ(eye.z+.45),new T.Vector3(0,1,0)).intersectObjects(visible,false)[0];
 assert(up&&up.object.name.startsWith('main-ceiling'),`the south-east room looks up at a plastered ceiling (${up?.object.name})`);
 const rise=8-2.95,slope=Math.atan2(rise,6.55),glass=new T.Vector3(6.55*.68+.3*Math.cos(slope)+.05*Math.sin(slope),8-rise*.68-.3*Math.sin(slope)+.05*Math.cos(slope),8.8),front=eye.clone().setZ(8.8),toward=new T.Raycaster(front,glass.clone().sub(front).normalize()).intersectObjects(visible,false)[0];
 assert(toward&&[toward.object.material].flat().some(m=>m.transparent),`a low east roof window is visible over the knee wall (${toward?.object.name||toward?.object.parent?.name})`);
}
// The walk-in pantry is closed off from the hall WC: solid wall on its west side down to the wall between them (plan).
assert(crosses(point(835,480),point(812,525),[ground]).length>0,'a wall separates the pantry from the WC');
// The basement stair is entered from the hall across its top step: nothing stands in that way between 0.3 and 1.9 m.
model.basement.visible=true;
for(let x=920;x<=975;x+=2)for(let z=470;z<=490;z+=2)assert.equal(crosses(point(x,z,1.9),point(x,z,.3),[ground,model.basement]).filter(h=>h.object.isMesh).length,0,`the way onto the basement stair is clear at ${x}, ${z}`);
model.basement.visible=false;
// The link, as photographed from the hall and from its east end: a plastered ceiling pitched over the corridor, its
// ridge along the middle about 3.45 m up and its feet at the wall heads about 2.85 m up; two black steel beams across at
// the wall heads; a black track of spotlights along the ridge. It lifts off with the ground-floor ceilings.
model.setLevel('exterior');model.root.updateMatrixWorld(true);
{const above=(x,z)=>crosses([x,2.5,z],[x,6,z],[model.root]).find(h=>h.object.isMesh);
 // Where the main roof's eave reaches over the link's east end, a plastered bulkhead boxes it in, 2.7 m up.
 for(const z of [1.7,2.5,3.3]){const h=above(-6.35,z);assert(h?.object.name==='link-ceiling'&&h.point.y>2.65&&h.point.y<2.8,`the bulkhead at the link's east end (${h?.object.name}, ${h?.point.y.toFixed(2)} m)`);}
 for(const x of [-14.3,-11,-7.5]){for(const [z,lo,hi] of [[1.7,2.85,3.05],[2.3,3.25,3.45],[2.75,3.25,3.45],[3.3,2.85,3.05]]){const h=above(x,z);
  assert.equal(h?.object.name,'link-ceiling',`the link's ceiling over (${x}, ${z}): ${h?.object.name||h?.object.parent?.name||'nothing'}`);assert(h.point.y>lo&&h.point.y<hi,`the link's ceiling at (${x}, ${z}) is ${h.point.y.toFixed(2)} m up, photographed ${lo}–${hi} m`);}}
 const beams=[],spots=[];model.root.traverse(o=>{if(o.name==='link-beam')beams.push(new T.Box3().setFromObject(o));if(o.name==='link-spot')spots.push(o);});
 assert.equal(beams.length,2,'two steel beams across the link');for(const b of beams)assert(b.min.z<1.65&&b.max.z>3.35&&b.min.y>2.5&&b.max.y<2.95,'each beam spans the corridor at the wall heads');
 const track=model.root.getObjectByName('link-light-track');assert(track,'a light track along the ridge');const tb=new T.Box3().setFromObject(track);
 assert(tb.max.x-tb.min.x>7&&tb.max.x<-6.66&&tb.min.y>3.2&&Math.abs((tb.min.z+tb.max.z)/2-2.51)<.1,'the track runs the link along its ridge');assert(spots.length>=6,`spotlights on the track (${spots.length})`);
 model.setLevel('ground');model.root.updateMatrixWorld(true);assert.notEqual(above(-11,2.3)?.object.name,'link-ceiling','the link ceiling lifts off in the ground-floor view');}
model.dispose();console.log('Passed: the link\'s pitched plaster ceiling with its steel beams and track lights, the closed full-height garage corridor door, the hall WC\'s toilet against the east wall and vanity in its recess, dining circulation, the basement stairwell open and guarded in the hall with a clear way onto its top step, the pantry closed off from the WC, the hall doorway beside its table, the south bedroom headboard against its wall, yoga doorway, sliding door, corridor clearance, walkway, outdoor table, guest atrium, plan doorways, guest stair, basement doors and registration, roof height, upper walls to the ceiling, roof windows over the knee wall and finite model transforms.');
