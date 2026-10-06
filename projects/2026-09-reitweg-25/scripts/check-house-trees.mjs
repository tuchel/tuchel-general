import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Trees are drawn per instance: only those a camera can see (the view, and the pool's mirror when it is shown), and a
// tree whose leaves would each cover under LEAF_PIXELS pixels as its lighter leaf-card crown, which reads the same at
// that size. Shadows still come from every tree at full detail, and the path tracer still sees every tree.
await build({entryPoints:['lib/house-model/foliage.ts','lib/house-model/photographic-scene.ts'],outdir:'tmp/trees-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {foliageMaterials,buildTrees,drawTrees,LEAF_PIXELS}=await import('../tmp/trees-check/foliage.mjs');
const {photographicScene}=await import('../tmp/trees-check/photographic-scene.mjs');
assert(LEAF_PIXELS>=1&&LEAF_PIXELS<=2,'a leaf swaps only below about a pixel and a half');
const materials=foliageMaterials('leaves'),specs=[];
// A grid of near trees 20 m apart, from 0 to 400 m east of the camera, and a ring of distant ones.
for(let x=0;x<=400;x+=20)for(let z=-60;z<=60;z+=20)specs.push({x,z,r:3.5,height:10,seed:x*31+z,kind:z>0?'maple':'broadleaf'});
for(let a=0;a<40;a++)specs.push({x:Math.cos(a)*600,z:Math.sin(a)*600,r:4,height:12,seed:900+a,kind:'pine',far:true});
const group=buildTrees(specs,materials,'garden-trees');const scene=new T.Scene();scene.add(group);scene.updateMatrixWorld(true);
const camera=new T.PerspectiveCamera(36,16/10,.1,3000);camera.position.set(-5,1.65,0);camera.lookAt(10,1.65,0);camera.updateMatrixWorld();
const heightPx=1964,pixel=2*Math.tan(T.MathUtils.degToRad(camera.fov/2))/heightPx;
const counts=drawTrees(scene,[camera],pixel,camera);
const meshes=[];group.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});
const total=specs.length;
// Every visible tree is drawn once, either modelled or as a crown, with its bark; trees behind the camera are not.
const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
let visible=0;for(const s of specs){const sphere=new T.Sphere(new T.Vector3(s.x,s.height*.55,s.z),Math.max(s.height,s.r*2)*.62);if(frustum.intersectsSphere(sphere))visible++;}
assert.equal(counts.drawn,visible,`${counts.drawn} trees drawn, ${visible} in view`);
assert(counts.drawn<total*.75,`trees out of view are skipped (${counts.drawn} of ${total})`);
const bark=meshes.filter(m=>m.name==='tree-bark').reduce((s,m)=>s+m.count,0);assert.equal(bark,counts.drawn,'bark for each drawn tree');
const modelled=meshes.filter(m=>m.name==='tree-leaves').reduce((s,m)=>s+m.count,0),crowns=meshes.filter(m=>m.name==='tree-lod-core').reduce((s,m)=>s+m.count,0);
assert.equal(modelled+crowns+counts.farDrawn,counts.drawn,'each drawn tree has one crown');
// A crown stands in only where a leaf blade would cover under LEAF_PIXELS pixels: on a Retina-sized view, beyond a few
// hundred metres.
for(const m of meshes.filter(m=>m.name==='tree-lod-core')){const p=new T.Vector3(),q=new T.Matrix4();for(let i=0;i<m.count;i++){m.getMatrixAt(i,q);p.setFromMatrixPosition(q);const leaf=.15*q.getMaxScaleOnAxis()/(p.distanceTo(camera.position)*pixel);assert(leaf<LEAF_PIXELS,`a crown where a leaf covers ${leaf.toFixed(2)} px`);}}
for(const m of meshes.filter(m=>m.name==='tree-leaves')){const p=new T.Vector3(),q=new T.Matrix4();for(let i=0;i<m.count;i++){m.getMatrixAt(i,q);p.setFromMatrixPosition(q);const leaf=.15*q.getMaxScaleOnAxis()/(p.distanceTo(camera.position)*pixel);assert(leaf>=LEAF_PIXELS,`modelled leaves where a leaf covers ${leaf.toFixed(2)} px`);}}
assert(crowns>0&&modelled>0,'both kinds drawn in this deep view');
// Shadows: every tree casts at full detail; crowns cast none.
for(const m of meshes){
 if(m.name==='tree-lod-core'||m.name==='tree-lod-cards'){assert.equal(m.castShadow,false,'crowns cast no shadow');assert(m.userData.skipPhotographic,'the tracer skips crowns');continue;}
 m.onBeforeShadow();assert.equal(m.count,m.userData.instances,`${m.name} casts shadows from every tree`);m.onBeforeRender();
}
// The mirror's camera adds what it sees: a camera looking back west draws trees the first did not.
const back=camera.clone();back.lookAt(-20,1.65,0);back.updateMatrixWorld();
const both=drawTrees(scene,[camera,back],pixel,camera);assert(both.drawn>counts.drawn,'a second camera adds its trees');
// The path tracer sees every tree, whatever is drawn.
drawTrees(scene,[camera],pixel,camera);
const local=await photographicScene(scene,new T.Texture(),new AbortController().signal,()=>{},{instances:true});
let traced=0;local.scene.traverse(o=>{if(o.isInstancedMesh&&o.name==='tree-bark')traced+=o.count;});
assert.equal(traced,total,'the tracer gets every tree');local.dispose();
// Woodland trees (the stands round the garden) are built near their real size: an instance stands exactly as tall as
// asked, its crown reaching low as at a wood's edge (a birch's from about a third up), and its leaf cards keep about
// their real size whatever the tree's.
const stand={};
for(const [kind,low] of [['woodland',.25],['birch',.42],['spruce',.12]])for(const far of [false,true])for(const height of [6,14,24]){
 const r=kind==='spruce'?height*.15:kind==='birch'?height*.22:height*.35,g=buildTrees([{x:0,z:0,r,height,seed:4021,kind,far,base:-1}],materials,'stand-check');g.updateMatrixWorld(true);
 const crown=new T.Box3(),m=new T.Matrix4(),v=new T.Vector3();let cards=0,edge=0;
 g.traverse(o=>{if(!o.isInstancedMesh||o.name==='tree-bark')return;o.getMatrixAt(0,m);const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++)crown.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(m));
  if(o.name==='tree-leaf-cards')for(let i=0;i+5<p.count;i+=6){cards++;edge+=v.fromBufferAttribute(p,i).applyMatrix4(m).distanceTo(new T.Vector3().fromBufferAttribute(p,i+1).applyMatrix4(m));}});
 assert(cards>0,`${kind}: leaf cards`);
 assert(Math.abs(crown.max.y-(height-1))<height*.02,`${kind}${far?' (far)':''}: ${height} m asked, crown tops out at ${(crown.max.y+1).toFixed(2)} m`);
 assert(crown.min.y+1<height*low,`${kind}${far?' (far)':''}: crown reaches down to ${((crown.min.y+1)/height*100).toFixed(0)}% of its height`);
 const size=edge/cards;if(!far&&height===14)stand[kind]=size;
 assert(height<14||size>.4&&size<2.2,`${kind}${far?' (far)':''}: a ${height} m tree's leaf cards are ${size.toFixed(2)} m, about their real size`);
 g.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
}
console.log(`Passed: ${counts.drawn} of ${total} trees drawn for a view east (${modelled} modelled, ${crowns} as crowns beyond ${LEAF_PIXELS} px a leaf, ${counts.farDrawn} distant); every tree casts shadows; the mirror adds its own; the tracer sees all; woodland trees top out at the height asked, crowns reaching low, leaf cards about ${stand.woodland.toFixed(1)} m whatever the tree's size.`);
