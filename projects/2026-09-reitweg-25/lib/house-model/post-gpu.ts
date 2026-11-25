import * as T from 'three';
import {finish} from './look';
import {TEMPORAL} from './temporal';
import {LENS,meterCorrection,focalLength} from './lens';
import type {Post,PostOptions,PostView} from './post';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** What the image chain needs from `three/webgpu` and `three/tsl`. */
export type PostGPU={tsl:any;/** three's corner shading pass (GTAONode.js). */ao?:(depth:unknown,normal:null,camera:T.Camera)=>any;/** three's bloom (BloomNode.js). */bloom?:(input:unknown,strength:number,radius:number,threshold:number)=>any;NodeMaterial:new()=>T.Material;QuadMesh:new(material:T.Material)=>{render(renderer:unknown):void;material:T.Material}};
/** The image chain for the WebGPU renderer (post.ts is the WebGL renderer's). So far: the scene into a floating-point
 * target, corner shading on still frames, still frames averaged into a clean image, and the same finish to the screen: white balance, tone mapping,
 * the S-curve with its shadow lift, saturation, and the screen's transfer; moving frames blended into the kept image,
 * and the lens (meter, grain, sun shafts, focus). Not yet there: mist, the wet mirror, and showing a path-traced image;
 * those calls do nothing. */
