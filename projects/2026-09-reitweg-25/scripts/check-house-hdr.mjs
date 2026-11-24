import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts','lib/house-model/hdr.ts'],outdir:'tmp/hdr-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {tiers,tierFor}=await import('../tmp/hdr-check/device-tier.mjs'),{HDR}=await import('../tmp/hdr-check/hdr.mjs');
const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),hdr=read('hdr.ts'),post=read('post.ts'),viewer=read('viewer.ts');

// Extreme on a computer only.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].hdr,false,`${q} stays under white`);
assert.equal(tiers.extreme.hdr,true);assert.equal(tierFor('extreme',true,true).hdr,false,'not on a phone');
// Light up to the knee keeps the finished look exactly; above it the gain rises without a step, and stops at the peak.
const gain=light=>Math.min(HDR.peak,Math.max(1,(light/HDR.knee)**HDR.curve));
assert.equal(gain(HDR.knee*.5),1);assert.equal(gain(HDR.knee),1);assert(gain(HDR.knee*1.01)<1.02);assert(gain(1)>1.5&&gain(1)<=HDR.peak);assert.equal(gain(100),HDR.peak);
assert(post.includes('if(uHdr>1.0)gl_FragColor.rgb*=clamp(pow(sceneLight/${HDR.knee.toFixed(2)},${HDR.curve.toFixed(2)}),1.0,uHdr);'),'the finish applies that gain');
assert(/float sceneLight=dot\(gl_FragColor\.rgb,vec3\(0\.2126,0\.7152,0\.0722\)\)\*toneMappingExposure;/.test(post),'from the exposed scene, before the finish presses it under white');
// Only while the screen is being given it, and never into a photograph or a recording (those leave in sRGB).
assert(/hdr:\(\)=>screen&&renderer\.outputColorSpace===DisplayP3ColorSpace\?HDR\.peak:0/.test(viewer),'live view only');
// Tried only where the screen shows above white and the browser can copy a floating-point canvas to WebGPU; the
// canvas is made with alpha for that, and anything refused leaves the view as it was.
assert(/\(dynamic-range: high\)/.test(hdr)&&/'drawingBufferStorage' in WebGL2RenderingContext\.prototype/.test(hdr)&&/'gpu' in navigator/.test(hdr));
assert(/const bright=tier\.hdr&&hdrWanted\(\);/.test(viewer)&&/alpha:bright/.test(viewer));
assert(/toneMapping\?\.mode!=='extended'\)return;/.test(hdr)&&/drawingBufferFormat!==gl\.RGBA16F\)return;/.test(hdr)&&/catch\{return;\}/.test(hdr),'refusals leave the canvas alone');
// Every frame drawn on the canvas reaches the screen over it.
assert(/if\(screen&&renderer\.info\.render\.frame!==shown\)\{shown=renderer\.info\.render\.frame;screen\.present\(\);\}/.test(viewer));
console.log(`Passed: in Extreme on a computer whose screen shows above white, light over ${HDR.knee} of the exposure is shown up to ${HDR.peak} times white; photographs, recordings and other screens are unchanged.`);
