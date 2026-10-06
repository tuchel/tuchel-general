import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// The woods beyond the garden's own setting, from OpenStreetMap's woodland outlines (forests.json, built by
// scripts/build-forests.mjs): each stands on the land's own height at a stand's height, from 120 m out, where the traced
// trees end. From the east roof window the spruce wood beyond the pasture tops out a few degrees above eye level, as
// the owner's photographs show.
await build({entryPoints:['lib/house-model/forests.ts','lib/house-model/site-data.ts'],outdir:'tmp/forests-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error',loader:{'.json':'json'}});
const {FORESTS,distantWoods,standing,footing,STAND_HEIGHT}=await import('../tmp/forests-check/forests.mjs'),{plotOutline}=await import('../tmp/forests-check/site-data.mjs');
assert.match(FORESTS.source.licence,/ODbL/);assert.match(FORESTS.source.attribution,/OpenStreetMap contributors/);
assert(FORESTS.woods.length>=5,`${FORESTS.woods.length} woods`);
const inside=([x,z],poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
for(const w of FORESTS.woods){const p=w.points;
 for(let i=0;i<p.length;i+=3){assert(Math.hypot(p[i],p[i+1])>=119,`a wood's edge 120 m out or more (${p[i].toFixed(0)}, ${p[i+1].toFixed(0)})`);assert(!inside([p[i],p[i+1]],plotOutline));assert(Math.abs(p[i])<=701&&Math.abs(p[i+1])<=701);}
 assert(['needleleaved','broadleaved','mixed'].includes(w.leaf),'a leaf type for each wood');}
// Drawn on the model's level ground: on higher land at most 3 m above it, and only where their crowns rise above it.
const ground=x=>-5*T.MathUtils.smoothstep(x,55,140),drawn=standing(ground);
assert(drawn.length>=5,`${drawn.length} woods drawn`);
assert([[5,0],[-8,0],[-3,200]].every(([land,x])=>footing(land,x,ground)<=ground(x)+3&&footing(land,x,ground)<=land),'never more than 3 m above the model ground');
// The mesh: finite, walls from below the model's ground to the canopy.
const mesh=distantWoods(ground),pos=mesh.geometry.attributes.position;
for(let i=0;i<pos.count;i++)assert(Number.isFinite(pos.getX(i)+pos.getY(i)+pos.getZ(i)));
assert(mesh.userData.walls.every(([x,base,top,land])=>base<=Math.min(land,ground(x))&&land<=ground(x)+3&&top-land>=STAND_HEIGHT.broadleaved*.7&&top-land<=STAND_HEIGHT.needleleaved*1.2),'walls reach from below the model ground to a stand’s height');
// From the east roof window (the owner's photographs), the woods across the pasture top out 2–7° above eye level.
mesh.updateMatrixWorld(true);const ray=new T.Raycaster(),eye=new T.Vector3(4.26,5.05,2.8);mesh.material.side=T.DoubleSide;
const top=heading=>{let lo=-5,hi=20;for(let k=0;k<30;k++){const m=(lo+hi)/2,h=heading*Math.PI/180,e=m*Math.PI/180;ray.set(eye,new T.Vector3(Math.sin(h)*Math.cos(e),Math.sin(e),-Math.cos(h)*Math.cos(e)));if(ray.intersectObject(mesh,false).length)lo=m;else hi=m;}return lo;};
const angles=[95,105,115].map(top);
for(const a of angles)assert(a>2&&a<7,`the woods east top out ${a.toFixed(1)}° above the roof window`);
// Shown from eye level only: from above, a wood drawn as its edge and canopy would read as a block.
{const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');assert(/woods=setting\?\.vegetation\.getObjectByName\('distant-woods'\);if\(woods\)woods\.visible=false;/.test(viewer)&&/place=key as Place;if\(woods\)woods\.visible=true;/.test(viewer)&&/leaveEyeLevel=\(\)=>\{if\(!place\)return;place=undefined;if\(woods\)woods\.visible=false;/.test(viewer),'eye level only');
 assert(mesh.userData.dynamic,'kept out of the static batches, so it can be shown and hidden');}
// Credited in About this model.
assert(/© OpenStreetMap contributors, ODbL/.test(fs.readFileSync('components/studio/model/house-model.tsx','utf8')),'credited in About this model');
console.log(`Passed: ${FORESTS.woods.length} woods from OpenStreetMap, 120 m out or more, ${drawn.length} drawn where the model's ground carries them, on the land's own height at a stand's height; from the east roof window they top out ${angles.map(a=>a.toFixed(1)).join(', ')}° above eye level, as photographed; credited.`);
