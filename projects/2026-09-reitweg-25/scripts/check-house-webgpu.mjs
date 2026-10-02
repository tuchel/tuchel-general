import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/live-trace-webgpu.ts'],outdir:'tmp/webgpu-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {GPU_TRACE,unpadRows,plausible,stageChange,converged}=await import('../tmp/webgpu-check/live-trace-webgpu.mjs');
const {DataUtils}=await import('three');

// WebGPU hands back rows top down, each padded to 256 bytes; WebGL wants them bottom up and unpadded. A 3 × 2 image of
// half floats (8 bytes a pixel) comes back with 256-byte rows.
const width=3,height=2,stride=128,padded=new Uint16Array(stride*height);
for(let y=0;y<height;y++)for(let i=0;i<width*4;i++)padded[y*stride+i]=y*100+i;
const tight=unpadRows(padded,width,height);
assert.equal(tight.length,width*height*4);
assert.deepEqual([...tight.subarray(0,12)],Array.from({length:12},(_,i)=>100+i),'the top row lands last');
assert.deepEqual([...tight.subarray(12,24)],Array.from({length:12},(_,i)=>i),'the bottom row lands first');
// An empty or broken traced image is caught, so the WebGL tracer takes over: all black, or pixels that are not numbers.
const image=(f)=>{const d=new Uint16Array(320*200*4);for(let i=0;i<d.length;i++)d[i]=DataUtils.toHalfFloat(f(i));return d;};
assert(plausible(image(i=>i%4===3?1:.2)),'a lit image passes');
assert(!plausible(image(i=>i%4===3?1:0)),'an all-black image fails');
assert(!plausible(image(i=>Math.floor(i/4)%97===0?NaN:.2)),'scattered pixels that are not numbers fail');
// Tracing stops once a denoised stage looks like the one before: the change between them, in display steps of 255 after a
// simple tone curve, is under 1 on average and under 4 at the 99th percentile. Grain at the level of a settled denoise
// passes; a lamp switching on in a corner, or the whole view brightening by a tenth, does not.
const scene=i=>{const p=Math.floor(i/4),x=p%320,y=Math.floor(p/320);return i%4===3?1:.3+.5*(x/320)*(y/200);};
const same=stageChange(image(scene),image(scene));assert.equal(same.mean,0);assert(converged(same),'identical stages have converged');
let seed=7;const jitter=()=>{seed=seed*16807%2147483647;return seed/2147483647-.5;};
const grain=stageChange(image(scene),image(i=>i%4===3?1:scene(i)*(1+.006*jitter())));assert(converged(grain),`settled grain counts as converged (mean ${grain.mean.toFixed(2)}, 99th ${grain.p99.toFixed(2)})`);
const lamp=stageChange(image(scene),image(i=>{const p=Math.floor(i/4);return i%4===3?1:p%320<40&&Math.floor(p/320)<30?scene(i)*1.8:scene(i);}));assert(!converged(lamp),`a lamp in a corner has not (99th ${lamp.p99.toFixed(1)})`);
const brighter=stageChange(image(scene),image(i=>i%4===3?1:scene(i)*1.1));assert(!converged(brighter),`a view brighter by a tenth has not (mean ${brighter.mean.toFixed(1)})`);
{const gpu=fs.readFileSync('lib/house-model/live-trace-webgpu.ts','utf8');
 assert(/if\(previous&&converged\(stageChange\(previous,c\.data\)\)\)final=true/.test(gpu),'a stage like the last ends the trace');}
assert(/addEventListener\?\.\('uncapturederror'/.test(fs.readFileSync('lib/house-model/live-trace-webgpu.ts','utf8')),'validation errors count as failure');
// The denoiser's weights ship with the site, with Intel's Apache 2.0 notice; the tracer gathers enough samples first.
const weights='public'+GPU_TRACE.weights;
assert(fs.existsSync(weights)&&fs.statSync(weights).size>500000,`${weights} is present`);
assert(/Apache License/.test(fs.readFileSync('public/assets/oidn/LICENSE.txt','utf8')),'the weights carry their licence');
const {stages}=GPU_TRACE;assert(stages.every((n,i)=>!i||n>stages[i-1])&&stages[0]>=32&&stages.at(-1)<=512&&GPU_TRACE.copyEvery<=500,'stages rise, the first denoised early, a few copies a second');
assert(JSON.parse(fs.readFileSync('package.json','utf8')).dependencies['oidn-web'],'oidn-web is a dependency');
// Extreme traces on WebGPU only: without it, or once its device fails, the live view stays.
const live=fs.readFileSync('lib/house-model/live-trace.ts','utf8');
assert(!/WebGLPathTracer/.test(live),'no WebGL tracer');
assert(/if\(!\('gpu' in navigator\)\)\{unavailable=true;return;\}/.test(live)&&/if\(gpu\.failed\)\{unavailable=true;release\(\);return;\}/.test(live),'no WebGPU, or a failed device: no tracing');
// The tracer is kept: a rebuild hands it the new scene, converted with the kept cache.
assert(/instances:true,cache\}/.test(live)&&/p\.gpu\.rescene\(local\.scene,controller\.signal\)/.test(live),'a rebuild reuses the tracer and the conversions');
assert(/invalidate:\(\)=>\{abort\?\.abort\(\);abort=undefined;sceneStale=true;cameraStale=true;\}/.test(live),'invalidating keeps the tracer');
const gpu=fs.readFileSync('lib/house-model/live-trace-webgpu.ts','utf8');
const before=source=>source.indexOf('await treesInBackground(scene,signal)')>0&&source.indexOf('await treesInBackground(scene,signal)')<source.indexOf('tracer.setScene(');
assert(/isWebGPUBackend/.test(gpu),'a WebGPURenderer quietly running on WebGL 2 is not used');
assert(before(gpu)&&/new GenerateMeshBVHWorker\(\)/.test(gpu),'trees are built in workers before the tracer sees the scene');
// Only denoised images follow the first: none of the grainy ones in between stages are copied.
assert(/if\(denoised&&!settled\)/.test(gpu),'between stages the denoised image stays');
// The tracer copies the sky's filtering. Its environment shader samples the sky with a sampler, which three leaves out
// for a nearest-filtered texture (a DataTexture's default): the shader would not compile and nothing would be traced.
assert(/equirect:[^]*?const texture=new T\.DataTexture\([^\n]*texture\.minFilter=texture\.magFilter=T\.LinearFilter/.test(fs.readFileSync('lib/house-model/lighting.ts','utf8')),'the sky handed to the tracer is filtered');
// The house's scene buffers pass WebGPU's default 128 MB per storage binding (one is 144 MB); the device asks for the
// graphics card's own limits, or the first sample fails validation.
assert(/const \{maxStorageBufferBindingSize,maxBufferSize\}=adapter\.limits/.test(gpu)&&/new W\.WebGPURenderer\(\{canvas,antialias:false,requiredLimits:\{maxStorageBufferBindingSize,maxBufferSize\}\}\)/.test(gpu),'the device has the graphics card\'s buffer limits');
console.log(`Passed: a filtered sky and the graphics card's buffer limits; WebGPU path tracing denoised at ${GPU_TRACE.stages.join(', ')} samples, copied to the WebGL view every ${GPU_TRACE.copyEvery} ms with rows flipped and unpadded; instances traced as instances with their trees built in workers; the tracer and conversions kept across rebuilds; no tracing without WebGPU.`);
