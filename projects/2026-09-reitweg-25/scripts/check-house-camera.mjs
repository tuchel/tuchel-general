import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/camera-rig.ts'],outfile:'tmp/camera-check.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {createCameraRig,overviewFov,eyeLevelFov,fitDistance}=await import('../tmp/camera-check.mjs');
const deg=T.MathUtils.degToRad,horizontal=(v,a)=>2*T.MathUtils.radToDeg(Math.atan(Math.tan(deg(v)/2)*a));
for(const aspect of [.45,.6,.8,1,1.6,2.4]){const f=overviewFov(aspect);assert(f>=36&&f<=52,`overview field of view stays photographic at aspect ${aspect}`);}
assert(horizontal(eyeLevelFov(390/844),390/844)>=45,'portrait eye level keeps a useful horizontal view');
assert(eyeLevelFov(390/844)<=88);
// A framed span fits: the visible height covers it and the width covers the exterior margin.
const d=fitDistance(36,1.6,36,true,false),vh=2*d*Math.tan(deg(36)/2);assert(vh>=36-1e-9&&vh*1.6>=36*1.65-1e-9);
// Moving between views keeps the lens fixed and orbits around the targets instead of cutting through the house.
const camera=new T.PerspectiveCamera(),controls={target:new T.Vector3(),enabled:true,minDistance:4,maxDistance:320,minPolarAngle:.025,maxPolarAngle:Math.PI/2-.05};
const rig=createCameraRig(camera,controls,false);rig.resize(1440,900);
rig.frame({target:new T.Vector3(-1,2,1),direction:new T.Vector3(48,20,21),span:41,exterior:true},true);
const fov=camera.fov,start=performance.now();
rig.frame({target:new T.Vector3(-14,1,0),direction:new T.Vector3(-33,23,-35),span:48,exterior:true});
const house=new T.Box3(new T.Vector3(-6,0,-9.6),new T.Vector3(6,8,9.6));
for(let t=0;t<=1000;t+=50){rig.update(start+t);assert.equal(camera.fov,fov,'field of view is constant through a transition');assert(!house.containsPoint(camera.position),'camera path stays outside the house');}
assert(!rig.moving);
rig.enterEyeLevel(new T.Vector3(0,1.65,0),new T.Vector3(10,1.4,0));assert(rig.eyeLevel&&!controls.enabled);assert(camera.near<=.05);
console.log('Passed: fixed field of view during transitions, orbit paths outside the house, framed spans fit, portrait eye level keeps a wide view.');
