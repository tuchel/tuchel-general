import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts','lib/house-model/atmosphere.ts'],outdir:'tmp/living-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.json':'json'}});
const {tiers,tierFor}=await import('../tmp/living-check/device-tier.mjs'),{atmosphere,STIR}=await import('../tmp/living-check/atmosphere.mjs');
const T=await import('three');
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');

// Extreme on a computer only.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].living,false,`${q} is still unless Breeze is on`);
assert.equal(tiers.extreme.living,true);assert.equal(tierFor('extreme',true,true).living,false,'not on a phone');
// The air stirs as much as the camera's move asks or the Breeze switch gives, whichever is more.
const air=atmosphere(new T.Object3D());
assert.equal(air.breezing,false);air.stir(.4);assert.equal(air.breezing,true);air.stir(0);assert.equal(air.breezing,false);
air.breeze(true);air.stir(0);assert.equal(air.breezing,true,'Breeze holds it up');air.breeze(false);assert.equal(air.breezing,false);
// It rises while the camera moves and falls within a second of its stopping, so the view comes to rest, sharpens and is
// path-traced as before. Not for those who ask for less motion.
assert(STIR.fall<=1&&STIR.rise>=STIR.fall);
assert(/if\(tier\.living&&!reduced&&captures\)\{const to=moving\?1:0;if\(stir!==to\)\{stir=to>stir\?Math\.min\(1,stir\+delta\/STIR\.rise\):Math\.max\(0,stir-delta\/STIR\.fall\);captures\.stir\(stir\);if\(stir>0\)needsFrame=true;else changed\(\);\}\}/.test(viewer));
// While it falls under a camera that has stopped, frames go on being blended into the kept image; at rest the view starts afresh.
assert(/carried=this\.valid&&\(moved\|\|!this\.fresh\)/.test(fs.readFileSync('lib/house-model/temporal.ts','utf8')));
// Only the Breeze switch drifts the clouds and redraws the sun's shadows each frame: both would cost a moving frame dear.
assert(/if\(captures\?\.breezeOn\)lighting\?\.drift\(captures\.waterSeconds\);/.test(viewer)&&/if\(motion&&captures\?\.breezeOn&&tier\.photographic\)renderer\.shadowMap\.needsUpdate=true;/.test(viewer));
console.log(`Passed: in Extreme on a computer, leaves, grass and water stir while the camera moves and come to rest ${STIR.fall} s after it stops.`);
