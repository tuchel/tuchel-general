import * as T from 'three';
import {cameraData,pieces,sceneSender,type SceneData} from './trace-transfer';
import type {FromWorker,ToWorker} from './live-trace-worker';

/** The path tracer on WebGPU (Extreme, where the browser has it): three-gpu-pathtracer's wavefront tracer and Open
 * Image Denoise's neural network (Intel's weights, Apache 2.0), guided by the scene's colours and facings.
 * It renders in its own graphics context; a few times a second its image is copied into the WebGL view, which blends and
 * finishes it like any traced image (post.ts). The grainy image shows until the first stage's samples are in; from then
 * on only denoised images are shown, each stage's replacing the last. Tracing stops after the last stage, or sooner once a
 * stage looks like the one before it (converged). */
export const GPU_TRACE={stages:[64,128,256,512],copyEvery:250,bounces:6,weights:'/assets/oidn/rt_hdr_alb_nrm_small.tza'};

type Copy={data:Uint16Array;width:number;height:number};
/** WebGPU rows run top down and are padded to 256 bytes; WebGL textures run bottom up, unpadded. */
export function unpadRows(data:Uint16Array,width:number,height:number):Uint16Array{
 const stride=Math.ceil(width*8/256)*256/2,row=width*4,out=new Uint16Array(row*height);
 for(let y=0;y<height;y++)out.set(data.subarray(y*stride,y*stride+row),(height-1-y)*row);
 return out;
}

/** A traced image has light somewhere and no invalid numbers, judged from 4096 pixels spread over it. */
export function plausible(data:Uint16Array){
 let light=false;const pixels=data.length/4;
 for(let i=0;i<4096;i++){
  const p=Math.floor((i+.5)/4096*pixels)*4;
  for(let c=0;c<3;c++){const v=T.DataUtils.fromHalfFloat(data[p+c]);if(!Number.isFinite(v))return false;if(v>0)light=true;}
 }
 return light;
}
/** How much a denoised stage differs from the one before it, in display steps of 255: both are exposed so the earlier
 * image's mean luminance sits at mid-grey, given a simple tone curve and gamma 2.2, and compared channel by channel at
 * 4096 pixels spread over the image. The mean difference, and its 99th percentile. */
export function stageChange(a:Uint16Array,b:Uint16Array){
 const n=4096,pixels=a.length/4,at=(i:number)=>Math.floor((i+.5)/n*pixels)*4,half=T.DataUtils.fromHalfFloat;
 let sum=0;for(let i=0;i<n;i++){const p=at(i);sum+=.2126*half(a[p])+.7152*half(a[p+1])+.0722*half(a[p+2]);}
 const k=.18/Math.max(sum/n,1e-6),display=(v:number)=>{const x=Math.max(0,v)*k;return Math.pow(x/(1+x),1/2.2)*255;};
 const diffs=new Float32Array(n);let total=0;
 for(let i=0;i<n;i++){const p=at(i);let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(display(half(a[p+c]))-display(half(b[p+c]))));diffs[i]=d;total+=d;}
 diffs.sort();
 return {mean:total/n,p99:diffs[Math.floor(n*.99)]};
}
/** No visible change: under 1 display step on average and under 4 at the 99th percentile. */
export const CONVERGED={mean:1,p99:4};
export const converged=(change:{mean:number;p99:number})=>change.mean<CONVERGED.mean&&change.p99<CONVERGED.p99;
/** Builds every geometry's ray-tracing tree in background workers (the tracer's own options), so the tracer, which
 * builds only what is missing, does none of it on the page's thread. Instanced trees share one tree per archetype. */
