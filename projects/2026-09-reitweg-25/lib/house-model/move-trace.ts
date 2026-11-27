import * as T from 'three';
import type {Lighting} from './lighting';

/** A prototype, not part of any preset: path tracing while the view moves, on the WebGPU renderer's own device, so
 * its image needs no copy to the page. `?renderer=webgpu&moveTrace=320x200x2x2` asks for it: width, height, bounces,
 * and how many rounds of the tracer run each frame (each round carries every path `bounces` steps on, and a path's
 * light is written only when it ends). A trailing `s` shows the traced image instead of the view. Every frame starts
 * again from the camera, so the image is one sample a pixel. It measures what such a trace costs beside the live view
 * and what one sample looks like, before anything is built on it. */
export function moveTraceAsked(){
 const m=/^(\d+)x(\d+)x(\d+)x(\d+)(s?)$/.exec(new URLSearchParams(location.search).get('moveTrace')??'');
 return m?{width:+m[1],height:+m[2],bounces:+m[3],rounds:+m[4],show:!!m[5]}:undefined;
}
export function createMoveTrace(options:{renderer:unknown;scene:T.Scene;camera:T.PerspectiveCamera;lighting:Lighting;asked:NonNullable<ReturnType<typeof moveTraceAsked>>;ready:()=>void}){
 const {scene,camera,lighting,asked}=options,renderer=options.renderer as {setRenderTarget(target:T.RenderTarget|null):void};
 const view=new T.PerspectiveCamera(),target=new T.RenderTarget(asked.width,asked.height,{type:T.HalfFloatType,depthBuffer:false});
 let tracer:{renderSample():void;updateCamera():void;dispose():void}|undefined,local:{dispose():void}|undefined,disposed=false;
 void (async()=>{
  const [{photographicScene},{WebGPUPathTracer},{treesInBackground}]=await Promise.all([import('./photographic-scene'),import('three-gpu-pathtracer/webgpu'),import('./live-trace-webgpu')]);
  await (options.renderer as {init():Promise<unknown>}).init();
  const environment=await lighting.equirectGPU(),made=await photographicScene(scene,environment,new AbortController().signal,()=>{},{maxDistance:120,origin:new T.Vector3(-5,0,8),sunScale:lighting.sunThroughClouds,instances:true});
  await treesInBackground(made.scene);
  if(disposed){made.dispose();return;}
  const t=new WebGPUPathTracer(options.renderer as never);
  // `renderDelay` never passes, so every frame is the tracer's quick first one: `bounces` steps a round at full size.
  Object.assign(t,{maxBounces:asked.bounces,maxTransparentBounces:4,renderDelay:Infinity,minSamples:1,fadeDuration:0,dynamicLowRes:true,lowResScale:1,synchronizeRenderSize:false,maxSamples:0,filterGlossyFactor:.5});
  t.setSize(asked.width,asked.height);view.copy(camera);t.setScene(made.scene,view);
  local=made;tracer=t as unknown as typeof tracer;options.ready();
 })().catch(error=>console.warn('Moving trace unavailable',error));
 return {
  /** One sample a pixel from the camera as it is now; the image, or undefined until the scene is ready. */
  step(){
   if(!tracer)return;
   view.copy(camera);view.clearViewOffset();tracer.updateCamera();
   renderer.setRenderTarget(asked.show?null:target);for(let i=0;i<asked.rounds;i++)tracer.renderSample();renderer.setRenderTarget(null);
   return target.texture;
  },
  dispose(){disposed=true;tracer?.dispose();local?.dispose();target.dispose();},
 };
}
