import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The covered courtyard as photographed (IMG_1563, IMG_1431, photographs 15 and 69): its stone paving lies flush with the
// lawn beside it, and stone block steps lead up from it to the link's courtyard opening and the guest wing's two courtyard
// doors; the posts stand on stone plinths, and the fireplace and the loggia furniture on the paving. On the lawn beside the
// paving, a maple about 9 m tall forks low into several stems, its crown about 8 m across and clear of the roofs
// (photograph from the lawn south-west of the courtyard; the aerial photograph).
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/renovation-data.ts'],outdir:'tmp/courtyard-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/courtyard-check/${name}.mjs`);
const [{buildHouseModel},{planPoint:p},{renovationState}]=await Promise.all(['build-model','site-data','renovation-data'].map(load));
const ray=new T.Raycaster();
const top=(root,x,z)=>{const meshes=[];root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh){let shown=true;for(let q=o;q;q=q.parent)if(!q.visible)shown=false;if(shown)meshes.push(o);}});
 const ray=new T.Raycaster(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));ray.far=3.5;const hit=ray.intersectObjects(meshes,false).find(h=>!/roof|beam|post|rafter/.test(h.object.name||'')&&h.point.y<1);return hit;};
for(const realism of [false,true]){
 const model=buildHouseModel(realism),root=model.root;model.setRenovations(renovationState());model.setLevel('exterior');root.updateMatrixWorld(true);
 const mode=realism?'detailed':'model';
 // The paving: within 3 cm of the lawn (0.005 m), along the link and down the guest wing.
 for(const [x,z] of [p(600,760),p(700,800),p(420,950),p(400,1150)]){const h=top(root,x,z);assert(h&&h.point.y<.04&&h.point.y>-.01,`${mode}: the courtyard paving at (${x.toFixed(1)}, ${z.toFixed(1)}) lies flush with the lawn (${h?.point.y.toFixed(3)} m)`);}
 // A stone step in front of each courtyard door, its top about at the threshold, then the paving.
 const steps=[[p(464,667),p(811,667),7.9,'the link'],[p(367,671),p(316,1228),5.8,'the yoga room'],[p(367,671),p(316,1228),11.5,'the wellness room']];
 for(const [a,b,t,what] of steps){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,x=a[0]+ux*t,z=a[1]+uz*t;
  // Outward, away from the wing the wall belongs to: toward the courtyard.
  const centre=p(625,800),s=Math.sign((-uz)*(centre[0]-x)+ux*(centre[1]-z)),nx=-uz*s,nz=ux*s;
  const step=top(root,x+nx*.3,z+nz*.3),beyond=top(root,x+nx*.8,z+nz*.8);
  assert(step&&step.point.y>.1&&step.point.y<.17,`${mode}: a stone step at ${what}'s courtyard door (${step?.point.y.toFixed(3)} m)`);
  assert(beyond&&beyond.point.y<.04,`${mode}: the paving beyond ${what}'s step (${beyond?.point.y.toFixed(3)} m)`);}
 // The plinths and the fireplace reach down to the paving; each post stands on a plinth about 0.2 m tall and wider than
 // it; the lounge sits on the paving.
 const named=name=>{const list=[];root.traverse(o=>{if(o.name===name)list.push(o);});assert(list.length>0,name);return list;};
 for(const name of ['courtyard-post-plinth','courtyard-fireplace'])for(const o of named(name)){const y=new T.Box3().setFromObject(o).min.y;assert(Math.abs(y-.02)<.02,`${mode}: ${name} stands on the paving (${y.toFixed(3)} m)`);}
 {const plinths=named('courtyard-post-plinth').map(o=>new T.Box3().setFromObject(o)),posts=named('courtyard-post');assert.equal(plinths.length,posts.length,`${mode}: a plinth under each post`);
  for(const post of posts){const b=new T.Box3().setFromObject(post),c=b.getCenter(new T.Vector3()),under=plinths.find(q=>q.containsPoint(new T.Vector3(c.x,q.max.y-.01,c.z)));
   assert(under&&Math.abs(b.min.y-under.max.y)<.01&&under.max.y-under.min.y>.17&&under.max.y-under.min.y<.23,`${mode}: the post at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) stands on a plinth about 0.2 m tall`);
   assert(under.max.x-under.min.x>b.max.x-b.min.x+.03,`${mode}: the plinth is wider than its post`);}}
 if(realism){const lounge=[];root.traverse(o=>{if(o.userData.replacedBy==='courtyard')lounge.push(o);});assert(lounge.length>0,'the loggia furniture');
  for(const o of lounge){const y=new T.Box3().setFromObject(o).min.y;assert(y>-.005&&y<.06,`the loggia furniture stands on the paving (${y.toFixed(3)} m)`);}}
 if(realism){
  const roofs=[],v=new T.Vector3();root.traverse(o=>{if(o.isMesh&&/roof-slope/.test(o.name))roofs.push(o);});
  const near=[];for(const set of root.getObjectByName('garden-trees').userData.treeSets)set.matrices.forEach(matrix=>{const at=new T.Vector3().setFromMatrixPosition(matrix);if(Math.hypot(at.x+13.72,at.z-12.03)<1)near.push({set,matrix,at});});
  assert.equal(near.length,1,`one tree on the lawn beside the courtyard paving (${near.length})`);const [{set,matrix,at}]=near;assert.equal(set.kind,'maple','a maple beside the courtyard');
  const box=new T.Box3(),leaves=[];for(const mesh of [set.bark,...set.crowns]){const p=mesh.geometry.attributes.position;for(let k=0;k<p.count;k+=3){v.fromBufferAttribute(p,k).applyMatrix4(matrix);box.expandByPoint(v);if(mesh!==set.bark&&k%60===0)leaves.push(v.clone());}}
  const reach=Math.max(box.max.x-at.x,at.x-box.min.x,box.max.z-at.z,at.z-box.min.z);
  assert(box.max.y>8.5&&box.max.y<9.6,`the courtyard maple stands about 9 m (${box.max.y.toFixed(2)})`);assert(reach>3.5&&reach<4.7,`its crown reaches about 4 m (${reach.toFixed(2)})`);
  const up=new T.Vector3(0,1,0),under=leaves.filter(q=>{ray.set(q,up);ray.far=20;return ray.intersectObjects(roofs,false).length>0;});
  assert.equal(under.length,0,`the courtyard maple's leaves stay out from under the roofs (${under.length}, e.g. ${under[0]?.toArray().map(n=>n.toFixed(1)).join(', ')})`);
 }
 model.dispose();
}
console.log('Passed: the courtyard paving lies flush with the lawn, stone steps lead up to the link and guest-wing courtyard doors, the posts stand on stone plinths, the fireplace and loggia furniture on the paving, and the maple beside it is about 9 m tall and clear of the roofs.');
