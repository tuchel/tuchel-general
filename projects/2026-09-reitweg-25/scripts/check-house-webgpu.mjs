import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/live-trace-webgpu.ts'],outdir:'tmp/webgpu-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {GPU_TRACE,unpadRows,plausible}=await import('../tmp/webgpu-check/live-trace-webgpu.mjs');
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
console.log(`Passed: WebGPU path tracing denoised at ${GPU_TRACE.stages.join(', ')} samples, copied to the WebGL view every ${GPU_TRACE.copyEvery} ms with rows flipped and unpadded; instances traced as instances with their trees built in workers; the tracer and conversions kept across rebuilds; no tracing without WebGPU.`);
