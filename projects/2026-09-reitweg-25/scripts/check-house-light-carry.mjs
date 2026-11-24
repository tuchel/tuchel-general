import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import * as T from 'three';
await build({entryPoints:['lib/house-model/device-tier.ts','lib/house-model/carry.ts'],outdir:'tmp/light-carry-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.json':'json'}});
const {tiers,tierFor}=await import('../tmp/light-carry-check/device-tier.mjs'),{LIGHT_CARRY,lightCarried,lightCarryGlsl}=await import('../tmp/light-carry-check/carry.mjs');
const post=fs.readFileSync('lib/house-model/post.ts','utf8'),viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');

// Extreme on a computer only (it needs the live trace).
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].lightCarry,false,`${q} has no traced light to carry`);
assert.equal(tiers.extreme.lightCarry,true);assert.equal(tierFor('extreme',true,true).lightCarry,false,'not on a phone');
// How much of the traced light a view keeps: all of it near the view it was traced for, none past `move` m or `turn`.
const at=(x,turn=0)=>{const c=new T.PerspectiveCamera();c.position.set(x,1.6,0);c.rotation.y=turn;c.updateMatrixWorld();return c;};
const kept=at(0);
assert.equal(lightCarried(kept,at(0)),1);assert.equal(lightCarried(kept,at(LIGHT_CARRY.move*LIGHT_CARRY.full*.9)),1,'full through most of the range');
assert.equal(lightCarried(kept,at(LIGHT_CARRY.move*1.01)),0);assert.equal(lightCarried(kept,at(0,LIGHT_CARRY.turn*1.01)),0);
const mid=lightCarried(kept,at(LIGHT_CARRY.move*(1+LIGHT_CARRY.full)/2));assert(mid>.3&&mid<.7,`it fades out toward the limit (${mid})`);
assert(LIGHT_CARRY.move>=3,'several steps');
// What is carried is the traced image over the live one it replaced, point by point: light, not surface. In a moving
// frame each pixel's point is looked up where the traced view saw it; a point that view did not see, or saw near its
// edge, takes the light of its part of the frame.
assert(/clamp\(\(t\+0\.004\)\/\(live\+0\.004\),\$\{LIGHT_CARRY\.least\.toFixed\(2\)\},\$\{LIGHT_CARRY\.most\.toFixed\(1\)\}\)/.test(post),'the ratio is bounded');
assert(lightCarryGlsl.includes('abs(texture2D(prevDepth,at).r-expected)<')&&lightCarryGlsl.includes(`smoothstep(0.0,${LIGHT_CARRY.edge.toFixed(2)},min(min(at.x,at.y),min(1.0-at.x,1.0-at.y)))`));
assert(lightCarryGlsl.includes(`gl_FragColor=vec4(c.rgb*mix(vec3(1.0),mix(texture2D(ratio,clamp(at,0.0,1.0),${LIGHT_CARRY.coarse.toFixed(1)}).rgb,texture2D(ratio,at).rgb,valid),amount),c.a);`),'an unseen point takes the light of its part of the frame');
assert(/ratio:new T\.WebGLRenderTarget\(1,1,\{type:T\.HalfFloatType,depthBuffer:false,generateMipmaps:true,minFilter:T\.LinearMipmapLinearFilter\}\)/.test(post));
// Only under the scene, sun and weather the image was traced for.
// Until it has been judged on a real graphics card it is asked for with `?carry=on`.
assert(/const carrying=tier\.lightCarry&&new URLSearchParams\(location\.search\)\.get\('carry'\)==='on';/.test(viewer));
assert(/carry:carrying&&live&&level!=='upper'&&!snow\.amount&&!raining&&!wet\.value\?live\.generation:undefined/.test(viewer));
assert(/kept\.generation===view\.carry/.test(post));
console.log(`Passed: in Extreme on a computer with ?carry=on, a path-traced view's light stays on the surfaces it lit while the camera moves up to ${LIGHT_CARRY.move} m or turns ${Math.round(LIGHT_CARRY.turn*180/Math.PI)}°, fading out toward that limit.`);
