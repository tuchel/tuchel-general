import * as T from 'three';
import {addShaderFeature,after,hasShaderFeature,materialsOf} from './shader-features';

/** The pool as a mirror (Extreme): the scene is drawn once more, reflected in the water's plane, at half resolution, and
 * the water reads it where the sky light alone would otherwise reflect, so the house, the trees and the clouds appear in
 * it. Ripples bend the reflection by the same normals that shade the water. The mirror image is drawn only while the
 * pool is in view, and clipped at the water line so nothing below it shows (after Lengyel's oblique near plane, as in
 * three's Reflector). Only the part of the view the pool takes up is drawn (`crop`), so most of the scene is culled.
 * Where a moving frame's time is short (`spare`), the image is redrawn every `pace` frames and kept in between, still
 * read with the view it was drawn for, so it stays where it belongs on the water. */
export const POOL_MIRROR={level:-.085+.003,scale:.5,ripple:.035,pace:2};

/** The part of `camera`'s view that `box` takes up, as [left, bottom, right, top] in -1..1 with `margin` around it, or
 * the whole view when the box reaches behind the camera. */
export function viewCrop(camera:T.Camera,box:T.Box3,margin:number):[number,number,number,number]{
 const m=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),v=new T.Vector4();
 let l=1,b=1,r=-1,t=-1;
 for(let i=0;i<8;i++){
  v.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z,1).applyMatrix4(m);
  if(v.w<=1e-4)return [-1,-1,1,1];
  l=Math.min(l,v.x/v.w);r=Math.max(r,v.x/v.w);b=Math.min(b,v.y/v.w);t=Math.max(t,v.y/v.w);
 }
 l=Math.max(-1,l-margin);b=Math.max(-1,b-margin);r=Math.min(1,r+margin);t=Math.min(1,t+margin);
 return r-l>1e-3&&t-b>1e-3?[l,b,r,t]:[-1,-1,1,1];
}
/** Points `mirror` at the reflection of `camera` in the horizontal plane y = `level`, with its near plane on the water
 * (Lengyel's oblique clipping), and sets `textureMatrix` to map world points to the mirror image's texture. With
 * `around`, the image is narrowed to the part of the mirror's view that box takes up (viewCrop, with `margin`); returns
 * that part. */
