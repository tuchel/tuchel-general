import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import * as T from 'three';
fs.mkdirSync('tmp/renovation-check',{recursive:true});
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/solar-layout.ts','lib/house-model/renovation-data.ts'],outdir:'tmp/renovation-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
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
for(let bits=0;bits<64;bits++){
 const state=Object.fromEntries(ids.map((id,i)=>[id,!!(bits&(1<<i))]));model.setRenovations(state);
 for(const level of ['exterior','ground','upper','basement']){
  model.setLevel(level);
  for(const id of ids){const group=model.root.getObjectByName('renovation-'+id);assert(group);assert.equal(visible(group),state[id]&&(id==='front'?level!=='basement':['exterior','ground','upper'].includes(level)),`${bits}/${level}/${id}`);}
  assert.equal(visible(model.root.getObjectByName('renovation-solar-roofs')),state.solar&&level==='exterior');
  assert.equal(visible(model.root.getObjectByName('renovation-kitchen-roof')),state.kitchen&&level==='exterior');
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
console.log('Passed: all 64 renovation combinations across four floors; original scene and meadow restored; 50 panels clear skylights, perimeter and each other; finite transforms.');
