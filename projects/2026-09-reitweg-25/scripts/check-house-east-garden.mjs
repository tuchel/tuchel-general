import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The garden east and north-east of the main house, as photographed from the east meadow, the east terrace and the lawn
// by the north hedge, and placed on the aerial photograph: a broad mugo pine in the east lawn; a tall Japanese maple
// over the south-east corner; a Japanese dogwood, a second, smaller mugo pine and a pale boulder in front of the north
// hedge; two small hawthorns by the north-east corner; a low clipped yew hedge along the east terrace, with fountain grass
// between it and the wall; and no trees where the grounds plan drew two in the meadow north-east of the house.
await build({entryPoints:['lib/house-model/build-model.ts'],outdir:'tmp/east-garden-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/east-garden-check/build-model.mjs');
const model=buildHouseModel(true),root=model.root;root.updateMatrixWorld(true);
const trees=root.getObjectByName('garden-trees');assert(trees,'garden trees');
// Every garden tree: where its trunk stands, how tall it is and how far and how low its crown reaches.
const found=[],v=new T.Vector3(),m=new T.Matrix4();
for(const set of trees.userData.treeSets)set.matrices.forEach(matrix=>{const at=new T.Vector3().setFromMatrixPosition(matrix),box=new T.Box3();
 for(const mesh of [set.bark,...set.crowns]){const p=mesh.geometry.attributes.position;for(let k=0;k<p.count;k+=3)box.expandByPoint(v.fromBufferAttribute(p,k).applyMatrix4(matrix));}
 // Leaves under the main house's roof (eaves ±6.55 × ±10.1, ridge 8 m), and of those, inside its walls (±6 × ±9.6).
 let under=0,rooms=0;for(const mesh of set.crowns){const p=mesh.geometry.attributes.position;for(let k=0;k<p.count;k++){v.fromBufferAttribute(p,k).applyMatrix4(matrix);if(Math.abs(v.x)<6.55&&Math.abs(v.z)<10.1&&v.y<2.95+(6.55-Math.abs(v.x))*(8-2.95)/6.55){under++;if(Math.abs(v.x)<6&&Math.abs(v.z)<9.6)rooms++;}}}
 found.push({x:at.x,z:at.z,top:box.max.y,low:box.min.y,under,rooms,reach:Math.max(box.max.x-at.x,at.x-box.min.x,box.max.z-at.z,at.z-box.min.z)});});
const near=(x,z,d=1)=>found.filter(t=>Math.hypot(t.x-x,t.z-z)<d);
const one=(name,x,z,[lo,hi],[rlo,rhi])=>{const list=near(x,z);assert.equal(list.length,1,`${name}: one tree at (${x}, ${z}), found ${list.length}`);const [t]=list;
 assert(t.top>lo&&t.top<hi,`${name}: ${t.top.toFixed(2)} m tall, photographed ${lo}–${hi} m`);assert(t.reach>rlo&&t.reach<rhi,`${name}: crown reaches ${t.reach.toFixed(2)} m, photographed ${rlo}–${rhi} m`);return t;};
// The broad mugo pine in the east lawn: a dome of needles about 2.5 m tall and 4.5 m across, down to the grass.
const mugo=one('mugo pine',21.1,6.4,[2.3,2.75],[1.9,2.7]);assert(mugo.low<.4,`the mugo pine's needles reach the lawn (${mugo.low.toFixed(2)} m)`);
// The Japanese maple over the south-east corner: about 8 m tall, its crown from z 8.2 to 15.6, reaching over the eaves
// but not into the rooms beneath the roof.
const maple=one('Japanese maple',5.8,11.9,[7.5,8.6],[3.3,4.3]);assert.equal(maple.rooms,0,`the maple's leaves stay out of the rooms under the roof (${maple.rooms} leaf points inside)`);
assert(!found.some(t=>t!==maple&&t.under>0),'no other garden tree reaches into the roof');
// In front of the north hedge: the Japanese dogwood, the second mugo pine beside the boulder; two hawthorns.
one('Japanese dogwood',11.8,-12.6,[4.2,4.9],[2.1,2.9]);
const small=one('second mugo pine',13.6,-12.0,[1.6,2.1],[.9,1.5]);assert(small.low<.4,'the second mugo pine reaches the ground');
one('hawthorn by the north-east corner',7.8,-9.3,[3.6,4.4],[1.5,2.3]);
one('hawthorn in the north-east lawn',11.7,-7.4,[3.6,4.4],[2,2.8]);
// No trees where the grounds plan drew two north-east of the house, nor a tall one where the mugo pine stands.
for(const [x,z] of [[19.4,-8.3],[21.7,-9.6]])assert.equal(near(x,z,2.5).length,0,`no tree at (${x}, ${z})`);
assert(!found.some(t=>Math.hypot(t.x-21.1,t.z-6.4)<5&&t.top>3),'nothing tall where the mugo pine stands');
// The low clipped yew hedge along the terrace's east edge, about 0.7 m tall, from the north-east corner to the fountain
// grass's middle; the grass, about 0.8 m tall, between it and the wall.
const yew=root.getObjectByName('east-terrace-yew-hedge');assert(yew,'the yew hedge along the east terrace');
const bodies=[];yew.traverse(o=>{if(o.name==='hedge-body')bodies.push(o);});
const ray=new T.Raycaster(),top=(x,z,list=bodies)=>{ray.set(new T.Vector3(x,4,z),new T.Vector3(0,-1,0));return ray.intersectObjects(list,false)[0]?.point.y;};
for(let z=-10.5;z<=-2;z+=.5){const y=top(9,z);assert(y>.6&&y<.8,`the yew hedge stands about 0.7 m tall at z ${z} (${y?.toFixed(2)} m)`);}
for(const z of [-12,0])assert.equal(top(9,z),undefined,`the yew hedge ends short of z ${z}`);
for(const x of [7.6,10.4])assert.equal(top(x,-6),undefined,`the yew hedge is about 0.9 m wide (clear at x ${x})`);
const grass=[];root.traverse(o=>{if(o.isInstancedMesh&&o.name==='fountain-grass')grass.push(o);});assert(root.getObjectByName('fountain-grass-plumes')?.count>0,'the fountain grass flowers');
{let n=0,sum=0;for(const g of grass)for(let i=0;i<g.count;i++){g.getMatrixAt(i,m);const p=new T.Vector3().setFromMatrixPosition(m);if(p.x>6.7&&p.x<8.5&&p.z>-3&&p.z<1.7){n++;sum+=new T.Vector3().setFromMatrixScale(m).y;}}
 assert(n>150,`fountain grass between the yew hedge and the wall (${n} clumps)`);assert(sum/n>.7&&sum/n<.95,`the fountain grass stands about 0.8 m tall (${(sum/n).toFixed(2)} m)`);}
// The boulder in front of the north hedge: about 2.5 m long and 1.15 m high.
const boulder=root.getObjectByName('garden-boulder');assert(boulder,'the boulder');
{const b=new T.Box3().setFromObject(boulder),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
 assert(Math.hypot(c.x-12,c.z+11.2)<.6,`the boulder stands at (12, -11.2) (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
 assert(size.y>1&&size.y<1.3,`the boulder is about 1.15 m high (${size.y.toFixed(2)})`);assert(Math.max(size.x,size.z)>2.2&&Math.max(size.x,size.z)<2.8,'about 2.5 m long');}
// By the loggia's south end: a dwarf red Japanese maple, its leaves deep red, beside a smaller boulder.
{const list=[];for(const set of trees.userData.treeSets)set.matrices.forEach((matrix,i)=>{const at=new T.Vector3().setFromMatrixPosition(matrix);if(Math.hypot(at.x+15,at.z-21)<1)list.push(set.colors[i]);});
 assert.equal(list.length,1,'a red Japanese maple by the loggia');assert(list[0].r>list[0].g*2,'its leaves are red');
 const red=one('red Japanese maple',-15,21,[1.1,1.5],[1,1.8]);assert(red.top<1.6,'a dwarf');
 const stone=root.getObjectByName('loggia-boulder');assert(stone,'the boulder beside it');const c=new T.Box3().setFromObject(stone).getCenter(new T.Vector3());assert(Math.hypot(c.x+14.1,c.z-21.3)<.5,'beside the maple');}
console.log('Passed: the photographed mugo pines, Japanese maple, Japanese dogwood and hawthorns stand where and as tall as photographed; the yew hedge, fountain grass and boulder; the red Japanese maple by the loggia; no trees where none grow.');