async function treesInBackground(scene:T.Scene,signal?:AbortSignal){
 const [{GenerateMeshBVHWorker},{SAH}]=await Promise.all([import('three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js'),import('three-mesh-bvh')]);
 const found=new Set<T.BufferGeometry>();
 scene.traverse(o=>{const g=(o as T.Mesh).isMesh?(o as T.Mesh).geometry:undefined;if(g&&!g.boundsTree)found.add(g);});
 const queue=[...found].sort((a,b)=>b.attributes.position.count-a.attributes.position.count);
 // Two cores stay free for the page, as for the bounce bake.
 const workers=Array.from({length:Math.max(1,Math.min(3,(navigator.hardwareConcurrency||4)-2))},()=>new GenerateMeshBVHWorker());
 try{await Promise.all(workers.map(async worker=>{for(let g=queue.shift();g&&!signal?.aborted;g=queue.shift())g.boundsTree=await worker.generate(g,{strategy:SAH,targetLeafSize:5});}));}
 finally{workers.forEach(w=>w.dispose());}
}
/** `signal`: a newer scene replaced this one; nothing more is built for it. */
/** What the resting view drives: the tracer on the page (createWebGPUTracer) or in a worker (createWorkerTracer). */
export type Tracer={
 /** Starts again from the camera's current view, at `width` × `height`. */
 reset:(width:number,height:number)=>void;
 /** Takes a new scene; false when `signal` cancelled it first. */
 rescene:(scene:T.Scene,signal?:AbortSignal)=>Promise<boolean>;
 relight:()=>void;
 /** One round of samples; the latest image (the denoised one once a stage is in), or undefined before the first. */
 step:(now:number)=>{texture:T.DataTexture;samples:number;denoised:number}|undefined;
 readonly failed:boolean;readonly done:boolean;
 dispose:()=>void;
};
/** `weights`: where the denoiser's weights are (a worker is handed the page's address). */
export async function createWebGPUTracer(scene:T.Scene,camera:T.PerspectiveCamera,signal?:AbortSignal,options:{weights?:string}={}):Promise<Tracer|undefined>{
 const gpu=(navigator as Navigator&{gpu?:{requestAdapter:()=>Promise<{limits:Record<string,number>}|null>}}).gpu;
 const adapter=gpu&&await gpu.requestAdapter().catch(()=>null);
 if(!adapter)return undefined;
 // The house's scene buffers pass WebGPU's default 128 MB per storage binding; the device asks for the card's own limits.
 const {maxStorageBufferBindingSize,maxBufferSize}=adapter.limits;
 const [W,{WebGPUPathTracer,OIDNDenoiser},{initUNetFromURL}]=await Promise.all([import('three/webgpu'),import('three-gpu-pathtracer/webgpu'),import('oidn-web')]);
 const canvas=typeof document!=='undefined'?document.createElement('canvas'):new OffscreenCanvas(1,1);canvas.width=canvas.height=1;
 const renderer=new W.WebGPURenderer({canvas,antialias:false,requiredLimits:{maxStorageBufferBindingSize,maxBufferSize}});
 await renderer.init();
 // Without WebGPU, WebGPURenderer quietly runs on WebGL 2; the WebGL tracer is the better choice then.
 if(!(renderer.backend as {isWebGPUBackend?:boolean}).isWebGPUBackend){renderer.dispose();return undefined;}
 renderer.toneMapping=W.NoToneMapping;
 const view=new T.PerspectiveCamera();view.copy(camera);
 const tracer=new WebGPUPathTracer(renderer);
 const {stages}=GPU_TRACE,last=stages.length-1;
 Object.assign(tracer,{maxBounces:GPU_TRACE.bounces,maxTransparentBounces:8,renderDelay:0,minSamples:0,fadeDuration:0,dynamicLowRes:false,synchronizeRenderSize:false,maxSamples:stages[0],filterGlossyFactor:.5});
 let denoiser:InstanceType<typeof OIDNDenoiser>|undefined;
 try{denoiser=new OIDNDenoiser({initUNetFromURL,auxWeightsUrl:options.weights??GPU_TRACE.weights});tracer.setDenoiser(denoiser);}catch(error){console.warn('Denoiser unavailable',error);}
 await treesInBackground(scene,signal);
 if(signal?.aborted){tracer.dispose?.();renderer.dispose();return undefined;}
 tracer.setScene(scene,view);
 const target=new W.RenderTarget(1,1,{type:W.HalfFloatType,depthBuffer:false});
 const texture=new T.DataTexture(new Uint16Array(4),1,1,T.RGBAFormat,T.HalfFloatType);texture.minFilter=texture.magFilter=T.LinearFilter;
 // `stage`: the stage being gathered; `denoised`: the samples of the denoised image on show (0 before the first).
 // `final`: the last stage's image has reached the WebGL view. `previous`: the denoised image before it, to compare.
 let copying=false,lastCopy=0,samples=0,shown=0,lost=false,final=false,gathered=0,stage=0,denoised=0,previous:Uint16Array|undefined;
 // Any validation error, a lost device, a throw or an image with no light in it counts as failure; the WebGL tracer
 // takes over (live-trace.ts).
 const device=(renderer.backend as {device?:{lost?:Promise<unknown>;addEventListener?:(type:string,listener:()=>void)=>void}}).device;
 void device?.lost?.then(()=>{lost=true;});
 device?.addEventListener?.('uncapturederror',()=>{lost=true;});
 const copy=async()=>{
  // A denoiser that has not finished 15 s after a stage's samples are in (weights unavailable, say) is not waited for.
  if(samples>=stages[stage]&&!gathered)gathered=performance.now();
  const settled=samples>=stages[stage]&&(!denoiser||denoiser.complete||performance.now()-gathered>15000);
  // Once a denoised image is on show, the grainy ones in between stages are not.
  if(denoised&&!settled){const counts=await tracer.getSampleCountsAsync() as {avg:number};samples=counts.avg;return;}
  copying=true;
  try{
   const [counts,data]=await Promise.all([tracer.getSampleCountsAsync(),renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height)]) as [{avg:number},Uint16Array];
   const c:Copy={data:unpadRows(data,target.width,target.height),width:target.width,height:target.height};
   if(counts.avg>0&&!plausible(c.data))throw new Error('the traced image is empty or not a number');
   texture.image={data:c.data,width:c.width,height:c.height};texture.needsUpdate=true;samples=shown=counts.avg;
   if(settled){
    denoised=stages[stage];gathered=0;
    // A stage that looks like the one before ends the trace. Otherwise the next carries on from these samples, and the
    // denoiser runs again when it is in.
    if(previous&&converged(stageChange(previous,c.data)))final=true;
    else if(stage<last){stage++;tracer.maxSamples=stages[stage];}else final=true;
    previous=c.data;
   }
  }catch(error){console.warn('WebGPU trace copy',error);lost=true;}
  finally{copying=false;}
 };
 return {
  /** Starts again from the camera's current view, at `width` × `height`. */
  reset:(width:number,height:number)=>{
   view.copy(camera);view.updateMatrixWorld();tracer.setCamera(view);
   if(target.width!==width||target.height!==height){target.setSize(width,height);tracer.setSize(width,height);}
   stage=0;tracer.maxSamples=stages[0];tracer.reset();denoiser?.reset();samples=shown=0;lastCopy=0;final=false;gathered=0;denoised=0;previous=undefined;
  },
  /** Takes a new scene (a changed floor, renovation or walk): trees still missing are built in workers first; meshes
   * kept from the last scene keep theirs. False when `signal` cancelled it first. */
  rescene:async(next:T.Scene,signal?:AbortSignal)=>{
   await treesInBackground(next,signal);if(signal?.aborted)return false;
   tracer.setScene(next,view);final=false;return true;
  },
  relight:()=>{tracer.updateLights();tracer.updateEnvironment();},
  /** One round of samples; the WebGL copy of the image refreshes a few times a second. */
  step:(now:number)=>{
   if(lost)return;
   if(final)return {texture,samples:shown,denoised};
   try{renderer.setRenderTarget(target);tracer.renderSample();renderer.setRenderTarget(null);}catch(error){console.warn('WebGPU trace',error);lost=true;return;}
   if(!copying&&now-lastCopy>GPU_TRACE.copyEvery){lastCopy=now;void copy();}
   return shown>0||samples>0?{texture,samples:shown,denoised}:undefined;
  },
  get failed(){return lost;},
  get done(){return final;},
  dispose:()=>{tracer.dispose?.();target.dispose();texture.dispose();renderer.dispose();},
 };
}
export type WebGPUTracer=Tracer;
/** The WebGPU tracer in a worker (live-trace-worker.ts), seen from the page through the same interface as
 * createWebGPUTracer: preparing, ray-tracing trees, packing, sampling, denoising and reading back all happen off the
 * page's thread. The page sends the scene's new parts as data, a tick each frame it wants samples, and shows each image
 * the worker sends back. Undefined when the worker cannot run WebGPU (the page's own tracer is tried next). */
