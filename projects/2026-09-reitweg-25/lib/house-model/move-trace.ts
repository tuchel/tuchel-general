import * as T from 'three';
import type {Lighting} from './lighting';

/** A prototype, not part of any preset: path tracing while the view moves, on the WebGPU renderer's own device, so
 * its image needs no copy to the page. `?renderer=webgpu&moveTrace=320x200x2x8` asks for it: width, height, bounces,
 * and over how many frames a sample is traced. Each frame carries every path one step on (about 4 ms at 320x200 on an
 * M3 Max; a whole sample every frame cost 15 ms), and a path's light is written only when it ends, so a sample takes
 * about 8 frames. It is traced for the view it started from and handed, with that view, to the kept light
 * (post-gpu.ts, `motion`), which moving frames are multiplied by. */
/** `level`: how broadly the sample and its frame are read (each level halves them); `keep`: how much of the ratio
 * before stays where it saw the same place; `generation`: what the kept light is marked with while it is the moving
 * trace's. */
export const MOVING={level:2,keep:.7,generation:-2};
export function moveTraceAsked(){
 const m=/^(\d+)x(\d+)x(\d+)x(\d+)$/.exec(new URLSearchParams(location.search).get('moveTrace')??'');
 return m?{width:+m[1],height:+m[2],bounces:+m[3],frames:Math.max(1,+m[4])}:undefined;
}
export function createMoveTrace(options:{renderer:unknown;scene:T.Scene;camera:T.PerspectiveCamera;lighting:Lighting;asked:NonNullable<ReturnType<typeof moveTraceAsked>>;ready:()=>void}){
 const {scene,camera,lighting,asked}=options,renderer=options.renderer as {setRenderTarget(target:T.RenderTarget|null):void};
 const view=new T.PerspectiveCamera(),target=new T.RenderTarget(asked.width,asked.height,{type:T.HalfFloatType,depthBuffer:false,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});
 let tracer:{renderSample():void;updateCamera():void;dispose():void}|undefined,local:{dispose():void}|undefined,disposed=false,age=0;
 void (async()=>{
  const [{photographicScene},{WebGPUPathTracer},{treesInBackground}]=await Promise.all([import('./photographic-scene'),import('three-gpu-pathtracer/webgpu'),import('./live-trace-webgpu')]);
  await (options.renderer as {init():Promise<unknown>}).init();
  const environment=await lighting.equirectGPU(),made=await photographicScene(scene,environment,new AbortController().signal,()=>{},{maxDistance:120,origin:new T.Vector3(-5,0,8),sunScale:lighting.sunThroughClouds,instances:true});
  await treesInBackground(made.scene);
  if(disposed){made.dispose();return;}
  const t=new WebGPUPathTracer(options.renderer as never);
  Object.assign(t,{maxBounces:asked.bounces,maxTransparentBounces:4,renderDelay:0,minSamples:0,fadeDuration:0,dynamicLowRes:false,synchronizeRenderSize:false,maxSamples:0,filterGlossyFactor:.5});
  t.setSize(asked.width,asked.height);view.copy(camera);t.setScene(made.scene,view);
  local=made;tracer=t as unknown as typeof tracer;options.ready();
 })().catch(error=>console.warn('Moving trace unavailable',error));
 return {
  /** One step of the sample; `started`: it starts from the camera as it is now. The image once the sample is in. */
  step(started:(width:number,height:number)=>void){
   if(!tracer)return;
   if(!age){view.copy(camera);view.clearViewOffset();tracer.updateCamera();started(asked.width,asked.height);}
   renderer.setRenderTarget(target);tracer.renderSample();renderer.setRenderTarget(null);
   if(++age<asked.frames)return;
   age=0;return target.texture;
  },
  dispose(){disposed=true;tracer?.dispose();local?.dispose();target.dispose();},
 };
}
