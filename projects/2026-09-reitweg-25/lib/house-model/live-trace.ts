import * as T from 'three';
import type {Lighting} from './lighting';
import type {WebGPUTracer} from './live-trace-webgpu';
import type {SceneCache} from './photographic-scene';

/** How a resting view hands over to path tracing (Extreme). Tracing, and preparing its scene, starts once the view has
 * rested `rest` ms with no panel open, so passing clicks never set it off. The live image holds while samples gather:
 * the grainy image is never shown, nor one still carrying the traced scene's own plain surface colours. The first
 * cleaned image fades in over `fade` ms; later ones replace it, drawn every `present` ms. How many samples are gathered
 * is the WebGPU tracer's (GPU_TRACE). */
export const LIVE_TRACE={fade:400,rest:1000,present:100};
/** How much of the traced image shows `elapsed` ms after its first cleaned image arrived (0–1). */
export function traceFade(elapsed:number){return T.MathUtils.smoothstep(elapsed,0,LIVE_TRACE.fade);}
/** The lot around the house, and how far from it trees are kept. */
const ORIGIN=new T.Vector3(-5,0,8),REACH=120;

/** Path tracing in the viewport while the camera rests, on WebGPU with its denoiser (live-trace-webgpu.ts), in a worker
 * where the browser offers WebGPU there and on the page otherwise; where the browser has no WebGPU, or its device fails,
 * Extreme keeps its live view. The scene is converted in the background the
 * first time the view rests, and kept: a new sun re-lights it; a new floor, renovation or walk converts again only what
 * changed (photographic-scene.ts) and hands the same tracer the new scene, whose unchanged meshes keep their
 * ray-tracing trees. The tracer samples at the screen's CSS resolution, a quarter of a Retina screen's pixels; the
 * viewer blends its image in through the same finish as the live view (post.ts). */
export function createLiveTrace(options:{renderer:T.WebGLRenderer;scene:T.Scene;camera:T.PerspectiveCamera;lighting:Lighting}){
 const {renderer,scene,camera,lighting}=options;
 type Prepared={gpu:WebGPUTracer;local:{scene:T.Scene;dispose:()=>void};environment:T.Texture};
 let prepared:Prepared|undefined,abort:AbortController|undefined,cache:SceneCache|undefined;
 let lightStale=false,cameraStale=true,sceneStale=false,disposed=false,unavailable=false,generation=0;
 const release=()=>{
  abort?.abort();abort=undefined;
  if(prepared){prepared.gpu.dispose();prepared.local.dispose();prepared.environment.dispose();prepared=undefined;}
 };
 const cancelled=()=>new DOMException('Cancelled','AbortError');
 // The WebGPU renderer reads a target back a moment later.
 const sky=async()=>(renderer as {isWebGPURenderer?:boolean}).isWebGPURenderer?lighting.equirectGPU():lighting.equirect();
 const prepare=async()=>{
  if(!('gpu' in navigator)){unavailable=true;return;}
  const controller=new AbortController();abort=controller;
  let local:Prepared['local']|undefined,environment:T.Texture|undefined;
  try{
   const {photographicScene,sceneCache}=await import('./photographic-scene');
   if(controller.signal.aborted)return;
   cache??=sceneCache();environment=await sky();
   local=await photographicScene(scene,environment,controller.signal,()=>{},{maxDistance:REACH,origin:ORIGIN,sunScale:lighting.sunThroughClouds,instances:true,cache});
   if(controller.signal.aborted)throw cancelled();
   if(prepared){
    // The same tracer takes the new scene.
    const p=prepared;
    if(!await p.gpu.rescene(local.scene,controller.signal))throw cancelled();
    p.local.dispose();p.environment.dispose();p.local=local;p.environment=environment;
   }else{
    // In a worker where the browser allows WebGPU there, so none of it holds the page; on the page otherwise.
    const scene=local.scene,m=await import('./live-trace-webgpu');
    const failed=(where:string)=>(error:unknown)=>{console.warn(`WebGPU path tracing ${where} unavailable`,error);return undefined;};
    let gpu=await m.createWorkerTracer(scene,camera,controller.signal).catch(failed('in a worker'));
    if(!gpu&&!controller.signal.aborted)gpu=await m.createWebGPUTracer(scene,camera,controller.signal).catch(failed('on the page'));
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
  const environment=await sky();if(p!==prepared){environment.dispose();return;}
  copyLights(scene,p.local.scene,lighting.sunThroughClouds);p.local.scene.environment=p.local.scene.background=environment;
  p.gpu.relight();p.environment.dispose();p.environment=environment;
 };
 let relighting=false,stepping=false;
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
   stepping=true;return gpu.step(performance.now());
  },
  /** True while resting should keep drawing: preparing, or still gathering samples. */
  get wanted(){return !unavailable&&(!prepared||sceneStale||lightStale||relighting||!prepared.gpu.done);},
  get ready(){return !!prepared;},
  /** Counts new scenes and suns: an image traced under another generation shows a different house or light. */
  get generation(){return generation;},
  /** The camera moved: the next rest starts afresh. */
  reset:()=>{cameraStale=true;if(stepping){stepping=false;prepared?.gpu.pause?.();}},
  /** The sun moved. */
  relight:()=>{lightStale=true;cameraStale=true;generation++;},
  /** What is shown changed (floor, renovations, grass around the walker): the next rest converts what changed. */
  invalidate:()=>{abort?.abort();abort=undefined;sceneStale=true;cameraStale=true;generation++;},
  /** Frees the tracer (a photograph's own tracer needs the graphics card); the conversions are kept. */
  release,
  dispose:()=>{disposed=true;release();cache?.dispose();},
 };
}
export type LiveTrace=ReturnType<typeof createLiveTrace>;