export async function createWorkerTracer(scene:T.Scene,camera:T.PerspectiveCamera,signal?:AbortSignal):Promise<Tracer|undefined>{
 if(typeof Worker==='undefined')return undefined;
 const worker=new Worker(new URL('./live-trace-worker.ts',import.meta.url),{type:'module'});
 const sender=sceneSender(),texture=new T.DataTexture(new Uint16Array(4),1,1,T.RGBAFormat,T.HalfFloatType);texture.minFilter=texture.magFilter=T.LinearFilter;
 // `view`: counts resets; images traced for an earlier view are not shown.
 let failed=false,done=false,shown=0,denoised=0,have=false,current=scene,next=0,view=0;
 const waiting=new Map<number,(ok:boolean)=>void>();
 let started:((ok:boolean)=>void)|undefined;
 const send=(message:ToWorker)=>worker.postMessage(message);
 // Geometry and textures go ahead in pieces, the page's thread handed back between them: cloning the first scene's
 // 100 MB into one message would hold it about a fifth of a second.
 const deliver=async(data:SceneData)=>{const {parts,rest}=pieces(data);for(const part of parts){send({kind:'parts',parts:part});await new Promise(r=>setTimeout(r,0));}return rest;};
 worker.onmessage=({data}:MessageEvent<FromWorker>)=>{
  switch(data.kind){
   case 'ready':started?.(true);break;
   case 'unavailable':started?.(false);break;
   case 'failed':failed=true;started?.(false);for(const r of waiting.values())r(false);waiting.clear();break;
   case 'scened':waiting.get(data.id)?.(data.ok);waiting.delete(data.id);break;
   case 'image':if(data.view!==view)break;texture.image={data:data.data,width:data.width,height:data.height};texture.needsUpdate=true;shown=data.samples;denoised=data.denoised;done=data.done;have=true;break;
  }
 };
 worker.onerror=error=>{console.warn('Tracing worker',error.message);failed=true;started?.(false);};
 const first=await deliver(sender.scene(scene));
 const ok=!signal?.aborted&&await new Promise<boolean>(resolve=>{
  started=resolve;if(failed)resolve(false);signal?.addEventListener('abort',()=>resolve(false),{once:true});
  send({kind:'init',scene:first,camera:cameraData(camera),weights:GPU_TRACE.weights});
 });
 started=undefined;
 if(!ok||signal?.aborted){worker.terminate();texture.dispose();return undefined;}
 return {
  reset:(width:number,height:number)=>{have=false;done=false;shown=0;denoised=0;send({kind:'reset',camera:cameraData(camera),width,height,view:++view});},
  rescene:async(scene:T.Scene,signal?:AbortSignal)=>{
   const rest=await deliver(sender.scene(scene));
   if(signal?.aborted||failed)return false;
   return new Promise<boolean>(resolve=>{
    const id=++next;waiting.set(id,ok=>{if(ok)current=scene;resolve(ok);});
    signal?.addEventListener('abort',()=>{waiting.delete(id);resolve(false);},{once:true});
    send({kind:'scene',id,scene:rest});
   });
  },
  relight:()=>send({kind:'lights',scene:sender.lights(current)}),
  step:()=>{send({kind:'tick'});return have?{texture,samples:shown,denoised}:undefined;},
  get failed(){return failed;},
  get done(){return done;},
  dispose:()=>{send({kind:'dispose'});setTimeout(()=>worker.terminate(),1000);texture.dispose();},
 };
}

