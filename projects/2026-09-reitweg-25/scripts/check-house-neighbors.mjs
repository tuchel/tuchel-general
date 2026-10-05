import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// Neighbors (a More toggle, off at first): the buildings across the fence, Nos. 21 and 23 to the north and No. 27 to
// the south, from the Bavarian survey's LoD2 building models in plain off-white massing. They are placed by the
// house's own LoD2 building, which covers the model's roofs; each stands on the model's ground at its own height,
// outside the plot, with its faces turned outward. Shown outside only; the traced image follows.
await build({entryPoints:['lib/house-model/neighbors.ts','lib/house-model/build-model.ts','lib/house-model/site-data.ts'],outdir:'tmp/neighbors-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error',loader:{'.json':'json'}});
const {NEIGHBORS,neighborHouses}=await import('../tmp/neighbors-check/neighbors.mjs'),{buildHouseModel}=await import('../tmp/neighbors-check/build-model.mjs'),{plotOutline}=await import('../tmp/neighbors-check/site-data.mjs');

// The buildings: the circled ones on the three lots, credited.
assert.deepEqual(Object.fromEntries([21,23,27].map(lot=>[lot,NEIGHBORS.buildings.filter(b=>b.lot===lot).length])),{21:2,23:2,27:3},'house and shed on No. 21, house and annex on No. 23, two houses and a garage on No. 27');
assert.equal(NEIGHBORS.source.publisher,'Bayerische Vermessungsverwaltung');assert.equal(NEIGHBORS.source.licence,'CC BY 4.0');

// The fit: the house's LoD2 roofs, where the data places them, cover the model's roofs (0.25 m cells; the model's
// eaves overhang the LoD2 outline, which follows the walls).
const cell=.25,raster=(a,b,c,out)=>{const area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(area)<1e-9)return;
 for(let i=Math.floor(Math.min(a[0],b[0],c[0])/cell);i<=Math.ceil(Math.max(a[0],b[0],c[0])/cell);i++)for(let j=Math.floor(Math.min(a[1],b[1],c[1])/cell);j<=Math.ceil(Math.max(a[1],b[1],c[1])/cell);j++){
  const x=(i+.5)*cell,y=(j+.5)*cell,w0=((b[0]-x)*(c[1]-y)-(c[0]-x)*(b[1]-y))/area,w1=((c[0]-x)*(a[1]-y)-(a[0]-x)*(c[1]-y))/area;if(w0>=0&&w1>=0&&1-w0-w1>=0)out.add(i+','+j);}};
const model=buildHouseModel(false);model.setLevel('exterior');model.root.updateMatrixWorld(true);
const roofs=new Set(),skip=new Set([model.trees,model.site]),v=[0,1,2].map(()=>new T.Vector3()),e1=new T.Vector3(),e2=new T.Vector3();
model.root.traverse(o=>{if(!o.isMesh||!o.visible)return;for(let p=o;p;p=p.parent)if(skip.has(p))return;
 const pos=o.geometry.attributes.position,idx=o.geometry.index,n=idx?idx.count:pos.count;
 for(let t=0;t+2<n;t+=3){for(let k=0;k<3;k++)v[k].fromBufferAttribute(pos,idx?idx.getX(t+k):t+k).applyMatrix4(o.matrixWorld);
  if(Math.min(v[0].y,v[1].y,v[2].y)<2.3||Math.abs(e1.subVectors(v[1],v[0]).cross(e2.subVectors(v[2],v[0])).normalize().y)<.2)continue;
  raster([v[0].x,v[0].z],[v[1].x,v[1].z],[v[2].x,v[2].z],roofs);}});
const house=new Set();for(const ring of NEIGHBORS.house){const p=Array.from({length:ring.length/2},(_,i)=>[ring[i*2],ring[i*2+1]]);for(let k=1;k+1<p.length;k++)raster(p[0],p[k],p[k+1],house);}
const both=[...house].filter(k=>roofs.has(k)).length,overlap=both/(house.size+roofs.size-both),covered=both/house.size;
assert(overlap>.78&&covered>.95,`the house's LoD2 roofs cover ${(covered*100).toFixed(1)}% of themselves on the model's roofs, overlap ${overlap.toFixed(3)}`);

