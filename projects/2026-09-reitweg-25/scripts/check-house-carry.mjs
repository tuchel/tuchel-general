import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// Small moves keep the traced look (Extreme). The last denoised traced image is kept with the view it was traced for
// and that view's depth. After a step or a small turn, the new view shows it moved into place: each pixel's point, from
// the new view's depth, is looked up where the kept view saw it, and kept only where the kept depth agrees, so what the
// move uncovered shows the live image. It holds until the new trace's first denoised image replaces it; a new scene or
// sun, or a move beyond 1.5 m or 30°, drops it.
await build({entryPoints:['lib/house-model/carry.ts'],outdir:'tmp/carry-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {CARRY,carryApplies,reproject}=await import('../tmp/carry-check/carry.mjs');

const camera=(x,yaw)=>{const c=new T.PerspectiveCamera(58,1.6,.05,3000);c.position.set(x,1.65,0);c.rotation.set(0,yaw,0);c.updateMatrixWorld();c.updateProjectionMatrix();return c;};
const kept=camera(0,0),now=camera(.4,T.MathUtils.degToRad(6));
const view=c=>({viewProjection:new T.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse),view:c.matrixWorldInverse.clone()});
// Points in front of both views: from the new view's pixel and depth to where the kept view saw them.
{let worst=0,checked=0;
 for(let i=0;i<500;i++){
  const p=new T.Vector3(Math.sin(i)*3,1+Math.cos(i*1.7),-3-(i%17));
  const ndc=p.clone().project(now);if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1)continue;
  const uv=new T.Vector2(ndc.x*.5+.5,ndc.y*.5+.5),depth=-p.clone().applyMatrix4(now.matrixWorldInverse).z;
  const want=p.clone().project(kept),expect=-p.clone().applyMatrix4(kept.matrixWorldInverse).z;if(Math.abs(want.x)>.99||Math.abs(want.y)>.99||expect<=0)continue;
  const r=reproject(uv,depth,now,view(kept),expect);
  assert(r.valid,'a point both views see is carried');
  worst=Math.max(worst,Math.hypot(r.uv.x-(want.x*.5+.5),r.uv.y-(want.y*.5+.5)));checked++;
 }
 assert(checked>100&&worst<1e-5,`${checked} points land where the kept view saw them (worst ${worst.toExponential(1)})`);}
// Where the kept view saw something nearer (the move uncovered this point), the live image shows.
{const p=new T.Vector3(.5,1.5,-6),ndc=p.clone().project(now),uv=new T.Vector2(ndc.x*.5+.5,ndc.y*.5+.5),depth=-p.clone().applyMatrix4(now.matrixWorldInverse).z;
 const nearer=-p.clone().applyMatrix4(kept.matrixWorldInverse).z*.6;
 assert(!reproject(uv,depth,now,view(kept),nearer).valid,'an uncovered point is not carried');
 const off=camera(0,T.MathUtils.degToRad(80));assert(!reproject(uv,depth,now,view(off),depth).valid,'nor one the kept view did not have on screen');}
// Which moves keep it.
assert(carryApplies(kept,now)&&CARRY.move>=1&&CARRY.move<=2&&CARRY.turn<=T.MathUtils.degToRad(35),'a step and a small turn keep it');
assert(!carryApplies(kept,camera(CARRY.move+.1,0))&&!carryApplies(kept,camera(0,CARRY.turn+.05)),'a longer walk or a wider turn starts afresh');

// The wiring: kept with each new denoised image and the trace's scene; carried until the next one; dropped with a
// new scene or sun; drawn through the finish like any traced image.
{const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),viewer=read('viewer.ts'),post=read('post.ts'),live=read('live-trace.ts');
 assert(/get generation\(\)/.test(live)&&/generation\+\+/.test(live),'a new scene or sun counts as a new generation');
 assert(/post\.keep\(traced\.texture,traced\.demodulated,live\.generation\)/.test(viewer),'each denoised image is kept');
 assert(/post\.carries\(rig\.camera,live\.generation\)/.test(viewer)&&/post\.carry\(/.test(viewer),'and carried until the next');
 assert(/uniform float reproject/.test(post)&&/prevViewProj/.test(post)&&/mix\(live,t,amount\*valid\)/.test(post),'the finish moves it into place, the live image where it cannot');}
console.log(`Passed: points seen from a step and a 6° turn land where the kept view saw them; uncovered points and those off the kept screen show the live image; moves within ${CARRY.move} m and ${Math.round(T.MathUtils.radToDeg(CARRY.turn))}° keep the traced look, a new scene or sun drops it.`);
