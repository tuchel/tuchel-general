import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Office Nook Window Expansion (renovation option): the dining alcove's east window and garden door become one fixed pane
// from the floor, in the oak-inside, black-outside frame. The east façade option no longer changes that stretch of wall.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/renovation-data.ts'],outdir:'tmp/nook-window-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/nook-window-check/build-model.mjs');
const {renovations,offered,renovationState}=await import('../tmp/nook-window-check/renovation-data.mjs');

const option=renovations.find(r=>r.id==='nookWindow');
assert(option&&offered.includes(option),'the nook window is offered in the Changes panel');
assert.equal(option.title,'Office Nook Window Expansion');

const visible=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};
const glassy=h=>[h.object.material].flat().every(m=>m.transparent);
for(const realistic of [false,true]){
 const model=buildHouseModel(realistic),ray=new T.Raycaster();
 // From inside the alcove, looking east at the wall (metres south of the house's middle).
 const firstAt=(z,y)=>{ray.set(new T.Vector3(5,y,z),new T.Vector3(1,0,0));ray.far=1.6;return ray.intersectObject(model.root,true).find(h=>h.object.isMesh&&visible(h.object));};
 const show=state=>{model.setRenovations({...renovationState(),...state});model.setLevel('exterior');model.root.updateMatrixWorld(true);};
 // Below the window's sill, between window and door, and through the door: wall, wall, glass as built.
 const spots=[[1.1,.5],[2,1.5],[2,.5],[3,1.5]];
 for(const east of [false,true]){show({east});
  for(const [z,y] of spots){const hit=firstAt(z,y),door=z===3;assert(hit&&glassy(hit)===door,`as built${east?' with the east façade open':''}, z ${z} y ${y} is ${door?'glass':'wall'}`);}}
 // With the option, all of it is one pane, the east façade open or not, and nothing divides it.
 for(const east of [false,true]){show({east,nookWindow:true});
  for(const [z,y] of [...spots,[.9,1.9],[1.7,.3],[2.4,1],[3.3,2]]){const hit=firstAt(z,y);assert(hit&&glassy(hit),`with the option${east?' and the east façade':''}, z ${z} y ${y} is glass (${hit?.object.name||hit?.object.material?.color?.getHexString?.()})`);}}
 // The pane runs from the window's north jamb to the door's south jamb, and stops at the head.
 show({nookWindow:true});
 const N=-9.61,from=N+10.3,to=N+13;
 for(const [z,y] of [[from-.12,1],[to+.12,1],[2,2.45]]){const hit=firstAt(z,y);assert(hit&&!glassy(hit),`solid around the pane at z ${z.toFixed(2)}, y ${y}`);}
 // Its frame is oak on the room side and black outside.
 if(realistic){const oak=model.root.getObjectByName('window-bench')?.material.color.getHexString();
  // Past the plastered reveal, the first framed piece: the jamb.
  ray.set(new T.Vector3(5,1,from+.03),new T.Vector3(1,0,0));ray.far=1.6;const jamb=ray.intersectObject(model.root,true).find(h=>visible(h.object)&&Array.isArray(h.object.material));assert(jamb,'a jamb at the north edge');
  const face=[jamb.object.material].flat()[jamb.face.materialIndex];assert.equal(face.color.getHexString(),oak,'the jamb is oak inside');
  ray.set(new T.Vector3(7,1,from+.03),new T.Vector3(-1,0,0));ray.far=1.3;const out=ray.intersectObject(model.root,true).find(h=>h.object===jamb.object);
  const outside=out&&[out.object.material].flat()[out.face.materialIndex];assert(outside&&outside.color.getHexString()!==oak,'and dark outside');}
}
console.log('Passed: Office Nook Window Expansion is offered; as built, the alcove keeps its window and garden door with the east façade open or closed; with the option, one pane from the floor runs from the window\'s north jamb to the door\'s south jamb in a frame of oak inside and black outside.');
