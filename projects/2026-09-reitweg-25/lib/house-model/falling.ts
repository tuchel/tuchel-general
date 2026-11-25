import * as T from 'three';
import {shelterNodes} from './snow';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** What rain and snow need of `three/tsl` and `three/webgpu` to fall under the WebGPU renderer. */
export type FallingGPU={tsl:any;NodeMaterial:new()=>T.Material;
 /** Draws an object over the finished frame (post-gpu.ts). */
 over:(object:T.Object3D,camera:T.Camera)=>void};
/** A uniform either renderer can hold: a node under the WebGPU renderer, which keeps a `value` as well. */
export const held=<V,>(gpu:FallingGPU|undefined,value:V):{value:V}=>gpu?gpu.tsl.uniform(value):{value};
/** That renderer has no points of a size, so each drop or flake is a small square that faces the screen: one per
 * `seed`, with its `chance`. */
export function fallingQuads(seeds:Float32Array,chance:Float32Array){
 const quad=new T.PlaneGeometry(1,1),geometry=new T.InstancedBufferGeometry();
 geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));
 geometry.setAttribute('seed',new T.InstancedBufferAttribute(seeds,3));geometry.setAttribute('chance',new T.InstancedBufferAttribute(chance,1));
 geometry.instanceCount=chance.length;return geometry;
}
/** What the two share as nodes. `wrap`: a track's copy in the box round `middle`, and how far it shows there (none at
 * the box's faces or under a roof). `sprite`: the square, `pixels` across, round a point in view space, and where on it
 * a fragment lies (−1 to 1, y up); `gone` puts it out of sight. `seen`: 1 where the scene is no nearer than `away`
 * metres; `depth` is the scene's own depth buffer there. */
export function fallingNodes(gpu:FallingGPU,u:{uBox:any;uMiddle:any;uView:any},sky?:Record<string,{value:unknown}>){
 const {vec4,mod,abs,max,smoothstep,select,varying,texture,screenUV,positionGeometry,cameraProjectionMatrix,cameraNear,cameraFar,perspectiveDepthToViewZ}=gpu.tsl;
 const open=shelterNodes(gpu.tsl,sky),depth=texture(new T.DepthTexture(1,1));
 return {
  depth,
  wrap:(track:any)=>{
   const p=u.uMiddle.add(mod(track.sub(u.uMiddle).add(u.uBox.mul(.5)),u.uBox)).sub(u.uBox.mul(.5)).toVar(),edge=abs(p.sub(u.uMiddle)).div(u.uBox.mul(.5));
   return {p,shows:smoothstep(.8,1,max(edge.x,max(edge.y,edge.z))).oneMinus().mul(open(p))};
  },
  /** How many pixels a metre covers, one metre away. */
  scale:u.uView.y.mul(cameraProjectionMatrix.element(1).y).mul(.5),
  sprite:(middle:any,pixels:any,gone:any)=>{
   const clip=cameraProjectionMatrix.mul(vec4(middle,1));
   return {vertex:select(gone,vec4(2,2,2,1),vec4(clip.xy.add(positionGeometry.xy.mul(pixels).mul(2).div(u.uView).mul(clip.w)),clip.zw)),at:varying(positionGeometry.xy.mul(2))};
  },
  seen:(away:any)=>select(away.greaterThan(perspectiveDepthToViewZ(depth.sample(screenUV).r,cameraNear,cameraFar).negate()),0,1),
 };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
/** Draws `object` over the frame on the canvas. The WebGPU renderer's image chain does it in the pass that shows the
 * frame (`gpu.over`). */
export function drawOver(renderer:T.WebGLRenderer,object:T.Object3D,camera:T.Camera,gpu?:FallingGPU){
 if(gpu){gpu.over(object,camera);return;}
 const clear=renderer.autoClear;renderer.autoClear=false;renderer.setRenderTarget(null);renderer.render(object,camera);renderer.autoClear=clear;
}
