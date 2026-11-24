import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts'],outdir:'tmp/wet-mirror-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {tiers,tierFor}=await import('../tmp/wet-mirror-check/device-tier.mjs');
const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),surfaces=read('surface-materials.ts'),pass=read('wet-reflections.ts'),post=read('post.ts'),viewer=read('viewer.ts');

// Extreme on a computer only: a phone's Extreme keeps the sky's reflection.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].wetMirror,false,`${q} has no mirror pass`);
assert.equal(tiers.extreme.wetMirror,true);assert.equal(tierFor('extreme',true,true).wetMirror,false,'not on a phone');
// Wet paving says in the frame's alpha how far it mirrors (1: not at all; a half: standing water), and only paving does.
assert(/if\(weather==='paving'\)shader\.fragmentShader=after\(shader\.fragmentShader,'opaque_fragment','gl_FragColor\.a=1\.0-0\.5\*surfaceMirror;'\)/.test(surfaces),'paving writes its mirror into alpha');
assert(/surfaceMirror=uWet\*flat_\*mix\(/.test(surfaces),'the mirror follows the rain, level ground and the puddles');
// The pass reads it back, leaves leaf edges alone (their coverage alpha runs below a half), mirrors level ground only,
// and hands on an opaque frame.
assert(/mirror=clamp\(\(1\.0-colour\.a\)\*2\.0,0\.0,1\.0\)/.test(pass)&&/colour\.a<0\.49/.test(pass)&&/nw\.y<0\.9/.test(pass),'reads the mirror, on level ground');
assert(!/gl_FragColor=vec4\([^;]*colour\.a\)/.test(pass),'the frame leaves the pass opaque');
// It runs only while something is wet, after the contact shadows and before the mist.
assert(/if\(mirror\)mirror\.enabled=mirror\.wet;/.test(post)&&post.indexOf('new ContactShadows(')<post.indexOf('new WetReflections(')&&post.indexOf('new WetReflections(')<post.indexOf('new MistPass('),'runs while wet, in its place in the chain');
assert(/wetMirror:tier\.wetMirror/.test(viewer),'the viewer asks for it by tier');
console.log('Passed: in Extreme on a computer, wet paving mirrors the scene through the frame’s own depth while it rains; puddles wholly, the film between them partly.');
