import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/landscape-context.ts','lib/house-model/site-data.ts','lib/house-model/neighbors.ts'],outdir:'tmp/setting-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.json':'json'}});
const {landscapeContext,boundaryHedge}=await import('../tmp/setting-check/landscape-context.mjs');
const {plotOutline,NORTH_TREES,EAST_TREES,GABLE_HEDGE}=await import('../tmp/setting-check/site-data.mjs'),{NEIGHBORS}=await import('../tmp/setting-check/neighbors.mjs');
// The garden hedges: about 1.35 m on all three garden edges; a tall hedge, about 3.2 m, along the main house's north
// gable, clear of the wall (owner and aerial photographs).
const hedge=boundaryHedge(),runs=[[plotOutline[0],plotOutline[1]],[plotOutline[1],plotOutline[2]],[plotOutline[2],plotOutline[3]]];
hedge.updateMatrixWorld(true);const bodies=[];hedge.traverse(o=>{if(o.name==='hedge-body')bodies.push(o);});const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
const top=(x,z)=>{ray.set(new T.Vector3(x,5,z),down);return ray.intersectObjects(bodies,false)[0]?.point.y;};
for(const [a,b] of runs){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len;
 for(let t=.05;t<1;t+=.1){const y=top(a[0]+(b[0]-a[0])*t-tz*.62,a[1]+(b[1]-a[1])*t+tx*.62);assert(y>1.1&&y<1.6,'hedge continues on all three garden edges at about 1.35 m');}}
for(let x=GABLE_HEDGE.from+.5;x<GABLE_HEDGE.to-.4;x+=1){const y=top(x,GABLE_HEDGE.z);assert(y>2.9&&y<3.5,`the hedge along the north gable stands about 3.2 m (x ${x.toFixed(1)}: ${y?.toFixed(2)} m)`);}
assert(GABLE_HEDGE.z+GABLE_HEDGE.width/2<-9.61-1.5&&GABLE_HEDGE.from<-6&&GABLE_HEDGE.to>4,'along the gable, at least 1.5 m clear of the north wall');
const {group}=landscapeContext();group.updateMatrixWorld(true);assert(group.getObjectByName('mature-roadside-avenue'));assert(group.getObjectByName('layered-park-woodland'));
// Trees traced from the aerial photograph: outside the plot, clear of the neighbors' houses; north of the boundary a
// spruce behind the main house's north gable; east of the lot a cluster that ends about halfway down the east hedge.
{for(const name of ['north-neighbor-trees','east-trees'])assert(group.getObjectByName(name),name);
 const inside=([x,z],poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
 const [a,b,c]=plotOutline,boundary=x=>a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
 for(const [x,z,height] of [...NORTH_TREES,...EAST_TREES]){
  assert(!inside([x,z],plotOutline),`a tree at (${x}, ${z}) stands outside the plot`);
  for(const nb of NEIGHBORS.buildings){const f=nb.footprint,poly=Array.from({length:f.length/2},(_,i)=>[f[i*2],f[i*2+1]]);assert(!inside([x,z],poly)&&!poly.some(([px,pz])=>Math.hypot(px-x,pz-z)<2.5),`a tree at (${x}, ${z}) clear of ${nb.id}`);}
  assert(height>=8&&height<=30,'heights as photographed');}
 for(const [x,z] of NORTH_TREES)assert(z<boundary(x)-2,`(${x}, ${z}) north of the boundary`);
 assert(NORTH_TREES.some(([x,z,h,,kind])=>kind==='pine'&&h>=20&&Math.abs(x)<6&&z<boundary(x)&&z>boundary(x)-20),'a tall spruce behind the main house’s north gable');
 const middle=(b[1]+c[1])/2,east=EAST_TREES.filter(([x,z])=>x<b[0]+30&&z>b[1]&&z<c[1]);
 assert(east.length>=4&&east.every(([,z])=>z<middle),`the cluster along the east hedge ends about halfway down it (z < ${middle.toFixed(1)})`);}
let ridges=0;group.traverse(o=>{if(o instanceof T.Mesh){assert([...o.matrixWorld.elements].every(Number.isFinite));const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)assert(Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)));if(o.userData.scenicBackdrop){ridges++;const radii=[];for(let j=0;j<a.count;j++)radii.push(Math.hypot(a.getX(j),a.getZ(j)));assert(Math.min(...radii)>=999,'the distant land is drawn beyond the property and its setting');assert(a.count>40000,'land with depth and relief');assert(Math.max(...radii)-Math.min(...radii)>1800,'terrain extends across sloping depth, not a vertical card');}}});assert.equal(ridges,1);
for(const root of [group,hedge])root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
console.log('Passed: three continuous garden hedges at about 1.35 m and a 3.2 m hedge along the north gable; trees traced from the aerial photograph outside the plot and clear of the neighbors’ houses, a spruce behind the north gable and the east cluster ending halfway down the east hedge; finite landscape geometry and the distant land drawn beyond the setting.');
