import * as T from 'three';
import type {WebGLPathTracer} from 'three-gpu-pathtracer';
import {atmosphere} from './atmosphere';
import {initialCapture,type CaptureState} from './experience-data';
import {photoSize} from './photo-size';
import type {Lighting} from './lighting';

/** Photographs, panoramas, films and model export, plus optional breeze and sound. */
export function createCaptures(options:{
 scene:T.Scene;camera:T.PerspectiveCamera;renderer:T.WebGLRenderer;root:T.Object3D;lighting:Lighting;
 invalidate:()=>void;onState:(s:CaptureState)=>void;
 /** Path tracing and export are offered only where memory allows. */
 heavy:boolean;
 eyeLevel:()=>boolean;
 /** Orbits the camera for a film; returns false when the camera is at eye level. */
 orbit:(angle:number)=>void;
 beginOrbit:()=>boolean;
}){
 const {scene,camera,renderer,root,lighting}=options,canvas=renderer.domElement,air=atmosphere(root);
 let state={...initialCapture},disposed=false,abort:AbortController|undefined,tracer:WebGLPathTracer|undefined;
 let baked:{dispose:()=>void}|undefined,worker:{dispose:()=>void}|undefined,environment:T.Texture|undefined,renderSize:T.Vector2|undefined,renderRatio=1,lastReport=0,motionSeconds=0,lastMotion=0;
 const send=(s:Partial<CaptureState>)=>{state={...state,...s};if(!disposed)options.onState(state);options.invalidate();};
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const preferenceChanged=()=>{if(reduced.matches&&state.breeze){air.breeze(false);send({breeze:false});}};
 reduced.addEventListener('change',preferenceChanged);
 const download=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 let recorder:MediaRecorder|undefined,recordTimer:ReturnType<typeof setTimeout>|undefined,tourStart=0;
 const endFilm=()=>{if(recorder?.state==='recording')recorder.stop();tourStart=0;};
 const stop=()=>{
  abort?.abort();abort=undefined;
  tracer?.dispose();tracer=undefined;worker?.dispose();worker=undefined;baked?.dispose();baked=undefined;environment?.dispose();environment=undefined;
  if(renderSize){renderer.setPixelRatio(renderRatio);renderer.setSize(renderSize.x,renderSize.y,false);renderSize=undefined;}
  // Any interaction ends a film: the camera belongs to the viewer again.
  endFilm();
  if(state.busy||state.render!=='idle'||state.samples||state.message)send({render:'idle',busy:false,samples:0,message:''});
 };
 const photograph=async(panorama=false)=>{
  stop();
  if(!options.heavy){send({message:'Photographic rendering needs a computer; this device keeps the live view.'});return;}
  if(panorama&&!options.eyeLevel()){send({message:'Choose an eye-level view before making a panorama.'});return;}
  const controller=new AbortController();abort=controller;
  send({busy:true,render:'preparing',message:'Preparing photographic materials…'});
  let local:{scene:T.Scene;dispose:()=>void}|undefined,pt:WebGLPathTracer|undefined,bvh:{dispose:()=>void}|undefined,env:T.Texture|undefined;
  try{
   const [{photographicScene},{WebGLPathTracer,EquirectCamera},{GenerateMeshBVHWorker}]=await Promise.all([import('./photographic-scene'),import('three-gpu-pathtracer'),import('three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js')]);
   // The same sky that lights the live view, so the photograph matches it.
   env=lighting.equirect();
   local=await photographicScene(scene,env,controller.signal,text=>send({message:text}),{maxDistance:90,origin:camera.position.clone(),sunScale:lighting.sunThroughClouds});
   if(controller.signal.aborted){local.dispose();env.dispose();return;}
   send({message:'Building the light transport model…'});
   pt=new WebGLPathTracer(renderer);
   Object.assign(pt,{bounces:7,transmissiveBounces:10,renderDelay:0,minSamples:1,fadeDuration:400,filterGlossyFactor:.4,rasterizeScene:false});
   pt.tiles.set(3,3);pt.textureSize.set(1024,1024);
   const generator=new GenerateMeshBVHWorker();bvh=generator;pt.setBVHWorker(generator);
   let renderCamera:T.Camera=camera;
   if(panorama){renderCamera=new EquirectCamera();renderCamera.position.copy(camera.position);renderCamera.quaternion.copy(camera.quaternion);renderCamera.updateMatrixWorld();}
   await pt.setSceneAsync(local.scene,renderCamera);
   if(controller.signal.aborted){pt.dispose();generator.dispose();local.dispose();env.dispose();return;}
   renderSize=renderer.getSize(new T.Vector2());renderRatio=renderer.getPixelRatio();renderer.setPixelRatio(1);
   const {width,height}=photoSize(renderSize.x,renderSize.y,renderRatio,state.maximum,panorama);
   renderer.setSize(width,height,false);
   tracer=pt;baked=local;worker=generator;environment=env;
   send({busy:false,render:panorama?'panorama':'refining',message:'Light is settling. Keep the camera still.'});
  }catch(error){
   pt?.dispose();bvh?.dispose();local?.dispose();env?.dispose();
   if(!controller.signal.aborted)send({busy:false,render:'idle',message:'Photographic rendering is unavailable on this device. The live view and still images still work.'});
   console.warn('Photographic render',error);
  }
 };
 const film=()=>{
  if(recorder?.state==='recording'){recorder.stop();return;}
  stop();
  if(!canvas.captureStream||typeof MediaRecorder==='undefined'){send({message:'Video capture is not supported by this browser. Save a still image instead.'});return;}
  const mime=['video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime){send({message:'This browser has no supported video encoder.'});return;}
  if(!options.beginOrbit()){send({message:'Films orbit the whole house; return to an overview first.'});return;}
  try{
   const stream=canvas.captureStream(30),chunks:Blob[]=[];
   recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{if(recordTimer)clearTimeout(recordTimer);stream.getTracks().forEach(t=>t.stop());tourStart=0;send({recording:false,message:'Film saved · 20-second orbit'});if(!disposed)download(new Blob(chunks,{type:mime}),'reitweg-25-film.'+(mime.includes('mp4')?'mp4':'webm'));};
   tourStart=performance.now();recorder.start();
   recordTimer=setTimeout(()=>recorder?.state==='recording'&&recorder.stop(),20000);
   send({recording:true,message:'Recording a 20-second orbit…'});
  }catch{send({message:'Video recording could not start on this device.'});}
 };
 const exportModel=async()=>{
  stop();
  if(!options.heavy){send({message:'Model export needs a computer.'});return;}
  const controller=new AbortController();abort=controller;
  send({busy:true,message:'Preparing the textured model for export…'});
  let model:{scene:T.Scene;dispose:()=>void}|undefined,env:T.Texture|undefined;
  try{
   const [{photographicScene},{GLTFExporter}]=await Promise.all([import('./photographic-scene'),import('three/addons/exporters/GLTFExporter.js')]);
   env=new T.DataTexture(new Float32Array(4),1,1,T.RGBAFormat,T.FloatType);
   model=await photographicScene(scene,env,controller.signal,text=>send({message:text}),{maxDistance:120,origin:new T.Vector3(-5,0,8)});
   model.scene.environment=null;model.scene.background=null;
   if(controller.signal.aborted)return;
   // Data textures become canvases so GLTFExporter can embed them as images.
   const textures=new Map<T.Texture,T.CanvasTexture>();
   model.scene.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    for(const mat of Array.isArray(o.material)?o.material:[o.material]){
     if(!(mat instanceof T.MeshStandardMaterial))continue;
     for(const key of ['map','roughnessMap','normalMap'] as const){
      const original=mat[key];if(!(original instanceof T.DataTexture))continue;
      if(!textures.has(original)){
       const c=document.createElement('canvas');c.width=original.image.width;c.height=original.image.height;
       c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(original.image.data as Uint8Array),c.width,c.height),0,0);
       const converted=new T.CanvasTexture(c);converted.colorSpace=original.colorSpace;converted.flipY=original.flipY;converted.wrapS=original.wrapS;converted.wrapT=original.wrapT;textures.set(original,converted);
      }
      mat[key]=textures.get(original)!;
     }
    }
   });
   let data:ArrayBuffer|object;
   try{data=await new GLTFExporter().parseAsync(model.scene,{binary:true,onlyVisible:true});}finally{textures.forEach(t=>t.dispose());}
   if(controller.signal.aborted)return;
   download(new Blob([data as ArrayBuffer],{type:'model/gltf-binary'}),'reitweg-25-textured-model.glb');
   send({busy:false,message:'Textured model saved for Blender or another renderer.'});
  }catch(error){
   console.warn('Model export',error);
   if(!controller.signal.aborted)send({busy:false,message:'Model export did not complete.'});
  }finally{model?.dispose();env?.dispose();}
 };
 return {
  photograph,film,exportModel,stop,
  maximum:(on:boolean)=>{stop();send({maximum:on});},
  breeze:(on:boolean)=>{air.breeze(on);send({breeze:on});},
  sound:async(on:boolean)=>{try{await air.sound(on);send({sound:on});}catch{send({sound:false,message:'Audio could not start in this browser.'});}},
  savePhoto:()=>{
   if(!tracer||state.samples<1)return;
   tracer.renderSample();
   const name='reitweg-25-'+(state.render==='panorama'?'360-panorama':'photograph')+'.png';
   canvas.toBlob(blob=>{if(blob)download(blob,name);});
  },
  get recording(){return recorder?.state==='recording';},
  get tracing(){return !!tracer;},
  get active(){return !!tracer||state.busy;},
  get breezing(){return air.breezing;},
  /** Advances wind, film orbit and path tracing. Returns true when the tracer owns the canvas. */
  tick:(now:number)=>{
   if(air.breezing&&!tracer){motionSeconds+=Math.min(.1,(now-(lastMotion||now))/1000);air.tick(motionSeconds);}
   lastMotion=now;
   if(tourStart)options.orbit(Math.min(1,(now-tourStart)/20000)*.9);
   if(tracer){
    const target=state.maximum?1024:256;
    if(tracer.samples<target)tracer.renderSample();
    if(now-lastReport>700){lastReport=now;send({samples:Math.floor(tracer.samples),message:tracer.samples>=target?'Photograph ready. Save it or return to exploring.':'Refining reflections, shadows and bounced light…'});}
    return true;
   }
   return false;
  },
  get waterSeconds(){return motionSeconds;},
  dispose:()=>{disposed=true;reduced.removeEventListener('change',preferenceChanged);stop();if(recordTimer)clearTimeout(recordTimer);air.dispose();},
 };
}
export type Captures=ReturnType<typeof createCaptures>;
