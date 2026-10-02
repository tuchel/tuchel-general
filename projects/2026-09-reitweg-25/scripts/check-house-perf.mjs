import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
// The performance readout (`?debug=perf`): graphics-card time per render pass, processor time per frame, what is drawn,
// and how a resting path trace progresses. It costs nothing unless asked for.
await build({entryPoints:['lib/house-model/perf-readout.ts'],outdir:'tmp/perf-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {rolling,traceClock,readoutText}=await import('../tmp/perf-check/perf-readout.mjs');

// Rolling means over the last frames.
const r=rolling(3);assert(Number.isNaN(r.mean),'no reading before a value');
for(const v of [1,2,3,10])r.add(v);assert.equal(r.mean,5,'mean of the last three');

// The trace clock runs from the moment the view rests.
const c=traceClock();
c.step(500,{samples:4,denoised:0},false);assert(Number.isNaN(c.firstImage),'nothing counts before a rest');
c.rest(1000);c.ready(2500);
c.step(1100,undefined,false);
c.step(4000,{samples:8,denoised:0},false);
c.step(6000,{samples:64,denoised:64},false);
c.step(9000,{samples:256,denoised:256},false);
c.step(12000,{samples:512,denoised:512},true);
assert.equal(c.sceneReady,1500,'scene ready 1.5 s into the rest');
assert.equal(c.firstImage,3000,'first image at 3 s');
assert.equal(c.firstDenoised,5000,'first denoised image at 5 s');
assert.equal(c.finished,11000,'finished at 11 s');
assert.equal(Math.round(c.samplesPerSecond),63,'504 samples in 8 s after the first image');
assert.equal(c.stage,512,'the denoised stage on show');
c.rest(20000);assert(Number.isNaN(c.firstImage)&&Number.isNaN(c.finished),'a new rest starts afresh');

// The text: unknown values read as a dash, never NaN.
const text=readoutText({quality:'extreme',pixelRatio:2,motionScale:.7,moving:true,fps:58.6,cpu:4.12,gpu:new Map([['scene',6.23],['ao',1.1]]),gpuAvailable:true,draws:412,triangles:3.1e6,programs:124,trace:{phase:'sampling',clock:c}});
assert(/extreme · 2× pixels, 0\.7× while moving · 59 fps · 4\.1 ms processor a frame/.test(text),text);
assert(/scene 6\.2 · ao 1\.1/.test(text)&&/412 draws · 3\.10 M triangles · 124 programs/.test(text),text);
assert(/trace sampling · scene –/.test(text)&&!/NaN/.test(text),text);
assert(/graphics-card timers unavailable/.test(readoutText({quality:'detailed',pixelRatio:2,motionScale:1,moving:false,fps:0,cpu:NaN,gpu:new Map(),gpuAvailable:false,draws:0,triangles:0,programs:0})),'says when the browser has no timers');

// Wiring: only `?debug=perf` builds it; each pass of the chain, the mirror and the bakes are timed; draws are counted
// over the whole frame.
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8'),post=fs.readFileSync('lib/house-model/post.ts','utf8');
assert(/new URLSearchParams\(location\.search\)\.get\('debug'\)==='perf'\?createPerfReadout\(/.test(viewer),'only on request');
assert(/passes:\(?\[\['scene',scenePass\]/.test(post),'the chain names its passes');
assert(/perf\?\.watch\(post\.passes\)/.test(viewer)&&/timed\('mirror',/.test(viewer)&&/timed\('trace blend',/.test(viewer),'passes, the mirror and the traced image are timed');
// Bakes and the sky are polled every frame and mostly idle: only calls that did work are kept, and they do not count
// as drawn frames.
assert(/baked\('sky bake',\(\)=>bake\.update\(\)\)/.test(viewer)&&/baked\('bounce bake',\(\)=>bounce\.update\(\)\)/.test(viewer)&&/baked\('sky',\(\)=>lighting\.update\(camera,now\)\)/.test(viewer),'bakes and the sky are timed when they work');
assert(/renderer\.info\.autoReset=false/.test(fs.readFileSync('lib/house-model/perf-readout.ts','utf8')),'draws are counted over the whole frame');
console.log('Passed: rolling means; the trace clock from rest to scene, first image, first denoised image and finish, with samples per second; readable text without NaN; built only for ?debug=perf, timing each pass, the mirror and the bakes.');
