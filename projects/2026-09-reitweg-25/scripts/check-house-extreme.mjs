import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/live-trace.ts'],outdir:'tmp/extreme-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {traceFade,LIVE_TRACE}=await import('../tmp/extreme-check/live-trace.mjs');

// A resting view hands over to path tracing without showing its work: the live image holds until the first cleaned
// image is in, which then fades in over a fraction of a second. Grainy samples are never shown.
assert.equal(traceFade(0),0,'starts from the live image');assert.equal(traceFade(LIVE_TRACE.fade),1,'all traced after the fade');
assert(traceFade(LIVE_TRACE.fade/2)>0&&traceFade(LIVE_TRACE.fade/2)<1,'fades in');assert(LIVE_TRACE.fade>=200&&LIVE_TRACE.fade<=800,'a short fade');
for(let t=0;t<LIVE_TRACE.fade;t+=25)assert(traceFade(t+25)>=traceFade(t));

// The viewer: only a cleaned image with its surface colours divided out is shown (the traced scene alone has none of
// the live view's texture detail); any change of view (camera, size, walking) drops back to the live image; a new floor or renovation
// rebuilds the traced scene, a new sun re-lights it; it never runs over the upper-floor section (clipping planes) or a
// photograph's own tracer.
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
assert(/const cleaned=!!traced\?\.denoised&&traced\.demodulated/.test(viewer)&&!/traceBlend/.test(viewer),'grainy or undivided traced images are never shown');
assert(/const changed=\(\)=>\{[^}]*live\?\.reset\(\)/.test(viewer),'moving drops back to the live view');
assert(/const applyState=\(\)=>\{[^]*?live\?\.invalidate\(\)[^]*?\};/.test(viewer),'a new floor or renovation rebuilds');
assert(/setSun:[^\n]*live\?\.relight\(\)/.test(viewer),'a new sun re-lights');
assert(/still&&!refine&&!needsFrame&&level!=='upper'&&!captures\?\.active/.test(viewer),'traces only a settled view, never the upper-floor section or during a photograph');
// The eye-level grass is placed around the walker; wherever it moves, the traced scene is rebuilt with it.
assert.equal((viewer.match(/grass\.(showAround\(rig\.lens\.position\)|hide\(\));live\?\.invalidate\(\)/g)||[]).length,2,'grass shown or hidden rebuilds the traced scene');
assert(/if\(grass\?\.step\(\)\)\{live\?\.invalidate\(\);/.test(viewer),'grass moved with the walker rebuilds it');
// The interface comes first: tracing, and preparing its scene, waits until the view has rested a second with no panel
// or dialog open, and the traced image is drawn a few times a second rather than every frame.
assert(LIVE_TRACE.rest>=800&&LIVE_TRACE.present>=80,'a real rest before tracing; a few draws a second');
assert(/!interfaceOpen&&!elsewhere&&now-lastChange>LIVE_TRACE\.rest/.test(viewer),'tracing waits for a rest with no panel open');
assert(/now-presented>=LIVE_TRACE\.present\|\|!live\.wanted/.test(viewer),'the traced image is drawn a few times a second, and once more when it is finished');
assert(/setInterface\(!!panel\|\|about\)/.test(fs.readFileSync('components/studio/model/house-model.tsx','utf8')),'panels and the About dialog pause tracing');
// Tests read what the view shows from the canvas: preparing, a sample count, or live.
assert(/canvas\.dataset\.trace=shown/.test(viewer)&&/canvas\.dataset\.trace='live'/.test(viewer),'the canvas reports what it shows');
console.log(`Passed: after ${LIVE_TRACE.rest} ms at rest with no panel open, the live view holds until the first cleaned traced image, which fades in over ${LIVE_TRACE.fade} ms (drawn every ${LIVE_TRACE.present} ms after); moving returns to the live view.`);
