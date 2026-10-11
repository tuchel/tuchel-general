import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The covered courtyard as photographed (IMG_1563, IMG_1431, photographs 15 and 69): its stone paving lies flush with the
// lawn beside it, and stone block steps lead up from it to the link's courtyard opening and the guest wing's two courtyard
// doors; the posts, the fireplace and the loggia furniture stand on the paving.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/renovation-data.ts'],outdir:'tmp/courtyard-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/courtyard-check/${name}.mjs`);
const [{buildHouseModel},{planPoint:p},{renovationState}]=await Promise.all(['build-model','site-data','renovation-data'].map(load));
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
 // The loggia posts and the fireplace reach down to the paving; the lounge sits on it.
 for(const name of ['courtyard-post','courtyard-fireplace']){const list=[];root.traverse(o=>{if(o.name===name)list.push(o);});assert(list.length>0,name);
  for(const o of list){const y=new T.Box3().setFromObject(o).min.y;assert(Math.abs(y-.02)<.02,`${mode}: ${name} stands on the paving (${y.toFixed(3)} m)`);}}
 if(realism){const lounge=[];root.traverse(o=>{if(o.userData.replacedBy==='courtyard')lounge.push(o);});assert(lounge.length>0,'the loggia furniture');
  for(const o of lounge){const y=new T.Box3().setFromObject(o).min.y;assert(y>-.005&&y<.06,`the loggia furniture stands on the paving (${y.toFixed(3)} m)`);}}
 model.dispose();
}
console.log('Passed: the courtyard paving lies flush with the lawn, stone steps lead up to the link and guest-wing courtyard doors, and the posts, fireplace and loggia furniture stand on the paving.');
