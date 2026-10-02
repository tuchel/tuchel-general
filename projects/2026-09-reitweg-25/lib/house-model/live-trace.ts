import * as T from 'three';
import type {Lighting} from './lighting';
import type {WebGPUTracer} from './live-trace-webgpu';
import type {SceneCache} from './photographic-scene';

/** How a resting view hands over to path tracing (Extreme). Tracing, and preparing its scene, starts once the view has
 * rested `rest` ms with no panel open, so passing clicks never set it off. The traced image replaces the live one as it
 * gathers samples: hidden for the first two, fully shown from 48, drawn every `present` ms. Until it settles, an
 * edge-aware filter guided by the live image smooths its grain, about three pixels across at first, gone by 256 samples;
 * a denoised image needs none. How many samples are gathered is the WebGPU tracer's (GPU_TRACE). */
export const LIVE_TRACE={show:[2,48] as const,filter:{radius:3,until:256},rest:1000,present:100};
export function traceBlend(samples:number){
 const [a,b]=LIVE_TRACE.show,{radius,until}=LIVE_TRACE.filter;
 return {amount:T.MathUtils.smoothstep(samples,a,b),radius:radius*(1-T.MathUtils.smoothstep(samples,4,until))};
}
/** The lot around the house, and how far from it trees are kept. */
const ORIGIN=new T.Vector3(-5,0,8),REACH=120;

/** Path tracing in the viewport while the camera rests, on WebGPU with its denoiser (live-trace-webgpu.ts); where the
 * browser has no WebGPU, or its device fails, Extreme keeps its live view. The scene is converted in the background the
 * first time the view rests, and kept: a new sun re-lights it; a new floor, renovation or walk converts again only what
 * changed (photographic-scene.ts) and hands the same tracer the new scene, whose unchanged meshes keep their
 * ray-tracing trees. The tracer samples at the screen's CSS resolution, a quarter of a Retina screen's pixels; the
 * viewer blends its image in through the same finish as the live view (post.ts). */
export function createLiveTrace(options:{renderer:T.WebGLRenderer;scene:T.Scene;camera:T.PerspectiveCamera;lighting:Lighting}){
 const {renderer,scene,camera,lighting}=options;
 type Prepared={gpu:WebGPUTracer;local:{scene:T.Scene;dispose:()=>void};environment:T.Texture};
 let prepared:Prepared|undefined,abort:AbortController|undefined,cache:SceneCache|undefined;
 let lightStale=false,cameraStale=true,sceneStale=false,disposed=false,unavailable=false;
 const release=()=>{
  abort?.abort();abort=undefined;
  if(prepared){prepared.gpu.dispose();prepared.local.dispose();prepared.environment.dispose();prepared=undefined;}
 };
 const cancelled=()=>new DOMException('Cancelled','AbortError');
 const prepare=async()=>{
  if(!('gpu' in navigator)){unavailable=true;return;}
  const controller=new AbortController();abort=controller;
  let local:Prepared['local']|undefined,environment:T.Texture|undefined;
  try{
   const {photographicScene,sceneCache}=await import('./photographic-scene');
   if(controller.signal.aborted)return;
   cache??=sceneCache();environment=lighting.equirect();
   local=await photographicScene(scene,environment,controller.signal,()=>{},{maxDistance:REACH,origin:ORIGIN,sunScale:lighting.sunThroughClouds,instances:true,cache});
   if(controller.signal.aborted)throw cancelled();
   if(prepared){
    // The same tracer takes the new scene.
    const p=prepared;
    if(!await p.gpu.rescene(local.scene,controller.signal))throw cancelled();
    p.local.dispose();p.environment.dispose();p.local=local;p.environment=environment;
   }else{
    const scene=local.scene,gpu=await import('./live-trace-webgpu').then(m=>m.createWebGPUTracer(scene,camera,controller.signal)).catch(error=>{console.warn('WebGPU path tracing unavailable',error);return undefined;});
    if(controller.signal.aborted){gpu?.dispose();throw cancelled();}
    if(!gpu){unavailable=true;throw new Error('no WebGPU tracer');}
    prepared={gpu,local,environment};
   }
   sceneStale=false;lightStale=false;cameraStale=true;abort=undefined;
  }catch(error){
   local?.dispose();environment?.dispose();
   if(!controller.signal.aborted&&!unavailable)console.warn('Live path tracing',error);
   if(abort===controller)abort=undefined;
  }
 };
 const relight=async()=>{
  if(!prepared)return;
  const {copyLights}=await import('./photographic-scene'),p=prepared;if(!p||p!==prepared)return;
  const environment=lighting.equirect();
  copyLights(scene,p.local.scene,lighting.sunThroughClouds);p.local.scene.environment=p.local.scene.background=environment;
  p.gpu.relight();p.environment.dispose();p.environment=environment;
 };
 let relighting=false;
 return {
  /** One round of samples while the camera rests; undefined while the scene is prepared. Starts preparing on the first
   * call, and again after a change of floor, renovation or walk. */
  step(){
   if(disposed||unavailable)return;
   if(!prepared||sceneStale){if(!abort)void prepare();return;}
   if(lightStale){if(!relighting){relighting=true;lightStale=false;void relight().finally(()=>{relighting=false;});}return;}
   if(relighting)return;
   const {gpu}=prepared;
   // A failed device ends tracing for this visit; the live view stays.
   if(gpu.failed){unavailable=true;release();return;}
   if(cameraStale){const size=renderer.getSize(new T.Vector2());gpu.reset(Math.max(1,Math.round(size.x)),Math.max(1,Math.round(size.y)));cameraStale=false;}
   return gpu.step(performance.now());
  },
  /** True while resting should keep drawing: preparing, or still gathering samples. */
  get wanted(){return !unavailable&&(!prepared||sceneStale||lightStale||relighting||!prepared.gpu.done);},
  get ready(){return !!prepared;},
  /** The camera moved: the next rest starts afresh. */
  reset:()=>{cameraStale=true;},
  /** The sun moved. */
  relight:()=>{lightStale=true;cameraStale=true;},
  /** What is shown changed (floor, renovations, grass around the walker): the next rest converts what changed. */
  invalidate:()=>{abort?.abort();abort=undefined;sceneStale=true;cameraStale=true;},
  /** Frees the tracer (a photograph's own tracer needs the graphics card); the conversions are kept. */
  release,
  dispose:()=>{disposed=true;release();cache?.dispose();},
 };
}
export type LiveTrace=ReturnType<typeof createLiveTrace>;
