// Builds lib/house-model/forests.json: the woods round the house from OpenStreetMap's woodland outlines (landuse=forest
// and natural=wood), in the model's frame. Run from the project root:
//   node scripts/build-forests.mjs
// The Overpass query downloads once into tmp/osm/. Positions go to UTM zone 32N about the address point and then
// through the same rotation and shift as the neighbours' buildings (neighbors.json, fitted on the house's own LoD2
// outline). Outlines are simplified to 4 m, cut to a 1.4 km square about the house, and kept from 120 m out, where the
// traced trees and their lower storey end. Woods tagged neither broadleaved nor mixed are taken as spruce, as the wood
// beyond the east pasture is photographed. Each point carries the land's height above the house's ground from the
// Terrain Tiles (zoom 11, tmp/terrain/, as for horizon.json).
import fs from 'node:fs';
import {build} from 'esbuild';
import sharp from 'sharp';

const OUT='lib/house-model/forests.json',CACHE='tmp/osm/woods.json',REACH=700,NEAR=120,TOLERANCE=4,Z=11,TILE=256;
await build({entryPoints:['lib/house-model/sun-position.ts'],outdir:'tmp/forests-build',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {SUN_SITE}=await import('../tmp/forests-build/sun-position.mjs');
const fit=JSON.parse(fs.readFileSync('lib/house-model/neighbors.json','utf8')).fit;

if(!fs.existsSync(CACHE)){
 const q=`[out:json][timeout:90];(way["landuse"="forest"](around:2500,${SUN_SITE.latitude},${SUN_SITE.longitude});way["natural"="wood"](around:2500,${SUN_SITE.latitude},${SUN_SITE.longitude});relation["landuse"="forest"](around:2500,${SUN_SITE.latitude},${SUN_SITE.longitude});relation["natural"="wood"](around:2500,${SUN_SITE.latitude},${SUN_SITE.longitude}););out geom;`;
 let body;
 for(const server of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
  const r=await fetch(`${server}?data=${encodeURIComponent(q)}`,{headers:{'User-Agent':'tuchel-general-house-model/1.0',Accept:'application/json'}}).catch(()=>undefined);
  const text=r?.ok?await r.text():'';if(text.startsWith('{')){body=text;break;}
 }
 if(!body)throw new Error('Overpass: no answer');
 fs.mkdirSync('tmp/osm',{recursive:true});fs.writeFileSync(CACHE,body);
}
const osm=JSON.parse(fs.readFileSync(CACHE,'utf8'));

/** ETRS89 latitude and longitude to UTM zone 32N, Krüger series (GRS80), as in build-neighbors.mjs. */
function utm32(lat,lon){
 const a=6378137,f=1/298.257222101,n=f/(2-f),k0=.9996,A=a/(1+n)*(1+n*n/4+n**4/64);
 const al=[0,n/2-2*n*n/3+5*n**3/16,13*n*n/48-3*n**3/5,61*n**3/240],e=2*Math.sqrt(n)/(1+n);
 const phi=lat*Math.PI/180,lam=(lon-9)*Math.PI/180;
 const t=Math.sinh(Math.atanh(Math.sin(phi))-e*Math.atanh(e*Math.sin(phi))),xi=Math.atan2(t,Math.cos(lam)),eta=Math.atanh(Math.sin(lam)/Math.sqrt(1+t*t));
 let E=eta,N=xi;for(const j of [1,2,3]){E+=al[j]*Math.cos(2*j*xi)*Math.sinh(2*j*eta);N+=al[j]*Math.sin(2*j*xi)*Math.cosh(2*j*eta);}
 return [500000+k0*A*E,k0*A*N];
}
const [E0,N0]=utm32(SUN_SITE.latitude,SUN_SITE.longitude),c=Math.cos(fit.rotation*Math.PI/180),s=Math.sin(fit.rotation*Math.PI/180);
const toModel=(lat,lon)=>{const [E,N]=utm32(lat,lon),e=E-E0,n=N-N0;return [e*c-n*s+fit.shift[0],-(e*s+n*c+fit.shift[1])];};
// The model frame back to latitude and longitude, for the land's height (a metre or two is plenty at 50 m pixels).
const toGeo=([x,z])=>{const e=x-fit.shift[0],nz=-z-fit.shift[1],E=e*c+nz*s,N=-e*s+nz*c;
 return [SUN_SITE.latitude+N/111320,SUN_SITE.longitude+E/(111320*Math.cos(SUN_SITE.latitude*Math.PI/180))];};

// Land heights from the cached Terrain Tiles.
const tiles=new Map(),px=lon=>(lon+180)/360*2**Z*TILE,py=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**Z*TILE;
async function elevation(lat,lon){
 const X=Math.floor(px(lon)),Y=Math.floor(py(lat)),key=`${Math.floor(X/TILE)}/${Math.floor(Y/TILE)}`;
 if(!tiles.has(key)){const file=`tmp/terrain/${Z}/${key}.png`;
  if(!fs.existsSync(file)){const r=await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${key}.png`);if(!r.ok)throw new Error(`terrain ${key}: ${r.status}`);fs.mkdirSync(file.replace(/\/[^/]+$/,''),{recursive:true});fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}
  const {data}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});tiles.set(key,data);}
 const d=tiles.get(key),i=((Y%TILE)*TILE+X%TILE)*3;return d[i]*256+d[i+1]+d[i+2]/256-32768;
}
const home=await elevation(SUN_SITE.latitude,SUN_SITE.longitude);

// Outer rings, cut to the square (Sutherland–Hodgman) and simplified (Douglas–Peucker).
function clip(ring){
 let out=ring;
 for(const [axis,sign] of [[0,1],[0,-1],[1,1],[1,-1]]){const inside=p=>sign*p[axis]<=REACH,input=out;out=[];
  for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length];
   if(inside(a))out.push(a);
   if(inside(a)!==inside(b)){const t=(sign*REACH-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}}
 return out;
}
function simplify(points){
 if(points.length<3)return points;
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop();let far=-1,d=0;const [ax,az]=points[a],[bx,bz]=points[b],len=Math.hypot(bx-ax,bz-az)||1;
  for(let i=a+1;i<b;i++){const e=Math.abs((bx-ax)*(az-points[i][1])-(ax-points[i][0])*(bz-az))/len;if(e>d){d=e;far=i;}}
  if(d>TOLERANCE){keep[far]=1;stack.push([a,far],[far,b]);}}
 return points.filter((_,i)=>keep[i]);
}
const woods=[];
for(const el of osm.elements){
 const rings=el.type==='way'?[el.geometry]:(el.members??[]).filter(m=>m.role==='outer'&&m.geometry).map(m=>m.geometry);
 const t=el.tags??{},leaf=t.leaf_type==='broadleaved'||t.leaf_cycle==='deciduous'||t.genus==='Quercus'?'broadleaved':t.leaf_type==='mixed'?'mixed':'needleleaved';
 for(const g of rings){
  let ring=g.map(p=>toModel(p.lat,p.lon));if(ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1])ring.pop();
  ring=simplify(clip(ring));if(ring.length<3)continue;
  if(Math.min(...ring.map(p=>Math.hypot(p[0],p[1])))<NEAR)continue;
  const points=[];for(const p of ring){const [lat,lon]=toGeo(p);points.push(Math.round(p[0]*10)/10,Math.round(p[1]*10)/10,Math.round((await elevation(lat,lon)-home)*10)/10);}
  woods.push({id:`${el.type}/${el.id}`,leaf,points});
 }
}
fs.writeFileSync(OUT,JSON.stringify({source:{name:'OpenStreetMap woodland (landuse=forest, natural=wood)',attribution:'© OpenStreetMap contributors',licence:'ODbL',licenceUrl:'https://opendatacommons.org/licenses/odbl/',land:'Terrain Tiles (Mapzen, AWS Open Data)'},reach:REACH,near:NEAR,woods})+'\n');
console.log(`${woods.length} woods within ${REACH} m, ${woods.reduce((n,w)=>n+w.points.length/3,0)} points; ${(fs.statSync(OUT).size/1000).toFixed(0)} kB`);
