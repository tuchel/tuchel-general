import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import * as T from 'three';
fs.mkdirSync('tmp/renovation-check',{recursive:true});
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/solar-layout.ts','lib/house-model/renovation-data.ts','lib/house-model/site-data.ts'],outdir:'tmp/renovation-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildHouseModel}=await import('../tmp/renovation-check/build-model.mjs');
const {solarPanels,solarRoofs,solarModule,roofSkylights}=await import('../tmp/renovation-check/solar-layout.mjs');
const {renovationState}=await import('../tmp/renovation-check/renovation-data.mjs');
const realistic=process.argv.includes('--realism');
const model=buildHouseModel(realistic),ids=Object.keys(renovationState());
if(realistic){assert(model.root.getObjectByName('tree-leaves'),'instanced modelled-leaf trees');assert(model.root.getObjectByName('hedge-leaf-cards'),'leafy hedge');}
const visible=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};
model.setLevel('exterior');model.setRenovations(renovationState());
const snapshot=()=>{const data=[];model.root.traverse(o=>data.push([o.uuid,o.visible,...o.position.toArray(),...o.scale.toArray(),...(o.isInstancedMesh?o.instanceMatrix.array:[])]));return data;};
const before=snapshot();
for(let bits=0;bits<1<<ids.length;bits++){
 const state=Object.fromEntries(ids.map((id,i)=>[id,!!(bits&(1<<i))]));model.setRenovations(state);
 for(const level of ['exterior','ground','upper','basement']){
  model.setLevel(level);
  for(const id of ids){const group=model.root.getObjectByName('renovation-'+id);assert(group);assert.equal(visible(group),state[id]&&(id==='front'?level!=='basement':['exterior','ground','upper'].includes(level)),`${bits}/${level}/${id}`);}
  assert.equal(visible(model.root.getObjectByName('renovation-solar-roofs')),state.solar&&['exterior','upper'].includes(level));
  assert.equal(visible(model.root.getObjectByName('renovation-kitchen-roof')),state.kitchen&&['exterior','upper'].includes(level));
  model.root.traverse(o=>{if(o.userData.replacedBy)assert.equal(o.visible,!state[o.userData.replacedBy]);});
 }
}
model.setLevel('exterior');model.setRenovations(renovationState());assert.deepEqual(snapshot(),before,'all original visibility, geometry and meadow instances restore');
assert.equal(solarPanels.length,50);let count=0;model.root.traverse(o=>{if(o.name.startsWith('solar-module-'))count++;});assert.equal(count,50);
for(const roof of solarRoofs){const span=Math.hypot(roof.width/2,roof.ridge-roof.eave),panels=solarPanels.filter(p=>p.roof===roof.id);
 for(const panel of panels){assert(panel.u-solarModule.width/2>=.45-1e-8);assert(panel.u+solarModule.width/2<=span-.45+1e-8);assert(Math.abs(panel.z)+solarModule.length/2<=roof.length/2-.45+1e-8);
  for(const w of roofSkylights(roof.id).filter(w=>w.side===panel.side))assert(Math.abs(panel.u-w.fraction*span)>=(solarModule.width+1.4)/2+.25||Math.abs(panel.z-w.z)>=(solarModule.length+.78)/2+.25,'panel clears skylight');
 }
 for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++){const a=panels[i],b=panels[j];if(a.side===b.side)assert(Math.abs(a.u-b.u)>=solarModule.width+.024||Math.abs(a.z-b.z)>=solarModule.length+.024,'panels do not overlap');}
}
model.root.updateMatrixWorld(true);
if(realistic){const ray=new T.Raycaster();for(const roof of solarRoofs)for(const win of roofSkylights(roof.id)){
 const mesh=model.root.getObjectByName(roof.id+'-roof-slope-'+win.side),half=roof.width/2,rise=roof.ridge-roof.eave;
 const local=new T.Vector3(win.side*half*win.fraction,roof.ridge-rise*win.fraction,win.z),normal=new T.Vector3(win.side*rise,half,0).normalize();
 const start=local.clone().add(normal).applyMatrix4(mesh.parent.matrixWorld),end=local.clone().sub(normal).applyMatrix4(mesh.parent.matrixWorld);ray.set(start,end.clone().sub(start).normalize());ray.far=start.distanceTo(end);
 assert.equal(ray.intersectObject(mesh,false).length,0,'skylight is an actual hole through the roof');
 const solid=new T.Vector3(win.side*half*.15,roof.ridge-rise*.15,-roof.length/2+.3);ray.set(solid.clone().add(normal).applyMatrix4(mesh.parent.matrixWorld),normal.clone().negate().transformDirection(mesh.parent.matrixWorld));assert(ray.intersectObject(mesh,false).length>0,'roof surface winding faces the sky on both slopes');
}}
model.root.traverse(o=>{for(const n of o.matrixWorld.elements)assert(Number.isFinite(n));});model.dispose();
const study=JSON.parse(fs.readFileSync('public/assets/solar-feasibility.json','utf8'));
const load=study.scenarios.find(s=>s.name==='Working case').annualDemand;
for(const b of study.batteries){const standby=b.units*.01*study.hours/19;assert(Math.abs(study.annualPV+b.annualImport-load-standby-b.annualExport-b.annualBatteryLoss-b.endingSocKwh/19)<.001,'hourly energy conservation');}
assert.equal(study.scenarios[1].components.cars,2000);
assert.equal(study.scenarios[1].components.existingElectricity, (412*12-180)/.35);
assert.equal(Object.keys(study.scenarios[1].components).length,2,'no new heating or cooling loads');
for(const b of study.fullRoof.batteries){const standby=b.units*.01*study.hours/19;assert(Math.abs(study.fullRoof.annualPV+b.annualImport-load-standby-b.annualExport-b.annualBatteryLoss-b.endingSocKwh/19)<.001,'full-roof energy conservation');}
assert(Math.abs(study.monthly.reduce((sum,m)=>sum+m.generation,0)-study.annualPV)<.001);
// The east glazing wraps the south wall on both sides of the retained fireplace; the pier beside it stays solid.
model.setLevel('exterior');model.setRenovations({...renovationState(),east:true});model.root.updateMatrixWorld(true);
const southRay=new T.Raycaster(),southAt=x=>{southRay.set(new T.Vector3(x,.6,10.4),new T.Vector3(0,0,-1));southRay.far=1.6;return southRay.intersectObject(model.root,true).filter(h=>h.object.isMesh&&visible(h.object));};
for(const x of [-4.5,-2.5,2.5,4.5]){const hits=southAt(x);assert(hits.length&&hits.every(h=>[h.object.material].flat().every(m=>m.transparent)),`south wall at x ${x} is glazed`);}
assert(southAt(-.7).some(h=>[h.object.material].flat().some(m=>!m.transparent)),'the pier west of the fireplace stays solid');
// Upstairs, the opened east façade glazes the master bedroom's gable from the chimney to the knee wall, up to about 3 m
// and under the roof slope; the original keeps its single window, and the wall beside the chimney stays solid.
const gableAt=(x,y)=>{southRay.set(new T.Vector3(x,y,8.6),new T.Vector3(0,0,1));southRay.far=1.4;return southRay.intersectObject(model.root,true).filter(h=>h.object.isMesh&&visible(h.object));};
const opaque=hits=>hits.some(h=>[h.object.material].flat().some(m=>!m.transparent));
const opened=[[.75,3.3],[1.2,5.95],[3.3,4.2],[3,4.9],[4.7,3.35],[4.3,3.8]];
for(const east of [false,true]){model.setRenovations({...renovationState(),east});model.setLevel('exterior');model.root.updateMatrixWorld(true);
 for(const [x,y] of opened)assert.equal(opaque(gableAt(x,y)),!east,`gable at x ${x}, y ${y} is ${east?'glazed':'solid'} with the east façade ${east?'on':'off'}`);
 assert(opaque(gableAt(.3,4.5)),'the wall beside the chimney stays solid');assert(opaque(gableAt(1,6.45)),'the gable above the new glass stays solid');}
