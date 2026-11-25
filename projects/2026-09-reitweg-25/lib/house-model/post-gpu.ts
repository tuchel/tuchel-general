import * as T from 'three';
import {finish} from './look';
import type {Post,PostOptions} from './post';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** What the image chain needs from `three/webgpu` and `three/tsl`. */
export type PostGPU={tsl:any;/** three's corner shading pass (GTAONode.js). */ao?:(depth:unknown,normal:null,camera:T.Camera)=>any;NodeMaterial:new()=>T.Material;QuadMesh:new(material:T.Material)=>{render(renderer:unknown):void;material:T.Material}};
/** The image chain for the WebGPU renderer (post.ts is the WebGL renderer's). So far: the scene into a floating-point
 * target, corner shading on still frames, still frames averaged into a clean image, and the same finish to the screen: white balance, tone mapping,
 * the S-curve with its shadow lift, saturation, and the screen's transfer. Not yet there: corner shading, bloom, the
 * lens, mist, the wet mirror, moving-frame blending, and showing a path-traced image; those calls do nothing. */
export function createPostGPU(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,options:PostOptions,gpu:PostGPU):Post&{over(object:T.Object3D,camera:T.Camera):void}{
 const {positionGeometry,screenCoordinate,ivec2,texture,uniform,vec3,vec4,float,mix,max,min,pow,dot,clamp,agxToneMapping,sRGBTransferOETF}=gpu.tsl;
 // That renderer draws into plain render targets through the calls the WebGL renderer has for its own.
 const half=()=>new T.RenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}) as unknown as T.WebGLRenderTarget;
 const target=new T.RenderTarget(1,1,{type:T.HalfFloatType,samples:options.samples,depthTexture:new T.DepthTexture(1,1)}) as unknown as T.WebGLRenderTarget;
 let settled=[half(),half()],frames=0;
 const quadOf=(node:any)=>{const m=new gpu.NodeMaterial() as any;m.fragmentNode=node;m.depthTest=false;m.depthWrite=false;return new gpu.QuadMesh(m);};
 // A still frame joins the average of those before it.
 const current=texture(target.texture),history=texture(settled[0].texture),weight=uniform(1);
 const blend=quadOf(mix(history,current,weight));
 // With four samples to a pixel the scene's depth cannot be read as one value, which corner shading and what falls over
 // the frame need: its first sample is copied to a plain depth buffer after the scene is drawn.
 const level=options.samples>=4?new T.RenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1)}) as unknown as T.WebGLRenderTarget:undefined,depthOf=(level??target).depthTexture!;
 const levelled=level&&quadOf(vec4(0));
 if(levelled)Object.assign(levelled.material,{depthNode:texture(target.depthTexture!).load(ivec2(screenCoordinate)).r,depthTest:true,depthWrite:true,depthFunc:T.AlwaysDepth});
 // Corner shading at the WebGL chain's settings (post.ts), from the scene's depth alone. Its grain is turned from frame
 // to frame, and the average of still frames smooths it.
 const shade=options.ao&&gpu.ao?gpu.ao(texture(depthOf),null,camera):undefined,occlusion=uniform(1);
 if(shade){shade.radius.value=.7;shade.distanceExponent.value=1.6;shade.thickness.value=1.4;shade.samples.value=12;shade.resolutionScale=.5;shade.useTemporalFiltering=true;}
 const shaded=shade&&quadOf(mix(history,vec4(current.rgb.mul(mix(1,shade.getTextureNode().r,occlusion)),current.a),weight));
 // The finish, as the WebGL chain's last pass does it (post.ts, FinishedOutput).
 const shown=texture(settled[0].texture),balance=uniform(new T.Vector3(1,1,1)),look=uniform(new T.Vector3(1,1,0)),exposure=uniform(1);
 const luma=vec3(.2126,.7152,.0722);
 const mapped=agxToneMapping(shown.rgb.mul(balance),exposure);
 const e0=pow(clamp(mapped,0,1),vec3(1/2.2)),m=dot(e0,luma),f=float(1).sub(m),e=min(e0.mul(look.z.mul(f.mul(f).mul(f).mul(f)).add(1)),vec3(1));
 const p=pow(e,vec3(look.x)),q=pow(vec3(1).sub(e),vec3(look.x)),c=pow(p.div(max(p.add(q),vec3(1e-5))),vec3(2.2)),l=dot(c,luma);
 const graded=max(vec3(0),vec3(l).add(c.sub(l).mul(look.y)));
 const output=quadOf(vec4(sRGBTransferOETF(graded),1));
 const lamps=options.lamps??(()=>0);
 // The finish fills the screen whatever camera it is drawn with, so that what falls over the frame can be drawn in the
 // same pass (`over`): a second pass to the canvas does not keep what the first left there.
 (output.material as any).vertexNode=vec4(positionGeometry.xy,0,1);
 const finished=output as unknown as T.Mesh,stage=new T.Scene();finished.frustumCulled=false;finished.renderOrder=-1;stage.add(finished);
 const draw=(through:T.Camera)=>{
  // The finish tone-maps and encodes itself, so the renderer is asked for neither while it is drawn.
  const mapping=renderer.toneMapping,space=renderer.outputColorSpace;
  renderer.toneMapping=T.NoToneMapping;renderer.outputColorSpace=T.LinearSRGBColorSpace;
  shown.value=settled[0].texture;renderer.setRenderTarget(null);renderer.render(stage,through);
  renderer.toneMapping=mapping;renderer.outputColorSpace=space;
 };
 const toScreen=()=>{for(const o of stage.children.slice())if(o!==finished)stage.remove(o);draw(camera);};
 const api={
  passes:[],
  setSize:(width:number,height:number,ratio:number)=>{const w=Math.max(1,Math.floor(width*ratio)),h=Math.max(1,Math.floor(height*ratio));target.setSize(w,h);level?.setSize(w,h);for(const t of settled)t.setSize(w,h);frames=0;},
  compileAsync:(object:T.Object3D)=>{
   const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);
   const done=renderer.compileAsync(object,camera,scene);renderer.setRenderTarget(previous);return done;
  },
  compilePasses:()=>Promise.resolve(),
  warm:()=>{},
  render:(refining:boolean,exposed:number,indoor=0)=>{
   const g=finish(indoor,lamps());balance.value.set(g.balance[0],g.balance[1],g.balance[2]);look.value.set(g.contrast,g.saturation,g.lift);exposure.value=exposed;occlusion.value=g.occlusion;
   if(!refining)frames=0;
   renderer.setRenderTarget(target);renderer.render(scene,camera);
   if(level&&levelled){renderer.setRenderTarget(level);levelled.render(renderer);}
   const [was,next]=settled;current.value=target.texture;history.value=was.texture;weight.value=1/(frames+1);
   renderer.setRenderTarget(next);(refining&&shaded?shaded:blend).render(renderer);settled=[next,was];frames++;
   toScreen();
  },
  get lightCarried(){return 0;},
  get accumulated(){return frames;},
  temporal:false,
  replay:toScreen,
  /** Draws `object` over the frame on the canvas, with whatever else was drawn over it since it was last shown. */
  over:(object:T.Object3D,through:T.Camera)=>{stage.add(object);draw(through);},
  setMist:()=>{},keepDepth:()=>{},
  /** The scene's own depth buffer as last drawn, which what falls over the frame reads as it is (falling.ts). */
  get depth(){return depthOf;},
  present:()=>{},keep:()=>{},carries:()=>false,carry:()=>{},
  reset:()=>{frames=0;},
  dispose:()=>{target.dispose();level?.dispose();levelled?.material.dispose();for(const t of settled)t.dispose();blend.material.dispose();shaded?.material.dispose();shade?.dispose();output.material.dispose();},
 };
 return api as unknown as Post&{over:typeof api.over};
}
