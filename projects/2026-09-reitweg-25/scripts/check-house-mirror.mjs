import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/pool-reflection.ts','lib/house-model/device-tier.ts'],outdir:'tmp/mirror-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {POOL_MIRROR,mirrorView}=await import('../tmp/mirror-check/pool-reflection.mjs');
const {tiers}=await import('../tmp/mirror-check/device-tier.mjs');

// The mirror lies on the water: the pool's surface is a 6 mm slab centred 85 mm below the coping (pool.ts).
const pool=fs.readFileSync('lib/house-model/pool.ts','utf8'),[,y,h]=pool.match(/box\('pool-water',0,(-?[\d.]+),0,16,([\d.]+),4,water\)/);
assert(Math.abs(POOL_MIRROR.level-(+y+ +h/2))<1e-9,`mirror at the water surface (${POOL_MIRROR.level} m)`);
// From a standing eye beside the pool, looking across it: a point on the house appears in the mirror where its
// reflection in the water would; anything below the water line falls outside the mirror image's depth range.
const camera=new T.PerspectiveCamera(58,16/10,.05,3000);camera.position.set(-12,1.6,18);camera.lookAt(0,0,8);camera.updateProjectionMatrix();camera.updateMatrixWorld();
const mirror=new T.PerspectiveCamera(),matrix=new T.Matrix4();mirrorView(camera,POOL_MIRROR.level,mirror,matrix);
const ndc=(p)=>new T.Vector4(p.x,p.y,p.z,1).applyMatrix4(mirror.matrixWorldInverse).applyMatrix4(mirror.projectionMatrix);
const above=ndc(new T.Vector3(2,3,0)),below=ndc(new T.Vector3(2,-.5,6));
assert(Math.abs(above.z/above.w)<=1,'what stands above the water is in the mirror image');
assert(below.z/below.w<-1,'the pool floor and walls below the water are clipped away');
// The texture lookup: a point's reflection projects through the eye to where the water shows it.
const roof=new T.Vector3(2,6,0),image=roof.clone();image.y=2*POOL_MIRROR.level-roof.y;
const eye=camera.position,through=eye.clone().add(image.clone().sub(eye).multiplyScalar((eye.y-POOL_MIRROR.level)/(eye.y-image.y)));
const uv=new T.Vector4(through.x,through.y,through.z,1).applyMatrix4(matrix),r=new T.Vector4(roof.x,roof.y,roof.z,1).applyMatrix4(matrix);
assert(Math.hypot(uv.x/uv.w-r.x/r.w,uv.y/uv.w-r.y/r.w)<1e-6,'the water samples the reflected roof at the right place');
assert.equal(tiers.extreme.poolMirror,true);for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].poolMirror,false,`${q} reflects the sky light only`);
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
assert(/mirror\?\.render\(\);[^\n]*post\.render\(still/.test(viewer),'the mirror image is drawn before each live frame');
console.log(`Passed: the pool mirrors the scene at its water line (${POOL_MIRROR.level} m), clipping everything below it, sampled where the reflection falls; Extreme only.`);
