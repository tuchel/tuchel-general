import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/experience.ts'],outfile:'tmp/motion-check.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {createExperience}=await import('../tmp/motion-check.mjs');
let preferenceChanged;const preference={matches:false,addEventListener:(_,fn)=>preferenceChanged=fn,removeEventListener:()=>{}};
globalThis.window={matchMedia:()=>preference};
let state;const root=new T.Group(),canvas={addEventListener(){},removeEventListener(){}};
const scene=new T.Scene(),camera=new T.PerspectiveCamera(),sun=new T.DirectionalLight(),hemi=new T.HemisphereLight();
const experience=createExperience(scene,camera,{domElement:canvas},{},sun,hemi,root,()=>{},()=>{},s=>state=s,()=>{});
experience.stop();assert.equal(state.breeze,true);
let frames=0;for(let i=0;i<=120;i++){experience.tick(i*1000/120);if(experience.motionFrame)frames++;}
assert(frames<=30&&frames>=23,'ambient frames capped separately from a 120 Hz display');
const before=experience.waterTime.value;experience.tick(10000,false);experience.tick(10040,true);assert(experience.waterTime.value-before<.1,'no time jump after hidden/cutaway pause');
experience.breeze(false);experience.tick(12000);assert(!experience.motionFrame);const frozen=experience.waterTime.value;experience.tick(14000);assert.equal(experience.waterTime.value,frozen);
preference.matches=true;preferenceChanged();assert.equal(state.breeze,false,'reduced motion disables breeze');
preference.matches=false;preferenceChanged();assert.equal(state.breeze,true);
experience.dispose();console.log('Passed: capped motion, pause/resume without jumps, breeze off freezes ripples, reduced-motion preference observed.');