model.setRenovations(renovationState());
// The reading and office nook takes the dining alcove: bookshelves, a sofa and a desk inside the alcove's walls, the hall
// doorway and the opening to the family room kept clear, the same with the east façade open or closed.
{const {planPoint:p}=await import('../tmp/renovation-check/site-data.mjs'),nook=model.root.getObjectByName('renovation-nook'),alcove=model.root.getObjectByName('dining-alcove');
 assert(nook&&alcove,'reading nook and original dining alcove exist');for(const part of ['nook-bookshelves','nook-sofa','nook-desk'])assert(nook.getObjectByName(part),`nook has ${part}`);
 const [w,n]=p(1052,526),[e,s]=p(1218,666),probe=new T.Raycaster(),across=(a,b,y)=>{const u=new T.Vector3(a[0],y,a[1]),v=new T.Vector3(b[0],y,b[1]);probe.set(u,v.clone().sub(u).normalize());probe.far=u.distanceTo(v);return probe.intersectObject(nook,true).filter(h=>h.object.isMesh);};
 for(const east of [false,true]){model.setRenovations({...renovationState(),east,nook:true});model.setLevel('exterior');model.root.updateMatrixWorld(true);
  assert(visible(nook)&&!visible(alcove),'nook shows and the dining table goes');const box=new T.Box3().setFromObject(nook);
  assert(box.min.x>=w-.01&&box.max.x<=e+.01&&box.min.z>=n-.01&&box.max.z<=s+.01,`nook stays inside the alcove (${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}, ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)})`);
  for(const y of [.3,.8])assert.equal(across(p(1040,641),p(1150,641),y).length,0,`hall doorway into the nook is clear at ${y} m`);
  for(const y of [.3,.8])assert.equal(across(p(1140,600),p(1140,700),y).length,0,`opening to the family room is clear at ${y} m`);}
 model.setRenovations(renovationState());}
