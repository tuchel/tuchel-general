import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** The camera behind Extreme's image: a full-frame body (36 × 24 mm) with its focal length set by the field of view,
 * at f/2.8; it meters the scene and focuses on what is in the middle of the frame. */
export const LENS={sensor:.024,fNumber:2.8,maxBlur:10,
 /** Metering eases exposure by half the difference from a sunlit garden view (whose centre-weighted log average meters
  * 0.12 under the light model's exposure), at most half a stop either way: a camera's response on top of the light
  * model and the room exposure (lighting.ts), which keep rooms as photographed. */
 meter:{strength:.5,stops:.5,key:.12,seconds:.45},
 /** Air with a little dust: shafts of sunlight through windows and between trees. Scattering per metre outdoors, and in
  * a room for its first `room` metres from the camera; marched `reach` metres. */
 air:{outdoors:.0005,indoors:.012,room:5,forward:.4,reach:20,steps:24},
 /** Grain on the finished image, as a fraction of display brightness at mid-tones. */
 grain:.035,
};
const sharedVertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';

/** Focal length (metres) for a vertical field of view on the 24 mm-high sensor. */
export const focalLength=(fovDegrees:number)=>LENS.sensor/2/Math.tan(T.MathUtils.degToRad(fovDegrees)/2);
/** Blur diameter on screen, in pixels, of a point `distance` metres away when the lens focuses at `focus` metres. */
export function circleOfConfusion(distance:number,focus:number,fovDegrees:number,heightPixels:number){
 const f=focalLength(fovDegrees),onSensor=f*f/(LENS.fNumber*Math.max(focus-f,1e-3))*Math.abs(distance-focus)/Math.max(distance,1e-3);
 return Math.min(LENS.maxBlur,onSensor/LENS.sensor*heightPixels);
}
/** The exposure factor metering asks for, given the scene's centre-weighted log-average luminance and the exposure the
 * physical light model set. */
export function meterCorrection(logAverage:number,exposure:number){
 const {strength,stops,key}=LENS.meter,difference=Math.log2(key/Math.max(exposure*Math.pow(2,logAverage),1e-6));
 return Math.pow(2,T.MathUtils.clamp(difference*strength,-stops,stops));
}
/** Light scattered toward the camera per metre of sunlit air, per unit of sun irradiance (Henyey–Greenstein); `indoor`
 * is room air, near the camera. */
export function inScatter(cosAngle:number,indoor:number){
 const {outdoors,indoors,forward:g}=LENS.air,sigma=T.MathUtils.lerp(outdoors,indoors,indoor);
 return sigma*(1-g*g)/(4*Math.PI*Math.pow(1+g*g-2*g*cosAngle,1.5));
}

/** Linear depth (metres along the view) of the frame just rendered, kept for passes that run after the scene, and for
 * a path-traced image of the same view. */
export class DepthCapture extends Pass{
 target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 private material=new T.ShaderMaterial({uniforms:{depth:{value:null},near:{value:.1},far:{value:1000}},vertexShader:sharedVertex,
  fragmentShader:`#include <packing>
   uniform sampler2D depth;uniform float near;uniform float far;varying vec2 vUv;
   void main(){float d=texture2D(depth,vUv).r;gl_FragColor=vec4(d>=1.0?far:-perspectiveDepthToViewZ(d,near,far),0.0,0.0,1.0);}`,depthTest:false,depthWrite:false});
 private quad=new FullScreenQuad(this.material);
 constructor(private camera:T.PerspectiveCamera){super();this.needsSwap=false;}
 setSize(width:number,height:number){this.target.setSize(width,height);}
 render(renderer:T.WebGLRenderer,_w:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  if(!read.depthTexture)return;
  const u=this.material.uniforms;u.depth.value=read.depthTexture;u.near.value=this.camera.near;u.far.value=this.camera.far;
  const previous=renderer.getRenderTarget();renderer.setRenderTarget(this.target);this.quad.render(renderer);renderer.setRenderTarget(previous);
 }
 dispose(){this.target.dispose();this.material.dispose();this.quad.dispose();}
}

/** Sunlight scattered by the air between the camera and each surface, marched through the sun's shadow map, so shafts
 * fall through windows and between trees. Half resolution, jittered per frame and averaged while the view rests; the
 * average is added to the frame and kept for a path-traced image of the same view. */
