import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/lens.ts','lib/house-model/device-tier.ts'],outdir:'tmp/lens-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {LENS,circleOfConfusion,focalLength,meterCorrection,inScatter}=await import('../tmp/lens-check/lens.mjs');
const {tiers}=await import('../tmp/lens-check/device-tier.mjs');

// The lens: a full-frame camera at f/2.8. At eye level (58° vertical, a 21.6 mm lens) focused on a table 3 m away, the
// garden beyond blurs by a few pixels on a 1890-pixel-high Retina screen, a chair 1 m away by more; from the air
// (36°, focused on the house 60 m away) nothing blurs by a pixel.
const retina=1890;
assert(Math.abs(focalLength(58)*1000-21.6)<.1,`eye-level lens ${(focalLength(58)*1000).toFixed(1)} mm`);
const far=circleOfConfusion(1e6,3,58,retina),near=circleOfConfusion(1,3,58,retina);
assert(far>3&&far<7,`background blur ${far.toFixed(1)} px`);assert(near>far&&near<=LENS.maxBlur,`foreground blur ${near.toFixed(1)} px`);
assert.equal(circleOfConfusion(3,3,58,retina),0,'the focused distance is sharp');
assert(circleOfConfusion(120,60,36,retina)<1&&circleOfConfusion(30,60,36,retina)<1,'aerial views blur less than a pixel, so the overviews skip the pass');
// Metering adjusts at most half a stop, by half the difference from a sunlit garden view, which it leaves alone.
const neutral=Math.log2(LENS.meter.key/2);
assert(Math.abs(meterCorrection(neutral,2)-1)<1e-9,'a scene at the key is left alone');
assert(Math.abs(meterCorrection(neutral-1,2)-Math.SQRT2)<1e-9,'a stop darker is lifted half a stop');
assert(Math.abs(meterCorrection(neutral-6,2)-Math.SQRT2)<1e-12,'at most half a stop brighter');assert(Math.abs(meterCorrection(neutral+6,2)-Math.SQRT1_2)<1e-12,'at most half a stop darker');
// Air: a sunbeam crossing a room scatters under a hundredth of the sunlight toward a camera looking along it; open air
// along the whole march, even straight toward the sun, returns under 1.5% (a sunlit white wall returns about 25%), so
// shafts stay gentle and never veil the view; looking toward the sun scatters more than across the beam.
const beam=inScatter(Math.cos(Math.PI/6),1)*3,toSun=inScatter(1,0)*LENS.air.reach;
assert(beam>.004&&beam<.01,`a 3 m beam returns ${(beam*100).toFixed(2)}% of the sunlight`);
assert(toSun<.015,`open air toward the sun returns ${(toSun*100).toFixed(2)}%`);
assert(inScatter(1,1)>inScatter(0,1)*3,'forward scattering');
assert(LENS.air.room<=6,'room air only near the camera');
assert(LENS.grain>0&&LENS.grain<=.04,'grain is subtle');
// Only Extreme has the lens; the post chain applies it after the scene and before the finish.
assert.equal(tiers.extreme.lens,true);for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].lens,false,`${q} has no lens`);
const post=fs.readFileSync('lib/house-model/post.ts','utf8');
const order=['new DepthCapture','new SunShafts','new Meter','new AccumulatePass','new FocusPass','new FinishedOutput'].map(k=>post.indexOf(k));
assert(order.every((v,i)=>v>0&&(i===0||v>order[i-1])),'depth, shafts, meter, settle, focus, finish');
// A traced image of the same view takes the live view's haze (by depth, as three's fog) and its sky, where no surface is
// hit; grain uses float arithmetic only, since the output pass compiles as GLSL ES 1.0.
assert(/smoothstep\(fogRange\.x,fogRange\.y,d\)/.test(post)&&/d>=far\*0\.999\?live/.test(post),'traced images get haze and the live sky');
const grain=post.slice(post.indexOf('if(uGrain>0.0)'),post.indexOf('#ifdef SRGB_TRANSFER`'));
assert(grain.length>0&&!/\buint\b|>>|\^/.test(grain),'grain hash is GLSL ES 1.0');
console.log(`Passed: an f/${LENS.fNumber} full-frame lens blurs the garden ${far.toFixed(1)} px behind a table 3 m away and nothing from the air; metering moves at most ${LENS.meter.stops} stop either way; a sunbeam returns ${(beam*100).toFixed(1)}% of the sunlight; Extreme only.`);
