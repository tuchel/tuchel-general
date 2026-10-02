import * as T from 'three';
import {addShaderFeature,after,hasShaderFeature,materialsOf} from './shader-features';

/** The pool as a mirror (Extreme): the scene is drawn once more, reflected in the water's plane, at half resolution, and
 * the water reads it where the sky light alone would otherwise reflect, so the house, the trees and the clouds appear in
 * it. Ripples bend the reflection by the same normals that shade the water. The mirror image is drawn only while the
 * pool is in view, and clipped at the water line so nothing below it shows (after Lengyel's oblique near plane, as in
 * three's Reflector). */
export const POOL_MIRROR={level:-.085+.003,scale:.5,ripple:.035};

/** Points `mirror` at the reflection of `camera` in the horizontal plane y = `level`, with its near plane on the water
 * (Lengyel's oblique clipping), and sets `textureMatrix` to map world points to the mirror image's texture. */
export function mirrorView(camera:T.PerspectiveCamera,level:number,mirror:T.PerspectiveCamera,textureMatrix:T.Matrix4){
 camera.updateMatrixWorld();
 const position=camera.position.clone(),look=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion).add(position);
 position.y=2*level-position.y;look.y=2*level-look.y;
 mirror.position.copy(position);mirror.up.set(0,1,0).applyQuaternion(camera.quaternion);mirror.up.y=-mirror.up.y;mirror.lookAt(look);
 mirror.updateMatrixWorld();mirror.projectionMatrix.copy(camera.projectionMatrix);
 textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
 const plane=new T.Plane(new T.Vector3(0,1,0),-level).applyMatrix4(mirror.matrixWorldInverse),clip=new T.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
 const e=mirror.projectionMatrix.elements,q=new T.Vector4((Math.sign(clip.x)+e[8])/e[0],(Math.sign(clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);
 clip.multiplyScalar(2/clip.dot(q));e[2]=clip.x;e[6]=clip.y;e[10]=clip.z+1;e[14]=clip.w;
 mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
}
export function createPoolReflection(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,water:T.Object3D[]){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:2});
 const mirror=new T.PerspectiveCamera();
 const textureMatrix=new T.Matrix4(),uniforms={uMirror:{value:target.texture},uMirrorMatrix:{value:textureMatrix},uMirrorReady:{value:0},uMirrorRipple:{value:POOL_MIRROR.ripple}};
 const box=new T.Box3();for(const o of water)box.expandByObject(o);
 const frustum=new T.Frustum(),projection=new T.Matrix4();
 const patched=new Set<T.Material>();
 for(const o of water)for(const m of materialsOf(o)){
  if(patched.has(m)||!hasShaderFeature(m,'pool-water'))continue;patched.add(m);
  addShaderFeature(m,{key:'pool-mirror',compile:shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='uniform mat4 uMirrorMatrix;varying vec4 vMirror;\n'+after(shader.vertexShader,'worldpos_vertex','vMirror=uMirrorMatrix*vec4((modelMatrix*vec4(transformed,1.0)).xyz,1.0);');
   shader.fragmentShader='uniform sampler2D uMirror;uniform float uMirrorReady;uniform float uMirrorRipple;varying vec4 vMirror;\n'+after(shader.fragmentShader,'lights_fragment_maps',`
    if(uMirrorReady>0.5){
     vec3 n=inverseTransformDirection(normal,viewMatrix);
     vec2 uv=vMirror.xy/vMirror.w+n.xz*uMirrorRipple;
     radiance=texture2D(uMirror,clamp(uv,vec2(0.001),vec2(0.999))).rgb;
    }`);
  }});
 }
 const visible=()=>{
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
  return water.some(o=>o.visible)&&frustum.intersectsBox(box)&&camera.position.y>POOL_MIRROR.level;
 };
 return {
  setSize:(width:number,height:number)=>target.setSize(Math.max(1,Math.round(width*POOL_MIRROR.scale)),Math.max(1,Math.round(height*POOL_MIRROR.scale))),
  /** The mirror's camera for this frame, or undefined when the pool is out of view (draws only what it can see use it). */
  prepare:()=>{if(!visible())return undefined;mirrorView(camera,POOL_MIRROR.level,mirror,textureMatrix);return mirror;},
  /** Draws the mirror image for the current camera; call before the frame. */
  render:()=>{
   if(!visible()){uniforms.uMirrorReady.value=0;return;}
   mirrorView(camera,POOL_MIRROR.level,mirror,textureMatrix);
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
