import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
// How the viewer paces its work so the rest of the computer keeps up: nothing heavy runs in the background while the
// browser is not the focused app, moving frames draw at a lower resolution and still frames at full, a dragged sun
// re-traces bounced light once it settles, and shaders for other floors, eye level and dusk are compiled ahead of use.
await build({entryPoints:['lib/house-model/device-tier.ts'],outdir:'tmp/pacing-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {tiers}=await import('../tmp/pacing-check/device-tier.mjs');
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');

// 1. Away: a blur hands the graphics card and processor back; focus resumes. Path tracing and the sky and bounce bakes
// wait while away.
assert(/addEventListener\('blur',away\)/.test(viewer)&&/addEventListener\('focus',back\)/.test(viewer),'focus is followed');
assert(/!interfaceOpen&&!elsewhere&&now-lastChange>LIVE_TRACE\.rest/.test(viewer),'tracing waits while away');
assert(/if\(!elsewhere\)\{if\(bake\?\.update\(\)\)changed\(\);if\(bounce\?\.update\(\)\)changed\(\);\}/.test(viewer),'bakes wait while away');

// 6. Motion: a lower resolution while the view moves, full resolution the moment it rests; computers only.
for(const q of ['extreme','detailed'])assert(tiers[q].motionScale>=.6&&tiers[q].motionScale<1,`${q} draws moving frames at ${tiers[q].motionScale}×`);
for(const q of ['balanced','model'])assert.equal(tiers[q].motionScale,1,`${q} keeps one resolution`);
assert(/const scaleFor=\(moving:boolean\)=>/.test(viewer)&&/post\?\.setSize\(width,height,renderer\.getPixelRatio\(\)\*scaleFor\(/.test(viewer),'the post chain resizes with motion');

// 8. A dragged sun: shadows and sky follow each step; bounced light and the traced scene wait for 150 ms of stillness.
assert(/setSun:[^\n]*clearTimeout\(sunSettle\);sunSettle=setTimeout\(\(\)=>\{bounce\?\.request\(\);live\?\.relight\(\);changed\(\);\},SUN_SETTLE\)/.test(viewer),'bounce and tracing wait for the sun to settle');
assert(/const SUN_SETTLE=150/.test(viewer),'150 ms');

// 9. Shaders for every floor, renovation, eye level and dusk compile in the background after the first frame.
assert(/const precompile=async\(\)=>/.test(viewer)&&/for\(const \[floor,lamps\] of \[\['upper',false\],\['upper',true\],\['exterior',true\]\]/.test(viewer),'upper floor and dusk variants');
assert(/canvas\.dataset\.programs=/.test(viewer),'tests can read how many programs exist');
console.log(`Passed: tracing and bakes pause while the browser is not focused; moving frames at ${tiers.extreme.motionScale}× on computers; bounce and tracing follow a dragged sun after 150 ms; shaders for other floors and dusk compile ahead.`);
