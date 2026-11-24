import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts','lib/house-model/soft-shadows.ts'],outdir:'tmp/soft-shadows-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {tiers,tierFor}=await import('../tmp/soft-shadows-check/device-tier.mjs'),{SOFT_SHADOW,SHADOW_RANGE,packShadow,installSoftShadows}=await import('../tmp/soft-shadows-check/soft-shadows.mjs');
const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),viewer=read('viewer.ts'),lighting=read('lighting.ts'),lens=read('lens.ts');

// Extreme on a computer only; the other presets keep three's filtered shadows.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].softShadows,false,`${q} keeps its shadows`);
assert.equal(tiers.extreme.softShadows,true);assert.equal(tierFor('extreme',true,true).softShadows,false,'not on a phone');
assert(/const softened=tier\.softShadows&&new URLSearchParams\(location\.search\)\.get\('soft'\)!=='off';/.test(viewer)&&/renderer\.shadowMap\.type=softened\?T\.BasicShadowMap:T\.PCFShadowMap/.test(viewer)&&/if\(softened\)installSoftShadows\(\);/.test(viewer));
// Leaves and grass, drawn many deep, look in three places only.
assert(/#ifdef SOFT_SHADOW_PLAIN/.test(T.ShaderChunk.shadowmap_pars_fragment)===false);for(const f of ['foliage.ts','grass.ts'])assert(/plainShadow\(/.test(read(f)),f);
// Three's unfiltered lookup, and only that one, becomes the softened one; installing twice changes nothing more.
const before=T.ShaderChunk.shadowmap_pars_fragment;installSoftShadows();const after=T.ShaderChunk.shadowmap_pars_fragment;installSoftShadows();
assert.equal(T.ShaderChunk.shadowmap_pars_fragment,after);
const part=s=>s.slice(0,Math.min(s.lastIndexOf('float getShadow( sampler2D shadowMap,'),s.includes('softIgn')?s.indexOf('float softIgn'):Infinity));
assert.equal(part(after),part(before),'the filtered lookups are untouched');
assert(after.includes('shadow = softShadow( shadowMap, shadowMapSize, shadowRadius, shadowCoord.xyz );')&&!after.slice(part(after).length).includes('step( shadowCoord.z, depth )'));
// The one number the light carries: the frame's turn and the map's half width, both read back as the shader does.
for(const [turn,radius] of [[0,34],[7,34],[63,120.5],[64,60]]){const c=packShadow(turn,radius);assert.equal(Math.floor(c),turn%SOFT_SHADOW.turns);assert(Math.abs((c%1)*1024-radius)<.01);}
assert(/far:1\+radius\*SHADOW_RANGE\.perRadius\+SHADOW_RANGE\.fixed/.test(lighting)&&/fitted=radius;turnShadow\(0\);/.test(lighting),'the shadow map’s depth is the one the shader assumes');
assert(/lighting\?\.turnShadow\(jitter\?still\?post\.accumulated:moved:0\);/.test(viewer),'the pattern turns only with frames that are gathered');
// The edge: as wide as the gap to the caster times the spread, between the sharpest and the widest.
const width=(gap,radius,size)=>Math.min(SOFT_SHADOW.widest,Math.max(gap*SOFT_SHADOW.spread,SOFT_SHADOW.sharpest/size*2*radius));
assert(width(.3,34,4096)<.03,'crisp where a post meets the ground');assert(width(10,34,4096)>3*width(.3,34,4096),'a tree’s shadow ten metres on is soft');assert.equal(width(100,34,4096),SOFT_SHADOW.widest);
assert(SHADOW_RANGE.perRadius>0&&SHADOW_RANGE.fixed>0);
// The sun shafts read the same map either way.
assert(/const raw=!map\.compareFunction;/.test(lens)&&/#ifdef RAW_SHADOW/.test(lens));
console.log(`Passed: in Extreme on a computer the sun’s shadow edges widen by ${SOFT_SHADOW.spread*100} cm for each metre to what casts them, up to ${SOFT_SHADOW.widest} m; other presets keep three’s filtered shadows.`);
