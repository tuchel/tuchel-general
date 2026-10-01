import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/live-trace.ts'],outdir:'tmp/extreme-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {traceBlend,LIVE_TRACE}=await import('../tmp/extreme-check/live-trace.mjs');

// A resting view hands over to path tracing gradually: the live image until the traced one has a couple of samples,
// all traced from 48; grain is smoothed at first and not at all once the image has settled.
assert.equal(traceBlend(0).amount,0);assert.equal(traceBlend(2).amount,0,'hidden for the first samples');
assert(traceBlend(16).amount>0&&traceBlend(16).amount<1,'blends in');assert.equal(traceBlend(48).amount,1,'all traced from 48 samples');
for(let n=0;n<LIVE_TRACE.samples;n+=7){assert(traceBlend(n+7).amount>=traceBlend(n).amount);assert(traceBlend(n+7).radius<=traceBlend(n).radius);}
assert(traceBlend(1).radius>2,'grainy samples are smoothed');assert.equal(traceBlend(256).radius,0,'a settled image is shown as traced');
assert(LIVE_TRACE.samples>=512,'tracing runs long enough to settle');

// The viewer: any change of view (camera, size, walking) drops back to the live image; a new floor or renovation
// rebuilds the traced scene, a new sun re-lights it; it never runs over the upper-floor section (clipping planes) or a
// photograph's own tracer.
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
assert(/const changed=\(\)=>\{[^}]*live\?\.reset\(\)/.test(viewer),'moving drops back to the live view');
assert(/const applyState=\(\)=>\{[^]*?live\?\.invalidate\(\)[^]*?\};/.test(viewer),'a new floor or renovation rebuilds');
assert(/setSun:[^\n]*live\?\.relight\(\)/.test(viewer),'a new sun re-lights');
assert(/still&&!refine&&!needsFrame&&level!=='upper'&&!captures\?\.active/.test(viewer),'traces only a settled view, never the upper-floor section or during a photograph');
// The eye-level grass is placed around the walker; wherever it moves, the traced scene is rebuilt with it.
assert.equal((viewer.match(/grass\.(showAround\(rig\.lens\.position\)|hide\(\));live\?\.invalidate\(\)/g)||[]).length,3,'grass moves rebuild the traced scene');
// Tests read what the view shows from the canvas: preparing, a sample count, or live.
assert(/canvas\.dataset\.trace=shown/.test(viewer)&&/canvas\.dataset\.trace='live'/.test(viewer),'the canvas reports what it shows');
console.log(`Passed: a resting view blends to path tracing from ${LIVE_TRACE.show[0]} to ${LIVE_TRACE.show[1]} samples, smoothed until ${LIVE_TRACE.filter.until}, up to ${LIVE_TRACE.samples}; moving returns to the live view.`);
