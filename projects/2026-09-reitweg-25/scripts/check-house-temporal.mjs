import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts'],outdir:'tmp/temporal-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {tiers,tierFor}=await import('../tmp/temporal-check/device-tier.mjs');
const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),pass=read('temporal.ts'),post=read('post.ts'),viewer=read('viewer.ts');

// Extreme on a computer only.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].temporal,false,`${q} keeps no image in motion`);
assert.equal(tiers.extreme.temporal,true);assert.equal(tierFor('extreme',true,true).temporal,false,'not on a phone');
// The kept image is as large as the canvas whatever size the moving frame was drawn at, and the chain ends there:
// the focus and the finish run on it at full size.
assert(/full=renderer\.getDrawingBufferSize\(this\.size\)/.test(pass)&&/t\.setSize\(full\.x,full\.y\)/.test(pass),'the kept image is the canvas size');
assert(/if\(temporal\)\{output\.enabled=false;if\(focusPass\)focusPass\.enabled=false;\}/.test(post)&&/if\(temporal\)finishToScreen\(carryLight\(temporal\.settled,view\)\);/.test(post),'the finish runs on the kept image');
// In motion each pixel's point is looked up where the last frame saw it, by depth; a kept colour is held to the new
// frame's colours around it, and only where the last frame saw the same point may it stand a little past them.
assert(/clip=lastViewProj\*world/.test(pass)&&/texture2D\(lastDepth,at\)\.r-expected/.test(pass),'looked up by depth');
assert(/kept=clamp\(keptAt\(at\),lo-slack,hi\+slack\)/.test(pass)&&/slack=\(hi-lo\)\*\$\{TEMPORAL\.slack\.toFixed\(2\)\}\*seen\+0\.002\*seen/.test(pass),'held to the new frame');
// A point the move uncovered has no kept colour of its own: it shows the new frame at once, so nothing trails behind
// what passes in front. Elsewhere the kept colour may stand only a fifth of the local range past the new frame's.
assert(/gl_FragColor=vec4\(seen>0\.5\?mix\(kept,mine,weight\*exp\(-\$\{TEMPORAL\.falloff\.toFixed\(1\)\}\*dot\(off,off\)\)\):c,1\.0\);/.test(pass),'uncovered points show the new frame');
assert(/slack:\.2\}/.test(pass));
// A changed light or scene under a still camera shows at once; the camera's own move carries the image, and so do
// frames that follow one another without such a change.
assert(/carried=this\.valid&&\(moved\|\|!this\.fresh\)/.test(pass)&&/reset\(\)\{this\.frames=0;this\.fresh=true;\}/.test(pass)&&/if\(temporal\)temporal\.reset\(\)/.test(post),'only a camera move carries');
// Moving frames are jittered by a part of their own (larger) pixels, and the pass undoes the shift it reads from the lens.
assert(/const jitter=still\?post\.accumulated>0:post\.temporal;/.test(viewer)&&/k=still\?1:1\/drawnScale/.test(viewer),'moving frames are jittered');
assert(/q=vUv-jitter/.test(pass)&&/camera\.projectionMatrix\.elements\[8\]-lens\.elements\[8\]/.test(pass),'the jitter is undone');
// `?taa=off` is the comparison.
assert(/temporal:tier\.temporal&&new URLSearchParams\(location\.search\)\.get\('taa'\)!=='off'/.test(viewer));
console.log('Passed: in Extreme on a computer, moving frames are blended into a full-size image that travels with the camera; a point the move uncovers shows the new frame.');
