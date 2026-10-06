import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// The distant land (alpine-terrain.ts) stands where it is seen from the house: every point at its true bearing and
// elevation angle, so the Alps rise to the south, from the Wendelstein (east-southeast) round to the Zugspitze
// (south-southwest), at their real apparent heights, and only low hills lie east over the lake. Published peaks
// (Wikidata coordinates and heights) meet the skyline within 0.15°. The backdrop stays centred under the camera and
// lowers by the camera's height over each point's true distance.
await build({entryPoints:['lib/house-model/alpine-terrain.ts','lib/house-model/sun-position.ts'],outdir:'tmp/horizon-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error',loader:{'.json':'json'}});
const {alpineTerrain,HORIZON,rowDistance}=await import('../tmp/horizon-check/alpine-terrain.mjs'),{SUN_SITE,sunDirection}=await import('../tmp/horizon-check/sun-position.mjs');
const group=alpineTerrain(),mesh=group.getObjectByName('alpine-panorama'),EYE=1.65;
mesh.userData.anchor(EYE);group.updateMatrixWorld(true);
const R=6371000,rad=Math.PI/180,lat0=SUN_SITE.latitude*rad,lon0=SUN_SITE.longitude*rad,drop=d=>d*d*(1-HORIZON.refraction)/(2*R);

// Published peaks: bearing and elevation angle from the house's eye, with curvature and refraction.
const peaks=[['Zugspitze',47.421217,10.986314,2962],['Herzogstand',47.613667,11.307667,1731],['Benediktenwand',47.653056,11.465556,1801],['Wendelstein',47.702778,12.012222,1838],['Krottenkopf',47.545281,11.192781,2086],['Birkkarspitze',47.411389,11.4375,2749]];
const ray=new T.Raycaster(),eye=new T.Vector3(0,EYE,0),seen=[];
for(const [name,la,lo,h] of peaks){
 const p=la*rad,l=lo*rad,d=Math.acos(Math.sin(lat0)*Math.sin(p)+Math.cos(lat0)*Math.cos(p)*Math.cos(l-lon0))*R;
 const bearing=(Math.atan2(Math.sin(l-lon0)*Math.cos(p),Math.cos(lat0)*Math.sin(p)-Math.sin(lat0)*Math.cos(p)*Math.cos(l-lon0))/rad+360)%360;
 const angle=Math.atan((h-HORIZON.ground-EYE-drop(d))/d)/rad,hits=a=>{ray.set(eye,new T.Vector3(...sunDirection(bearing,a)));ray.far=4000;return ray.intersectObject(mesh,false).length>0;};
 assert(hits(angle-.15),`${name}: land at ${(angle-.15).toFixed(2)}°, bearing ${bearing.toFixed(1)}°`);
 assert(!hits(angle+.15),`${name}: sky at ${(angle+.15).toFixed(2)}°, bearing ${bearing.toFixed(1)}°`);
 seen.push(`${name} ${bearing.toFixed(0)}° ${angle.toFixed(2)}°`);
}
// The skyline by bearing: the highest land lies south (bearings 140–210°); east-north-east (0–90°) stays under 1°.
const p=mesh.geometry.attributes.position,{columns,rows}=HORIZON,skyline=Array.from({length:columns},(_,i)=>{let m=-90;for(let j=0;j<rows;j++){const v=i*rows+j;m=Math.max(m,Math.atan2(p.getY(v)-EYE,Math.hypot(p.getX(v),p.getZ(v)))/rad);}return m;});
const top=skyline.indexOf(Math.max(...skyline))*360/columns;
assert(top>=140&&top<=210,`the highest skyline at ${top}°`);assert(Math.max(...skyline.slice(0,columns/4))<1,`east-north-east under 1° (${Math.max(...skyline.slice(0,columns/4)).toFixed(2)}°)`);
// Nearer land in front: drawn radius grows with true distance along every bearing.
for(let j=1;j<rows;j++)assert(Math.hypot(p.getX(j),p.getZ(j))>Math.hypot(p.getX(j-1),p.getZ(j-1))&&rowDistance(j)>rowDistance(j-1));
// The camera's height: anchoring higher lowers every point by height × drawn radius ÷ true distance; the live view
// corrects from the anchor in the vertex shader; the viewer keeps it under the camera and re-anchors at rest.
{const lift=mesh.geometry.attributes.panoramaLift,before=p.getY(rows*100+40);mesh.userData.anchor(EYE+10);
 assert(Math.abs(before-mesh.geometry.attributes.position.getY(rows*100+40)-10*lift.getX(rows*100+40))<1e-3,'10 m higher lowers the land by 10 × r/d');
 const read=f=>fs.readFileSync(f,'utf8'),terrain=read('lib/house-model/alpine-terrain.ts'),viewer=read('lib/house-model/viewer.ts');
 assert(/transformed\.y-=\(cameraPosition\.y-panoramaAnchor\)\*panoramaLift/.test(terrain)&&mesh.userData.dynamic&&!mesh.frustumCulled,'lowered by the camera height in the shader, kept out of the static batches');
 assert(/panorama\.onBeforeRender=\(_r,_s,view\)=>\{if\(view!==rig\.camera\)return;panorama\.position\.set\(view\.position\.x,0,view\.position\.z\)/.test(viewer),'centred under the camera');
 assert(/panorama\.userData\.anchor\(p\.y\);panoramaAt\.copy\(p\);live\?\.invalidate\(\);/.test(viewer),'re-anchored at rest for the path tracer');
 assert(/EU-DEM layers; Austria terrain data © offene Daten Österreichs[^<]*SRTM terrain data courtesy of the U\.S\. Geological Survey/.test(read('components/studio/model/house-model.tsx')),'the elevation data credited in About this model');}
console.log(`Passed: published peaks meet the skyline within 0.15° (${seen.join(', ')}); the highest land lies at ${top}°, east-north-east stays under 1°; nearer land is drawn in front; the camera's height lowers each point by its true distance.`);
