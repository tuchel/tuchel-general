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
assert(GPU_TRACE.samples>=256&&GPU_TRACE.copyEvery<=500,'enough samples before denoising; a few copies a second');
assert(JSON.parse(fs.readFileSync('package.json','utf8')).dependencies['oidn-web'],'oidn-web is a dependency');
// The live tracer tries WebGPU first, falls back to WebGL when it is missing or its device is lost.
const live=fs.readFileSync('lib/house-model/live-trace.ts','utf8');
assert(/if\(webgpu&&'gpu' in navigator\)\{[^]*createWebGPUTracer[^]*\n   \}\n   webgpu=false;/.test(live),'WebGPU first, WebGL when it is unavailable');
// The WebGPU tracer traces instances, so trees and planting stay instanced; their ray-tracing trees are built in
// background workers before the tracer sees the scene, so it builds none on the page's thread.
assert(/convert\(true\)[^]*createWebGPUTracer/.test(live)&&/convert\(false\)/.test(live),'instanced for WebGPU, flattened for WebGL');
const before=gpuSource=>gpuSource.indexOf('await treesInBackground(scene,signal)')>0&&gpuSource.indexOf('await treesInBackground(scene,signal)')<gpuSource.indexOf('tracer.setScene(');
assert(/if\(gpu\.failed\)\{webgpu=false;release\(\);return;\}/.test(live),'a lost WebGPU device hands over to WebGL');
const gpu=fs.readFileSync('lib/house-model/live-trace-webgpu.ts','utf8');
assert(/isWebGPUBackend/.test(gpu),'a WebGPURenderer quietly running on WebGL 2 is not used');
assert(before(gpu)&&/new GenerateMeshBVHWorker\(\)/.test(gpu),'trees are built in workers before the tracer sees the scene');
console.log(`Passed: WebGPU path tracing with Open Image Denoise after ${GPU_TRACE.samples} samples, copied to the WebGL view every ${GPU_TRACE.copyEvery} ms with rows flipped and unpadded; instances traced as instances with their trees built in workers; WebGL tracing wherever WebGPU is missing or lost.`);
