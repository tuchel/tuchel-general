import * as T from 'three';
import type {WebGLPathTracer} from 'three-gpu-pathtracer';
import type {Lighting} from './lighting';

/** How a resting view hands over to path tracing (Extreme). The traced image replaces the live one as it gathers
 * samples: hidden for the first two, fully shown from 48. Until it settles, an edge-aware filter guided by the live image
 * smooths its grain, about three pixels across at first, gone by 256 samples. Tracing stops at 1024 samples. */
export const LIVE_TRACE={show:[2,48] as const,filter:{radius:3,until:256},samples:1024};
export function traceBlend(samples:number){
 const [a,b]=LIVE_TRACE.show,{radius,until}=LIVE_TRACE.filter;
 return {amount:T.MathUtils.smoothstep(samples,a,b),radius:radius*(1-T.MathUtils.smoothstep(samples,4,until))};
}
/** The lot around the house, and how far from it trees are kept: the scene the tracer holds is converted once. */
const ORIGIN=new T.Vector3(-5,0,8),REACH=120;

/** Path tracing in the viewport while the camera rests. The scene is converted and its ray-tracing tree built once, in
 * the background, the first time the view rests; a new sun only re-lights it, a new floor or renovation rebuilds it.
 * The tracer samples at the screen's CSS resolution, a quarter of a Retina screen's pixels, so it settles four times
 * sooner; the viewer blends its image in through the same finish as the live view (post.ts). */
export function createLiveTrace(options:{renderer:T.WebGLRenderer;scene:T.Scene;camera:T.PerspectiveCamera;lighting:Lighting}){
 const {renderer,scene,camera,lighting}=options;
 type Prepared={tracer:WebGLPathTracer;local:{scene:T.Scene;dispose:()=>void};worker:{dispose:()=>void};environment:T.Texture};
 let prepared:Prepared|undefined,abort:AbortController|undefined,lightStale=false,cameraStale=true,disposed=false;
 const release=()=>{
  abort?.abort();abort=undefined;
  if(prepared){prepared.tracer.dispose();prepared.worker.dispose();prepared.local.dispose();prepared.environment.dispose();prepared=undefined;}
 };
 const prepare=async()=>{
  const controller=new AbortController();abort=controller;
  let local:Prepared['local']|undefined,tracer:WebGLPathTracer|undefined,worker:Prepared['worker']|undefined,environment:T.Texture|undefined;
  try{
   const [{photographicScene},{WebGLPathTracer},{GenerateMeshBVHWorker}]=await Promise.all([import('./photographic-scene'),import('three-gpu-pathtracer'),import('three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js')]);
   if(controller.signal.aborted)return;
   environment=lighting.equirect();
   local=await photographicScene(scene,environment,controller.signal,()=>{},{maxDistance:REACH,origin:ORIGIN,sunScale:lighting.sunThroughClouds});
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   tracer=new WebGLPathTracer(renderer);
   Object.assign(tracer,{bounces:5,transmissiveBounces:8,renderDelay:0,minSamples:0,fadeDuration:0,filterGlossyFactor:.5,rasterizeScene:false,renderToCanvas:false,dynamicLowRes:false});
   tracer.tiles.set(2,2);tracer.textureSize.set(1024,1024);
   const generator=new GenerateMeshBVHWorker();worker=generator;tracer.setBVHWorker(generator);
   await tracer.setSceneAsync(local.scene,camera);
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   prepared={tracer,local,worker,environment};lightStale=false;cameraStale=true;abort=undefined;
  }catch(error){
   tracer?.dispose();worker?.dispose();local?.dispose();environment?.dispose();
   if(!controller.signal.aborted)console.warn('Live path tracing',error);
   if(abort===controller)abort=undefined;
  }
 };
 const relight=async()=>{
  if(!prepared)return;
  const {copyLights}=await import('./photographic-scene'),p=prepared;if(!p||p!==prepared)return;
  const environment=lighting.equirect();
  copyLights(scene,p.local.scene,lighting.sunThroughClouds);p.local.scene.environment=p.local.scene.background=environment;
  p.tracer.updateLights();p.tracer.updateEnvironment();p.environment.dispose();p.environment=environment;
 };
 let relighting=false;
 return {
  /** One sample (one tile of one) while the camera rests; undefined until the scene is ready. Starts preparing on the
   * first call. */
  step(){
   if(disposed)return;
   if(!prepared){if(!abort)void prepare();return;}
   if(lightStale){if(!relighting){relighting=true;lightStale=false;void relight().finally(()=>{relighting=false;});}return;}
   if(relighting)return;
   const {tracer}=prepared;
   if(cameraStale){camera.updateMatrixWorld();tracer.renderScale=1/renderer.getPixelRatio();tracer.setCamera(camera);cameraStale=false;}
   if(tracer.samples<LIVE_TRACE.samples){
    const previous=renderer.getRenderTarget();tracer.renderSample();renderer.setRenderTarget(previous);
   }
   return {texture:tracer.target.texture,samples:tracer.samples};
  },
  /** True while resting should keep drawing: preparing, or still gathering samples. */
  get wanted(){return !prepared||lightStale||relighting||prepared.tracer.samples<LIVE_TRACE.samples;},
  get ready(){return !!prepared;},
  /** The camera moved: the next rest starts afresh. */
  reset:()=>{cameraStale=true;},
  /** The sun moved. */
  relight:()=>{lightStale=true;cameraStale=true;},
  /** What is shown changed (floor, renovations): the next rest rebuilds the scene. */
  invalidate:()=>{release();cameraStale=true;},
  release,
  dispose:()=>{disposed=true;release();},
 };
}
export type LiveTrace=ReturnType<typeof createLiveTrace>;
