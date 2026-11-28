import * as T from 'three';
import type {Lighting} from './lighting';

/** Path tracing while the view moves (Extreme, WebGPU renderer only), on the renderer's own device, so its image
 * needs no copy to the page. `&moveTrace=320x200x2x8` sets, for a test, width, height, bounces and over how many
 * frames a sample is traced (MOVING has the usual ones). Each frame carries every path one step on (about 5 ms at 320x200 and 2.5 ms at 224x140 on an
 * M3 Max; a whole sample every frame cost 15 ms), and a path's light is written only when it ends, so a sample takes
 * about 8 frames. It is traced for the view it started from and handed, with that view, to the kept light
 * (post-gpu.ts, `motion`), which moving frames are multiplied by. */
/** `spread`: how far apart (pixels of the sample) the 4 by 4 taps lie that the sample and its frame are read with; `keep`: how much of the ratio
 * before stays where it saw the same place; `generation`: what the kept light is marked with while it is the moving
 * trace's. */
export const MOVING={width:224,height:140,bounces:2,frames:8,spread:2,keep:.7,generation:-2};
export function moveTraceAsked(on:boolean){
 const m=/^(\d+)x(\d+)x(\d+)x(\d+)$/.exec(new URLSearchParams(location.search).get('moveTrace')??'');
 return m?{width:+m[1],height:+m[2],bounces:+m[3],frames:Math.max(1,+m[4])}:on?{width:MOVING.width,height:MOVING.height,bounces:MOVING.bounces,frames:MOVING.frames}:undefined;
}
export function createMoveTrace(options:{renderer:unknown;scene:T.Scene;camera:T.PerspectiveCamera;lighting:Lighting;asked:NonNullable<ReturnType<typeof moveTraceAsked>>;ready:()=>void}){
 const {scene,camera,lighting,asked}=options,renderer=options.renderer as {setRenderTarget(target:T.RenderTarget|null):void};
 const view=new T.PerspectiveCamera(),target=new T.RenderTarget(asked.width,asked.height,{type:T.HalfFloatType,depthBuffer:false});
 type Made={scene:T.Scene;dispose():void};
 let tracer:{renderSample():void;updateCamera():void;updateLights():void;updateEnvironment():void;dispose():void}|undefined,local:Made|undefined,environment:T.Texture|undefined;
 let disposed=false,age=0,preparing=false,turn=0;
 // From a change of light until the traced scene has taken it, nothing is traced; `valid`: a sample traced under the
 // light and scene as they are now is in.
 let stale=false,valid=false,changes=0,relighting=false;
 // The scene and its sky are taken once the view has been drawn and rests, not while it is still being set
 // up: a sky read before the sun is placed is dark, and everything in shade traced black.
 const prepare=async()=>{
  const mine=turn;preparing=true;
  try{
   const [{photographicScene},{WebGPUPathTracer},{treesInBackground}]=await Promise.all([import('./photographic-scene'),import('three-gpu-pathtracer/webgpu'),import('./live-trace-webgpu')]);
   // Without the close grass, which comes and goes with every eye-level view: the lawn under it gives the same broad
   // light, and the scene need not be converted again at each change of view (0.9 s with the page held, M3 Max).
   const sky=await lighting.equirectGPU(),made=await photographicScene(scene,sky,new AbortController().signal,()=>{},{maxDistance:120,origin:new T.Vector3(-5,0,8),sunScale:lighting.sunThroughClouds,instances:true,leave:o=>o.name==='eye-level-grass'});
   await treesInBackground(made.scene);
   if(disposed||mine!==turn){made.dispose();sky.dispose();return;}
   const t=new WebGPUPathTracer(options.renderer as never);
   Object.assign(t,{maxBounces:asked.bounces,maxTransparentBounces:4,renderDelay:0,minSamples:0,fadeDuration:0,dynamicLowRes:false,synchronizeRenderSize:false,maxSamples:0,filterGlossyFactor:.5});
   t.setSize(asked.width,asked.height);view.copy(camera);t.setScene(made.scene,view);
   local=made;environment=sky;tracer=t as unknown as typeof tracer;age=0;options.ready();
  }finally{preparing=false;}
 };
 const release=()=>{tracer?.dispose();local?.dispose();environment?.dispose();tracer=local=environment=undefined;};
 return {
  /** One step of the sample; `started`: it starts from the camera as it is now. The image once the sample is in.
   * `rested`: the view is at rest with nothing else being prepared, so the scene may be converted now (it holds
   * frames up for some seconds, which must not fall into motion). */
  step(started:(width:number,height:number)=>void,rested:boolean){
   if(!tracer){if(rested&&!preparing&&!disposed)void prepare().catch(error=>{disposed=true;console.warn('Moving trace unavailable',error);});return;}
   if(stale){if(rested)void this.relight();return;}
   if(!age){view.copy(camera);view.clearViewOffset();tracer.updateCamera();started(asked.width,asked.height);}
   renderer.setRenderTarget(target);tracer.renderSample();renderer.setRenderTarget(null);
   if(++age<asked.frames)return;
   age=0;valid=true;return target.texture;
  },
  /** The sun or the clouds changed: the traced scene takes the new sky and sun. */
  async relight(){
   if(relighting)return;
   const t=tracer,made=local,mine=changes;if(!t||!made){stale=false;return;}
   relighting=true;
   try{
   const [{copyLights},sky]=await Promise.all([import('./photographic-scene'),lighting.equirectGPU()]);
   if(t!==tracer){sky.dispose();return;}
   copyLights(scene,made.scene,lighting.sunThroughClouds);made.scene.environment=made.scene.background=sky;
   t.updateLights();t.updateEnvironment();environment?.dispose();environment=sky;age=0;
   if(mine===changes)stale=false;
   }finally{relighting=false;}
  },
  /** What is shown changed (floor, renovations): the next step converts the scene again. */
  invalidate(){turn++;release();age=0;valid=false;},
  /** The light is changing (sun, sky, season, snow): what was traced no longer holds. */
  hold(){changes++;stale=true;valid=false;age=0;},
  get valid(){return valid;},
  dispose(){disposed=true;release();target.dispose();},
 };
}
