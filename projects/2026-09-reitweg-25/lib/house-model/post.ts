import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {finish} from './look';

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
  uniforms:{raster:{value:null},traced:{value:null},amount:{value:0},radius:{value:0},texel:{value:new T.Vector2()}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`uniform sampler2D raster;uniform sampler2D traced;uniform float amount;uniform float radius;uniform vec2 texel;varying vec2 vUv;
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
    gl_FragColor=vec4(mix(live,t,amount),1.0);
   }`,
  depthTest:false,depthWrite:false,
 });
 quad=new FullScreenQuad(this.material);
 dispose(){this.target.dispose();this.material.dispose();this.quad.dispose();}
}

/** Tone mapping with the finish of a photograph (look.ts): white balance on the scene's light before tone mapping, then
 * the S-curve and colour on display values, before the sRGB encoding. */
class FinishedOutput extends OutputPass{
 constructor(){
  super();
  Object.assign(this.uniforms,{uBalance:{value:new T.Vector3(1,1,1)},uLook:{value:new T.Vector2(1,1)}});
  const patch=(shader:string,anchor:string,code:string)=>{if(!shader.includes(anchor))throw new Error(`output shader has no ${anchor}`);return shader.replace(anchor,code);};
  let shader=this.material.fragmentShader;
  shader=patch(shader,'uniform sampler2D tDiffuse;','uniform sampler2D tDiffuse;uniform vec3 uBalance;uniform vec2 uLook;');
  shader=patch(shader,'gl_FragColor = texture2D( tDiffuse, vUv );','gl_FragColor = texture2D( tDiffuse, vUv );gl_FragColor.rgb*=uBalance;');
  shader=patch(shader,'#ifdef SRGB_TRANSFER',`{vec3 e=pow(clamp(gl_FragColor.rgb,0.0,1.0),vec3(1.0/2.2)),p=pow(e,vec3(uLook.x)),q=pow(1.0-e,vec3(uLook.x));
   vec3 c=pow(p/max(p+q,vec3(1e-5)),vec3(2.2));float l=dot(c,vec3(0.2126,0.7152,0.0722));gl_FragColor.rgb=max(vec3(0.0),l+uLook.y*(c-l));}
  #ifdef SRGB_TRANSFER`);
  this.material.fragmentShader=shader;
 }
 set(indoor:number){const f=finish(indoor);(this.uniforms.uBalance.value as T.Vector3).set(f.balance[0],f.balance[1],f.balance[2]);(this.uniforms.uLook.value as T.Vector2).set(f.contrast,f.saturation);return f;}
}

export type PostOptions={samples:number;ao:boolean;bloom:boolean};
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
 let bloom:QuarterResolutionBloom|undefined;
 // Faint and tight: a glow at the sun, glints and sunlit glass, never a veil over the room.
 if(options.bloom){bloom=new QuarterResolutionBloom(new T.Vector2(1,1),.06,.1,1);composer.addPass(bloom);}
 const accumulate=new AccumulatePass();composer.addPass(accumulate);
 const output=new FinishedOutput();composer.addPass(output);
 let traced:TracedBlend|undefined;
 return {
  composer,
  setSize:(width:number,height:number,ratio:number)=>{composer.setPixelRatio(ratio);composer.setSize(width,height);},
  /** Moving frames skip AO and accumulation; still frames refine towards a clean image. `indoor` (0–1) eases in the
   * interior finish (look.ts). */
  render:(refining:boolean,exposure:number,indoor=0)=>{
   const f=output.set(indoor);
   if(ao){ao.enabled=refining;ao.blendIntensity=f.occlusion;}
   accumulate.enabled=refining;if(!refining)accumulate.frames=0;
   // Bloom threshold in display terms: only highlights two and a half times brighter than white bloom.
   if(bloom)bloom.threshold=2.5/Math.max(exposure,1e-4);
   composer.render();
  },
  get accumulated(){return accumulate.frames;},
  /** Shows a path-traced image (linear, before exposure) over the settled live image, through the same finish. `amount`
   * 0–1 blends it in; `radius` (traced pixels) smooths its grain (TracedBlend). */
  present:(image:T.Texture,amount:number,radius:number,indoor=0)=>{
   output.set(indoor);
   traced??=new TracedBlend();
   const size=renderer.getDrawingBufferSize(new T.Vector2()),u=traced.material.uniforms,source=image.image as {width:number;height:number};
   if(traced.target.width!==size.x||traced.target.height!==size.y)traced.target.setSize(size.x,size.y);
   u.raster.value=accumulate.latest;u.traced.value=image;u.amount.value=amount;u.radius.value=radius;u.texel.value.set(1/source.width,1/source.height);
   renderer.setRenderTarget(traced.target);traced.quad.render(renderer);
   output.renderToScreen=true;output.render(renderer,null as unknown as T.WebGLRenderTarget,traced.target,0,false);
  },
  reset:()=>{accumulate.frames=0;},
  dispose:()=>{traced?.dispose();for(const p of composer.passes)(p as Pass&{dispose?:()=>void}).dispose?.();composer.dispose();target.dispose();},
 };
}
export type Post=ReturnType<typeof createPost>;