// Placement: Nos. 21 and 23 north of the plot, No. 27 south, none inside it.
const inside=([x,z],poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
const plotNorth=Math.min(...plotOutline.map(p=>p[1])),plotSouth=Math.max(...plotOutline.map(p=>p[1]));
for(const b of NEIGHBORS.buildings){
 const corners=Array.from({length:b.footprint.length/2},(_,i)=>[b.footprint[i*2],b.footprint[i*2+1]]),z=corners.reduce((s,p)=>s+p[1],0)/corners.length;
 assert(corners.every(p=>!inside(p,plotOutline)),`${b.id} stands outside the plot`);
 assert(b.lot===27?z>0&&z<plotSouth+60:z<0&&z>plotNorth-60,`${b.id} on No. ${b.lot} lies ${b.lot===27?'south':'north'} of the house`);
}

// The mesh: every building on the ground it is given, at its own height, roofs up, walls out (positive enclosed volume
// once the footprint closes it, near footprint area × height).
const groundAt=x=>-.035-5*T.MathUtils.smoothstep(x,55,140),mesh=neighborHouses(groundAt),p=mesh.geometry.attributes.position;
assert(mesh.castShadow&&mesh.receiveShadow&&mesh.material.color.getHexString()==='dfdad0','off-white, casting and taking shadows');
let start=0;const a=new T.Vector3(),b2=new T.Vector3(),c=new T.Vector3();
for(const b of NEIGHBORS.buildings){
 let count=0;const tri=ring=>{const n=ring.length/3;count+=(n-2)*3;};for(const r of [...b.walls,...b.roofs])tri(r);
 const corners=Array.from({length:b.footprint.length/2},(_,i)=>[b.footprint[i*2],b.footprint[i*2+1]]);
 let area=0;corners.forEach(([x,z],i)=>{const [x2,z2]=corners[(i+1)%corners.length];area+=(x*z2-x2*z)/2;});area=Math.abs(area);
 let low=Infinity,high=-Infinity,roofDown=0,volume=0;
 for(let i=start;i<start+count;i++){low=Math.min(low,p.getY(i));high=Math.max(high,p.getY(i));}
 // Enclosed volume about the footprint's middle at the base, where the open bottom adds nothing; a wall two buildings
 // share is left out of both, which the range allows.
 const o=new T.Vector3(corners.reduce((t,q)=>t+q[0],0)/corners.length,low,corners.reduce((t,q)=>t+q[1],0)/corners.length),walls=b.walls.reduce((t,r)=>t+(r.length/3-2)*3,0);
 for(let i=start;i<start+count;i+=3){a.fromBufferAttribute(p,i).sub(o);b2.fromBufferAttribute(p,i+1).sub(o);c.fromBufferAttribute(p,i+2).sub(o);volume+=a.dot(b2.clone().cross(c))/6;
  if(i>=start+walls&&e1.subVectors(b2,a).cross(e2.subVectors(c,a)).y<0)roofDown++;}
 const base=Math.min(...corners.map(([x,z])=>groundAt(x,z)))-.05;
 assert(Math.abs(low-base)<.02&&Math.abs(high-low-b.height)<.02,`${b.id}: stands at ${low.toFixed(2)} m, ${(high-low).toFixed(2)} m tall (LoD2 ${b.height} m)`);
 assert.equal(roofDown,0,`${b.id}: every roof face up`);
 assert(volume>.45*area*b.height&&volume<1.02*area*b.height,`${b.id}: faces outward, ${volume.toFixed(0)} m³ in ${area.toFixed(0)} m² × ${b.height} m`);
 start+=count;
}
assert.equal(start,p.count,'every face accounted for');

// The wiring: off at first, a More toggle on every detail setting, built when first shown, outside only, credited.
{const read=f=>fs.readFileSync(f,'utf8'),viewer=read('lib/house-model/viewer.ts'),page=read('components/studio/model/house-model.tsx'),panels=read('components/studio/model/model-panels.tsx');
 assert(/\[neighbors,setNeighbors\]=useState\(false\)/.test(page)&&/api\.current\?\.setNeighbors\(neighbors\)/.test(page),'off at first, sent to the view');
 assert(/<div className="model-more-toggles">\n[^]*?onClick=\{\(\)=>p\.onNeighbors\(!p\.neighbors\)\}>Neighbors<\/button>/.test(panels)&&!/\{realistic&&<div className="model-more-toggles">/.test(panels),'a toggle in More, in every detail setting');
 assert(/if\(on&&!neighbors\)\{neighbors=neighborHouses\(/.test(viewer)&&/neighbors\.visible=neighborsOn&&level==='exterior'/.test(viewer),'built when first shown; outside only');
 assert(/setNeighbors:[^]*?live\?\.invalidate\(\);changed\(\);/.test(viewer),'the traced image follows');
 assert(/Bayerische Vermessungsverwaltung, geodaten\.bayern\.de, CC BY 4\.0/.test(page),'credited in About this model');}
console.log(`Passed: ${NEIGHBORS.buildings.length} neighbors' buildings (Nos. 21 and 23 north, No. 27 south) stand outside the plot, at their own heights on the model's ground, faces outward; the house's LoD2 roofs cover ${(covered*100).toFixed(1)}% on the model's roofs (overlap ${overlap.toFixed(3)} with the eaves); off at first, a More toggle, outside only, credited.`);