export function mirrorView(camera:T.PerspectiveCamera,level:number,mirror:T.PerspectiveCamera,textureMatrix:T.Matrix4,around?:T.Box3,margin=0){
 camera.updateMatrixWorld();
 const position=camera.position.clone(),look=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion).add(position);
 position.y=2*level-position.y;look.y=2*level-look.y;
 mirror.position.copy(position);mirror.up.set(0,1,0).applyQuaternion(camera.quaternion);mirror.up.y=-mirror.up.y;mirror.lookAt(look);
 mirror.updateMatrixWorld();mirror.projectionMatrix.copy(camera.projectionMatrix);
 const crop=around?viewCrop(mirror,around,margin):[-1,-1,1,1],[l,b,r,t]=crop;
 mirror.projectionMatrix.premultiply(new T.Matrix4().set(2/(r-l),0,0,-(r+l)/(r-l),0,2/(t-b),0,-(t+b)/(t-b),0,0,1,0,0,0,0,1));
 textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
 const plane=new T.Plane(new T.Vector3(0,1,0),-level).applyMatrix4(mirror.matrixWorldInverse),clip=new T.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
 const e=mirror.projectionMatrix.elements,q=new T.Vector4((Math.sign(clip.x)+e[8])/e[0],(Math.sign(clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);
 // Depth runs 0 to 1 under the WebGPU renderer, which would also remake a camera's projection on meeting it first.
 const deep=camera.coordinateSystem===T.WebGPUCoordinateSystem;mirror.coordinateSystem=camera.coordinateSystem;
 clip.multiplyScalar((deep?1:2)/clip.dot(q));e[2]=clip.x;e[6]=clip.y;e[10]=deep?clip.z:clip.z+1;e[14]=clip.w;
 mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
 return crop;
}
export function createPoolReflection(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,water:T.Object3D[]){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:2});
 const mirror=new T.PerspectiveCamera();
 const textureMatrix=new T.Matrix4(),uniforms={uMirror:{value:target.texture},uMirrorMatrix:{value:textureMatrix},uMirrorReady:{value:0},uMirrorRipple:{value:new T.Vector2(POOL_MIRROR.ripple,POOL_MIRROR.ripple)}};
 const box=new T.Box3();for(const o of water)box.expandByObject(o);
 const frustum=new T.Frustum(),projection=new T.Matrix4();
 const patched=new Set<T.Material>();let turn=0;
 const held=(spare:boolean)=>spare&&uniforms.uMirrorReady.value===1&&turn%POOL_MIRROR.pace!==0;
 for(const o of water)for(const m of materialsOf(o)){
  if(patched.has(m)||!hasShaderFeature(m,'pool-water'))continue;patched.add(m);
  addShaderFeature(m,{key:'pool-mirror',compile:shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='uniform mat4 uMirrorMatrix;varying vec4 vMirror;\n'+after(shader.vertexShader,'worldpos_vertex','vMirror=uMirrorMatrix*vec4((modelMatrix*vec4(transformed,1.0)).xyz,1.0);');
   shader.fragmentShader='uniform sampler2D uMirror;uniform float uMirrorReady;uniform vec2 uMirrorRipple;varying vec4 vMirror;\n'+after(shader.fragmentShader,'lights_fragment_maps',`
    if(uMirrorReady>0.5){
     vec3 n=inverseTransformDirection(normal,viewMatrix);
     vec2 uv=vMirror.xy/vMirror.w+n.xz*uMirrorRipple;
     radiance=texture2D(uMirror,clamp(uv,vec2(0.001),vec2(0.999))).rgb;
    }`);
  },variant:'',nodes:slots=>{
   // The same as nodes. The mirror image's rows run top down under the WebGPU renderer.
   const {texture,uniform,vec2,vec4,mix,clamp,positionWorld,normalWorld}=slots.tsl;
   const at=uniform(textureMatrix).mul(vec4(positionWorld,1)),ready=uniform(0).onRenderUpdate(()=>uniforms.uMirrorReady.value);
   const uv=clamp(at.xy.div(at.w).add((slots.normal??normalWorld).xz.mul(uniform(uniforms.uMirrorRipple.value))),.001,.999),image=texture(target.texture,vec2(uv.x,uv.y.oneMinus())).rgb;
   slots.indirect.push(context=>context.radiance.assign(mix(context.radiance,image,ready)));
  }});
 }
 const visible=()=>{
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
  return water.some(o=>o.visible)&&frustum.intersectsBox(box)&&camera.position.y>POOL_MIRROR.level;
 };
 // The ripples reach `ripple` of the whole view to either side, so the image keeps that much around the pool.
 const aim=()=>{
  const crop=mirrorView(camera,POOL_MIRROR.level,mirror,textureMatrix,box,2*POOL_MIRROR.ripple);
  uniforms.uMirrorRipple.value.set(2/(crop[2]-crop[0]),2/(crop[3]-crop[1])).multiplyScalar(POOL_MIRROR.ripple);
 };
 return {
  setSize:(width:number,height:number)=>target.setSize(Math.max(1,Math.round(width*POOL_MIRROR.scale)),Math.max(1,Math.round(height*POOL_MIRROR.scale))),
  /** The mirror's camera for this frame, or undefined when the pool is out of view (draws only what it can see use it). */
  prepare:(spare=false)=>{if(!visible()||held(spare))return undefined;aim();return mirror;},
  /** Draws the mirror image for the current camera; call before the frame. */
  render:(spare=false)=>{
   if(!visible()){uniforms.uMirrorReady.value=0;return;}
   if(held(spare)){turn++;return;}
   aim();turn=1;
   const shown=water.map(o=>o.visible),previous=renderer.getRenderTarget(),autoUpdate=renderer.shadowMap.autoUpdate;
   water.forEach(o=>{o.visible=false;});renderer.shadowMap.autoUpdate=false;
   renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,mirror);
   renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=autoUpdate;water.forEach((o,i)=>{o.visible=shown[i];});
   uniforms.uMirrorReady.value=1;
  },
  dispose:()=>target.dispose(),
 };
}
export type PoolReflection=ReturnType<typeof createPoolReflection>;
