import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
// Touch: a touch the browser never ends (iOS can drop its pointerup and pointercancel when a notification or a system
// gesture takes over) must not stay held, or every later one-finger drag reads as a pinch and only zooms. Run against
// OrbitControls itself on a stand-in canvas that, like a browser, refuses to release a touch it no longer knows.
await build({entryPoints:['lib/house-model/touches.ts'],outdir:'tmp/touch-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {endStaleTouches}=await import('../tmp/touch-check/touches.mjs');

globalThis.PointerEvent=class extends Event{constructor(type,{bubbles,cancelable,composed,...init}={}){super(type,{bubbles,cancelable,composed});Object.assign(this,{pointerId:0,pointerType:'mouse',isPrimary:false,clientX:0,clientY:0,pageX:0,pageY:0,button:0},init);}};
const view=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';doc.defaultView=view;
class Canvas extends EventTarget{
 style={};clientWidth=400;clientHeight=800;ownerDocument=doc;captured=new Set();
 dispatchEvent(e){const r=super.dispatchEvent(e);if(e.bubbles)doc.dispatchEvent(e);return r;}
 getRootNode(){return doc;}
 getBoundingClientRect(){return {left:0,top:0,width:400,height:800,right:400,bottom:800};}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){if(!this.captured.delete(id))throw new Error(`NotFoundError: no active pointer ${id}`);}
}
const STATE={TOUCH_ROTATE:3,TOUCH_DOLLY_PAN:5};
const touch=(canvas,type,id,x,y,primary)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:primary,clientX:x,clientY:y,pageX:x,pageY:y,bubbles:true}));

for(const ending of ['next touch','blur','hidden']){
 const canvas=new Canvas(),stop=endStaleTouches(canvas),camera=new T.PerspectiveCamera(36,.5,.1,100);camera.position.set(0,5,10);
 const controls=new OrbitControls(camera,canvas);controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
 // A finger lands and the browser never reports it lifting.
 touch(canvas,'pointerdown',1,100,400,true);canvas.captured.delete(1);
 if(ending==='blur')view.dispatchEvent(new Event('blur'));
 if(ending==='hidden'){doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));doc.visibilityState='visible';}
 // The next finger is the only one down: it turns the view, as one finger should.
 touch(canvas,'pointerdown',2,200,400,true);
 assert.equal(controls.state,STATE.TOUCH_ROTATE,`after a lost touch (${ending}), one finger turns the view (state ${controls.state})`);
 const before=camera.position.clone();touch(canvas,'pointermove',2,260,400,true);controls.update();
 assert(camera.position.distanceTo(before)>.05&&Math.abs(camera.position.length()-before.length())<1e-3,`one finger turns without zooming (${ending})`);
 touch(canvas,'pointerup',2,260,400,true);
 // A real second finger still pinches.
 touch(canvas,'pointerdown',3,100,400,true);touch(canvas,'pointerdown',4,300,400,false);
 assert.equal(controls.state,STATE.TOUCH_DOLLY_PAN,`two fingers down together still pinch (${ending})`);
 touch(canvas,'pointerup',4,300,400,false);touch(canvas,'pointerup',3,100,400,true);
 controls.dispose();stop();
}

// The viewer installs it before OrbitControls and its own eye-level look, so both hear the ending first.
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
const installed=viewer.search(/endStaleTouches\(canvas\)/),orbit=viewer.search(/new OrbitControls\(camera,canvas\)/),look=viewer.search(/addEventListener\('pointerdown',down\)/);
assert(installed>0&&installed<orbit&&installed<look,'the viewer ends lost touches before OrbitControls and the eye-level look hear a new one');
console.log('Passed: a touch the browser never ends is let go at the next first touch, on blur and when the page hides; one finger then turns the view and two still pinch.');
