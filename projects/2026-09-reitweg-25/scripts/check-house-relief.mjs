import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import sharp from 'sharp';
await build({entryPoints:['lib/house-model/device-tier.ts','lib/house-model/surface-materials.ts'],outdir:'tmp/relief-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.json':'json'}});
const {tiers,tierFor}=await import('../tmp/relief-check/device-tier.mjs'),{RELIEF}=await import('../tmp/relief-check/surface-materials.mjs');
const surfaces=fs.readFileSync('lib/house-model/surface-materials.ts','utf8'),viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');

// Extreme on a computer only, and only on scanned sets, which carry height.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].relief,false,`${q} stays flat`);
assert.equal(tiers.extreme.relief,true);assert.equal(tierFor('extreme',true,true).relief,false,'not on a phone');
assert(/finishSurfaces\(model\.root,textures,waterTime,tier\.weathered,tier\.relief\)/.test(viewer));
assert(/depth=relief&&textures\.scanned&&levels\?RELIEF\.depth\[surface\]:0;/.test(surfaces),'scanned sets only');
// Each set with depth has a height map that says something, and the levels given for it are its own: the 2nd and
// 98th percentiles of its normal map's alpha.
for(const [name,depth] of Object.entries(RELIEF.depth)){
 assert(depth>=0&&depth<=.03,`${name}: a few centimetres at most`);
 if(!depth)continue;
 const {data}=await sharp(`public/assets/materials/scanned/${name}-1024-normal.webp`).raw().toBuffer({resolveWithObject:true});
 const counts=new Array(256).fill(0);for(let i=3;i<data.length;i+=4)counts[data[i]]++;
 const level=share=>{let sum=0;for(let v=0;v<256;v++){sum+=counts[v];if(sum>=data.length/4*share)return v;}};
 assert.deepEqual(RELIEF.height[name],[level(.02),level(.98)],`${name}: levels`);assert(RELIEF.height[name][1]-RELIEF.height[name][0]>20,`${name}: a height map that says something`);
}
// The walk down the height map: a ray over a face (height 1) stops at once; over a gap it lands between the two steps
// round the surface. The same arithmetic as the shader's.
const walk=(height,shift)=>{let at=0,last=0,hole=1-height(0),was=hole;for(let i=0;i<RELIEF.steps;i++){if(at>=hole)break;last=at;was=hole;at+=1/RELIEF.steps;hole=1-height(shift*at);}const over=was-last,under=at-hole;return last+(at-last)*Math.min(1,Math.max(0,over/Math.max(over+under,1e-4)));};
assert.equal(walk(()=>1,1),0,'a face is where it was');
const floor=walk(()=>0,1);assert(Math.abs(floor-1)<1e-6,'a gap’s floor is a full depth down');
const ramp=walk(u=>.8-.6*u,1);assert(Math.abs(ramp-.5)<.02,`a slope is met where ray and surface cross (${ramp})`);assert(Math.abs(walk(()=>.5,1)-.5)<.02,'a step half way down is met half way');
// Beyond `far` metres nothing is walked, and a glancing ray is held to `flattest`.
assert(surfaces.includes('reliefFade=1.0-smoothstep(${RELIEF.near.toFixed(1)},${RELIEF.far.toFixed(1)},reliefFar)')&&surfaces.includes('if(reliefFade>0.0){')&&RELIEF.far>RELIEF.near);
assert(surfaces.includes('${RELIEF.flattest.toFixed(2)})')&&RELIEF.flattest>=.2);
console.log(`Passed: in Extreme on a computer, scanned cladding, roof tiles, stone and decking have up to ${Math.max(...Object.values(RELIEF.depth))*100} cm of depth within ${RELIEF.far} m of the eye.`);
