import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts'],outdir:'tmp/tier-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {tiers,tierFor,detectQuality,qualityFromParam}=await import('../tmp/tier-check/device-tier.mjs');
// Detailed on a phone keeps the scene, materials and light, but fits a phone browser's graphics memory:
// a 2048 shadow map (32 MB instead of 128 MB) and 2× multisampling (64 MB instead of 129 MB at phone size).
const phone=tierFor('detailed',true),computer=tierFor('detailed',false);
assert.deepEqual(computer,tiers.detailed,'computers keep Detailed as it is');
assert.equal(phone.shadowSize,2048);assert.equal(phone.samples,2);
for(const key of ['trees','textureSize','sunBounce','ao','bloom','grass','refineFrames','pixelRatio'])assert.equal(phone[key],tiers.detailed[key],`phone Detailed keeps ${key}`);
for(const q of ['balanced','model'])assert.deepEqual(tierFor(q,true),tiers[q],`${q} is the same on phones`);
// Extreme is Detailed with everything raised, for a computer's graphics card: the full Retina resolution, a sharper shadow
// map, a longer settle and more bounce rays, and path tracing in the viewport whenever the camera rests.
const extreme=tierFor('extreme',false);
assert.equal(extreme.quality,'extreme');assert.equal(extreme.liveTrace,true,'Extreme path-traces when still');
for(const key of ['pixelRatio','refineFrames'])assert(extreme[key]>tiers.detailed[key],`Extreme raises ${key}`);
// The resting path trace gives shadows and bounced light in full, so the live view keeps Detailed's shadow map and
// bounce bake rather than spend graphics memory and processor time on them.
for(const key of ['shadowSize','sunBounce'])assert.equal(extreme[key],tiers.detailed[key],`Extreme keeps Detailed's ${key}`);
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].liveTrace,false,`${q} keeps the raster view`);
// A phone never runs Extreme, even from a link: it gets phone Detailed.
assert.deepEqual(tierFor('extreme',true),tierFor('detailed',true),'Extreme on a phone is phone Detailed');
assert.equal(qualityFromParam('extreme'),'extreme');
// Tracing bounced sunlight in a GPU shader ran long enough for Safari on Apple silicon to drop the WebGL context
// (Detailed failed on an M3 MacBook Pro and an iPhone 17 Pro), so it is traced on the processor, in workers.
const bounce=fs.readFileSync('lib/house-model/sun-bounce.ts','utf8');
assert(!/BVHShaderGLSL|MeshBVHUniformStruct|bvhIntersect/.test(bounce),'no ray tracing in a shader');
assert(tiers.detailed.sunBounce>0&&tiers.balanced.sunBounce>0&&tiers.model.sunBounce===0,'Detailed and Balanced bounce sunlight indoors');
// Computers start in Detailed and phones in Balanced (Detailed stutters every few seconds on an iPhone 17 Pro);
// only a browser without WebGL2 gets the plain model.
const iPhone={agent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',touch:true,width:402,height:874,cores:6,memory:4};
const mac={agent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',touch:false,width:1512,height:982,cores:4,memory:4};
const browser=(webgl2,{agent,touch,width,height,cores,memory})=>{
 const gl={getExtension:()=>({loseContext(){}}),getParameter:()=>'Apple GPU'};
 Object.assign(globalThis,{window:{matchMedia:()=>({matches:touch})},document:{createElement:()=>({getContext:()=>webgl2?gl:null})},screen:{width,height}});
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:agent,hardwareConcurrency:cores,deviceMemory:memory},configurable:true});
};
browser(true,iPhone);assert.equal(detectQuality(),'balanced','an iPhone starts in Balanced');
browser(true,mac);assert.equal(detectQuality(),'detailed','a computer starts in Detailed');
browser(false,iPhone);assert.equal(detectQuality(),'model','no WebGL2: the plain model');
// Extreme is only ever chosen, never detected.
for(const device of [iPhone,mac]){browser(true,device);assert.notEqual(detectQuality(),'extreme');}
console.log('Passed: computers start in Detailed and phones in Balanced; Extreme is opt-in, computer-only, sharper and path-traced when still; Detailed on a phone keeps its scene and light with a 2048 shadow map and 2× multisampling; other presets and computers are unchanged; bounced sunlight is traced on the processor for Detailed and Balanced.');
