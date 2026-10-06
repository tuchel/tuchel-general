// Builds lib/house-model/neighbors.json: the neighbors' buildings north and south of No. 25, from the
// Bavarian survey's open 3D building models (LoD2: ALKIS footprints with standard roof forms from airborne laser
// scanning), placed in the model's frame. Run from the project root:
//   node scripts/build-neighbors.mjs
// The 2 km CityGML tile downloads once into tmp/lod2/. Positions are UTM zone 32N (EPSG:25832) about the address
// point (SUN_SITE). The house is one LoD2 building; its roofs, seen from above, are fitted to the model's roofs (best
// rotation and shift by overlap of 0.25 m cells), and every other building takes the same rotation and shift. Heights
// are each building's own, standing on the model's ground.
import fs from 'node:fs';
import {build} from 'esbuild';
import * as T from 'three';

// The neighbors across the fence, by lot from the ALKIS-Parzellarkarte
// (https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte): No. 21 (house and shed) and No. 23 (house and annex)
// to the north, No. 27 (a house with its garage at the boundary, and the main house) to the south. East is meadow,
// west the lane.
const LOTS={21:['DEBY_LOD2_74162','DEBY_LOD2_3945913'],23:['DEBY_LOD2_3945909','DEBY_LOD2_3945916'],27:['DEBY_LOD2_74163','DEBY_LOD2_108418070','DEBY_LOD2_3945903']};
const HOUSE='DEBY_LOD2_3945902',RADIUS=300,CELL=.25,OUT='lib/house-model/neighbors.json',CACHE='tmp/lod2';
const SOURCE={name:'3D-Gebäudemodelle (LoD2)',publisher:'Bayerische Vermessungsverwaltung',page:'https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2',licence:'CC BY 4.0',licenceUrl:'https://creativecommons.org/licenses/by/4.0/'};
await build({entryPoints:['lib/house-model/sun-position.ts','lib/house-model/build-model.ts'],outdir:'tmp/neighbors-build',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {SUN_SITE}=await import('../tmp/neighbors-build/sun-position.mjs'),{buildHouseModel}=await import('../tmp/neighbors-build/build-model.mjs');

/** ETRS89 latitude and longitude to UTM zone 32N, Krüger series (GRS80). */
function utm32(lat,lon){
 const a=6378137,f=1/298.257222101,n=f/(2-f),k0=.9996,A=a/(1+n)*(1+n*n/4+n**4/64);
 const al=[0,n/2-2*n*n/3+5*n**3/16,13*n*n/48-3*n**3/5,61*n**3/240],e=2*Math.sqrt(n)/(1+n);
 const phi=lat*Math.PI/180,lam=(lon-9)*Math.PI/180;
 const t=Math.sinh(Math.atanh(Math.sin(phi))-e*Math.atanh(e*Math.sin(phi))),xi=Math.atan2(t,Math.cos(lam)),eta=Math.atanh(Math.sin(lam)/Math.sqrt(1+t*t));
 let E=eta,N=xi;for(const j of [1,2,3]){E+=al[j]*Math.cos(2*j*xi)*Math.sinh(2*j*eta);N+=al[j]*Math.sin(2*j*xi)*Math.cosh(2*j*eta);}
 return [500000+k0*A*E,k0*A*N];
}
const [E0,N0]=utm32(SUN_SITE.latitude,SUN_SITE.longitude);
const tile=`${Math.floor(E0/2000)*2}_${Math.floor(N0/2000)*2}`,url=`https://download1.bayernwolke.de/a/lod2/citygml/${tile}.gml`,file=`${CACHE}/${tile}.gml`;
fs.mkdirSync(CACHE,{recursive:true});
if(!fs.existsSync(file)){const r=await fetch(url);if(!r.ok)throw new Error(`${url}: ${r.status}`);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}

// Buildings: surfaces as rings of [east, north, height] about the address point.
const gml=fs.readFileSync(file,'utf8'),buildings=[];
for(const [,id,body] of gml.matchAll(/<bldg:Building gml:id="([^"]*)">([\s\S]*?)<\/bldg:Building>/g)){
 const surfaces=[];
 for(const [,kind,inner] of body.matchAll(/<bldg:(WallSurface|RoofSurface|GroundSurface)[^>]*>([\s\S]*?)<\/bldg:\1>/g))
  for(const [,list] of inner.matchAll(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/g)){
   const v=list.trim().split(/\s+/).map(Number),ring=[];for(let i=0;i<v.length;i+=3)ring.push([v[i]-E0,v[i+1]-N0,v[i+2]]);
   ring.pop();surfaces.push({kind,ring});
  }
 if(!surfaces.length)continue;
 const all=surfaces.flatMap(s=>s.ring),cx=all.reduce((s,p)=>s+p[0],0)/all.length,cy=all.reduce((s,p)=>s+p[1],0)/all.length;
 if(Math.hypot(cx,cy)<RADIUS)buildings.push({id,surfaces,centre:[cx,cy]});
}
const house=buildings.find(b=>b.id===HOUSE);if(!house)throw new Error(`${HOUSE} not in ${tile}`);
for(const id of Object.values(LOTS).flat())if(!buildings.some(b=>b.id===id))throw new Error(`${id} not within ${RADIUS} m`);

// The fit: model roofs (upward faces above 2.3 m, outside the trees and site) as (x, -z), north up, against the
// house's LoD2 roofs turned by `phi` and shifted.
const raster=(a,b,c,out)=>{const area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(area)<1e-9)return;
 for(let i=Math.floor(Math.min(a[0],b[0],c[0])/CELL);i<=Math.ceil(Math.max(a[0],b[0],c[0])/CELL);i++)for(let j=Math.floor(Math.min(a[1],b[1],c[1])/CELL);j<=Math.ceil(Math.max(a[1],b[1],c[1])/CELL);j++){
  const x=(i+.5)*CELL,y=(j+.5)*CELL,w0=((b[0]-x)*(c[1]-y)-(c[0]-x)*(b[1]-y))/area,w1=((c[0]-x)*(a[1]-y)-(a[0]-x)*(c[1]-y))/area;if(w0>=0&&w1>=0&&1-w0-w1>=0)out.add(i+','+j);}};
