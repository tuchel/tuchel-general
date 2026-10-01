import * as T from 'three';

/** The path tracer on WebGPU (Extreme, where the browser has it): three-gpu-pathtracer's wavefront tracer, which
 * converges several times faster than the WebGL one, and, once it has gathered its samples, Open Image Denoise's
 * neural network (Intel's weights, Apache 2.0) cleans the last grain, guided by the scene's colours and facings.
 * It renders in its own graphics context; a few times a second its image is copied into the WebGL view, which blends and
 * finishes it like any traced image (post.ts). */
export const GPU_TRACE={samples:512,copyEvery:250,bounces:6,weights:'/assets/oidn/rt_hdr_alb_nrm_small.tza'};

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
export async function createWebGPUTracer(scene:T.Scene,camera:T.PerspectiveCamera){
 const gpu=(navigator as Navigator&{gpu?:{requestAdapter:()=>Promise<unknown>}}).gpu;
 if(!gpu||!await gpu.requestAdapter().catch(()=>null))return undefined;
 const [W,{WebGPUPathTracer,OIDNDenoiser},{initUNetFromURL}]=await Promise.all([import('three/webgpu'),import('three-gpu-pathtracer/webgpu'),import('oidn-web')]);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const renderer=new W.WebGPURenderer({canvas,antialias:false});
 await renderer.init();
 // Without WebGPU, WebGPURenderer quietly runs on WebGL 2; the WebGL tracer is the better choice then.
 if(!(renderer.backend as {isWebGPUBackend?:boolean}).isWebGPUBackend){renderer.dispose();return undefined;}
 renderer.toneMapping=W.NoToneMapping;
 const view=new T.PerspectiveCamera();view.copy(camera);
 const tracer=new WebGPUPathTracer(renderer);
 Object.assign(tracer,{maxBounces:GPU_TRACE.bounces,maxTransparentBounces:8,renderDelay:0,minSamples:0,fadeDuration:0,dynamicLowRes:false,synchronizeRenderSize:false,maxSamples:GPU_TRACE.samples,filterGlossyFactor:.5});
 let denoiser:InstanceType<typeof OIDNDenoiser>|undefined;
 try{denoiser=new OIDNDenoiser({initUNetFromURL,auxWeightsUrl:GPU_TRACE.weights});tracer.setDenoiser(denoiser);}catch(error){console.warn('Denoiser unavailable',error);}
 tracer.setScene(scene,view);
 const target=new W.RenderTarget(1,1,{type:W.HalfFloatType,depthBuffer:false});
 const texture=new T.DataTexture(new Uint16Array(4),1,1,T.RGBAFormat,T.HalfFloatType);texture.minFilter=texture.magFilter=T.LinearFilter;
 // `final`: the last image (denoised where the denoiser ran) has reached the WebGL view.
 let copying=false,lastCopy=0,samples=0,shown=0,lost=false,final=false,gathered=0;
 // Any validation error, a lost device, a throw or an image with no light in it counts as failure; the WebGL tracer
 // takes over (live-trace.ts).
 const device=(renderer.backend as {device?:{lost?:Promise<unknown>;addEventListener?:(type:string,listener:()=>void)=>void}}).device;
 void device?.lost?.then(()=>{lost=true;});
 device?.addEventListener?.('uncapturederror',()=>{lost=true;});
 const copy=async()=>{
  // A denoiser that has not finished 15 s after the samples are in (weights unavailable, say) is not waited for.
  if(samples>=GPU_TRACE.samples&&!gathered)gathered=performance.now();
  copying=true;const finished=samples>=GPU_TRACE.samples&&(!denoiser||denoiser.complete||performance.now()-gathered>15000);
  try{
   const [counts,data]=await Promise.all([tracer.getSampleCountsAsync(),renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height)]) as [{avg:number},Uint16Array];
   const c:Copy={data:unpadRows(data,target.width,target.height),width:target.width,height:target.height};
   if(counts.avg>0&&!plausible(c.data))throw new Error('the traced image is empty or not a number');
   texture.image={data:c.data,width:c.width,height:c.height};texture.needsUpdate=true;samples=shown=counts.avg;if(finished)final=true;
  }catch(error){console.warn('WebGPU trace copy',error);lost=true;}
  finally{copying=false;}
 };
 return {
  /** Starts again from the camera's current view, at `width` × `height`. */
  reset:(width:number,height:number)=>{
   view.copy(camera);view.updateMatrixWorld();tracer.setCamera(view);
   if(target.width!==width||target.height!==height){target.setSize(width,height);tracer.setSize(width,height);}
   tracer.reset();denoiser?.reset();samples=shown=0;lastCopy=0;final=false;gathered=0;
  },
  relight:()=>{tracer.updateLights();tracer.updateEnvironment();},
  /** One round of samples; the WebGL copy of the image refreshes a few times a second. */
  step:(now:number)=>{
   if(lost)return;
   if(final)return {texture,samples:shown};
   try{renderer.setRenderTarget(target);tracer.renderSample();renderer.setRenderTarget(null);}catch(error){console.warn('WebGPU trace',error);lost=true;return;}
   if(!copying&&now-lastCopy>GPU_TRACE.copyEvery){lastCopy=now;void copy();}
   return shown>0||samples>0?{texture,samples:shown}:undefined;
  },
  get failed(){return lost;},
  get done(){return final;},
  dispose:()=>{tracer.dispose?.();target.dispose();texture.dispose();renderer.dispose();},
 };
}
export type WebGPUTracer=NonNullable<Awaited<ReturnType<typeof createWebGPUTracer>>>;
