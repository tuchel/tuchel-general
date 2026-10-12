import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The front garage (renovation option): a two-car garage on the lane in the south corner, doors to the north, under a
// slate roof at the guest wing's pitch; a bin room for four bins opening to the lane, reached from the drive by a cobbled
// path; a 2 m fence and gates on the road line across the notch; the well garden cleared to open lawn with cherries in
// bloom.
await build({entryPoints:['lib/house-model/landscape-context.ts','lib/house-model/build-model.ts','lib/house-model/renovation-data.ts','lib/house-model/front-garage.ts','lib/house-model/site-data.ts','lib/house-model/entrance-garden.ts','lib/house-model/front-garden.ts'],outdir:'tmp/garage-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/garage-check/build-model.mjs');
const {landscapeContext}=await import('../tmp/garage-check/landscape-context.mjs');
const {renovations,offered,renovationState}=await import('../tmp/garage-check/renovation-data.mjs');
const {garagePoint,roadPoint,GARAGE,BIN_ROOM,BIN_PATH,DRIVE_GATE,PEDESTRIAN_GATE,ROAD_LENGTH}=await import('../tmp/garage-check/front-garage.mjs');
const {sitePoint,viewpoints,treePositions}=await import('../tmp/garage-check/site-data.mjs');
const {FRUIT_TREES,SHRUBS,CHERRIES}=await import('../tmp/garage-check/front-garden.mjs');
const {drivewayFootprint,insideEntrancePolygon}=await import('../tmp/garage-check/entrance-garden.mjs');

const option=renovations.find(r=>r.id==='garage');
assert(option&&offered.includes(option),'the front garage is offered in the Changes panel');
assert(option.view in viewpoints,'the front garage has its own overview');
// Bavarian building code (BayBO Art. 6(7)): at most 9 m of garage and side rooms on one boundary, mean wall height 3 m.
assert(BIN_ROOM.v1-GARAGE.v0<=9,`${(BIN_ROOM.v1-GARAGE.v0).toFixed(1)} m of building on the road line`);
assert(GARAGE.eave<=3,'eaves under 3 m');

const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
const v3=([x,z],y)=>new T.Vector3(x,y,z);
const ray=new T.Raycaster();
const first=(from,to,root)=>{const d=to.clone().sub(from);ray.set(from,d.clone().normalize());ray.far=d.length();
 return ray.intersectObject(root,true).find(h=>h.object.isMesh&&!h.object.isInstancedMesh&&visible(h.object));};
const named=(o,name)=>{for(;o;o=o.parent)if(o.name===name)return true;return false;};
// Garage frame: m into the plot from the lane's road line, v along it southward.
const local=(x,z)=>{const o=garagePoint(0,0),i=garagePoint(1,0),a=garagePoint(0,1),dx=x-o[0],dz=z-o[1];return [dx*(i[0]-o[0])+dz*(i[1]-o[1]),dx*(a[0]-o[0])+dz*(a[1]-o[1])];};
const toSegment=([x,z],[ax,az],[bx,bz])=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-t*dx,z-az-t*dz);};
const removedTrees=[[246,690],[256,833],[308,839],[357,846],...FRUIT_TREES,...SHRUBS].map(([x,z])=>sitePoint(x,z));

