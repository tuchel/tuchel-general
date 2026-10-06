import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/landscape-context.ts','lib/house-model/site-data.ts','lib/house-model/neighbors.ts','lib/house-model/foliage.ts'],outdir:'tmp/setting-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.json':'json'}});
const {landscapeContext,boundaryHedge}=await import('../tmp/setting-check/landscape-context.mjs');
const {foliageMaterials}=await import('../tmp/setting-check/foliage.mjs');
const {plotOutline,NORTH_TREES,EAST_TREES,TALL_HEDGE}=await import('../tmp/setting-check/site-data.mjs'),{NEIGHBORS}=await import('../tmp/setting-check/neighbors.mjs');
// The garden hedges: about 1.35 m on all three garden edges, except that the north hedge stands about 3.2 m from the
// arrival wall to abreast of the main house's north gable (owner photographs); no hedge stands apart along the gable.
const hedge=boundaryHedge(foliageMaterials()),runs=[[plotOutline[0],plotOutline[1]],[plotOutline[1],plotOutline[2]],[plotOutline[2],plotOutline[3]]];
hedge.updateMatrixWorld(true);const bodies=[];hedge.traverse(o=>{if(o.name==='hedge-body')bodies.push(o);});const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
const top=(x,z)=>{ray.set(new T.Vector3(x,5,z),down);return ray.intersectObjects(bodies,false)[0]?.point.y;};
let tall=0;
for(const [a,b] of runs){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len;
 for(let t=.02;t<1;t+=.04){const x=a[0]+(b[0]-a[0])*t-tz*.62,z=a[1]+(b[1]-a[1])*t+tx*.62,y=top(x,z),high=a===plotOutline[0]&&x<TALL_HEDGE.until-.4,low=a!==plotOutline[0]||x>TALL_HEDGE.until+.4;
  if(high){tall++;assert(y>2.9&&y<3.5,`the north hedge stands about 3.2 m from the arrival wall to the gable (x ${x.toFixed(1)}: ${y?.toFixed(2)} m)`);}
  else if(low)assert(y>1.1&&y<1.6,`the hedge continues at about 1.35 m (x ${x.toFixed(1)}: ${y?.toFixed(2)} m)`);}}
assert(tall>=10&&TALL_HEDGE.until>4&&TALL_HEDGE.until<6.5,'tall from the arrival wall to abreast of the north gable');
for(let x=-6;x<=6;x+=1)assert(top(x,-12.5)===undefined,'no hedge standing apart along the gable');
// Leaves cover a hedge's sides, not just its top: a good share of the leaf cards sit between a third and four fifths up.
{const cards=[];hedge.traverse(o=>{if(o.name==='hedge-leaf-cards')cards.push(o);});const p=cards[0].geometry.attributes.position;let mid=0;
 for(let i=0;i<p.count;i+=6){const y=p.getY(i);if(y>3.2*.33&&y<3.2*.8)mid++;}
 assert(mid/(p.count/6)>.2,`${(mid/(p.count/6)*100).toFixed(0)}% of the tall hedge's leaf cards on its sides`);}
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
 assert(NORTH_TREES.some(([x,z,h,,kind])=>kind==='spruce'&&h>=20&&Math.abs(x)<6&&z<boundary(x)&&z>boundary(x)-20),'a tall spruce behind the main house’s north gable');
 // Heights against the owner's photograph from the east roof window (camera fitted to the neighbors' surveyed buildings,
 // the north roof verge and the north hedge to 8 px rms): the canopy's skyline over each tree's crown caps its top.
 const skyline={N1:20.2,N2:23.6,N3:23.1,N7:23.8,N8:24.8,N9:27.6,N10:23.5,E0:20.6,E1:23.7};
 for(const [id,cap] of Object.entries(skyline)){const [,,h]=(id[0]==='N'?NORTH_TREES:EAST_TREES)[+id.slice(1)];assert(h<=cap&&h>cap-3.5,`${id}: ${h} m, the photographed skyline caps it at ${cap} m`);}
 // Kinds as photographed: woodland broadleaves, a silver birch in each view, spruces.
 assert([...NORTH_TREES,...EAST_TREES].every(([,,,,kind])=>['woodland','birch','spruce'].includes(kind)),'woodland kinds');
 assert(NORTH_TREES.some(([,,,,k])=>k==='birch')&&EAST_TREES.some(([,,,,k])=>k==='birch'),'a birch behind the neighbors and one east of the lot');
 const middle=(b[1]+c[1])/2,east=EAST_TREES.filter(([x,z])=>x<b[0]+30&&z>b[1]&&z<c[1]);
 assert(east.length>=4&&east.every(([,z])=>z<middle),`the cluster along the east hedge ends about halfway down it (z < ${middle.toFixed(1)})`);
 // The woods' lower storey: smaller trees and shrubs under and between the traced crowns, so the stands close down to
 // the ground; outside the plot, clear of the neighbors' houses, and only where traced crowns stand.
 const under=group.getObjectByName('woodland-understory');assert(under,'woodland-understory');
 const sets=under.children[0].userData.treeSets,p=new T.Vector3(),q=new T.Quaternion(),k=new T.Vector3();let count=0;
 for(const set of sets)for(const matrix of set.matrices){matrix.decompose(p,q,k);count++;
  assert(!inside([p.x,p.z],plotOutline),`understory at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) outside the plot`);
  for(const nb of NEIGHBORS.buildings){const f=nb.footprint,poly=Array.from({length:f.length/2},(_,i)=>[f[i*2],f[i*2+1]]);assert(!inside([p.x,p.z],poly)&&!poly.some(([px,pz])=>Math.hypot(px-p.x,pz-p.z)<3),`understory clear of ${nb.id}`);}
  assert([...NORTH_TREES,...EAST_TREES].some(([x,z,,r])=>Math.hypot(x-p.x,z-p.z)<r+3),'under or beside a traced crown');}
 assert(count>=60,`${count} understory trees and shrubs`);
 // Its floor, shaded under the crowns, never shows inside the garden.
 const floor=under.getObjectByName('woodland-floor').geometry.attributes.position;let shown=0;
 for(let i=0;i<floor.count;i++){const x=floor.getX(i),z=floor.getZ(i),ground=-5*T.MathUtils.smoothstep(x,55,140);if(inside([x,z],plotOutline)&&floor.getY(i)>ground-.2)shown++;}
 assert.equal(shown,0,`${shown} points of the woodland floor show inside the garden`);}
let ridges=0;group.traverse(o=>{if(o instanceof T.Mesh){assert([...o.matrixWorld.elements].every(Number.isFinite));const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)assert(Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)));if(o.userData.scenicBackdrop){ridges++;const radii=[];for(let j=0;j<a.count;j++)radii.push(Math.hypot(a.getX(j),a.getZ(j)));assert(Math.min(...radii)>=999,'the distant land is drawn beyond the property and its setting');assert(a.count>40000,'land with depth and relief');assert(Math.max(...radii)-Math.min(...radii)>1800,'terrain extends across sloping depth, not a vertical card');}}});assert.equal(ridges,1);
for(const root of [group,hedge])root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
console.log('Passed: three continuous garden hedges at about 1.35 m, the north one about 3.2 m from the arrival wall to the north gable, leaves on their sides; trees traced from the aerial photograph outside the plot and clear of the neighbors’ houses, a spruce behind the north gable and the east cluster ending halfway down the east hedge, heights under the photographed skyline, the woods closed down to the ground by their lower storey; finite landscape geometry and the distant land drawn beyond the setting.');
