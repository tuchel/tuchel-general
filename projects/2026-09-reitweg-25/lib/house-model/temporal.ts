import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** One image kept across frames, at rest and in motion (Extreme). At rest it is the average of the sub-pixel-jittered
 * frames, as before. In motion each new frame is blended into it instead of replacing it: every pixel's point, from the
 * frame's depth, is looked up where the last frame saw it, so what the view had gathered (clean edges, corner shading,
 * full resolution) travels with the camera, and each moving frame, drawn smaller and jittered, adds `blend` of itself.
 * Nothing in the scene moves but the camera, so the look-up is exact; where the last frame's depth disagrees (a point
 * the move uncovered, a walking figure) the kept colour is held to what the new frame shows around that pixel.
 * `blend`: the share a moving frame adds where its pixel's centre lies, falling by `falloff` with the squared distance
 * from it (in its pixels); `carry`: the frames a view that comes to rest counts its moving image as, so the first still frame refines it rather
 * than replacing it; `tolerance`: how far (a share of the distance, plus 5 cm) the kept depth may differ; `slack`: how
 * far past the new frame's neighbouring colours a kept colour may stand, as a share of their range. */
export const TEMPORAL={blend:.14,falloff:3,carry:2,tolerance:.03,slack:.5};

const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
export class TemporalPass extends Pass{
 private targets:[T.WebGLRenderTarget,T.WebGLRenderTarget];
 private lastDepth=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 private material:T.ShaderMaterial;private copying:T.ShaderMaterial;private quad:FullScreenQuad;private copy:FullScreenQuad;
 private clean=new T.PerspectiveCamera();private lastWorld=new T.Matrix4();private lastLens=new T.Vector3();
 private size=new T.Vector2();private valid=false;private fresh=true;
 /** Frames averaged into the image since the view came to rest; 0 while it moves. */
 frames=0;
 /** The frame being drawn refines a resting view (set before the chain runs). */
 refining=false;
 constructor(private camera:T.PerspectiveCamera,private depth:T.Texture){
  super();this.needsSwap=false;
  const make=()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
  this.targets=[make(),make()];
  this.material=new T.ShaderMaterial({
   uniforms:{current:{value:null},history:{value:null},depth:{value:depth},lastDepth:{value:this.lastDepth.texture},weight:{value:1},reproject:{value:0},drawn:{value:new T.Vector2()},full:{value:new T.Vector2()},jitter:{value:new T.Vector2()},
    lastViewProj:{value:new T.Matrix4()},lastView:{value:new T.Matrix4()},invProj:{value:new T.Matrix4()},camWorld:{value:new T.Matrix4()}},
   vertexShader:vertex,
   fragmentShader:`uniform sampler2D current;uniform sampler2D history;uniform sampler2D depth;uniform sampler2D lastDepth;uniform float weight;uniform float reproject;uniform vec2 drawn;uniform vec2 full;uniform vec2 jitter;
    uniform mat4 lastViewProj;uniform mat4 lastView;uniform mat4 invProj;uniform mat4 camWorld;varying vec2 vUv;
    // The kept image between its pixels, by a Catmull-Rom curve through sixteen of them (nine look-ups): a straight
    // blend of the nearest four, repeated every frame of a move, would soften it.
    vec3 keptAt(vec2 uv){
     vec2 p=uv*full,c=floor(p-0.5)+0.5,f=p-c;
     vec2 w0=f*(-0.5+f*(1.0-0.5*f)),w1=1.0+f*f*(-2.5+1.5*f),w2=f*f*(2.0-1.5*f)+0.5*f,w3=f*f*(-0.5+0.5*f),w12=w1+w2;
     vec2 t0=(c-1.0)/full,t3=(c+2.0)/full,t12=(c+w2/w12)/full;
     vec3 sum=texture2D(history,vec2(t0.x,t0.y)).rgb*w0.x*w0.y+texture2D(history,vec2(t12.x,t0.y)).rgb*w12.x*w0.y+texture2D(history,vec2(t3.x,t0.y)).rgb*w3.x*w0.y
      +texture2D(history,vec2(t0.x,t12.y)).rgb*w0.x*w12.y+texture2D(history,vec2(t12.x,t12.y)).rgb*w12.x*w12.y+texture2D(history,vec2(t3.x,t12.y)).rgb*w3.x*w12.y
      +texture2D(history,vec2(t0.x,t3.y)).rgb*w0.x*w3.y+texture2D(history,vec2(t12.x,t3.y)).rgb*w12.x*w3.y+texture2D(history,vec2(t3.x,t3.y)).rgb*w3.x*w3.y;
     return max(sum,0.0);
    }
    void main(){
     if(reproject<0.5){gl_FragColor=vec4(mix(texture2D(history,vUv).rgb,texture2D(current,vUv).rgb,weight),1.0);return;}
     // Where this pixel's point is in the new frame, which was drawn shifted by its jitter; and the drawn pixel nearest it.
     vec2 q=vUv-jitter,p=q*drawn,centre=floor(p)+0.5,off=p-centre,near=centre/drawn;
     vec3 c=texture2D(current,q).rgb;
     vec4 ray=invProj*vec4(vUv*2.0-1.0,1.0,1.0);ray.xyz/=ray.w;
     vec4 world=camWorld*vec4(ray.xyz*(texture2D(depth,q).r/-ray.z),1.0),clip=lastViewProj*world;
     vec2 at=clip.xy/clip.w*0.5+0.5;
     if(clip.w<=0.0||any(lessThan(at,vec2(0.0)))||any(greaterThan(at,vec2(1.0)))){gl_FragColor=vec4(c,1.0);return;}
     float expected=-(lastView*world).z,seen=abs(texture2D(lastDepth,at).r-expected)<${TEMPORAL.tolerance}*expected+0.05?1.0:0.0;
     // The new frame's colours around the pixel: a kept colour outside them belongs to something else.
     vec3 mine=texture2D(current,near).rgb,lo=mine,hi=mine;
     for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){if(x==0&&y==0)continue;vec3 n=texture2D(current,near+vec2(float(x),float(y))/drawn).rgb;lo=min(lo,n);hi=max(hi,n);}
     vec3 slack=(hi-lo)*${TEMPORAL.slack.toFixed(2)}*seen+0.002*seen;
     vec3 kept=clamp(keptAt(at),lo-slack,hi+slack);
     // A frame drawn smaller says most about the full-size pixels its own pixels' centres fall on: there it counts
     // in full, between them less, which is how jittered small frames add up to a full-size image.
     gl_FragColor=vec4(seen>0.5?mix(kept,mine,weight*exp(-${TEMPORAL.falloff.toFixed(1)}*dot(off,off))):mix(kept,c,weight),1.0);
    }`,depthTest:false,depthWrite:false});
  this.copying=new T.ShaderMaterial({uniforms:{source:{value:null as T.Texture|null}},vertexShader:vertex,fragmentShader:'uniform sampler2D source;varying vec2 vUv;void main(){gl_FragColor=texture2D(source,vUv);}',depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);this.copy=new FullScreenQuad(this.copying);
 }
 /** Something other than the camera changed (the light, the scene): what was gathered at rest no longer holds. */
 reset(){this.frames=0;this.fresh=true;}
 render(renderer:T.WebGLRenderer,_write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const camera=this.camera,u=this.material.uniforms,full=renderer.getDrawingBufferSize(this.size);
  if(this.targets[0].width!==full.x||this.targets[0].height!==full.y){for(const t of this.targets)t.setSize(full.x,full.y);this.valid=false;}
  // The view without its sub-pixel jitter: the kept image and the look-up live there.
  const clean=this.clean;clean.fov=camera.fov;clean.aspect=camera.aspect;clean.near=camera.near;clean.far=camera.far;clean.zoom=camera.zoom;clean.updateProjectionMatrix();
  const lens=clean.projectionMatrix,moved=!camera.matrixWorld.equals(this.lastWorld)||this.lastLens.x!==camera.fov||this.lastLens.y!==camera.zoom||this.lastLens.z!==camera.aspect;
  const [history,next]=this.targets;
  if(this.refining&&!moved){
   // A view that has just come to rest refines its moving image; a changed light or scene starts afresh.
   if(this.frames===0&&this.valid&&!this.fresh)this.frames=TEMPORAL.carry;
   u.reproject.value=0;u.weight.value=1/(this.frames+1);
   this.frames++;
  }else{
   // Only the camera's own move carries the image along: a new light or scene under a still camera shows at once.
   const carried=this.valid&&moved;
   this.frames=0;u.reproject.value=carried?1:0;u.weight.value=carried?TEMPORAL.blend:1;
   (u.invProj.value as T.Matrix4).copy(lens).invert();(u.camWorld.value as T.Matrix4).copy(camera.matrixWorld);
  }
  u.current.value=read.texture;u.history.value=history.texture;(u.drawn.value as T.Vector2).set(read.width,read.height);(u.full.value as T.Vector2).set(full.x,full.y);
  // A point at x in the clean view is drawn at x minus the difference in the lens's shift.
  (u.jitter.value as T.Vector2).set((camera.projectionMatrix.elements[8]-lens.elements[8])/2,(camera.projectionMatrix.elements[9]-lens.elements[9])/2);
  const previous=renderer.getRenderTarget();
  renderer.setRenderTarget(next);this.quad.render(renderer);
  this.targets=[next,history];this.valid=true;this.fresh=false;
  // This frame's depth and view, for the next frame's look-up.
  const d=this.depth.image as {width:number;height:number};
  if(this.lastDepth.width!==d.width||this.lastDepth.height!==d.height)this.lastDepth.setSize(d.width,d.height);
  this.copying.uniforms.source.value=this.depth;renderer.setRenderTarget(this.lastDepth);this.copy.render(renderer);
  renderer.setRenderTarget(previous);
  (u.lastView.value as T.Matrix4).copy(camera.matrixWorldInverse);(u.lastViewProj.value as T.Matrix4).multiplyMatrices(lens,camera.matrixWorldInverse);
  this.lastWorld.copy(camera.matrixWorld);this.lastLens.set(camera.fov,camera.zoom,camera.aspect);
 }
 /** The kept image, before the finish. */
 get latest(){return this.targets[0].texture;}
 get settled(){return this.targets[0];}
 dispose(){for(const t of this.targets)t.dispose();this.lastDepth.dispose();this.material.dispose();this.copying.dispose();this.quad.dispose();this.copy.dispose();}
}
