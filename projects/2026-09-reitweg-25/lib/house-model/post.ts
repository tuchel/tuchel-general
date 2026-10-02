import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {DisplayP3ColorSpace} from 'three/addons/math/ColorSpaces.js';
import {finish} from './look';
import {LENS,DepthCapture,SunShafts,Meter,DepthOfField,focalLength,meterCorrection} from './lens';

/** Ambient occlusion at half resolution, with normals reconstructed from the main pass's
 * depth; no second scene render. */
class HalfResolutionGTAO extends GTAOPass{
 setSize(width:number,height:number){super.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)));}
 // three r186 reads normalRenderTarget even when depth comes from outside; give it an unused one.
 setGBuffer(depthTexture?:T.DepthTexture,normalTexture?:T.Texture){const self=this as unknown as {normalRenderTarget?:T.WebGLRenderTarget};self.normalRenderTarget??=new T.WebGLRenderTarget(1,1);super.setGBuffer(depthTexture,normalTexture);}
}
class QuarterResolutionBloom extends UnrealBloomPass{
 setSize(width:number,height:number){super.setSize(Math.max(2,Math.round(width/2)),Math.max(2,Math.round(height/2)));}
}
/** Points the AO pass at whichever buffer the scene was just rendered into. */
class DepthHandoff extends Pass{
 constructor(private ao:GTAOPass){super();this.needsSwap=false;}
 render(_r:T.WebGLRenderer,_w:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const depth=read.depthTexture;if(!depth||this.ao.depthTexture===depth)return;
  this.ao.depthTexture=depth;this.ao.gtaoMaterial.uniforms.tDepth.value=depth;this.ao.pdMaterial.uniforms.tDepth.value=depth;
 }
}
/** Averages sub-pixel-jittered frames while the camera is still: clean edges and settled AO. */
class AccumulatePass extends Pass{
 private targets:[T.WebGLRenderTarget,T.WebGLRenderTarget];
 private quad:FullScreenQuad;
 private material:T.ShaderMaterial;
 frames=0;
 constructor(){
  super();
  const make=()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
  this.targets=[make(),make()];
  this.material=new T.ShaderMaterial({uniforms:{current:{value:null},history:{value:null},weight:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D current;uniform sampler2D history;uniform float weight;varying vec2 vUv;void main(){gl_FragColor=mix(texture2D(history,vUv),texture2D(current,vUv),weight);}',depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 setSize(width:number,height:number){for(const t of this.targets)t.setSize(width,height);this.frames=0;}
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const [history,next]=this.targets,u=this.material.uniforms;
  u.current.value=read.texture;u.history.value=history.texture;u.weight.value=1/(this.frames+1);
  renderer.setRenderTarget(next);this.quad.render(renderer);
  this.targets=[next,history];this.frames++;
  u.current.value=next.texture;u.weight.value=1;renderer.setRenderTarget(this.renderToScreen?null:write);this.quad.render(renderer);
 }
 /** The settled image, before the finish. */
 get latest(){return this.targets[0].texture;}
 dispose(){for(const t of this.targets)t.dispose();this.material.dispose();this.quad.dispose();}
}
/** Blends a path-traced image over the settled live one. While the traced image is grainy, an edge-aware filter smooths
 * it within surfaces the live image shows as one: taps whose live colour differs by more than about half a stop count
 * for little, so edges stay sharp. */
class TracedBlend{
 target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 material=new T.ShaderMaterial({
  uniforms:{raster:{value:null},traced:{value:null},amount:{value:0},radius:{value:0},texel:{value:new T.Vector2()},shafts:{value:null},shafted:{value:0},
   depth:{value:null},hasDepth:{value:0},far:{value:3000},fogColor:{value:new T.Color()},fogRange:{value:new T.Vector2(1e9,1e9)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`uniform sampler2D raster;uniform sampler2D traced;uniform float amount;uniform float radius;uniform vec2 texel;uniform sampler2D shafts;uniform float shafted;
   uniform sampler2D depth;uniform float hasDepth;uniform float far;uniform vec3 fogColor;uniform vec2 fogRange;varying vec2 vUv;
   vec3 guide(vec2 uv){vec3 c=max(texture2D(raster,uv).rgb,vec3(0.0));float s=c.r+c.g+c.b+1e-4;return vec3(log2(s/3.0+1e-4)*2.0,c.r/s*6.0,c.g/s*6.0);}
   void main(){
    vec3 live=texture2D(raster,vUv).rgb,t;
    if(radius<0.05)t=texture2D(traced,vUv).rgb;
    else{
     vec3 g0=guide(vUv),sum=vec3(0.0);float w=0.0;
     for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
      vec2 o=vec2(float(x),float(y))*radius*0.5*texel;vec3 d=guide(vUv+o)-g0;
      float k=exp(-dot(d,d)-float(x*x+y*y)/4.5);sum+=k*texture2D(traced,vUv+o).rgb;w+=k;
     }
     t=sum/w;
    }
    // The traced scene has no air: the live view's haze and sun shafts are added to it, and where no surface is hit
    // the live view's sky shows (the tracer sees the softer sky that lights the scene).
    if(hasDepth>0.5){
     float d=texture2D(depth,vUv).r;
     t=d>=far*0.999?live:mix(t,fogColor,smoothstep(fogRange.x,fogRange.y,d));
    }
    t+=shafted*texture2D(shafts,vUv).rgb;
    gl_FragColor=vec4(mix(live,t,amount),1.0);
   }`,
  depthTest:false,depthWrite:false,
 });
 quad=new FullScreenQuad(this.material);
 dispose(){this.target.dispose();this.material.dispose();this.quad.dispose();}
}

/** Tone mapping with the finish of a photograph (look.ts): white balance on the scene's light before tone mapping, then
 * the S-curve and colour on display values, before the sRGB encoding. Extreme adds film grain (lens.ts), strongest in
 * the mid-tones, different every frame. On a Display P3 canvas (Extreme on a wide-gamut screen) the graded colour moves
 * to P3's primaries before it is clamped, so what the grade saturates past sRGB is kept; three's output pass applies
 * only the transfer curve. */
class FinishedOutput extends OutputPass{
 constructor(){
  super();
  Object.assign(this.uniforms,{uBalance:{value:new T.Vector3(1,1,1)},uLook:{value:new T.Vector2(1,1)},uGrain:{value:0},uSeed:{value:0},uP3:{value:0}});
  const patch=(shader:string,anchor:string,code:string)=>{if(!shader.includes(anchor))throw new Error(`output shader has no ${anchor}`);return shader.replace(anchor,code);};
  let shader=this.material.fragmentShader;
  // Linear sRGB to linear Display P3 (three's XYZ matrices), column by column.
  shader=patch(shader,'uniform sampler2D tDiffuse;','uniform sampler2D tDiffuse;uniform vec3 uBalance;uniform vec2 uLook;uniform float uGrain;uniform float uSeed;uniform float uP3;const mat3 P3_FROM_SRGB=mat3(0.8225927,0.0331996,0.0170853,0.1775340,0.9667835,0.0723957,0.0000000,0.0000000,0.9103014);');
  shader=patch(shader,'gl_FragColor = texture2D( tDiffuse, vUv );','gl_FragColor = texture2D( tDiffuse, vUv );gl_FragColor.rgb*=uBalance;');
  shader=patch(shader,'#ifdef SRGB_TRANSFER',`{vec3 e=pow(clamp(gl_FragColor.rgb,0.0,1.0),vec3(1.0/2.2)),p=pow(e,vec3(uLook.x)),q=pow(1.0-e,vec3(uLook.x));
   vec3 c=pow(p/max(p+q,vec3(1e-5)),vec3(2.2));float l=dot(c,vec3(0.2126,0.7152,0.0722));vec3 g=l+uLook.y*(c-l);if(uP3>0.5)g=P3_FROM_SRGB*g;gl_FragColor.rgb=max(vec3(0.0),g);}
  if(uGrain>0.0){
   // Two hashes summed: triangular noise in −1…1 (float only; the output pass compiles as GLSL ES 1.0).
   vec3 h=fract(vec3(gl_FragCoord.xyx+uSeed*vec3(17.0,59.0,23.0))*0.1031);h+=dot(h,h.yzx+33.33);
   vec3 k=fract(vec3(gl_FragCoord.yxy*1.37+uSeed*vec3(91.0,7.0,41.0))*0.1031);k+=dot(k,k.yzx+33.33);
   float n=fract((h.x+h.y)*h.z)+fract((k.x+k.y)*k.z)-1.0;
   vec3 e=pow(gl_FragColor.rgb,vec3(1.0/2.2));float m=clamp(dot(e,vec3(0.2126,0.7152,0.0722)),0.0,1.0);
   gl_FragColor.rgb=pow(max(e+n*uGrain*(0.3+2.8*m*(1.0-m)),vec3(0.0)),vec3(2.2));
  }
  #ifdef SRGB_TRANSFER`);
  this.material.fragmentShader=shader;
 }
 set(indoor:number){const f=finish(indoor);(this.uniforms.uBalance.value as T.Vector3).set(f.balance[0],f.balance[1],f.balance[2]);(this.uniforms.uLook.value as T.Vector2).set(f.contrast,f.saturation);return f;}
}

/** Depth of field as a step of the chain (lens.ts). */
class FocusPass extends Pass{
 focus=5;scale=0;
 constructor(public dof:DepthOfField){super();}
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){this.dof.render(renderer,read.texture,this.renderToScreen?null:write,this.focus,this.scale);}
 dispose(){this.dof.dispose();}
}

/** `lens` (Extreme) adds the camera of lens.ts: metered exposure, autofocus depth of field at eye level, sun shafts and
 * grain. */
export type PostOptions={samples:number;ao:boolean;bloom:boolean;lens?:{sun:T.DirectionalLight}};
export type PostView={eyeLevel:boolean};
export function createPost(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,options:PostOptions){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:options.samples,depthTexture:new T.DepthTexture(1,1)});
 const composer=new EffectComposer(renderer,target);
 const scenePass=new RenderPass(scene,camera);composer.addPass(scenePass);
 let ao:HalfResolutionGTAO|undefined;
 if(options.ao){
  ao=new HalfResolutionGTAO(scene,camera,1,1,{depthTexture:composer.readBuffer.depthTexture??undefined});
  ao.updateGtaoMaterial({radius:.7,distanceExponent:1.6,thickness:1.4,scale:1,samples:12,distanceFallOff:1});
  ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:12});
  composer.addPass(new DepthHandoff(ao));composer.addPass(ao);
 }
 const lensCamera=options.lens&&camera instanceof T.PerspectiveCamera?camera:undefined;
 const depth=lensCamera?new DepthCapture(lensCamera):undefined;
 if(depth)composer.insertPass(depth,1);
 let bloom:QuarterResolutionBloom|undefined;
 // Faint and tight: a glow at the sun, glints and sunlit glass, never a veil over the room.
 if(options.bloom){bloom=new QuarterResolutionBloom(new T.Vector2(1,1),.06,.1,1);composer.addPass(bloom);}
 const shafts=lensCamera&&depth&&options.lens?new SunShafts(lensCamera,options.lens.sun,depth.target.texture):undefined;
 if(shafts)composer.addPass(shafts);
 const meter=lensCamera&&depth?new Meter(depth.target.texture,()=>lensCamera.aspect):undefined;
 if(meter)composer.addPass(meter);
 const accumulate=new AccumulatePass();composer.addPass(accumulate);
 const focusPass=depth?new FocusPass(new DepthOfField(depth.target.texture)):undefined;
 if(focusPass)composer.addPass(focusPass);
 const output=new FinishedOutput();composer.addPass(output);
 if(meter)output.uniforms.uGrain.value=LENS.grain;
 let traced:TracedBlend|undefined,focused:T.WebGLRenderTarget|undefined,scale=1,focus=NaN,last=0,seed=0;
 /** Eases exposure toward the meter's reading and focus toward the middle of the frame. */
 const adapt=(exposure:number,view:PostView)=>{
  const now=performance.now(),dt=Math.min(.1,(now-(last||now))/1000);last=now;
  if(meter&&Number.isFinite(meter.logAverage)){
   const target=meterCorrection(meter.logAverage,exposure),k=Math.min(1,dt/LENS.meter.seconds);
   scale=scale*Math.pow(target/scale,k);
  }
  if(meter&&Number.isFinite(meter.focus))focus=Number.isFinite(focus)?focus+(meter.focus-focus)*Math.min(1,dt/.2):meter.focus;
  if(focusPass&&lensCamera&&depth){
   const f=focalLength(lensCamera.fov),at=Number.isFinite(focus)?Math.max(focus,.3):5;
   focusPass.focus=at;focusPass.scale=f*f/(LENS.fNumber*Math.max(at-f,1e-3))/LENS.sensor*depth.target.height;
   // At eye level only: from the air a point 30 m off focus blurs less than a pixel.
   focusPass.enabled=view.eyeLevel;
  }
  output.uniforms.uSeed.value=seed=(seed+1)%64;
  renderer.toneMappingExposure=exposure*scale;
 };
 return {
  composer,
  /** The chain's passes by name, for the performance readout (perf-readout.ts). */
  passes:([['scene',scenePass],['depth',depth],['ao',ao],['bloom',bloom],['shafts',shafts],['meter',meter],['accumulate',accumulate],['focus',focusPass],['output',output]] as [string,Pass|undefined][]).filter((p):p is [string,Pass]=>!!p[1]),
  setSize:(width:number,height:number,ratio:number)=>{composer.setPixelRatio(ratio);composer.setSize(width,height);},
  /** Moving frames skip AO and accumulation; still frames refine towards a clean image. `indoor` (0–1) eases in the
   * interior finish (look.ts). With the lens, exposure follows the meter while the view moves and for the first frames
   * of a rest, then holds, so a settling image never changes brightness. */
  render:(refining:boolean,exposure:number,indoor=0,view:PostView={eyeLevel:false})=>{
   const f=output.set(indoor);output.uniforms.uP3.value=renderer.outputColorSpace===DisplayP3ColorSpace?1:0;
   if(ao){ao.enabled=refining;ao.blendIntensity=f.occlusion;}
   if(!refining){accumulate.frames=0;shafts?.reset();}
   accumulate.enabled=refining;
   if(shafts)shafts.indoor=indoor;
   if(meter)meter.enabled=!refining||accumulate.frames<6;
   adapt(exposure,view);
   // Bloom threshold in display terms: only highlights two and a half times brighter than white bloom.
   if(bloom)bloom.threshold=2.5/Math.max(renderer.toneMappingExposure,1e-4);
   composer.render();
  },
  get accumulated(){return accumulate.frames;},
  /** Shows a path-traced image (linear, before exposure) over the settled live image, through the same finish. `amount`
   * 0–1 blends it in; `radius` (traced pixels) smooths its grain (TracedBlend). */
  present:(image:T.Texture,amount:number,radius:number,exposure:number,indoor=0)=>{
   output.set(indoor);output.uniforms.uP3.value=renderer.outputColorSpace===DisplayP3ColorSpace?1:0;
   traced??=new TracedBlend();
   const size=renderer.getDrawingBufferSize(new T.Vector2()),u=traced.material.uniforms,source=image.image as {width:number;height:number};
   if(traced.target.width!==size.x||traced.target.height!==size.y)traced.target.setSize(size.x,size.y);
   u.raster.value=accumulate.latest;u.traced.value=image;u.amount.value=amount;u.radius.value=radius;u.texel.value.set(1/source.width,1/source.height);
   u.shafts.value=shafts?.active?shafts.texture:null;u.shafted.value=shafts?.active?1:0;
   u.depth.value=depth?.target.texture??null;u.hasDepth.value=depth?1:0;u.far.value=lensCamera?.far??3000;
   if(scene.fog instanceof T.Fog){u.fogColor.value.copy(scene.fog.color);u.fogRange.value.set(scene.fog.near,scene.fog.far);}
   renderer.setRenderTarget(traced.target);traced.quad.render(renderer);
   // Exposure and focus hold while the view rests; the grain keeps moving.
   renderer.toneMappingExposure=exposure*scale;output.uniforms.uSeed.value=seed=(seed+1)%64;
   let finished=traced.target;
   if(focusPass?.enabled){
    focused??=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
    if(focused.width!==size.x||focused.height!==size.y)focused.setSize(size.x,size.y);
    focusPass.dof.render(renderer,traced.target.texture,focused,focusPass.focus,focusPass.scale);finished=focused;
   }
   output.renderToScreen=true;output.render(renderer,null as unknown as T.WebGLRenderTarget,finished,0,false);
  },
  reset:()=>{accumulate.frames=0;},
  dispose:()=>{traced?.dispose();focused?.dispose();for(const p of composer.passes)(p as Pass&{dispose?:()=>void}).dispose?.();composer.dispose();target.dispose();},
 };
}
export type Post=ReturnType<typeof createPost>;