const model=buildHouseModel(false);model.setLevel('exterior');model.root.updateMatrixWorld(true);
const roofs=new Set(),skip=new Set([model.trees,model.site]),v=[0,1,2].map(()=>new T.Vector3()),e1=new T.Vector3(),e2=new T.Vector3();
model.root.traverse(o=>{if(!o.isMesh||!o.visible)return;for(let p=o;p;p=p.parent)if(skip.has(p))return;
 const pos=o.geometry.attributes.position,idx=o.geometry.index,n=idx?idx.count:pos.count;
 for(let t=0;t+2<n;t+=3){for(let k=0;k<3;k++)v[k].fromBufferAttribute(pos,idx?idx.getX(t+k):t+k).applyMatrix4(o.matrixWorld);
  if(Math.min(v[0].y,v[1].y,v[2].y)<2.3||Math.abs(e1.subVectors(v[1],v[0]).cross(e2.subVectors(v[2],v[0])).normalize().y)<.2)continue;
  raster([v[0].x,-v[0].z],[v[1].x,-v[1].z],[v[2].x,-v[2].z],roofs);}});
const lod=new Set();for(const {kind,ring} of house.surfaces)if(kind==='RoofSurface')for(let k=1;k+1<ring.length;k++)raster(ring[0],ring[k],ring[k+1],lod);
const cells=[...lod].map(k=>k.split(',').map(c=>(+c+.5)*CELL)),mean=p=>p.reduce((s,q)=>[s[0]+q[0]/p.length,s[1]+q[1]/p.length],[0,0]);
const cm=mean([...roofs].map(k=>k.split(',').map(c=>(+c+.5)*CELL))),cl=mean(cells);
const overlap=(deg,tx,ty)=>{const c=Math.cos(deg*Math.PI/180),s=Math.sin(deg*Math.PI/180);let hit=0;for(const [e,n] of cells)if(roofs.has(Math.floor((e*c-n*s+tx)/CELL)+','+Math.floor((e*s+n*c+ty)/CELL)))hit++;return hit/(cells.length+roofs.size-hit);};
let fit={overlap:0,rotation:0,shift:[0,0]};
for(let d=-5;d<=20;d+=.5){const c=Math.cos(d*Math.PI/180),s=Math.sin(d*Math.PI/180),x0=cm[0]-(cl[0]*c-cl[1]*s),y0=cm[1]-(cl[0]*s+cl[1]*c);
 for(let dx=-4;dx<=4;dx+=.5)for(let dy=-4;dy<=4;dy+=.5){const o=overlap(d,x0+dx,y0+dy);if(o>fit.overlap)fit={overlap:o,rotation:d,shift:[x0+dx,y0+dy]};}}
{const f=fit;for(let d=f.rotation-.5;d<=f.rotation+.5;d+=.05)for(let dx=-.5;dx<=.5;dx+=.05)for(let dy=-.5;dy<=.5;dy+=.05){const o=overlap(d,f.shift[0]+dx,f.shift[1]+dy);if(o>fit.overlap)fit={overlap:o,rotation:d,shift:[f.shift[0]+dx,f.shift[1]+dy]};}}

