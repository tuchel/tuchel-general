import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The trees follow the sun study's date. Those that shed open in April, turn from mid-September and stand bare from
// late November; evergreens do not change; midsummer, the model's opening date, is exactly as it was built.
await build({entryPoints:['lib/house-model/foliage.ts'],outfile:'tmp/seasons-check.mjs',bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {foliageMaterials,buildTrees,seasonTrees,shedOn,leafTint,SHED}=await import('../tmp/seasons-check.mjs');
const JAN=15,APR=110,JUN=172,OCT=288,DEC=345;
assert.equal(shedOn(JUN),0);assert.equal(shedOn(OCT),0,'October trees are in full leaf');assert.equal(shedOn(JAN),1);assert.equal(shedOn(DEC),1);
assert(shedOn(APR)>0&&shedOn(APR)<1,'mid-April leaves are half out');
for(const kind of ['broadleaf','maple','hawthorn','cherry','woodland','birch'])for(const v of [0,.3,.99]){
 assert.deepEqual(leafTint(kind,JUN,v),[1,1,1],`${kind} keeps its summer colour in June`);
 const [r,g,b]=leafTint(kind,OCT,v);assert(r>g&&g>b&&r/b>(v<.3?1.1:1.5),`${kind} has turned by mid-October (${[r,g,b].map(n=>n.toFixed(2))})`);
 const first=leafTint(kind,SHED.turn[0]-SHED.spread,v);assert.deepEqual(first,[1,1,1],'no tree turns before the turn, however early it runs');
}
{const [r,g]=leafTint('birch',OCT,.5),[mr,mg]=leafTint('maple',OCT,.5);assert(g/r>.6,'birches turn yellow');assert(mg/mr<.4,'the Japanese maple turns red');}
{const [r,g,b]=leafTint('woodland',APR+10,.5);assert(g>1&&b<1,'spring leaf is a fresher, yellower green');}

const materials=foliageMaterials('leaves'),specs=[];
for(const [i,kind] of ['broadleaf','maple','birch','woodland','spruce','pine','cherry'].entries())for(let k=0;k<3;k++)specs.push({x:i*10,z:k*10,r:3,height:9,seed:i*7+k,kind,far:kind==='woodland'});
const root=buildTrees(specs,materials,'garden-trees'),sets=root.userData.treeSets;
const colours=()=>sets.map(s=>s.colors.map(c=>c.toArray().join()).join(';')),summer=colours();
const meshes=set=>[...set.crowns,...set.lod??[]],sheds=set=>!['spruce','pine'].includes(set.kind);
assert(sets.some(s=>s.lod)&&sets.some(s=>!s.lod),'modelled and card trees are both in the sample');
for(const set of sets)for(const m of meshes(set))if(m.name.includes('cards'))assert.equal(m.material,sheds(set)?materials.fall.leaves:materials.leaves,`${set.kind} cards wear the ${sheds(set)?'shedding':'evergreen'} leaf`);

seasonTrees(root,materials,OCT);
assert.equal(materials.fall.shed.value,0);
sets.forEach((set,i)=>{if(sheds(set))assert.notEqual(colours()[i],summer[i],`${set.kind} changes colour in October`);else assert.equal(colours()[i],summer[i],`${set.kind} is evergreen`);
 assert(meshes(set).every(m=>m.visible)&&!set.bare,'every crown is still drawn in October');});

seasonTrees(root,materials,JAN);
assert.equal(materials.fall.shed.value,1);
for(const set of sets){
 if(!sheds(set)){assert(meshes(set).every(m=>m.visible)&&!set.bare,`${set.kind} keeps its crown in January`);continue;}
 assert(set.bare,`${set.kind} is bare in January`);
 for(const m of meshes(set)){const card=m.material===materials.fall.leaves;
  assert.equal(m.visible,card,`${m.name}: only thinned leaf cards are left on a bare tree`);
  if(card)assert(m.userData.skipPhotographic,'the path tracer sees a bare tree as limbs alone');}
 for(const m of set.lod??[])if(m.material===materials.fall.leaves)assert(m.castShadow,'a bare modelled tree casts its thinned crown');
 assert(set.bark.visible,'limbs stay');
}

seasonTrees(root,materials,JUN);
assert.deepEqual(colours(),summer,'midsummer returns exactly');assert.equal(materials.fall.shed.value,0);
for(const set of sets){assert(meshes(set).every(m=>m.visible)&&!set.bare);
 for(const m of set.lod??[])assert(!m.castShadow&&m.userData.skipPhotographic,'the distant crown of a modelled tree is again shadowless and untraced');
 for(const m of set.crowns)assert(!m.userData.skipPhotographic,'crowns are traced again');}
console.log('Passed: leaf opens in April, turns from mid-September and is down by December; evergreens hold; midsummer is unchanged.');
