import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Nothing may break through a roof: seen from above, every wall, window frame and beam lies
// under the roof surface, except the parts meant to stand on it (ridge caps, eave fascias, chimney).
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts'],outdir:'tmp/roof-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/roof-check/build-model.mjs');
const onRoof=new Set(['roof-ridge-cap','roof-eave-fascia','chimney']);
const {planPoint:p}=await import('../tmp/roof-check/site-data.mjs');
const within=(x,z,pts)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,zi]=pts[i],[xj,zj]=pts[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;};
for(const realism of [false,true]){
 const model=buildHouseModel(realism);model.setLevel('exterior');model.root.updateMatrixWorld(true);
 const roofs=[],windows=[];model.root.traverse(o=>{if(o.isMesh&&o.name.includes('roof-slope'))roofs.push(o);if(o.isMesh&&o.parent?.name==='open-roof-window')windows.push(o);});
 const shown=o=>{for(let a=o;a;a=a.parent){if(a===model.trees||a===model.site)return false;if(!a.visible&&a!==model.upper)return false;}return true;};
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),faults=[];
 model.root.traverse(o=>{
  if(!o.isMesh||o.name.includes('roof-slope')||onRoof.has(o.name)||!shown(o))return;
  const box=new T.Box3().setFromObject(o);if(box.max.y<2.5)return;
  const frame=o.parent?.name==='open-roof-window',points=[];
  for(let i=0;i<=10;i++)for(let j=0;j<=4;j++){
   if(o.geometry.type==='BoxGeometry'){const v=new T.Vector3(-.5+i/10,.5,-.5+j/4).applyMatrix4(o.matrixWorld);points.push([v.x,v.z]);}
   else points.push([box.min.x+(box.max.x-box.min.x)*i/10,box.min.z+(box.max.z-box.min.z)*j/4]);
  }
  for(const [x,z] of points){
   // Roof windows close their openings, so anything under one is inside; frames are checked against the slope itself.
   ray.set(new T.Vector3(x,40,z),down);const hits=ray.intersectObjects([o,...roofs,...(frame?[]:windows)],false);
   if(hits[0]?.object!==o)continue;const below=hits.find(h=>h.object!==o);if(!below)continue;
   // Measure against the upper face of the slope, not the sides of an opening.
   if(below.face&&below.face.normal.clone().transformDirection(below.object.matrixWorld).y<.7)continue;
   const rise=hits[0].point.y-below.point.y,under=below.object.name||'a roof window';
   // Roof-window frames stand about 12 cm proud of the slope; rays through the opening meet a roof far below.
   if(frame&&(rise<=.15||rise>.5))continue;
   if(rise>.005)faults.push(`${o.name||o.parent?.name||'mesh'} rises ${rise.toFixed(3)} m through ${under} at x ${x.toFixed(1)}, z ${z.toFixed(1)}`);
  }
 });
 assert.equal(faults.length,0,`${realism?'detailed':'model'}: ${faults.slice(0,5).join('; ')}`);
 // The entrance roof dies into the main and guest roofs: inside either house, none of it hangs below their roof.
 const {guestRoofFrame:gf}=await import('../tmp/roof-check/site-data.mjs');
 const mainUnder=x=>8-5.36*Math.abs(x)/6.55-.045,guestHalf=(gf.width+.18)/2;
 const guestUnder=(x,z)=>{const dx=x-gf.center[0],dz=z-gf.center[1];return 6.75-(6.75-2.94)*Math.abs(dx*Math.cos(gf.rotation)-dz*Math.sin(gf.rotation))/guestHalf-.045;};
 const link=model.root.getObjectByName('link-roof'),inLink=[];assert(link,'entrance roof exists');link.traverse(o=>{if(o.isMesh)inLink.push(o);});
 const guestPlan=[[116,535],[475,573],[461,668],[367,671],[316,1228],[49,1208]].map(([x,z])=>p(x,z)),inside=[];
 for(let x=-16;x<=-3;x+=.25)for(let z=.5;z<=7;z+=.25){const main=x>-5.95&&x<5.95&&z>-9.55&&z<9.55,guest=within(x,z,guestPlan);if(main||guest)inside.push([x,z,main?mainUnder(x):guestUnder(x,z)]);}
 const hanging=[];for(const [x,z,under] of inside){ray.set(new T.Vector3(x,2,z),new T.Vector3(0,1,0));ray.far=8;const h=ray.intersectObjects(inLink,false).find(h=>h.point.y<under-.01);if(h)hanging.push(`${h.object.name||h.object.parent?.name||'mesh'} at x ${x.toFixed(2)}, z ${z.toFixed(2)}, ${h.point.y.toFixed(2)} m`);}
 assert.equal(hanging.length,0,`${realism?'detailed':'model'}: the entrance roof hangs inside a house: ${hanging.slice(0,4).join('; ')}`);
 // Rafters frame the roof windows and never cross one: nothing timber between a room and the glass.
 if(realism){
  const rafters=[];model.root.traverse(o=>{if(o.name==='roof-rafter')rafters.push(o);});assert(rafters.length>40,'rafters exist');
  const crossing=[];model.root.traverse(o=>{if(o.name!=='open-roof-window')return;
   for(const u of [-.55,-.3,0,.3,.55])for(const w of [-.28,0,.28]){const pane=new T.Vector3(u,.05,w).applyMatrix4(o.matrixWorld),normal=new T.Vector3(0,1,0).transformDirection(o.matrixWorld);
    ray.set(pane.clone().addScaledVector(normal,-1.5),normal);ray.far=1.5;const h=ray.intersectObjects(rafters,false)[0];if(h)crossing.push(`window at x ${pane.x.toFixed(1)}, z ${pane.z.toFixed(1)}`);}});
  assert.equal(crossing.length,0,`a rafter crosses ${[...new Set(crossing)].slice(0,4).join('; ')}`);
  // Gable windows show whole: from the garden and from the room, nothing of the roof or its ceiling covers a top corner.
  const gables=[];model.root.traverse(o=>{if(o.name==='gable-window'&&o.parent?.parent?.name==='main-roof')gables.push(o);});assert(gables.length>=4,'main gable windows exist');
  const hidden=[];for(const pane of gables){const b=new T.Box3().setFromObject(pane),out=Math.sign(b.min.z);
   // The corner of the dark frame, 3 cm above the glass: seen from 8 and 14 m out in the garden and from inside the room.
   for(const x of [b.min.x-.02,b.max.x+.02]){const corner=new T.Vector3(x,b.max.y+.03,(b.min.z+b.max.z)/2+out*.12);
    for(const eye of [new T.Vector3(x*.3,1.65,corner.z+out*8),new T.Vector3(x*.3,1.65,corner.z+out*14),new T.Vector3(x*.3,4.7,corner.z-out*3.2)]){ray.set(eye,corner.clone().sub(eye).normalize());ray.far=eye.distanceTo(corner)+.05;
     const h=ray.intersectObject(model.root,true).find(h=>h.object.isMesh&&shown(h.object));if(h&&/roof-slope|ceiling/.test(h.object.name))hidden.push(`${h.object.name} covers the window corner at x ${x.toFixed(2)}, z ${corner.z.toFixed(1)}`);}}}
  assert.equal(hidden.length,0,hidden.slice(0,4).join('; '));
 }
 // Downpipes stand outside: never within the main house or the guest wing (and its garage).
 const guest=[[116,535],[475,573],[461,668],[367,671],[316,1228],[49,1208]].map(([x,z])=>p(x,z)),[w,n]=p(795,182),[e,s]=p(1229,877);
 model.root.traverse(o=>{if(o.name!=='downpipe')return;const v=o.getWorldPosition(new T.Vector3());assert(!(v.x>w&&v.x<e&&v.z>n&&v.z<s)&&!within(v.x,v.z,guest),`downpipe indoors at x ${v.x.toFixed(1)}, z ${v.z.toFixed(1)}`);});
 model.dispose();
}
console.log('Passed: no wall, window or beam breaks through a roof, the entrance roof stops at the main and guest roofs, rafters keep clear of roof windows, gable windows show whole, and no downpipe stands indoors, in either detail mode.');