// Into the model's frame: x east-ish, y up from the building's own ground, z south-ish; rounded to centimetres.
const c=Math.cos(fit.rotation*Math.PI/180),s=Math.sin(fit.rotation*Math.PI/180),r2=x=>Math.round(x*100)/100;
const toWorld=([e,n,h],ground)=>[r2(e*c-n*s+fit.shift[0]),r2(h-ground),r2(-(e*s+n*c+fit.shift[1]))];
const lotOf=id=>Number(Object.keys(LOTS).find(n=>LOTS[n].includes(id)));
const out=buildings.filter(b=>lotOf(b.id)).sort((a,b)=>Math.hypot(...a.centre)-Math.hypot(...b.centre)).map(b=>{
 const ground=Math.min(...b.surfaces.filter(s=>s.kind==='GroundSurface').flatMap(s=>s.ring.map(p=>p[2])));
 const footprint=b.surfaces.filter(s=>s.kind==='GroundSurface').map(s=>s.ring.map(p=>toWorld(p,ground))).sort((p,q)=>q.length-p.length)[0];
 // The survey winds every face counterclockwise seen from outside; (east, north, up) to (x, y, z) keeps that.
 const faces=kind=>b.surfaces.filter(s=>s.kind===kind).map(s=>s.ring.flatMap(p=>toWorld(p,ground)));
 return {id:b.id,lot:lotOf(b.id),height:r2(Math.max(...b.surfaces.flatMap(s=>s.ring.map(p=>p[2])))-ground),footprint:footprint.flatMap(p=>[p[0],p[2]]),walls:faces('WallSurface'),roofs:faces('RoofSurface')};
});
const houseRoofs=house.surfaces.filter(s=>s.kind==='RoofSurface').map(s=>s.ring.flatMap(p=>{const w=toWorld(p,0);return [w[0],w[2]];}));
fs.writeFileSync(OUT,JSON.stringify({source:{...SOURCE,tile:url},fit:{house:HOUSE,rotation:r2(fit.rotation),shift:fit.shift.map(r2),overlap:r2(fit.overlap)},house:houseRoofs,buildings:out})+'\n');
console.log(`${out.length} buildings on Nos. ${Object.keys(LOTS).join(', ')}; the house fits the model's roofs at ${fit.rotation.toFixed(2)}° and (${fit.shift.map(v=>v.toFixed(2)).join(', ')}) m, overlap ${fit.overlap.toFixed(3)}; ${(fs.statSync(OUT).size/1000).toFixed(0)} kB`);
