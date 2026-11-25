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
// Only the part of the view the pool takes up is drawn: the cropped image holds the pool, drops what lies beside it,
// shows what stands above the water and is sampled at the same reflected place.
{const box=new T.Box3(new T.Vector3(-8,+y,-2),new T.Vector3(8,+y+ +h,2)),m=new T.PerspectiveCamera(),mx=new T.Matrix4(),crop=mirrorView(camera,POOL_MIRROR.level,m,mx,box,.07);
 assert(crop[2]-crop[0]<1.6&&crop[3]-crop[1]<1,`the pool takes up part of the view (${crop.map(v=>v.toFixed(2))})`);
 const at=(p,c=m)=>new T.Vector4(p.x,p.y,p.z,1).applyMatrix4(c.matrixWorldInverse).applyMatrix4(c.projectionMatrix);
 let seen=0;for(let x=-8;x<=8;x+=2)for(const z of [-2,0,2]){const p=new T.Vector3(x,POOL_MIRROR.level,z),v=at(p,camera);if(v.w<=0||Math.abs(v.x/v.w)>1||Math.abs(v.y/v.w)>1)continue;
  seen++;const c=at(p);assert(Math.abs(c.x/c.w)<=1&&Math.abs(c.y/c.w)<=1,'all of the pool in view is inside the cropped image');}
 assert(seen>3,'the pool is in view');
 const inside=(p,c)=>{const v=at(p,c);return v.w>0&&Math.abs(v.x/v.w)<=1&&Math.abs(v.y/v.w)<=1;};
 let kept=0,all=0;for(let x=-40;x<=40;x+=2)for(let z=-40;z<=40;z+=2){const p=new T.Vector3(x,3,z);if(!inside(p,mirror))continue;all++;if(inside(p,m))kept++;}
 assert(all>50&&kept>0&&kept<.6*all,`what the pool cannot show is culled from the mirror image (${kept} of ${all} kept)`);
 const a=at(new T.Vector3(2,3,0)),b=at(new T.Vector3(2,-.5,6));assert(Math.abs(a.z/a.w)<=1&&b.z/b.w<-1,'the cropped image clips at the water line too');
 const u=new T.Vector4(through.x,through.y,through.z,1).applyMatrix4(mx),v=new T.Vector4(roof.x,roof.y,roof.z,1).applyMatrix4(mx);
 assert(Math.hypot(u.x/u.w-v.x/v.w,u.y/u.w-v.y/v.w)<1e-6,'the cropped image is sampled at the reflected place');
 assert(/mirrorView\(camera,POOL_MIRROR\.level,mirror,textureMatrix,box,2\*POOL_MIRROR\.ripple\)/.test(fs.readFileSync('lib/house-model/pool-reflection.ts','utf8')),'the mirror image is cropped to the pool with room for the ripples');}
assert.equal(tiers.extreme.poolMirror,true);for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].poolMirror,false,`${q} reflects the sky light only`);
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
assert(/if\(mirror\)timed\('mirror',\(\)=>mirror\.render\(\)\);post\.render\(still/.test(viewer),'the mirror image is drawn before each live frame');
console.log(`Passed: the pool mirrors the scene at its water line (${POOL_MIRROR.level} m), clipping everything below it, sampled where the reflection falls; Extreme only.`);
