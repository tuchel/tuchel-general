// Builds lib/house-model/horizon.json: the terrain around the house out to 150 km as seen from it, for the distant
// backdrop (alpine-terrain.ts). Run from the project root:
//   node scripts/build-horizon.mjs
// Elevations are the open Terrain Tiles (terrarium encoding, zoom 11, about 50 m; Mapzen/Linux Foundation on AWS Open
// Data, from EU-DEM, DGM Österreich and SRTM), downloaded once into tmp/terrain/. The grid is 720 bearings (0.5°) by 64 distances
// spaced evenly in log distance from 0.5 to 150 km. Each cell keeps the steepest elevation angle found in it, from 12
// sight lines per bearing stepped every 20-50 m through the tiles' own pixels, so summits between grid points still
// reach their height on the skyline. Angles include the earth's curvature with standard refraction (k = 0.13). Stored:
// the height above the house's ground (decimetres) that gives that angle at the cell's own distance.
import fs from 'node:fs';
import {build} from 'esbuild';
import sharp from 'sharp';

const Z=11,TILE=256,R=6371000,K=.13,COLUMNS=720,ROWS=64,NEAR=500,FAR=150000,LINES=12,OUT='lib/house-model/horizon.json',CACHE=`tmp/terrain/${Z}`;
const BOX={south:46.65,north:48.3,west:9.75,east:13.05};
await build({entryPoints:['lib/house-model/sun-position.ts'],outdir:'tmp/horizon-build',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {SUN_SITE}=await import('../tmp/horizon-build/sun-position.mjs');

const px=lon=>(lon+180)/360*2**Z*TILE,py=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**Z*TILE;
const tx0=Math.floor(px(BOX.west)/TILE),tx1=Math.floor(px(BOX.east)/TILE),ty0=Math.floor(py(BOX.north)/TILE),ty1=Math.floor(py(BOX.south)/TILE);
const tiles=new Map(),jobs=[];
for(let x=tx0;x<=tx1;x++)for(let y=ty0;y<=ty1;y++)jobs.push([x,y]);
await Promise.all(Array.from({length:8},async()=>{
 for(let job=jobs.shift();job;job=jobs.shift()){
  const [x,y]=job,file=`${CACHE}/${x}/${y}.png`;
  if(!fs.existsSync(file)){
   const url=`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
   let r;for(let attempt=0;attempt<4&&!r?.ok;attempt++){r=await fetch(url).catch(()=>undefined);if(!r?.ok)await new Promise(f=>setTimeout(f,2000*2**attempt));}
   if(!r?.ok)throw new Error(`${url}: ${r?.status}`);
   fs.mkdirSync(`${CACHE}/${x}`,{recursive:true});fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));
  }
  const {data}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true}),h=new Float32Array(TILE*TILE);
  for(let i=0;i<TILE*TILE;i++)h[i]=data[i*3]*256+data[i*3+1]+data[i*3+2]/256-32768;
  tiles.set(`${x}/${y}`,h);
 }
}));
/** Elevation (m) of the pixel under a point, unblended so summits keep their height; outside the box, sea level (below
 * every skyline). */
const sample=(X,Y)=>{const t=tiles.get(`${Math.floor(X/TILE)}/${Math.floor(Y/TILE)}`);return t?t[(Y%TILE)*TILE+X%TILE]:0;};
const elevation=(lat,lon)=>sample(Math.floor(px(lon)),Math.floor(py(lat)));
const rad=Math.PI/180,lat0=SUN_SITE.latitude*rad,lon0=SUN_SITE.longitude*rad,ground=elevation(SUN_SITE.latitude,SUN_SITE.longitude);
/** The point `d` metres from the house on true bearing `bearing` (degrees), on a sphere. */
const along=(bearing,d)=>{const b=bearing*rad,s=d/R,lat=Math.asin(Math.sin(lat0)*Math.cos(s)+Math.cos(lat0)*Math.sin(s)*Math.cos(b));
 return [lat/rad,(lon0+Math.atan2(Math.sin(b)*Math.sin(s)*Math.cos(lat0),Math.cos(s)-Math.sin(lat0)*Math.sin(lat)))/rad];};
const drop=d=>d*d*(1-K)/(2*R),distance=j=>NEAR*(FAR/NEAR)**(j/(ROWS-1)),step=(FAR/NEAR)**(1/(ROWS-1));
const best=new Float64Array(COLUMNS*ROWS).fill(-Infinity),row=d=>Math.round(Math.log(d/NEAR)/Math.log(FAR/NEAR)*(ROWS-1));
for(let i=0;i<COLUMNS;i++)for(let k=0;k<LINES;k++){
 const bearing=(i+(k+.5)/LINES-.5)*360/COLUMNS;
 for(let d=NEAR/Math.sqrt(step);d<FAR*Math.sqrt(step);d+=Math.min(50,Math.max(20,d*.0008))){
  const j=row(d);if(j<0||j>=ROWS)continue;const [lat,lon]=along(bearing,d);
  best[i*ROWS+j]=Math.max(best[i*ROWS+j],(elevation(lat,lon)-ground-drop(d))/d);
 }
}
const heights=new Int16Array(COLUMNS*ROWS);
for(let i=0;i<COLUMNS;i++)for(let j=0;j<ROWS;j++){const d=distance(j);heights[i*ROWS+j]=Math.max(-32768,Math.min(32767,Math.round((drop(d)+best[i*ROWS+j]*d)*10)));}
fs.writeFileSync(OUT,JSON.stringify({
 source:{name:'Terrain Tiles (terrarium)',publisher:'Mapzen / Linux Foundation, AWS Open Data',data:'EU-DEM (Copernicus), DGM Österreich and SRTM (USGS)',page:'https://registry.opendata.aws/terrain-tiles/',attribution:'https://github.com/tilezen/joerd/blob/master/docs/attribution.md'},
 ground:Math.round(ground*10)/10,refraction:K,columns:COLUMNS,rows:ROWS,near:NEAR,far:FAR,
 heights:Buffer.from(heights.buffer).toString('base64'),
})+'\n');
console.log(`${tiles.size} tiles; ground ${ground.toFixed(1)} m; ${COLUMNS} × ${ROWS} grid, ${(fs.statSync(OUT).size/1000).toFixed(0)} kB`);
