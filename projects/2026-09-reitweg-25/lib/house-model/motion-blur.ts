import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** A camera's shutter while the view moves (Extreme): each pixel is smeared along the path its point took across the
 * frame since the last one, for `shutter` of that path and never more than `longest` of the frame's height, in `taps`
 * samples. Found from the frame's depth and the camera's last position, so only the camera's own movement blurs. A
 * view at rest is untouched. */
export const MOTION_BLUR={shutter:.4,longest:.03,taps:8};

export class MotionBlur extends Pass{
 private material:T.ShaderMaterial;private quad:FullScreenQuad;
 private last=new T.Matrix4();private now=new T.Matrix4();private fresh=false;
 constructor(private camera:T.PerspectiveCamera,depth:T.Texture){
  super();
  this.material=new T.ShaderMaterial({
   uniforms:{frame:{value:null},depth:{value:depth},projectionInverse:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},lastViewProjection:{value:new T.Matrix4()},far:{value:1000},seed:{value:0}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:`uniform sampler2D frame;uniform sampler2D depth;uniform mat4 projectionInverse;uniform mat4 cameraWorld;uniform mat4 lastViewProjection;uniform float far;uniform float seed;varying vec2 vUv;
    float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
    void main(){
     vec4 view=projectionInverse*vec4(vUv*2.0-1.0,1.0,1.0);view.xyz/=view.w;
     float d=min(texture2D(depth,vUv).r,far);
     vec4 was=lastViewProjection*cameraWorld*vec4(view.xyz*(d/-view.z),1.0);
     vec2 path=was.w>0.0?(vUv-(was.xy/was.w*0.5+0.5))*${MOTION_BLUR.shutter.toFixed(2)}:vec2(0.0);
     float len=length(path);
     if(len<0.0008){gl_FragColor=texture2D(frame,vUv);return;}
     path*=min(1.0,${MOTION_BLUR.longest.toFixed(3)}/len);
     vec3 sum=vec3(0.0);float jitter=fract(ign(gl_FragCoord.xy)+seed*0.618034);
     for(int i=0;i<${MOTION_BLUR.taps};i++)sum+=texture2D(frame,clamp(vUv-path*((float(i)+jitter)/${MOTION_BLUR.taps}.0-0.5),0.0,1.0)).rgb;
     gl_FragColor=vec4(sum/${MOTION_BLUR.taps}.0,1.0);
    }`,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 /** Before each frame: `moving` says the view is not at rest. The pass runs only when the camera has in fact moved
  * since a frame drawn just before. */
 frame(moving:boolean){
  this.now.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);
  this.enabled=moving&&this.fresh&&!this.now.equals(this.last);
  if(this.enabled)(this.material.uniforms.lastViewProjection.value as T.Matrix4).copy(this.last);
  this.last.copy(this.now);this.fresh=moving;
 }
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const u=this.material.uniforms;u.frame.value=read.texture;u.projectionInverse.value.copy(this.camera.projectionMatrixInverse);u.cameraWorld.value.copy(this.camera.matrixWorld);u.far.value=this.camera.far;u.seed.value=(u.seed.value+1)%64;
  renderer.setRenderTarget(this.renderToScreen?null:write);this.quad.render(renderer);
 }
 dispose(){this.material.dispose();this.quad.dispose();}
}
