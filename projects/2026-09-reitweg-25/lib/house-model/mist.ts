import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** Ground mist at daybreak (Extreme): air that thickens toward the lawn, `depth` m deep (its density falls by e over
 * that height), through which 1/`reach` of the light is lost per metre along the ground at its fullest. It lies while
 * the sun is between `sun[0]` and `sun[1]` degrees, fullest just after sunrise, and a third as much at the same sun in
 * the evening; `summer` is what a midsummer morning keeps of it. Looked up from each pixel's depth, so it costs one
 * pass and shows in the path-traced still as well (post.ts). */
export const MIST={depth:1.3,reach:38,sun:[-7,13] as const,peak:2,evening:.3,summer:.45};

/** How much mist lies (0–1) at the sun's elevation (degrees), `minutes` into day `day` of the year. */
export function mistAmount(elevation:number,minutes:number,day:number){
 const [lo,hi]=MIST.sun,rise=T.MathUtils.smoothstep(elevation,lo,MIST.peak)*(1-T.MathUtils.smoothstep(elevation,MIST.peak,hi));
 const season=T.MathUtils.lerp(1,MIST.summer,Math.max(0,Math.cos((day-172)/365*2*Math.PI)));
 return rise*(minutes<720?1:MIST.evening)*season;
}
/** `vec3 mistOver(colour, eye, point, mist)`: `colour` seen from `eye` at `point` (world), through mist of colour
 * `mist.rgb` and ground density `mist.a` per metre. */
export const mistGlsl=`
vec3 mistOver(vec3 colour,vec3 eye,vec3 point,vec4 mist){
 if(mist.a<=0.0)return colour;
 float h=${MIST.depth.toFixed(2)},dy=(point.y-eye.y)/h,a=exp(-max(eye.y,0.0)/h),b=exp(-max(point.y,0.0)/h);
 float mean=abs(dy)<0.01?a:(a-b)/dy;
 return mix(mist.rgb,colour,exp(-mist.a*length(point-eye)*max(mean,0.0)));
}`;

export class MistPass extends Pass{
 private material:T.ShaderMaterial;private quad:FullScreenQuad;
 /** `mist`: the uniform shared with the traced blend: colour and ground density. */
 constructor(private camera:T.PerspectiveCamera,depth:T.Texture,private mist:{value:T.Vector4}){
  super();
  this.material=new T.ShaderMaterial({
   uniforms:{frame:{value:null},depth:{value:depth},mist,projectionInverse:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},far:{value:1000}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:`uniform sampler2D frame;uniform sampler2D depth;uniform vec4 mist;uniform mat4 projectionInverse;uniform mat4 cameraWorld;uniform float far;varying vec2 vUv;${mistGlsl}
    void main(){
     vec4 colour=texture2D(frame,vUv);
     vec4 view=projectionInverse*vec4(vUv*2.0-1.0,1.0,1.0);vec3 dirView=normalize(view.xyz/view.w);
     // The sky stands for the land far off: mist lies along the horizon.
     float d=texture2D(depth,vUv).r,dist=d>=far*0.999?600.0:d/max(-dirView.z,1e-3);
     vec3 eye=(cameraWorld*vec4(0.0,0.0,0.0,1.0)).xyz,dir=normalize(mat3(cameraWorld)*dirView);
     gl_FragColor=vec4(mistOver(colour.rgb,eye,eye+dir*dist,mist),colour.a);
    }`,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const u=this.material.uniforms;u.frame.value=read.texture;u.projectionInverse.value.copy(this.camera.projectionMatrixInverse);u.cameraWorld.value.copy(this.camera.matrixWorld);u.far.value=this.camera.far;
  renderer.setRenderTarget(this.renderToScreen?null:write);this.quad.render(renderer);
 }
 dispose(){this.material.dispose();this.quad.dispose();}
}
