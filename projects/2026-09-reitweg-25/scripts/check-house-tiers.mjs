import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts'],outdir:'tmp/tier-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {tiers,tierFor,detectQuality}=await import('../tmp/tier-check/device-tier.mjs');
// Detailed on a phone keeps the scene, materials and light, but fits a phone browser's graphics memory:
// a 2048 shadow map (32 MB instead of 128 MB) and 2× multisampling (64 MB instead of 129 MB at phone size).
const phone=tierFor('detailed',true),computer=tierFor('detailed',false);
assert.deepEqual(computer,tiers.detailed,'computers keep Detailed as it is');
assert.equal(phone.shadowSize,2048);assert.equal(phone.samples,2);
for(const key of ['trees','textureSize','sunBounce','ao','bloom','grass','refineFrames','pixelRatio'])assert.equal(phone[key],tiers.detailed[key],`phone Detailed keeps ${key}`);
for(const q of ['balanced','model'])assert.deepEqual(tierFor(q,true),tiers[q],`${q} is the same on phones`);
// Tracing bounced sunlight in a GPU shader ran long enough for Safari on Apple silicon to drop the WebGL context
// (Detailed failed on an M3 MacBook Pro and an iPhone 17 Pro), so it is traced on the processor, in workers.
const bounce=fs.readFileSync('lib/house-model/sun-bounce.ts','utf8');
assert(!/BVHShaderGLSL|MeshBVHUniformStruct|bvhIntersect/.test(bounce),'no ray tracing in a shader');
assert(tiers.detailed.sunBounce>0&&tiers.balanced.sunBounce>0&&tiers.model.sunBounce===0,'Detailed and Balanced bounce sunlight indoors');
// Every device starts in Detailed, an iPhone included; only a browser without WebGL2 gets the plain model.
const browser=(webgl2,agent)=>{
 const gl={getExtension:()=>({loseContext(){}}),getParameter:()=>'Apple GPU'};
 Object.assign(globalThis,{window:{matchMedia:()=>({matches:true})},document:{createElement:()=>({getContext:()=>webgl2?gl:null})},screen:{width:402,height:874}});
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:agent,hardwareConcurrency:6,deviceMemory:4},configurable:true});
};
browser(true,'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)');assert.equal(detectQuality(),'detailed','an iPhone starts in Detailed');
browser(false,'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)');assert.equal(detectQuality(),'model','no WebGL2: the plain model');
console.log('Passed: Detailed on a phone keeps its scene and light with a 2048 shadow map and 2× multisampling; other presets and computers are unchanged; bounced sunlight is traced on the processor for Detailed and Balanced.');