for(const realistic of [false,true]){
 const model=buildHouseModel(realistic,realistic?landscapeContext().group:undefined),root=model.root;model.setLevel('exterior');
 const on=state=>{model.setRenovations({...renovationState(),...state});root.updateMatrixWorld(true);};
 const garden=['granite-well-and-raised-beds','parking-yew-hedge','well-garden-back-hedge','well-garden-timber-trough','well-garden-gravel-path'];
 // Trees shown: [x, z, kind] for every visible tree.
 const trees=()=>{const out=[];root.traverse(o=>{if(!visible(o))return;
   for(const set of o.userData.treeSets??[])for(const m of set.matrices){const p=new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);out.push([p.x,p.z,set.kind]);}
   if(o.userData.gardenTree)out.push([o.userData.gardenTree[0],o.userData.gardenTree[1],o.userData.gardenTree[2]]);});return out;};
 const near=(list,[x,z],d=1)=>list.some(t=>Math.hypot(t[0]-x,t[1]-z)<d);

 // Off: today's front garden, its hedges and trees; no garage.
 on({});
 for(const name of garden)assert(visible(root.getObjectByName(name)),`${name} stands without the garage`);
 assert(!visible(root.getObjectByName('front-garage')),'no garage when the option is off');
 {const shown=trees();for(const p of removedTrees)assert(near(shown,p),`today's tree at ${p.map(n=>n.toFixed(1))}`);
  if(realistic)assert(visible(root.getObjectByName('avenue-by-the-garage')),'the avenue tree by the lane stands without the garage');
  assert(!shown.some(t=>t[2]==='cherry'),'no cherries without the garage');}

 on({garage:true});
 const garage=root.getObjectByName('front-garage');assert(visible(garage),'the garage stands');
 // On the road line: from the lane, the first thing met at 1.2 m along the garage and bin room is their lane wall, within
 // 0.25 m of the line.
 for(let v=GARAGE.v0+.2;v<BIN_ROOM.v1-.1;v+=.4){const hit=first(v3(garagePoint(-2,v),1.2),v3(garagePoint(3,v),1.2),root);
  assert(hit&&(named(hit.object,'front-garage')),`a lane wall at ${v.toFixed(1)} m along the lane`);
  const m=hit.point.clone().sub(v3(garagePoint(0,v),1.2)).length();assert(m<=.25,`the lane wall stands on the road line (${m.toFixed(2)} m in)`);}
 // The roof stays within the plot, its eave about 2.6 m above the lane; it pitches as steeply as the guest wing's roof.
 const roof=root.getObjectByName('front-garage-roof');assert(visible(roof),'the garage roof');
 const roofAt=m=>{const [x,z]=garagePoint(m,(GARAGE.v0+GARAGE.v1)/2),hit=first(new T.Vector3(x,9,z),new T.Vector3(x,0,z),root);return hit&&(named(hit.object,'front-garage-roof')||named(hit.object,'front-garage'))?hit:undefined;};
 assert(!roofAt(-.05),'nothing of the garage overhangs the lane');
 {const eave=roofAt(.05);assert(eave&&eave.point.y>2.4&&eave.point.y<2.85,`eave ${eave?.point.y.toFixed(2)} m over the lane wall`);}
 const garagePitch=Math.atan(roofAt(2).point.y-roofAt(1).point.y);
 const guestRoof=root.getObjectByName('guest-roof');guestRoof.updateMatrixWorld(true);
 // The guest roof's slope away from its roof windows: heights 1 m apart across it, where both rays meet the slope.
 const guestAt=(x,z)=>{const p=new T.Vector3(x,0,z).applyMatrix4(guestRoof.matrixWorld),hit=first(new T.Vector3(p.x,12,p.z),new T.Vector3(p.x,0,p.z),guestRoof);return hit&&/roof-slope/.test(hit.object.name)?hit.point.y:undefined;};
 const guestPitch=[-4,-2,0,2,4].map(z=>[guestAt(1,z),guestAt(2,z)]).filter(([a,b])=>a!==undefined&&b!==undefined).map(([a,b])=>Math.atan(a-b))[0];
 assert(guestPitch>.5,'the guest roof measured');
 assert(Math.abs(garagePitch-guestPitch)<.5*Math.PI/180,`garage roof ${(garagePitch*180/Math.PI).toFixed(1)}° vs guest wing ${(guestPitch*180/Math.PI).toFixed(1)}°`);
 {const ridge=roofAt((GARAGE.m0+GARAGE.m1)/2).point.y;assert(ridge>4.8&&ridge<5.3,`ridge ${ridge.toFixed(2)} m`);}
 // Two doors in the north gable, facing the drive; none on the lane.
 for(const m of [GARAGE.m0+1.6,GARAGE.m1-1.6]){const hit=first(v3(garagePoint(m,GARAGE.v0-3),1),v3(garagePoint(m,GARAGE.v0+1),1),root);
  assert(hit&&named(hit.object,'front-garage-door'),`a garage door faces north at ${m.toFixed(1)} m in (${hit?.object.name})`);}
 // The bin room: four bins, a pair of doors to the lane, a door to the garden.
 const bins=[];garage.traverse(o=>{if(o.name==='wheelie-bin'&&visible(o))bins.push(new T.Vector3().setFromMatrixPosition(o.matrixWorld));});
 assert.equal(bins.length,4,'four bins');
 for(const b of bins){const [m,v]=local(b.x,b.z);assert(v>BIN_ROOM.v0&&v<BIN_ROOM.v1&&m>BIN_ROOM.m0&&m<BIN_ROOM.m1,'each bin stands in the bin room');}
 const binDoor=(from,to,name)=>{const hit=first(v3(garagePoint(...from),1),v3(garagePoint(...to),1),root);assert(hit&&named(hit.object,name),`${name} (${hit?.object.name})`);return hit;};
 binDoor([-2,(BIN_ROOM.v0+BIN_ROOM.v1)/2],[1,(BIN_ROOM.v0+BIN_ROOM.v1)/2],'bin-room-lane-door');
 binDoor([BIN_ROOM.m1+2,BIN_PATH.at(-1)[1]],[BIN_ROOM.m1-.5,BIN_PATH.at(-1)[1]],'bin-room-garden-door');
 // A cobbled path, in the driveway's own stones, leaves the drive and runs to the bin room's garden door.
 const driveway=root.getObjectByName('individual-driveway-cobbles');
 const stones=[];root.traverse(o=>{if(o.isInstancedMesh&&/cobbles/.test(o.name)&&visible(o)){assert.equal(o.material,driveway.material,`${o.name} are the driveway's cobbles`);assert.equal(o.geometry.parameters.width,driveway.geometry.parameters.width);
  const m=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);stones.push(new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld));}}});
 const cobbled=([x,z])=>stones.some(s=>Math.abs(s.x-x)<.13&&Math.abs(s.z-z)<.1);
 const path=BIN_PATH.map(p=>garagePoint(...p));
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.15),end=i===path.length-1?(len-.2)/len:1;
  for(let k=0;k<=n;k++){const t=k/n*end,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];assert(cobbled(p),`cobbles at ${p.map(q=>q.toFixed(2))}`);}}
 {const door=path.at(-1);assert(stones.some(s=>Math.hypot(s.x-door[0],s.z-door[1])<.3),'the cobbles reach the bin room door');}
 // The apron joins the existing drive: cobbles all the way from the parking to the garage doors.
 {const from=sitePoint(345,700),to=garagePoint(GARAGE.m1-1,GARAGE.v0-.3),n=30;assert(insideEntrancePolygon(...from,drivewayFootprint),'starts on the drive');
  for(let k=0;k<=n;k++)assert(cobbled([from[0]+(to[0]-from[0])*k/n,from[1]+(to[1]-from[1])*k/n]),'cobbled from the drive to the garage doors');}
 // Where the old recessed wall stood, and along the drive's old edge, the cobbles run on without a gap.
 for(const [a,b] of [[sitePoint(365,422),sitePoint(346,610)],[sitePoint(346,610),sitePoint(337,707)]])for(let t=.02;t<=.98;t+=.01){const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];assert(cobbled(p),`cobbles where the old wall stood and along the drive's edge, at ${p.map(q=>q.toFixed(2))}`);}
 // The well garden, its hedges and its trees give way to open lawn; three cherries stand in it, in bloom.
 for(const name of garden)assert(!visible(root.getObjectByName(name)),`${name} gives way to lawn`);
 {const hedges=[];root.traverse(o=>{if(o.isMesh&&visible(o)&&(()=>{for(let a=o;a;a=a.parent)if(/hedge/.test(a.name))return true;return false;})())hedges.push(o);});
  for(let x=-35.5;x<=-28.5;x+=.5)for(let z=12.8;z<=20.2;z+=.5){ray.set(new T.Vector3(x,6,z),new T.Vector3(0,-1,0));ray.far=7;assert.equal(ray.intersectObjects(hedges,false).length,0,`no hedge in the lawn at ${x}, ${z}`);}}
 const shown=trees();
 for(const p of removedTrees)assert(!near(shown,p,.5),`the tree at ${p.map(n=>n.toFixed(1))} gives way`);
 const cherries=shown.filter(t=>t[2]==='cherry');assert.equal(cherries.length,CHERRIES.length,'the cherries stand');assert(cherries.length>=3);
 for(const c of cherries){for(let i=1;i<path.length;i++)assert(toSegment(c,path[i-1],path[i])>1.5,'cherries stand clear of the bin path');
  const [m,v]=local(c[0],c[1]);assert(m>GARAGE.m1+2||v>GARAGE.v1+2||v<GARAGE.v0-2,'cherries stand clear of the garage');}
 // No tree of the lane's avenue stands in the bin room or the garage.
 if(realistic){const byGarage=root.getObjectByName('avenue-by-the-garage');assert(byGarage&&!visible(byGarage),'the avenue tree at the bin room gives way');
  for(const t of shown){const [m,v]=local(t[0],t[1]);assert(!(m>-1&&m<GARAGE.m1&&v>GARAGE.v0-1&&v<BIN_ROOM.v1+1),`no tree in the garage or bin room (${t.map(n=>typeof n==='number'?n.toFixed(1):n)})`);}}
 // In bloom: the cherry crowns are pale pink, not green.
 const bloom=[];
 if(realistic)root.traverse(o=>{if(!visible(o))return;for(const set of o.userData.treeSets??[])if(set.kind==='cherry')for(const c of set.crowns){const col=c.geometry.attributes.color;if(!col)continue;let r=0,g=0,b=0;for(let i=0;i<col.count;i++){r+=col.getX(i);g+=col.getY(i);b+=col.getZ(i);}bloom.push([r/col.count,g/col.count,b/col.count]);}});
 else root.traverse(o=>{if(o.isMesh&&visible(o)&&o.userData.gardenTree?.[2]==='cherry'&&o.name==='tree-crown')bloom.push(o.material.color.toArray());});
 assert(bloom.length,'cherry crowns drawn');
 for(const [r,g,b] of bloom)assert(r>g*1.05&&b>g&&r>.3,`a blossom pink crown (${[r,g,b].map(n=>n.toFixed(2))})`);
 // The road line: a fence no taller than 2 m (permit-free under BayBO Art. 57(1)7a) across the notch, with a sliding drive
 // gate and a pedestrian gate the walker passes; the old recessed wall and its returns are gone.
 for(let u=.3;u<ROAD_LENGTH-.2;u+=.25){const [x,z]=roadPoint(u,.08),hit=first(new T.Vector3(x,4,z),new T.Vector3(x,0,z),root);
  assert(hit&&hit.point.y<=2.001&&hit.point.y>1.8,`fence ${hit?.point.y.toFixed(2)} m tall at ${u.toFixed(2)} m along the notch`);}
 // The fence runs the whole west line: from the plot's north-west corner to the notch, and along the lane to its south-west
 // corner wherever the garage and bin room are not.
 {const fenceAt=(x,z)=>{const hit=first(new T.Vector3(x,4,z),new T.Vector3(x,0,z),root);return hit&&hit.point.y<=2.001&&hit.point.y>1.8;};
  const [nx,nz]=sitePoint(441,220),[mx,mz]=sitePoint(336,399),len=Math.hypot(mx-nx,mz-nz),inward=[(mz-nz)/len,-(mx-nx)/len];
  // The first 1.3 m from the corner stand under the north hedge.
  for(let t=.1;t<=.99;t+=.01){const p=[nx+(mx-nx)*t+.08*inward[0],nz+(mz-nz)*t+.08*inward[1]];assert(fenceAt(...p),`the fence runs north to the corner, at ${p.map(q=>q.toFixed(2))}`);}
  for(const v of [.4,2.5,4.8,14.3,14.9]){const [x,z]=garagePoint(.08,v);assert(fenceAt(x,z),`the fence runs along the lane at ${v} m`);}}
 for(const [name,[a,b]] of [['garage-drive-gate',DRIVE_GATE],['garage-pedestrian-gate',PEDESTRIAN_GATE]]){const leaf=root.getObjectByName(name);assert(leaf&&visible(leaf),name);
  leaf.traverse(o=>{if(o.isMesh)assert(o.userData.passable,`${name} lets the walker through`);});
  const [x,z]=roadPoint((a+b)/2,.08),hit=first(new T.Vector3(x,3,z),new T.Vector3(x,0,z),root);assert(hit&&named(hit.object,name),`${name} spans its opening`);}
 for(const front of [false,true]){on({garage:true,front});
  for(const [x,z] of [sitePoint(355,516),sitePoint(296,618),sitePoint(352,410),sitePoint(388,300)]){const hit=first(new T.Vector3(x,4,z),new T.Vector3(x,0,z),root);
   assert(!hit||hit.point.y<.3,`with the arrival wall ${front?'on':'off'}, the old recessed wall is gone at ${[x,z].map(n=>n.toFixed(1))}`);}}
 on({front:true});{const [x,z]=sitePoint(355,516),hit=first(new T.Vector3(x,4,z),new T.Vector3(x,0,z),root);assert(hit&&hit.point.y>1.8,'the arrival wall alone keeps the recessed line');}
 on({});model.dispose();
 console.log(`Passed (${realistic?'realism':'natural'}): garage ${(BIN_ROOM.v1-GARAGE.v0).toFixed(1)} m on the road line at ${(garagePitch*180/Math.PI).toFixed(1)}°; ${bins.length} bins; ${cherries.length} cherries in bloom.`);
}