export class SunShafts extends Pass{
 private targets=[0,1].map(()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}));
 private march:T.ShaderMaterial;private add:T.ShaderMaterial;
 private marchQuad:FullScreenQuad;private addQuad:FullScreenQuad;
 frames=0;indoor=0;
 constructor(private camera:T.PerspectiveCamera,private sun:T.DirectionalLight,private depth:T.Texture){
  super();
  const {forward,reach,steps}=LENS.air;
  this.march=new T.ShaderMaterial({
   uniforms:{depth:{value:depth},shadow:{value:null},shadowMatrix:{value:new T.Matrix4()},projectionInverse:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},
    sunDirection:{value:new T.Vector3()},sunLight:{value:new T.Vector3()},sigma:{value:new T.Vector2(LENS.air.outdoors,LENS.air.indoors)},indoor:{value:0},frame:{value:0},history:{value:null},weight:{value:1}},
   vertexShader:sharedVertex,
   fragmentShader:`precision highp sampler2DShadow;
    uniform sampler2D depth;uniform sampler2DShadow shadow;uniform mat4 shadowMatrix;uniform mat4 projectionInverse;uniform mat4 cameraWorld;
    uniform vec3 sunDirection;uniform vec3 sunLight;uniform vec2 sigma;uniform float indoor;uniform float frame;uniform sampler2D history;uniform float weight;varying vec2 vUv;
    float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
    void main(){
     vec4 view=projectionInverse*vec4(vUv*2.0-1.0,1.0,1.0);vec3 dirView=normalize(view.xyz/view.w);
     float along=texture2D(depth,vUv).r,dist=min(along/max(-dirView.z,1e-3),${reach.toFixed(1)});
     vec3 origin=(cameraWorld*vec4(0.0,0.0,0.0,1.0)).xyz,dir=normalize(mat3(cameraWorld)*dirView);
     float c=dot(dir,sunDirection),g=${forward.toFixed(2)},phase=(1.0-g*g)/(12.566371*pow(1.0+g*g-2.0*g*c,1.5));
     float step=dist/${steps}.0,offset=fract(ign(gl_FragCoord.xy)+frame*0.618034),scattered=0.0;
     for(int i=0;i<${steps};i++){
      float t=step*(float(i)+offset);vec4 s=shadowMatrix*vec4(origin+dir*t,1.0);
      float lit=(any(lessThan(s.xyz,vec3(0.0)))||any(greaterThan(s.xyz,vec3(1.0))))?1.0:texture(shadow,vec3(s.xy,s.z-0.0005));
      // A room's dusty air for its first metres, then the clear air beyond the glass.
      scattered+=lit*mix(sigma.x,sigma.y,indoor*(1.0-smoothstep(${LENS.air.room.toFixed(1)}-1.0,${LENS.air.room.toFixed(1)}+1.0,t)));
     }
     vec3 light=sunLight*phase*scattered*step;
     gl_FragColor=vec4(mix(texture2D(history,vUv).rgb,light,weight),1.0);
    }`,depthTest:false,depthWrite:false});
  // Added as a full pass rather than blended onto the frame: a multisampled buffer's samples are discarded once resolved.
  this.add=new T.ShaderMaterial({uniforms:{frame:{value:null},shafts:{value:null},texel:{value:new T.Vector2()}},vertexShader:sharedVertex,
   fragmentShader:`uniform sampler2D frame;uniform sampler2D shafts;uniform vec2 texel;varying vec2 vUv;
    void main(){vec3 s=texture2D(shafts,vUv+texel*vec2(-0.5,-0.5)).rgb+texture2D(shafts,vUv+texel*vec2(0.5,-0.5)).rgb+texture2D(shafts,vUv+texel*vec2(-0.5,0.5)).rgb+texture2D(shafts,vUv+texel*vec2(0.5,0.5)).rgb;
     gl_FragColor=vec4(texture2D(frame,vUv).rgb+s*0.25,1.0);}`,depthTest:false,depthWrite:false});
  this.marchQuad=new FullScreenQuad(this.march);this.addQuad=new FullScreenQuad(this.add);
 }
 /** The averaged shafts, for a path-traced image of the same view. */
 get texture(){return this.targets[0].texture;}
 setSize(width:number,height:number){for(const t of this.targets)t.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)));this.frames=0;(this.add.uniforms.texel.value as T.Vector2).set(1/Math.max(1,width),1/Math.max(1,height));}
 reset(){this.frames=0;}
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const sun=this.sun,map=sun.shadow.map?.depthTexture,u=this.march.uniforms;
  // Night: nothing to scatter; the frame passes through.
  if(!sun.visible||!map){this.frames=0;this.add.uniforms.shafts.value=null;}
  else{
   u.shadow.value=map;u.shadowMatrix.value.copy(sun.shadow.matrix);
   u.projectionInverse.value.copy(this.camera.projectionMatrixInverse);u.cameraWorld.value.copy(this.camera.matrixWorld);
   (u.sunDirection.value as T.Vector3).subVectors(sun.position,sun.target.position).normalize();
   (u.sunLight.value as T.Vector3).set(sun.color.r,sun.color.g,sun.color.b).multiplyScalar(sun.intensity);
   u.indoor.value=this.indoor;
   const [history,next]=this.targets;u.history.value=history.texture;u.weight.value=1/(this.frames+1);u.frame.value=this.frames;
   renderer.setRenderTarget(next);this.marchQuad.render(renderer);
   this.targets=[next,history];this.frames++;this.add.uniforms.shafts.value=next.texture;
  }
  this.add.uniforms.frame.value=read.texture;renderer.setRenderTarget(this.renderToScreen?null:write);this.addQuad.render(renderer);
 }
 /** Whether there are shafts to add (daylight). */
 get active(){return !!this.add.uniforms.shafts.value;}
 dispose(){for(const t of this.targets)t.dispose();this.march.dispose();this.add.dispose();this.marchQuad.dispose();this.addQuad.dispose();}
}

