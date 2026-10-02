/// <reference lib="webworker" />
import * as T from 'three';
import {createWebGPUTracer,type Tracer} from './live-trace-webgpu';
import {applyCamera,sceneStore,type CameraData,type SceneData,type SceneParts} from './trace-transfer';

/** The WebGPU path tracer, its ray-tracing trees and its denoiser, run off the page's thread (live-trace-webgpu.ts,
 * createWorkerTracer). The page sends the scene as data (trace-transfer.ts) and a tick each frame it wants samples; the
 * tracer works while ticks keep coming and sends back each new image. */
/** `parts`: geometry and textures ahead of the scene that uses them. `view`: counts the page's resets; an image carries
 * the view it was traced for. */
export type ToWorker=
 {kind:'parts';parts:SceneParts}|
 {kind:'init';scene:SceneData;camera:CameraData;weights:string}|
 {kind:'scene';id:number;scene:SceneData}|
 {kind:'lights';scene:Pick<SceneData,'lights'|'environment'>}|
 {kind:'reset';camera:CameraData;width:number;height:number;view:number}|
 {kind:'tick'}|{kind:'dispose'};
export type FromWorker=
 {kind:'ready'}|{kind:'unavailable'}|{kind:'failed'}|{kind:'scened';id:number;ok:boolean}|
 {kind:'image';view:number;data:Uint16Array;width:number;height:number;samples:number;denoised:number;done:boolean};

const worker=self as unknown as DedicatedWorkerGlobalScope&{window?:unknown};
// three-gpu-pathtracer reads window.devicePixelRatio in a material the tracer never builds; give it something to find.
worker.window??=worker;
const post=(message:FromWorker,transfer:Transferable[]=[])=>worker.postMessage(message,transfer);
const store=sceneStore(),camera=new T.PerspectiveCamera();
let tracer:Tracer|undefined,scene:T.Scene|undefined,lastTick=0,sent=-1,running=false,closed=false,view=0;
// The scene being handed to the tracer; a newer one cancels it.
let building:AbortController|undefined;
// Ticks arrive with the page's frames; a pause longer than this means the page wants none.
const QUIET=200;
const frame=(next:(now:number)=>void)=>{if(typeof worker.requestAnimationFrame==='function')worker.requestAnimationFrame(next);else setTimeout(()=>next(performance.now()),16);};
const loop=(now:number)=>{
 if(closed||!tracer||now-lastTick>QUIET){running=false;return;}
 const result=tracer.step(now);
 if(tracer.failed){post({kind:'failed'});running=false;return;}
 if(result&&result.texture.version!==sent){
  sent=result.texture.version;const image=result.texture.image as {data:Uint16Array;width:number;height:number},data=image.data.slice();
  post({kind:'image',view,data,width:image.width,height:image.height,samples:result.samples,denoised:result.denoised,done:tracer.done},[data.buffer]);
 }
 frame(loop);
};
worker.onmessage=async({data}:MessageEvent<ToWorker>)=>{
 try{
  switch(data.kind){
   case 'parts':store.add(data.parts);break;
   case 'init':{
    scene=store.scene(data.scene);applyCamera(camera,data.camera);
    tracer=await createWebGPUTracer(scene,camera,undefined,{weights:data.weights}).catch(error=>{console.warn('WebGPU path tracing in a worker',error);return undefined;});
    post({kind:tracer?'ready':'unavailable'});break;
   }
   case 'scene':{
    // Only the scene the tracer takes decides what is let go: what a cancelled one brought stays for the next.
    building?.abort();const controller=new AbortController();building=controller;
    const next=store.scene(data.scene),ok=!!tracer&&await tracer.rescene(next,controller.signal);
    if(building===controller)building=undefined;
    if(ok){scene=next;store.prune(next);}post({kind:'scened',id:data.id,ok});break;
   }
   case 'lights':if(scene){store.lights(scene,data.scene);tracer?.relight();}break;
   case 'reset':applyCamera(camera,data.camera);view=data.view;tracer?.reset(data.width,data.height);sent=-1;break;
   case 'tick':lastTick=performance.now();if(!running&&tracer){running=true;frame(loop);}break;
   case 'dispose':closed=true;building?.abort();tracer?.dispose();worker.close();break;
  }
 }catch(error){console.warn('Tracing worker',error);post({kind:'failed'});}
};
