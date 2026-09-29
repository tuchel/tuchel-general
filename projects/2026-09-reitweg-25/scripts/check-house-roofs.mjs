import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Nothing may break through a roof: seen from above, every wall, window frame and beam lies
// under the roof surface, except the parts meant to stand on it (ridge caps, eave fascias, chimney).
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/site-data.ts'],outdir:'tmp/roof-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/roof-check/build-model.mjs');
const onRoof=new Set(['roof-ridge-cap','roof-eave-fascia','chimney']);
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
 // Downpipes stand outside: never within the main house or the guest wing (and its garage).
 const {planPoint:p}=await import('../tmp/roof-check/site-data.mjs');
 const guest=[[116,535],[475,573],[461,668],[367,671],[316,1228],[49,1208]].map(([x,z])=>p(x,z)),[w,n]=p(795,182),[e,s]=p(1229,877);
 const within=(x,z,pts)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,zi]=pts[i],[xj,zj]=pts[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;};
 model.root.traverse(o=>{if(o.name!=='downpipe')return;const v=o.getWorldPosition(new T.Vector3());assert(!(v.x>w&&v.x<e&&v.z>n&&v.z<s)&&!within(v.x,v.z,guest),`downpipe indoors at x ${v.x.toFixed(1)}, z ${v.z.toFixed(1)}`);});
 model.dispose();
}
console.log('Passed: no wall, window or beam breaks through a roof, and no downpipe stands indoors, in either detail mode.');