/** Centre-weighted metering and autofocus: a 32 × 32 summary of the frame's log luminance and depth, read back without
 * stalling the graphics card. */
export class Meter extends Pass{
 private target=new T.WebGLRenderTarget(32,32,{type:T.FloatType,depthBuffer:false});
 private material:T.ShaderMaterial;private quad:FullScreenQuad;
 private pending=false;private data=new Float32Array(32*32*4);
 /** Centre-weighted log₂ average luminance of the scene's light, before exposure; NaN until measured. */
 logAverage=NaN;
 /** Distance (metres) to what is in the middle of the frame; NaN until measured. */
 focus=NaN;
 constructor(depth:T.Texture,private aspect=()=>1){
  super();this.needsSwap=false;
  this.material=new T.ShaderMaterial({uniforms:{color:{value:null},depth:{value:depth},aspect:{value:1}},vertexShader:sharedVertex,
   fragmentShader:`uniform sampler2D color;uniform sampler2D depth;uniform float aspect;varying vec2 vUv;
    void main(){
     vec3 c=vec3(0.0);for(int y=0;y<2;y++)for(int x=0;x<2;x++)c+=texture2D(color,vUv+(vec2(float(x),float(y))-0.5)/64.0).rgb;
     float l=dot(c*0.25,vec3(0.2126,0.7152,0.0722));vec2 p=(vUv-0.5)*vec2(aspect,1.0);
     gl_FragColor=vec4(log2(max(l,1e-6)),texture2D(depth,vUv).r,exp(-dot(p,p)/0.08),1.0);
    }`,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 render(renderer:T.WebGLRenderer,_w:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  if(this.pending)return;
  const u=this.material.uniforms;u.color.value=read.texture;u.aspect.value=this.aspect();
  const previous=renderer.getRenderTarget();renderer.setRenderTarget(this.target);this.quad.render(renderer);renderer.setRenderTarget(previous);
  this.pending=true;
  renderer.readRenderTargetPixelsAsync(this.target,0,0,32,32,this.data).then(()=>{
   let sum=0,weights=0;const centre:number[]=[];
   for(let i=0;i<32*32;i++){const w=this.data[i*4+2];sum+=this.data[i*4]*w;weights+=w;}
   for(let y=14;y<18;y++)for(let x=14;x<18;x++)centre.push(this.data[(y*32+x)*4+1]);
   centre.sort((a,b)=>a-b);
   this.logAverage=sum/Math.max(weights,1e-6);this.focus=(centre[7]+centre[8])/2;
  }).catch(()=>{}).finally(()=>{this.pending=false;});
 }
 dispose(){this.target.dispose();this.material.dispose();this.quad.dispose();}
}

/** Depth of field from the lens above: each pixel gathers neighbours on a golden-angle spiral out to its own blur, and
 * a nearer, blurrier neighbour may spill over a sharp edge behind it but not the other way (after Gustafsson's
 * single-pass bokeh). */
export class DepthOfField{
 private material:T.ShaderMaterial;private quad:FullScreenQuad;
 constructor(depth:T.Texture){
  this.material=new T.ShaderMaterial({
   uniforms:{color:{value:null},depth:{value:depth},texel:{value:new T.Vector2()},focus:{value:5},scale:{value:0},maxBlur:{value:LENS.maxBlur}},
   vertexShader:sharedVertex,
   fragmentShader:`uniform sampler2D color;uniform sampler2D depth;uniform vec2 texel;uniform float focus;uniform float scale;uniform float maxBlur;varying vec2 vUv;
    float blur(float d){return min(maxBlur,scale*abs(d-focus)/max(d,1e-3));}
    void main(){
     float centreDepth=texture2D(depth,vUv).r,centreSize=blur(centreDepth);
     vec3 sum=texture2D(color,vUv).rgb;float total=1.0,radius=0.6;
     for(int i=0;i<160;i++){
      if(radius>=maxBlur)break;
      float a=float(i)*2.39996323;vec2 uv=vUv+vec2(cos(a),sin(a))*texel*radius;
      vec3 c=texture2D(color,uv).rgb;float d=texture2D(depth,uv).r,size=blur(d);
      if(d>centreDepth)size=clamp(size,0.0,centreSize*2.0);
      float m=smoothstep(radius-0.5,radius+0.5,size);
      sum+=mix(sum/total,c,m);total+=1.0;radius+=0.6/radius;
     }
     gl_FragColor=vec4(sum/total,1.0);
    }`,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 /** Renders `input` into `output` focused at `focus` metres; `scale` is the blur (pixels) of a point at infinity. */
 render(renderer:T.WebGLRenderer,input:T.Texture,output:T.WebGLRenderTarget|null,focus:number,scale:number){
  const u=this.material.uniforms;u.color.value=input;u.focus.value=focus;u.scale.value=scale;
  const image=input.image as {width:number;height:number};(u.texel.value as T.Vector2).set(1/image.width,1/image.height);
  renderer.setRenderTarget(output);this.quad.render(renderer);
 }
 dispose(){this.material.dispose();this.quad.dispose();}
}