// The timber arrival wall follows the house: upright slats (a ray skimming the face crosses one every ~12 cm) in the
// main house's own cladding colour and photographed finish.
{const {sitePoint}=await import('../tmp/renovation-check/site-data.mjs');model.setRenovations({...renovationState(),front:true});model.setLevel('exterior');model.root.updateMatrixWorld(true);
 const wall=model.root.getObjectByName('proposed-timber-roadside-wall');assert(wall&&visible(wall),'timber arrival wall shows');
 const a=sitePoint(441,220),b=sitePoint(336,399),len=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/len,(b[1]-a[1])/len],n=[-u[1],u[0]];
 for(const side of [1,-1]){const start=new T.Vector3(a[0]+u[0]*.5+n[0]*side*.065,1.2,a[1]+u[1]*.5+n[1]*side*.065);southRay.set(start,new T.Vector3(u[0],0,u[1]));southRay.far=len-1;
  const crossings=southRay.intersectObject(wall,true).filter(h=>h.object.isMesh).length;assert(crossings>(len-1)/.3,`arrival wall slats are upright on both faces (${crossings} crossings over ${(len-1).toFixed(1)} m)`);}
 const house=model.root.getObjectByName('main-roof-wall-0').material,slat=model.root.getObjectByName('arrival-wall-slats')?.material;
 assert(slat&&slat.userData.photo==='cladding'&&slat.color.equals(house.color),'arrival wall slats share the house cladding');
 model.setRenovations(renovationState());}
console.log(`Passed: all ${1<<ids.length} renovation combinations across four floors; original scene and meadow restored; 50 panels clear skylights, perimeter and each other; finite transforms; south glazing on both sides of the fireplace, and the master bedroom gable glazed from the chimney to the knee wall; the reading nook replaces the dining alcove with bookshelves, a sofa and a desk, clear of the doorways, with or without the east façade; the arrival wall has upright slats in the house cladding.`);