export function createPostGPU(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,options:PostOptions,gpu:PostGPU):Post&{over(object:T.Object3D,camera:T.Camera):void}{
 const {positionGeometry,screenCoordinate,ivec2,texture,uniform,vec3,vec4,float,mix,max,min,pow,dot,clamp,agxToneMapping,sRGBTransferOETF}=gpu.tsl;
 // That renderer draws into plain render targets through the calls the WebGL renderer has for its own.
 const half=()=>new T.RenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}) as unknown as T.WebGLRenderTarget;
 const target=new T.RenderTarget(1,1,{type:T.HalfFloatType,samples:options.samples,depthTexture:new T.DepthTexture(1,1)}) as unknown as T.WebGLRenderTarget;
 let settled=[half(),half()],frames=0;
 const quadOf=(node:any)=>{const m=new gpu.NodeMaterial() as any;m.fragmentNode=node;m.depthTest=false;m.depthWrite=false;return new gpu.QuadMesh(m);};
 // A still frame joins the average of those before it.
 const current=texture(target.texture),history=texture(settled[0].texture),weight=uniform(1);
 // Faint and tight, as in the WebGL chain: a glow at the sun, glints and sunlit glass, never a veil over the room.
 const glow=options.bloom&&gpu.bloom?gpu.bloom(current,.06,.1,1):undefined;
 // Sunlight scattered by the air (the lens's sun shafts, below), at half size, added with four look-ups around the pixel.
 const air=options.lens?[half(),half()]:undefined,haze=air&&texture(air[0].texture),hazy=uniform(0),texel=uniform(new T.Vector2());
 const shafted=(frame:any)=>{
  if(!haze)return frame;
  const {uv,vec2}=gpu.tsl,at=uv(),tap=(x:number,y:number)=>haze.sample(at.add(texel.mul(vec2(x,y)))).rgb;
  return vec4(frame.rgb.add(tap(-.5,-.5).add(tap(.5,-.5)).add(tap(-.5,.5)).add(tap(.5,.5)).mul(hazy.mul(.25))),frame.a);
 };
 const lit=(frame:any)=>shafted(glow?vec4(frame.rgb.add(glow.rgb),frame.a):frame);
 const blend=quadOf(mix(history,lit(current),weight));
 // With four samples to a pixel the scene's depth cannot be read as one value, which corner shading and what falls over
 // the frame need: its first sample is copied to a plain depth buffer after the scene is drawn.
 const level=options.samples>=4?new T.RenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1)}) as unknown as T.WebGLRenderTarget:undefined,depthOf=(level??target).depthTexture!;
 const levelled=level&&quadOf(vec4(0));
 if(levelled)Object.assign(levelled.material,{depthNode:texture(target.depthTexture!).load(ivec2(screenCoordinate)).r,depthTest:true,depthWrite:true,depthFunc:T.AlwaysDepth});
 // Corner shading at the WebGL chain's settings (post.ts), from the scene's depth alone. Its grain is turned from frame
 // to frame, and the average of still frames smooths it.
 const shade=options.ao&&gpu.ao?gpu.ao(texture(depthOf),null,camera):undefined,occlusion=uniform(1);
 if(shade){shade.radius.value=.7;shade.distanceExponent.value=1.6;shade.thickness.value=1.4;shade.samples.value=12;shade.resolutionScale=.5;shade.useTemporalFiltering=true;}
 const shaded=shade&&quadOf(mix(history,lit(vec4(current.rgb.mul(mix(1,shade.getTextureNode().r,occlusion)),current.a)),weight));
 // The finish, as the WebGL chain's last pass does it (post.ts, FinishedOutput).
 // The kept image in motion (temporal.ts, Extreme): each pixel's point is looked up where the last frame saw it and the
 // new frame, drawn smaller and jittered, is blended in. The same steps as the WebGL pass; rows run top down here, and
 // the point comes from the depth buffer's own value.
 const kept=options.temporal&&camera instanceof T.PerspectiveCamera?(()=>{
  const {Fn,uv,vec2,floor,abs,exp,select}=gpu.tsl,eye=camera;
  const mixed=half(),lastDepth=half(),composed=quadOf(lit(shade?vec4(current.rgb.mul(mix(1,shade.getTextureNode().r,occlusion)),current.a):current));
  const frame=texture(mixed.texture),depth=texture(depthOf),last=texture(lastDepth.texture),share=uniform(1),carried=uniform(0);
  const drawn=uniform(new T.Vector2(1,1)),full=uniform(new T.Vector2(1,1)),jitter=uniform(new T.Vector2()),lens=uniform(new T.Vector4(1,1,0,1));
  const lastViewProj=uniform(new T.Matrix4()),lastView=uniform(new T.Matrix4()),camWorld=uniform(new T.Matrix4());
  // How far in front of the eye a depth value lies.
  const far=(d:any)=>lens.w.div(d.add(lens.z));
  const keptAt=(at:any)=>{
   const p=at.mul(full),c=floor(p.sub(.5)).add(.5),f=p.sub(c);
   const w0=f.mul(f.mul(f.mul(-.5).add(1)).sub(.5)),w1=f.mul(f).mul(f.mul(1.5).sub(2.5)).add(1),w2=f.mul(f).mul(f.mul(-1.5).add(2)).add(f.mul(.5)),w3=f.mul(f).mul(f.mul(.5).sub(.5)),w12=w1.add(w2);
   const t0=c.sub(1).div(full),t3=c.add(2).div(full),t12=c.add(w2.div(w12)).div(full);
   const tap=(x:any,y:any,wx:any,wy:any)=>history.sample(vec2(x.x,y.y)).rgb.mul(wx.x).mul(wy.y);
   return max(tap(t0,t0,w0,w0).add(tap(t12,t0,w12,w0)).add(tap(t3,t0,w3,w0)).add(tap(t0,t12,w0,w12)).add(tap(t12,t12,w12,w12)).add(tap(t3,t12,w3,w12)).add(tap(t0,t3,w0,w3)).add(tap(t12,t3,w12,w3)).add(tap(t3,t3,w3,w3)),vec3(0));
  };
  const moving=quadOf(Fn(()=>{
   const at0=uv(),q=at0.sub(jitter).toVar(),p=q.mul(drawn),centre=floor(p).add(.5),off=p.sub(centre),near=centre.div(drawn).toVar();
   const c=frame.sample(q).rgb.toVar(),distance=far(depth.sample(q).r).toVar();
   const ndc=vec2(at0.x.mul(2).sub(1),at0.y.mul(-2).add(1)),world=camWorld.mul(vec4(ndc.x.mul(distance).div(lens.x),ndc.y.mul(distance).div(lens.y),distance.negate(),1)).toVar();
   const clip=lastViewProj.mul(world).toVar(),at=vec2(clip.x.div(clip.w).mul(.5).add(.5),clip.y.div(clip.w).mul(-.5).add(.5)).toVar();
   const inside=clip.w.greaterThan(0).and(at.x.greaterThanEqual(0)).and(at.y.greaterThanEqual(0)).and(at.x.lessThanEqual(1)).and(at.y.lessThanEqual(1));
   const expected=lastView.mul(world).z.negate(),seen=inside.and(abs(last.sample(at).r.sub(expected)).lessThan(expected.mul(TEMPORAL.tolerance).add(.05)));
   // The new frame's colours around the pixel: a kept colour outside them belongs to something else.
   const mine=frame.sample(near).rgb.toVar(),lo=mine.toVar(),hi=mine.toVar();
   for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y){const n=frame.sample(near.add(vec2(x,y).div(drawn))).rgb;lo.assign(min(lo,n));hi.assign(max(hi,n));}
   const slack=hi.sub(lo).mul(TEMPORAL.slack).add(.002),held=clamp(keptAt(at),lo.sub(slack),hi.add(slack));
   return vec4(select(seen.and(carried.greaterThan(.5)),mix(held,mine,share.mul(exp(dot(off,off).mul(-TEMPORAL.falloff)))),c),1);
  })());
  const copy=quadOf(vec4(far(texture(depthOf).r),0,0,1));
  const lastWorld=new T.Matrix4(),lastLens=new T.Vector3(),size=new T.Vector2();let valid=false,fresh=true;
  return {mixed,lastDepth,
   reset(){fresh=true;},
   resize(w:number,h:number){mixed.setSize(w,h);lastDepth.setSize(w,h);const f=renderer.getDrawingBufferSize(size);if(settled[0].width!==f.x||settled[0].height!==f.y){for(const t of settled)t.setSize(f.x,f.y);valid=false;return true;}return false;},
   /** Whether the frame being drawn moved the view (or follows a change of light or scene). */
   moved:()=>!eye.matrixWorld.equals(lastWorld)||lastLens.x!==eye.fov||lastLens.y!==eye.zoom||lastLens.z!==eye.aspect,
   /** A view come to rest counts its moving image as `carry` frames. */
   rested:()=>valid&&!fresh,
   /** Blends the scene just drawn into the kept image. */
   blend(next:T.WebGLRenderTarget,moved:boolean){
    const e=eye.projectionMatrix.elements,is=carried.value=valid&&(moved||!fresh)?1:0;share.value=is?TEMPORAL.blend:1;
    lens.value.set(e[0],e[5],e[10],e[14]);jitter.value.set(e[8]/2,-e[9]/2);camWorld.value.copy(eye.matrixWorld);
    drawn.value.set(mixed.width,mixed.height);full.value.set(next.width,next.height);
    renderer.setRenderTarget(mixed);composed.render(renderer);renderer.setRenderTarget(next);moving.render(renderer);
   },
   /** Keeps this frame's depth and view for the next frame's look-up. */
   remember(){
    const e=eye.projectionMatrix.elements;lens.value.set(e[0],e[5],e[10],e[14]);
    renderer.setRenderTarget(lastDepth);copy.render(renderer);
    lastView.value.copy(eye.matrixWorldInverse);lastViewProj.value.copy(eye.projectionMatrix);const l=lastViewProj.value.elements;l[8]=0;l[9]=0;lastViewProj.value.multiply(eye.matrixWorldInverse);
    lastWorld.copy(eye.matrixWorld);lastLens.set(eye.fov,eye.zoom,eye.aspect);valid=true;fresh=false;
   },
   dispose(){mixed.dispose();lastDepth.dispose();composed.material.dispose();moving.material.dispose();copy.material.dispose();},
  };
 })():undefined;
 const shown=texture(settled[0].texture),balance=uniform(new T.Vector3(1,1,1)),look=uniform(new T.Vector3(1,1,0)),exposure=uniform(1);
 const luma=vec3(.2126,.7152,.0722);
 const mapped=agxToneMapping(shown.rgb.mul(balance),exposure);
 const e0=pow(clamp(mapped,0,1),vec3(1/2.2)),m=dot(e0,luma),f=float(1).sub(m),e=min(e0.mul(look.z.mul(f.mul(f).mul(f).mul(f)).add(1)),vec3(1));
 const p=pow(e,vec3(look.x)),q=pow(vec3(1).sub(e),vec3(look.x)),c=pow(p.div(max(p.add(q),vec3(1e-5))),vec3(2.2)),l=dot(c,luma);
 const graded=max(vec3(0),vec3(l).add(c.sub(l).mul(look.y)));
 // The lens's grain on the finished image (lens.ts), new each frame: two hashes summed, triangular noise in -1..1.
 const seed=uniform(0),grained=options.lens?(()=>{
  const {fract}=gpu.tsl,at=screenCoordinate.xy,hash=(v:any)=>{const f=fract(v.mul(.1031)),h=f.add(dot(f,f.yzx.add(33.33)));return fract(h.x.add(h.y).mul(h.z));};
  const n=hash(vec3(at.x,at.y,at.x).add(seed.mul(vec3(17,59,23)))).add(hash(vec3(at.y,at.x,at.y).mul(1.37).add(seed.mul(vec3(91,7,41))))).sub(1);
  const e=pow(graded,vec3(1/2.2)),m=clamp(dot(e,luma),0,1);
  return pow(max(e.add(n.mul(LENS.grain).mul(m.mul(float(1).sub(m)).mul(2.8).add(.3))),vec3(0)),vec3(2.2));
 })():graded;
 const output=quadOf(vec4(sRGBTransferOETF(grained),1));
 // The lens's sun shafts (lens.ts, SunShafts): the air between the eye and each surface, marched through the sun's
 // shadow map, jittered per frame and averaged while the view rests. The map is read as plain depths and compared here.
 const shafts=air&&haze&&options.lens&&camera instanceof T.PerspectiveCamera?(()=>{
  const {Fn,uv,vec2,ivec2,normalize,smoothstep,fract,select}=gpu.tsl,eye=camera,sun=options.lens.sun,{forward:g,reach,steps,room,outdoors,indoors}=LENS.air;
  const lens=uniform(new T.Vector4(1,1,0,1)),camWorld=uniform(new T.Matrix4()),shadowMatrix=uniform(new T.Matrix4()),mapSize=uniform(new T.Vector2(1,1));
  const sunDirection=uniform(new T.Vector3()),sunLight=uniform(new T.Vector3()),indoor=uniform(0),turn=uniform(0),share=uniform(1),before=texture(air[1].texture);
  let quad:ReturnType<typeof quadOf>|undefined,map:any,held:T.Texture|undefined,count=0;
  const make=(depths:T.Texture)=>quadOf(Fn(()=>{
   const at=uv(),view=normalize(vec3(at.x.mul(2).sub(1).div(lens.x),at.y.mul(-2).add(1).div(lens.y),-1)).toVar();
   const along=lens.w.div(texture(depthOf).sample(at).r.add(lens.z)),reached=min(along.div(max(view.z.negate(),1e-3)),reach);
   const origin=camWorld.mul(vec4(0,0,0,1)).xyz.toVar(),dir=normalize(camWorld.mul(vec4(view,0)).xyz).toVar();
   const c=dot(dir,sunDirection),phase=float(1-g*g).div(pow(float(1+g*g).sub(c.mul(2*g)),1.5).mul(12.566371));
   const pace=reached.div(steps).toVar(),offset=fract(fract(dot(screenCoordinate.xy,vec2(.06711056,.00583715))).mul(52.9829189).add(turn.mul(.618034))).toVar();
   map=texture(depths);let scattered:any=float(0);
   for(let i=0;i<steps;i++){
    const t=pace.mul(offset.add(i)),s=shadowMatrix.mul(vec4(origin.add(dir.mul(t)),1)),q=s.xyz.div(s.w);
    const outside=q.x.lessThan(0).or(q.y.lessThan(0)).or(q.z.lessThan(0)).or(q.x.greaterThan(1)).or(q.y.greaterThan(1)).or(q.z.greaterThan(1));
    const seen=map.load(ivec2(vec2(q.x,q.y.oneMinus()).clamp(0,.9999).mul(mapSize))).r.greaterThanEqual(q.z.sub(.0005));
    // A room's dusty air for its first metres, then the clear air beyond the glass.
    scattered=scattered.add(select(outside.or(seen),1,0).mul(mix(outdoors,indoors,indoor.mul(float(1).sub(smoothstep(room-1,room+1,t))))));
   }
   return vec4(mix(before.sample(at).rgb,sunLight.mul(phase).mul(scattered).mul(pace),share),1);
  })());
  return {
   reset(){count=0;},
   setSize(w:number,h:number){for(const t of air)t.setSize(Math.max(1,Math.round(w/2)),Math.max(1,Math.round(h/2)));count=0;texel.value.set(1/Math.max(1,w),1/Math.max(1,h));},
   /** Marches this frame's air; night has nothing to scatter. */
   render(inside:number){
    const depths=sun.shadow.map?.depthTexture as T.Texture|undefined;
    if(!(sun.intensity>0)||!depths){count=0;hazy.value=0;return;}
    if(!quad||held!==depths){quad?.material.dispose();quad=make(depths);held=depths;}
    const e=eye.projectionMatrix.elements,image=depths.image as {width:number;height:number};lens.value.set(e[0],e[5],e[10],e[14]);camWorld.value.copy(eye.matrixWorld);
    shadowMatrix.value.copy(sun.shadow.matrix);mapSize.value.set(image.width,image.height);
    sunDirection.value.subVectors(sun.position,sun.target.position).normalize();sunLight.value.set(sun.color.r,sun.color.g,sun.color.b).multiplyScalar(sun.intensity);
    indoor.value=inside;const [was,next]=[air[0],air[1]];before.value=was.texture;share.value=1/(count+1);turn.value=count;
    renderer.setRenderTarget(next);quad.render(renderer);air[0]=next;air[1]=was;count++;haze.value=next.texture;hazy.value=1;
   },
   dispose(){for(const t of air)t.dispose();quad?.material.dispose();},
  };
 })():undefined;
 // The lens's meter (lens.ts): a 32 x 32 summary of the frame's log luminance, weighted to the centre, and of how far
 // off the middle of the frame is, read back without stalling the graphics card; exposure eases toward its reading.
 const meter=options.lens&&camera instanceof T.PerspectiveCamera?(()=>{
  const {uv,vec2,log2,exp}=gpu.tsl,eye=camera,small=new T.RenderTarget(32,32,{type:T.FloatType,depthBuffer:false}) as unknown as T.WebGLRenderTarget;
  const aspect=uniform(1),range=uniform(new T.Vector2(0,1)),at=uv(),p=at.sub(.5).mul(vec2(aspect,1));
  let sum:any=vec3(0);for(let y=0;y<2;y++)for(let x=0;x<2;x++)sum=sum.add(current.sample(at.add(vec2(x-.5,y-.5).div(64))).rgb);
  const quad=quadOf(vec4(log2(max(dot(sum.mul(.25),luma),1e-6)),range.y.div(texture(depthOf).sample(at).r.add(range.x)),exp(dot(p,p).div(-.08)),1));
  let pending=false,logAverage=NaN,scale=1,last=0;
  return {
   /** Distance (metres) to what is in the middle of the frame; NaN until measured. */
   focus:NaN,
   read(){
    if(pending)return;
    const e=eye.projectionMatrix.elements;range.value.set(e[10],e[14]);aspect.value=eye.aspect;
    renderer.setRenderTarget(small);quad.render(renderer);pending=true;
    ((renderer as any).readRenderTargetPixelsAsync(small,0,0,32,32) as Promise<Float32Array>).then(data=>{
     let total=0,weights=0;const centre:number[]=[];
     for(let i=0;i<32*32;i++){const w=data[i*4+2];total+=data[i*4]*w;weights+=w;}
     for(let y=14;y<18;y++)for(let x=14;x<18;x++)centre.push(data[(y*32+x)*4+1]);
     centre.sort((a,b)=>a-b);logAverage=total/Math.max(weights,1e-6);this.focus=(centre[7]+centre[8])/2;
    }).catch(()=>{}).finally(()=>{pending=false;});
   },
   /** The factor on `exposure`, eased toward what the meter asks for. */
   adapt(exposure:number){
    const now=performance.now(),dt=Math.min(.1,(now-(last||now))/1000);last=now;
    if(Number.isFinite(logAverage))scale*=Math.pow(meterCorrection(logAverage,exposure)/scale,Math.min(1,dt/LENS.meter.seconds));
    return scale;
   },
   dispose(){small.dispose();quad.material.dispose();},
  };
 })():undefined;
 // The lens's focus (lens.ts, DepthOfField): at eye level the kept image is blurred by how far each point is from what
 // the meter found in the middle of the frame, over a spiral of look-ups; a sharp edge does not spill over what is nearer.
 const focus=meter&&camera instanceof T.PerspectiveCamera?(()=>{
  const {Fn,uv,vec2,abs,smoothstep,select}=gpu.tsl,eye=camera,sharp=half(),from=texture(settled[0].texture);
  const range=uniform(new T.Vector2(0,1)),reach=uniform(5),scale=uniform(0),texel=uniform(new T.Vector2());
  const far=(p:any)=>range.y.div(texture(depthOf).sample(p).r.add(range.x)),size=(d:any)=>min(LENS.maxBlur,scale.mul(abs(d.sub(reach))).div(max(d,1e-3)));
  const quad=quadOf(Fn(()=>{
   const p=uv(),centre=far(p).toVar(),centreSize=size(centre).toVar(),sum=from.sample(p).rgb.toVar();let total=1;
   for(let i=0,radius=.6;i<160&&radius<LENS.maxBlur;i++,radius+=.6/radius){
    const a=i*2.39996323,q=p.add(texel.mul(vec2(Math.cos(a)*radius,Math.sin(a)*radius))),d=far(q).toVar(),s=size(d);
    sum.addAssign(mix(sum.div(total),from.sample(q).rgb,smoothstep(radius-.5,radius+.5,select(d.greaterThan(centre),min(s,centreSize.mul(2)),s))));total++;
   }
   return vec4(sum.div(total),1);
  })());
  let distance=NaN,last=0;
  return {
   /** `image` as the lens sees it, focus eased toward the middle of the frame. */
   render(image:T.WebGLRenderTarget){
    const now=performance.now(),dt=Math.min(.1,(now-(last||now))/1000);last=now;
    if(Number.isFinite(meter.focus))distance=Number.isFinite(distance)?distance+(meter.focus-distance)*Math.min(1,dt/.2):meter.focus;
    const f=focalLength(eye.fov),d=Number.isFinite(distance)?Math.max(distance,.3):5,e=eye.projectionMatrix.elements;
    if(sharp.width!==image.width||sharp.height!==image.height)sharp.setSize(image.width,image.height);
    range.value.set(e[10],e[14]);reach.value=d;scale.value=f*f/(LENS.fNumber*Math.max(d-f,1e-3))/LENS.sensor*image.height;texel.value.set(1/image.width,1/image.height);
    from.value=image.texture;renderer.setRenderTarget(sharp);quad.render(renderer);return sharp;
   },
   dispose(){sharp.dispose();quad.material.dispose();},
  };
 })():undefined;
 let showing=settled[0];
 const lamps=options.lamps??(()=>0);
 // The finish fills the screen whatever camera it is drawn with, so that what falls over the frame can be drawn in the
 // same pass (`over`): a second pass to the canvas does not keep what the first left there.
 (output.material as any).vertexNode=vec4(positionGeometry.xy,0,1);
 const finished=output as unknown as T.Mesh,stage=new T.Scene();finished.frustumCulled=false;finished.renderOrder=-1;stage.add(finished);
 const draw=(through:T.Camera)=>{
  // The finish tone-maps and encodes itself, so the renderer is asked for neither while it is drawn.
  const mapping=renderer.toneMapping,space=renderer.outputColorSpace;
  renderer.toneMapping=T.NoToneMapping;renderer.outputColorSpace=T.LinearSRGBColorSpace;
  shown.value=showing.texture;renderer.setRenderTarget(null);renderer.render(stage,through);
  renderer.toneMapping=mapping;renderer.outputColorSpace=space;
 };
 const toScreen=()=>{for(const o of stage.children.slice())if(o!==finished)stage.remove(o);draw(camera);};
 const api={
  passes:[],
  setSize:(width:number,height:number,ratio:number)=>{
   const w=Math.max(1,Math.floor(width*ratio)),h=Math.max(1,Math.floor(height*ratio));target.setSize(w,h);level?.setSize(w,h);
   // The kept image stays at full size whatever size the moving frames are drawn at.
   if(kept){if(kept.resize(w,h))frames=0;}else{for(const t of settled)t.setSize(w,h);frames=0;}
   shafts?.setSize(w,h);
  },
  compileAsync:(object:T.Object3D)=>{
   const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);
   // three makes ready only what the camera sees, and the rest held the first turn of the view for half a second:
   // everything counts as seen for the moment the list is drawn up.
   const culled:T.Object3D[]=[];object.traverse(o=>{if(o.frustumCulled){culled.push(o);o.frustumCulled=false;}});
   const done=renderer.compileAsync(object,camera,scene);renderer.setRenderTarget(previous);for(const o of culled)o.frustumCulled=true;return done;
  },
  compilePasses:()=>Promise.resolve(),
  warm:()=>{},
  render:(refining:boolean,exposed:number,indoor=0,view?:PostView)=>{
   const g=finish(indoor,lamps());balance.value.set(g.balance[0],g.balance[1],g.balance[2]);look.value.set(g.contrast,g.saturation,g.lift);exposure.value=exposed*(meter?.adapt(exposed)??1);seed.value=(seed.value+1)%64;occlusion.value=g.occlusion;
   // Only highlights two and a half times brighter than white bloom.
   if(glow)glow.threshold.value=2.5/Math.max(exposed,1e-4);
   const moved=kept?.moved()??false,rest=refining&&!moved;
   if(!rest)frames=0;else if(kept&&frames===0&&kept.rested())frames=TEMPORAL.carry;
   renderer.setRenderTarget(target);renderer.render(scene,camera);
   if(level&&levelled){renderer.setRenderTarget(level);levelled.render(renderer);}
   meter?.read();
   if(!rest)shafts?.reset();shafts?.render(indoor);
   const [was,next]=settled;current.value=target.texture;history.value=was.texture;weight.value=1/(frames+1);
   if(kept&&!rest)kept.blend(next,moved);
   else{renderer.setRenderTarget(next);(refining&&shaded?shaded:blend).render(renderer);}
   settled=[next,was];if(rest||!kept)frames++;
   kept?.remember();
   showing=view?.eyeLevel&&focus?focus.render(settled[0]):settled[0];
   toScreen();
  },
  get lightCarried(){return 0;},
  get accumulated(){return frames;},
  /** Moving frames are jittered too, and blended into the kept image. */
  temporal:!!kept,
  replay:toScreen,
  /** Draws `object` over the frame on the canvas, with whatever else was drawn over it since it was last shown. */
  over:(object:T.Object3D,through:T.Camera)=>{stage.add(object);draw(through);},
  setMist:()=>{},keepDepth:()=>{},
  /** The scene's own depth buffer as last drawn, which what falls over the frame reads as it is (falling.ts). */
  get depth(){return depthOf;},
  present:()=>{},keep:()=>{},carries:()=>false,carry:()=>{},
  reset:()=>{frames=0;kept?.reset();shafts?.reset();},
  dispose:()=>{kept?.dispose();meter?.dispose();focus?.dispose();shafts?.dispose();target.dispose();level?.dispose();levelled?.material.dispose();for(const t of settled)t.dispose();blend.material.dispose();shaded?.material.dispose();shade?.dispose();glow?.dispose();output.material.dispose();},
 };
 return api as unknown as Post&{over:typeof api.over};
}
