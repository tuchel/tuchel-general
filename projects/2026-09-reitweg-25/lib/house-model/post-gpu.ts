import * as T from 'three';
import {finish} from './look';
import {TEMPORAL} from './temporal';
import {MOTION_BLUR} from './motion-blur';
import {LENS,meterCorrection,focalLength} from './lens';
import {CONTACT} from './contact-shadows';
import {MIST,AIR_GLOW} from './mist';
import {WET_MIRROR} from './wet-reflections';
import {wet} from './surface-materials';
import {renderAlbedo,SHARP} from './albedo-pass';
import {CARRY,LIGHT_CARRY,carryApplies,lightCarried} from './carry';
import {MOVING} from './move-trace';
import {HDR} from './hdr';
import type {Post,PostOptions,PostView} from './post';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** What the image chain needs from `three/webgpu` and `three/tsl`. */
export type PostGPU={tsl:any;/** three's corner shading pass (GTAONode.js). */ao?:(depth:unknown,normal:null,camera:T.Camera)=>any;/** three's bloom (BloomNode.js). */bloom?:(input:unknown,strength:number,radius:number,threshold:number)=>any;NodeMaterial:new()=>T.Material;QuadMesh:new(material:T.Material)=>{render(renderer:unknown):void;material:T.Material}};
/** The image chain for the WebGPU renderer (post.ts is the WebGL renderer's). So far: the scene into a floating-point
 * target, corner shading on still frames, still frames averaged into a clean image, and the same finish to the screen: white balance, tone mapping,
 * the S-curve with its shadow lift, saturation, and the screen's transfer; moving frames blended into the kept image,
 * with the shutter's smear, and the lens (meter, grain, sun shafts, focus), mist, contact shadows and the wet mirror; a
 * path-traced image over a resting view, and its light kept for the frames that follow. */
export function createPostGPU(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,options:PostOptions,gpu:PostGPU):Post&{over(object:T.Object3D,camera:T.Camera):void;traceFrom(width:number,height:number):void;traceDone(image:T.Texture):void}{
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
 // With four samples to a pixel the scene's depth cannot be read as one value, which corner shading and what falls over
 // the frame need: its first sample is copied to a plain depth buffer after the scene is drawn.
 const level=options.samples>=4?new T.RenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1)}) as unknown as T.WebGLRenderTarget:undefined,depthOf=(level??target).depthTexture!;
 const levelled=level&&quadOf(vec4(0));
 if(levelled)Object.assign(levelled.material,{depthNode:texture(target.depthTexture!).load(ivec2(screenCoordinate)).r,depthTest:true,depthWrite:true,depthFunc:T.AlwaysDepth});
 // Where each pixel's point lies, from the scene's depth: `optics` holds the projection's terms; rows run top down.
 const optics=uniform(new T.Vector4(1,1,0,1)),placed=uniform(new T.Matrix4()),farthest=uniform(1000),tick=uniform(0),depths=texture(depthOf);
 const distanceAt=(at:any)=>optics.w.div(depths.sample(at).r.add(optics.z));
 const viewAt=(at:any,d:any)=>vec3(at.x.mul(2).sub(1).mul(d).div(optics.x),at.y.mul(-2).add(1).mul(d).div(optics.y),d.negate());
 // Short shadows where things touch (contact-shadows.ts): each pixel that faces the sun looks a short way toward it
 // through the frame's own depth. Every step is taken, the first hit kept: a look-up may not sit inside a branch here.
 const touch=options.contact&&options.lens&&camera instanceof T.PerspectiveCamera?{sun:options.lens.sun,amount:uniform(0),toLight:uniform(new T.Vector3())}:undefined;
 const touched=(frame:any)=>{
  if(!touch)return frame;
  const {Fn,uv,vec2,normalize,cross,dFdx,dFdy,smoothstep,fract,select}=gpu.tsl;
  return Fn(()=>{
   const at=uv(),d=distanceAt(at).toVar(),p=viewAt(at,d).toVar(),n=normalize(cross(dFdx(p),dFdy(p))).toVar(),facing=dot(n,touch.toLight).toVar();
   const bias=max(.015,d.mul(.004)).toVar(),jitter=fract(fract(dot(screenCoordinate.xy,vec2(.06711056,.00583715))).mul(52.9829189).add(tick.mul(.618034))).toVar();
   const from=p.add(n.mul(bias)).toVar(),shade=float(0).toVar(),open=float(1).toVar();
   for(let i=0;i<CONTACT.steps;i++){
    const t=jitter.add(i).mul(CONTACT.reach/CONTACT.steps).toVar(),q=from.add(touch.toLight.mul(bias.add(t))).toVar(),away=max(q.z.negate(),.05);
    const to=vec2(q.x.mul(optics.x).div(away).mul(.5).add(.5),q.y.mul(optics.y).div(away).mul(-.5).add(.5)).toVar();
    open.mulAssign(select(q.z.lessThan(-.05).and(to.x.greaterThanEqual(0)).and(to.y.greaterThanEqual(0)).and(to.x.lessThanEqual(1)).and(to.y.lessThanEqual(1)),1,0));
    const gap=q.z.negate().sub(distanceAt(to)).toVar(),hit=select(open.greaterThan(.5).and(gap.greaterThan(bias)).and(gap.lessThan(CONTACT.thick)),1,0).toVar();
    shade.assign(mix(shade,float(1).sub(t.mul(.6/CONTACT.reach)),hit));open.mulAssign(float(1).sub(hit));
   }
   const on=select(d.lessThan(CONTACT.far).and(d.lessThan(farthest.mul(.999))).and(facing.greaterThan(.04)),1,0);
   return vec4(frame.rgb.mul(float(1).sub(shade.mul(touch.amount).mul(on).mul(smoothstep(.04,.25,facing)).mul(float(1).sub(smoothstep(CONTACT.far*.6,CONTACT.far,d))))),frame.a);
  })();
 };
 // Ground mist (mist.ts, mistOver) and the lamps' glow in thick air (lampGlow), from each pixel's point.
 const mist=options.mist&&camera instanceof T.PerspectiveCamera?uniform(new T.Vector4()):undefined,glowing=uniform(new T.Vector3());
 const lampsAt=mist&&options.glowLamps?.length?options.glowLamps.slice(0,AIR_GLOW.most):[],glowColour=new T.Vector3().setFromColor(new T.Color(AIR_GLOW.colour));
 const misted=(frame:any)=>{
  if(!mist)return frame;
  const {Fn,If,uv,vec2,normalize,length,floor,fract,exp,abs,sqrt,atan,smoothstep,select,uniformArray}=gpu.tsl;
  const hash=(c:any)=>{const p=fract(vec3(c.x,c.y,c.x).mul(.1031)),r=p.add(dot(p,vec3(p.y,p.z,p.x).add(33.33)));return fract(r.x.add(r.y).mul(r.z));};
  const pools=(g:any)=>{const i=floor(g),f0=g.sub(i),f=f0.mul(f0).mul(f0.mul(-2).add(3));return mix(mix(hash(i),hash(i.add(vec2(1,0))),f.x),mix(hash(i.add(vec2(0,1))),hash(i.add(vec2(1,1))),f.x),f.y);};
  const lamps=lampsAt.length?uniformArray(lampsAt,'vec3'):undefined;
  return Fn(()=>{
   const at=uv(),d=distanceAt(at).toVar(),colour=frame.rgb.toVar();
   If(mist.a.greaterThan(0).or(glowing.x.greaterThan(0)),()=>{
    const ray=viewAt(at,float(1)).toVar(),eye=placed.mul(vec4(0,0,0,1)).xyz.toVar(),dir=normalize(placed.mul(vec4(ray,0)).xyz).toVar();
    // The sky stands for the land far off: mist lies along the horizon.
    const far=select(d.greaterThanEqual(farthest.mul(.999)),600,d.mul(length(ray))).toVar(),point=eye.add(dir.mul(far)).toVar();
    const dy=point.y.sub(eye.y).div(MIST.depth).toVar(),level=abs(dy).lessThan(.01),a=exp(max(eye.y,0).div(-MIST.depth)).toVar(),b=exp(max(point.y,0).div(-MIST.depth));
    const mean=select(level,a,a.sub(b).div(select(level,1,dy)));
    const lie=mix(mix(float(MIST.patch[0]),float(MIST.patch[1]),pools(point.xz.div(MIST.patchSize)).mul(.65).add(pools(point.xz.div(MIST.patchSize/2.7).add(7.3)).mul(.35))),1,smoothstep(90,150,far));
    colour.assign(mix(mist.rgb,colour,exp(mist.a.mul(lie).mul(far).mul(max(mean,0)).negate())));
    if(lamps)If(glowing.x.greaterThan(0),()=>{
     const sum=float(0).toVar();
     for(let i=0;i<lampsAt.length;i++){
      const q=lamps.element(i).sub(eye).toVar(),along=dot(q,dir).toVar(),h=max(sqrt(max(dot(q,q).sub(along.mul(along)),0)),AIR_GLOW.nearest).toVar();
      sum.addAssign(atan(far.sub(along).div(h)).add(atan(along.div(h))).div(h).mul(exp(h.div(-AIR_GLOW.reach))));
     }
     colour.addAssign(glowing.mul(sum));
    });
   });
   return vec4(colour,frame.a);
  })();
 };
 // Wet paving's mirror (wet-reflections.ts): where the paving left in the frame's alpha that it mirrors, the mirrored
 // view ray is followed through the frame's depth and what it meets is shown. The same steps as the WebGL pass, as one
 // function: its look-ups name their level, so they may sit inside its loop.
 const wetness=uniform(0);
 const mirrored=(frame:any)=>{
  if(!options.wetMirror||!(camera instanceof T.PerspectiveCamera))return frame;
  const {Fn,uv,vec2,normalize,cross,dFdx,dFdy,fract,sampler,wgsl,wgslFn}=gpu.tsl,S=WET_MIRROR.steps;
  const march=wgslFn(`fn wetMirror(frame:texture_2d<f32>,frameSampler:sampler,depth:texture_depth_2d,colour:vec4<f32>,p:vec3<f32>,level:f32,ground:vec2<f32>,x:vec3<f32>,y:vec3<f32>,z:vec3<f32>,optics:vec4<f32>,far:f32,jitter:f32,amount:f32)->vec4<f32>{
   let mirror=clamp((1.0-colour.a)*2.0,0.0,1.0);
   // Leaf edges, anti-aliased by coverage, also leave alpha below one, down to nothing: only the paving's half counts.
   if(amount<=0.0||-p.z>=far*0.999||mirror<0.02||colour.a<0.49||level<0.9){return colour;}
   let pool=smoothstep(0.5,1.0,mirror);
   // The film between puddles follows the paving's grain; standing water lies flat.
   let g=ground*9.0;let rough=vec3<f32>(wetNoise(g+vec2<f32>(0.03,0.0))-wetNoise(g-vec2<f32>(0.03,0.0)),0.0,wetNoise(g+vec2<f32>(0.0,0.03))-wetNoise(g-vec2<f32>(0.0,0.03)))*(1.0-pool)*0.25;
   let up=normalize(vec3<f32>(0.0,1.0,0.0)+rough);let nv=normalize(vec3<f32>(dot(x,up),dot(y,up),dot(z,up)));let v=normalize(p);let r=reflect(v,nv);
   let fresnel=0.03+0.97*pow(1.0-max(dot(-v,nv),0.0),5.0);
   var last=0.0;var t=0.0;var hit=vec3<f32>(0.0);var found=0.0;
   for(var i=0;i<${S};i++){
    let k=(f32(i)+jitter)/${S}.0;t=${WET_MIRROR.reach.toFixed(1)}*k*k+0.05;
    let q=p+r*t;if(q.z>-0.1){break;}
    var to=wetTo(q,optics);if(any(to<vec2<f32>(0.0))||any(to>vec2<f32>(1.0))){break;}
    let s=wetFar(depth,to,optics);let gap=-q.z-s;
    if(s>=far*0.999){if(i==${S-1}||-q.z>400.0){hit=textureSampleLevel(frame,frameSampler,to,0.0).rgb;found=1.0;break;}}
    else if(gap>0.0&&gap<max(0.6,(t-last)*1.5)){
     var a=last;var b=t;
     for(var j=0;j<5;j++){let mid=(a+b)*0.5;let h=p+r*mid;if(-h.z-wetFar(depth,wetTo(h,optics),optics)>0.0){b=mid;}else{a=mid;}}
     to=wetTo(p+r*b,optics);hit=textureSampleLevel(frame,frameSampler,to,0.0).rgb;
     let edge=smoothstep(vec2<f32>(0.0),vec2<f32>(0.06),to)*(1.0-smoothstep(vec2<f32>(0.94),vec2<f32>(1.0),to));found=edge.x*edge.y;break;
    }
    last=t;
   }
   let w=mirror*found*clamp(fresnel*2.4+0.12,0.0,0.94);
   return vec4<f32>(colour.rgb*(1.0-w)+hit*w,colour.a);
  }`,[wgsl(`fn wetHash(c:vec2<f32>)->f32{var q=fract(vec3<f32>(c.x,c.y,c.x)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
  fn wetNoise(g:vec2<f32>)->f32{let i=floor(g);var f=g-i;f=f*f*(3.0-2.0*f);return mix(mix(wetHash(i),wetHash(i+vec2<f32>(1.0,0.0)),f.x),mix(wetHash(i+vec2<f32>(0.0,1.0)),wetHash(i+vec2<f32>(1.0,1.0)),f.x),f.y);}
  fn wetTo(q:vec3<f32>,optics:vec4<f32>)->vec2<f32>{return vec2<f32>(q.x*optics.x/(-q.z)*0.5+0.5,0.5-q.y*optics.y/(-q.z)*0.5);}
  fn wetFar(depth:texture_depth_2d,to:vec2<f32>,optics:vec4<f32>)->f32{return optics.w/(textureLoad(depth,vec2<i32>(clamp(to,vec2<f32>(0.0),vec2<f32>(0.9999))*vec2<f32>(textureDimensions(depth))),0)+optics.z);}`)]);
  const seen=texture(target.texture),map=texture(depthOf).setUpdateMatrix(false);
  return Fn(()=>{
   const at=uv(),p=viewAt(at,distanceAt(at)).toVar(),n=normalize(cross(dFdx(p),dFdy(p)));
   const jitter=fract(fract(dot(screenCoordinate.xy,vec2(.06711056,.00583715))).mul(52.9829189).add(tick.mul(.618034)));
   return march({frame:seen,frameSampler:sampler(seen),depth:map,colour:frame,p,level:placed.mul(vec4(n,0)).y,ground:placed.mul(vec4(p,1)).xz,x:placed.mul(vec4(1,0,0,0)).xyz,y:placed.mul(vec4(0,1,0,0)).xyz,z:placed.mul(vec4(0,0,1,0)).xyz,optics,far:farthest,jitter,amount:wetness});
  })();
 };
 const bloomed=(frame:any)=>glow?vec4(frame.rgb.add(glow.rgb),frame.a):frame;
 const lit=(frame:any)=>shafted(bloomed(misted(mirrored(touched(frame)))));
 const blend=quadOf(mix(history,lit(current),weight));
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
  // The shutter (motion-blur.ts): the kept image smeared along the path each point took since the last frame, for the
  // screen only. (Smeared before it joined the kept image, the frame's jittered samples were scattered and the whole
  // moving picture went soft.) Every look-up is taken; a path too short to see is given no length.
  const streaks=options.mist?(()=>{
   const {length,fract}=gpu.tsl,raw=texture(mixed.texture),smeared=half();
   return {smeared,raw,quad:quadOf(Fn(()=>{
    const at=uv(),d=min(far(depth.sample(at.sub(jitter)).r),farthest).toVar(),ndc=vec2(at.x.mul(2).sub(1),at.y.mul(-2).add(1));
    const clip=lastViewProj.mul(camWorld.mul(vec4(ndc.x.mul(d).div(lens.x),ndc.y.mul(d).div(lens.y),d.negate(),1))).toVar();
    const path=at.sub(vec2(clip.x.div(clip.w).mul(.5).add(.5),clip.y.div(clip.w).mul(-.5).add(.5))).mul(select(clip.w.greaterThan(0),MOTION_BLUR.shutter,0)).toVar(),len=length(path);
    path.mulAssign(select(len.lessThan(.0008),0,min(1,float(MOTION_BLUR.longest).div(max(len,1e-6)))));
    const turn=fract(fract(dot(screenCoordinate.xy,vec2(.06711056,.00583715))).mul(52.9829189).add(tick.mul(.618034))).toVar();
    let sum:any=vec3(0);for(let i=0;i<MOTION_BLUR.taps;i++)sum=sum.add(raw.sample(clamp(at.sub(path.mul(turn.add(i).div(MOTION_BLUR.taps).sub(.5))),0,1)).rgb);
    return vec4(sum.div(MOTION_BLUR.taps),1);
   })())};
  })():undefined;
  const copy=quadOf(vec4(far(texture(depthOf).r),0,0,1));
  const lastWorld=new T.Matrix4(),lastLens=new T.Vector3(),size=new T.Vector2();let valid=false,fresh=true;
  return {mixed,lastDepth,
   reset(){fresh=true;},
   resize(w:number,h:number){mixed.setSize(w,h);lastDepth.setSize(w,h);const f=renderer.getDrawingBufferSize(size);streaks?.smeared.setSize(f.x,f.y);if(settled[0].width!==f.x||settled[0].height!==f.y){for(const t of settled)t.setSize(f.x,f.y);valid=false;return true;}return false;},
   /** Whether the frame being drawn moved the view (or follows a change of light or scene). */
   moved:()=>!eye.matrixWorld.equals(lastWorld)||lastLens.x!==eye.fov||lastLens.y!==eye.zoom||lastLens.z!==eye.aspect,
   /** A view come to rest counts its moving image as `carry` frames. */
   rested:()=>valid&&!fresh,
   /** Blends the scene just drawn into the kept image. */
   blend(next:T.WebGLRenderTarget,moved:boolean){
    const e=eye.projectionMatrix.elements,is=carried.value=valid&&(moved||!fresh)?1:0;share.value=is?TEMPORAL.blend:1;
    lens.value.set(e[0],e[5],e[10],e[14]);jitter.value.set(e[8]/2,-e[9]/2);camWorld.value.copy(eye.matrixWorld);
    drawn.value.set(mixed.width,mixed.height);full.value.set(next.width,next.height);
    renderer.setRenderTarget(mixed);composed.render(renderer);
    renderer.setRenderTarget(next);moving.render(renderer);
   },
   /** The kept image `from` as the shutter shows it; call before `remember`. */
   smear(from:T.WebGLRenderTarget){
    if(!streaks||!valid)return from;
    streaks.raw.value=from.texture;renderer.setRenderTarget(streaks.smeared);streaks.quad.render(renderer);return streaks.smeared;
   },
   /** Keeps this frame's depth and view for the next frame's look-up. */
   remember(){
    const e=eye.projectionMatrix.elements;lens.value.set(e[0],e[5],e[10],e[14]);
    renderer.setRenderTarget(lastDepth);copy.render(renderer);
    lastView.value.copy(eye.matrixWorldInverse);lastViewProj.value.copy(eye.projectionMatrix);const l=lastViewProj.value.elements;l[8]=0;l[9]=0;lastViewProj.value.multiply(eye.matrixWorldInverse);
    lastWorld.copy(eye.matrixWorld);lastLens.set(eye.fov,eye.zoom,eye.aspect);valid=true;fresh=false;
   },
   dispose(){mixed.dispose();streaks?.smeared.dispose();streaks?.quad.material.dispose();lastDepth.dispose();composed.material.dispose();moving.material.dispose();copy.material.dispose();},
  };
 })():undefined;
 const shown=texture(settled[0].texture),balance=uniform(new T.Vector3(1,1,1)),look=uniform(new T.Vector3(1,1,0)),exposure=uniform(1);
 const luma=vec3(.2126,.7152,.0722);
 const mapped=agxToneMapping(shown.rgb.mul(balance),exposure);
 const e0=pow(clamp(mapped,0,1),vec3(1/2.2)),m=dot(e0,luma),f=float(1).sub(m),e=min(e0.mul(look.z.mul(f.mul(f).mul(f).mul(f)).add(1)),vec3(1));
 const p=pow(e,vec3(look.x)),q=pow(vec3(1).sub(e),vec3(look.x)),c=pow(p.div(max(p.add(q),vec3(1e-5))),vec3(2.2)),l=dot(c,luma);
 const graded0=max(vec3(0),vec3(l).add(c.sub(l).mul(look.y)));
 // A canvas that shows above white (hdr.ts): light the scene holds above the knee is shown brighter, up to `bright` times.
 const bright=uniform(0),graded=graded0.mul(clamp(pow(dot(shown.rgb.mul(balance),luma).mul(exposure).div(HDR.knee),HDR.curve),1,max(bright,1)));
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
 // A traced view's light, kept for the frames that follow (carry.ts): the image, the depth and the view it was traced
 // for, and what it changed (`ratio`, at half size with its smaller levels). `keptAt`: where that view saw a pixel's
 // point, and whether it saw that point there.
 const light=camera instanceof T.PerspectiveCamera?{image:half(),depth:half(),lit:half(),ratio:new T.RenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter}) as unknown as T.WebGLRenderTarget,
  camera:new T.PerspectiveCamera(),demodulated:false,generation:-1,version:-1,reach:0}:undefined;
 const keptViewProj=uniform(new T.Matrix4()),keptView=uniform(new T.Matrix4()),keptDepth=texture((light?.depth??settled[0]).texture);
 const keptAt=(at:any)=>{
  const {vec2,abs}=gpu.tsl,world=placed.mul(vec4(viewAt(at,distanceAt(at)),1)).toVar(),clip=keptViewProj.mul(world).toVar(),expected=keptView.mul(world).z.negate();
  const to=vec2(clip.x.div(clip.w).mul(.5).add(.5),clip.y.div(clip.w).mul(-.5).add(.5)).toVar();
  return {to,seen:clip.w.greaterThan(0).and(abs(keptDepth.sample(to).r.sub(expected)).lessThan(expected.mul(CARRY.tolerance).add(.05)))};
 };
 // A path-traced image over the settled live one (post.ts, TracedBlend): multiplied by the live view's surface colours
 // where it arrives divided by its own, under the live view's fog, mist, lamp glow and sun shafts, which the traced
 // scene has not; where no surface is hit the live view's sky shows. A data texture's rows run bottom up. `moved`: the
 // image was traced for the kept view; each point is looked up where that view saw it, and the live image shows where
 // it did not and toward the border of what it saw. `ratio`: what the traced image changed instead, for moving frames to keep.
 const traced=(()=>{
  const {Fn,uv,vec2,select,smoothstep}=gpu.tsl,image=texture(settled[0].texture),live=texture(settled[0].texture),surfaces=texture(settled[0].texture);
  const amount=uniform(0),divided=uniform(0),moved=uniform(0),fogColour=uniform(new T.Color()),fogRange=uniform(new T.Vector2(1e9,1e9));
  const drawn=(ratio:boolean)=>quadOf(Fn(()=>{
   const at=uv(),was=live.sample(at).rgb.toVar(),d=distanceAt(at).toVar(),{to,seen}=keptAt(at),from=select(moved.greaterThan(.5),to,at);
   const valid=select(moved.lessThan(.5),1,select(seen,smoothstep(0,LIGHT_CARRY.edge,min(min(to.x,to.y),min(to.x.oneMinus(),to.y.oneMinus()))),0));
   const light=image.sample(vec2(from.x,from.y.oneMinus())).rgb.mul(mix(vec3(1),max(surfaces.sample(at).rgb,vec3(SHARP.floor)),divided));
   const aired=select(d.greaterThanEqual(farthest.mul(.999)),was,shafted(misted(vec4(mix(light,fogColour,smoothstep(fogRange.x,fogRange.y,d)),1))).rgb).toVar();
   return ratio?vec4(clamp(aired.add(.004).div(was.add(.004)),LIGHT_CARRY.least,LIGHT_CARRY.most),1):vec4(mix(was,aired,amount.mul(valid)),1);
  })());
  return {image,live,surfaces,amount,divided,moved,fogColour,fogRange,out:half(),colours:undefined as T.WebGLRenderTarget|undefined,quad:drawn(false),ratio:drawn(true)};
 })();
 // A moving frame under the light of the last traced view (carry.ts, LIGHT_CARRY): multiplied by the kept ratio where
 // that view saw the same point; a point it did not see takes the light of that part of the frame as a whole.
 let carriedLight=0;
 const relight=light&&kept?(()=>{
  const {Fn,uv,smoothstep,select}=gpu.tsl,frame=texture(settled[0].texture),broad=texture(light.ratio.texture),amount=uniform(0);
  const quad=quadOf(Fn(()=>{
   const at=uv(),c=frame.sample(at),{to,seen}=keptAt(at),valid=select(seen,smoothstep(0,LIGHT_CARRY.edge,min(min(to.x,to.y),min(to.x.oneMinus(),to.y.oneMinus()))),0);
   return vec4(c.rgb.mul(mix(vec3(1),mix(broad.sample(clamp(to,0,1)).level(LIGHT_CARRY.coarse-1).rgb,broad.sample(to).level(LIGHT_CARRY.fine-1).rgb,valid),amount)),c.a);
  })());
  return {quad,broad,render(image:T.WebGLRenderTarget){
   if(light.lit.width!==image.width||light.lit.height!==image.height)light.lit.setSize(image.width,image.height);
   frame.value=image.texture;amount.value=carriedLight;renderer.setRenderTarget(light.lit);quad.render(renderer);return light.lit;
  }};
 })():undefined;
 const copied=texture(settled[0].texture),copy=quadOf(copied),depthCopy=quadOf(vec4(distanceAt(gpu.tsl.uv()),0,0,1));
 // A prototype (move-trace.ts): light traced while the view moves. A sample is traced over several frames for the
 // view it started from (`from`: that view's frame, depth and place); when it is in, what it changed against that frame
 // becomes the kept ratio, both read broadly (`MOVING.level`) since one sample a pixel is grain, and blended with the
 // ratio before it, a resting trace's too, where that one saw the same place. Moving frames then take it as they take a resting trace's.
 const motion=light&&relight?(()=>{
  const {Fn,uv,vec2,select,smoothstep}=gpu.tsl;
  const broadly=()=>new T.RenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter}) as unknown as T.WebGLRenderTarget;
  const from={frame:broadly(),depth:half(),camera:new T.PerspectiveCamera(),placed:uniform(new T.Matrix4()),optics:uniform(new T.Vector4(1,1,0,1))};
  const sample=texture(from.frame.texture),frame=texture(from.frame.texture),depth=texture(from.depth.texture),before=texture(light.ratio.texture),share=uniform(0),fogColour=uniform(new T.Color()),fogRange=uniform(new T.Vector2(1e9,1e9));
  let spare=broadly();
  const quad=quadOf(Fn(()=>{
   const at=uv(),d=depth.sample(at).r.toVar(),o=from.optics;
   const world=from.placed.mul(vec4(at.x.mul(2).sub(1).mul(d).div(o.x),at.y.mul(-2).add(1).mul(d).div(o.y),d.negate(),1)).toVar(),clip=keptViewProj.mul(world).toVar();
   const to=vec2(clip.x.div(clip.w).mul(.5).add(.5),clip.y.div(clip.w).mul(-.5).add(.5)).toVar();
   const inside=select(clip.w.greaterThan(0),smoothstep(0,LIGHT_CARRY.edge,min(min(to.x,to.y),min(to.x.oneMinus(),to.y.oneMinus()))),0);
   const was=frame.sample(at).level(MOVING.level).rgb,traced=mix(sample.sample(at).level(MOVING.level).rgb,fogColour,smoothstep(fogRange.x,fogRange.y,d));
   const changed=select(d.greaterThanEqual(farthest.mul(.999)),vec3(1),clamp(traced.add(.004).div(was.add(.004)),LIGHT_CARRY.least,LIGHT_CARRY.most));
   return vec4(mix(changed,before.sample(clamp(to,0,1)).rgb,share.mul(inside)),1);
  })());
  return {
   /** A sample starts from the view as just drawn; `width`, `height`: the traced image's. */
   start(width:number,height:number){
    const previous=renderer.getRenderTarget();
    from.frame.setSize(width,height);from.depth.setSize(target.width,target.height);
    copied.value=settled[0].texture;renderer.setRenderTarget(from.frame);copy.render(renderer);
    renderer.setRenderTarget(from.depth);depthCopy.render(renderer);renderer.setRenderTarget(previous);
    from.camera.copy(camera as T.PerspectiveCamera);from.camera.updateMatrixWorld();from.placed.value.copy(from.camera.matrixWorld);
    const e=from.camera.projectionMatrix.elements;from.optics.value.set(e[0],e[5],e[10],e[14]);
   },
   /** The sample is in: `image`, linear and with its smaller levels. */
   done(image:T.Texture){
    const previous=renderer.getRenderTarget(),w=Math.ceil(target.width/2),h=Math.ceil(target.height/2);
    if(spare.width!==w||spare.height!==h)spare.setSize(w,h);
    sample.value=image;frame.value=from.frame.texture;depth.value=from.depth.texture;before.value=light.ratio.texture;share.value=light.generation===-1?0:MOVING.keep;
    if(scene.fog instanceof T.Fog){fogColour.value.copy(scene.fog.color);fogRange.value.set(scene.fog.near,scene.fog.far);}
    renderer.setRenderTarget(spare);quad.render(renderer);renderer.setRenderTarget(previous);
    [light.ratio,spare]=[spare,light.ratio];[light.depth,from.depth]=[from.depth,light.depth];
    relight.broad.value=light.ratio.texture;keptDepth.value=light.depth.texture;
    light.camera.copy(from.camera);light.camera.updateMatrixWorld();
    keptViewProj.value.multiplyMatrices(light.camera.projectionMatrix,light.camera.matrixWorldInverse);keptView.value.copy(light.camera.matrixWorldInverse);
    light.generation=MOVING.generation;light.version=-1;light.reach=meter&&Number.isFinite(meter.focus)?meter.focus:0;
   },
   dispose(){from.frame.dispose();from.depth.dispose();spare.dispose();quad.material.dispose();},
  };
 })():undefined;
 /** Draws `image` over the settled live image through the finish; `reproject`: it is the kept image. */
 const show=(image:T.Texture,amount:number,demodulated:boolean,reproject:boolean)=>{
  const size=renderer.getDrawingBufferSize(new T.Vector2());
  if(traced.out.width!==size.x||traced.out.height!==size.y)traced.out.setSize(size.x,size.y);
  if(demodulated&&(traced.colours?.width!==size.x||traced.colours.height!==size.y)){
   traced.colours?.dispose();traced.colours=new T.RenderTarget(size.x,size.y,{samples:4,colorSpace:T.SRGBColorSpace}) as unknown as T.WebGLRenderTarget;renderAlbedo(renderer,scene,camera,traced.colours);
  }
  // A kept image lies over the frame as it was last shown, with the kept light where there was any.
  traced.image.value=image;traced.live.value=(reproject&&light&&carriedLight>0?light.lit:settled[0]).texture;traced.amount.value=amount;traced.moved.value=reproject?1:0;traced.divided.value=demodulated&&traced.colours?1:0;
  if(traced.colours)traced.surfaces.value=traced.colours.texture;
  if(scene.fog instanceof T.Fog){traced.fogColour.value.copy(scene.fog.color);traced.fogRange.value.set(scene.fog.near,scene.fog.far);}
  renderer.setRenderTarget(traced.out);traced.quad.render(renderer);
  seed.value=(seed.value+1)%64;showing=near&&focus?focus.render(traced.out):traced.out;toScreen();
 };
 let showing=settled[0],flowing=false,near=false;
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
   const g=finish(indoor,lamps());balance.value.set(g.balance[0],g.balance[1],g.balance[2]);look.value.set(g.contrast,g.saturation,g.lift);exposure.value=exposed*(meter?.adapt(exposed)??1);seed.value=(seed.value+1)%64;occlusion.value=g.occlusion;bright.value=options.hdr?.()??0;
   // Only highlights two and a half times brighter than white bloom.
   if(glow)glow.threshold.value=2.5/Math.max(exposed,1e-4);
   const moved=kept?.moved()??false,rest=refining&&!moved;
   if(!rest)frames=0;else if(kept&&frames===0&&kept.rested())frames=TEMPORAL.carry;
   renderer.setRenderTarget(target);renderer.render(scene,camera);
   if(level&&levelled){renderer.setRenderTarget(level);levelled.render(renderer);}
   const e=camera.projectionMatrix.elements;optics.value.set(e[0],e[5],e[10],e[14]);placed.value.copy(camera.matrixWorld);farthest.value=(camera as T.PerspectiveCamera).far;wetness.value=wet.value;tick.value=(tick.value+1)%64;
   if(touch){
    // None by night or with the sun at the horizon, where a half-metre march says nothing about a shadow metres long.
    const toLight=touch.toLight.value.subVectors(touch.sun.position,touch.sun.target.position).normalize();
    touch.amount.value=touch.sun.intensity>0?CONTACT.strength*T.MathUtils.smoothstep(toLight.y,...CONTACT.low):0;toLight.transformDirection(camera.matrixWorldInverse);
   }
   meter?.read();
   if(!rest)shafts?.reset();shafts?.render(indoor);
   const [was,next]=settled;current.value=target.texture;history.value=was.texture;weight.value=1/(frames+1);
   if(kept&&!rest)kept.blend(next,moved);
   else{renderer.setRenderTarget(next);(refining&&shaded?shaded:blend).render(renderer);}
   const out=kept&&!rest&&moved&&!refining&&flowing?kept.smear(next):next;
   flowing=!refining;
   settled=[next,was];if(rest||!kept)frames++;
   kept?.remember();
   // The screen's frame takes the last traced view's light while it applies; the kept image stays as it was drawn.
   carriedLight=light&&relight&&(light.generation===MOVING.generation?view?.moving:view?.carry!==undefined&&light.generation===view.carry)?lightCarried(light.camera,camera,light.reach):0;
   const lit=relight&&carriedLight>0?relight.render(out):out;
   near=!!view?.eyeLevel;showing=near&&focus?focus.render(lit):lit;
   toScreen();
  },
  /** How much of a traced view's light the last frame carried (carry.ts, LIGHT_CARRY). */
  get lightCarried(){return carriedLight;},
  get accumulated(){return frames;},
  /** Moving frames are jittered too, and blended into the kept image. */
  temporal:!!kept,
  replay:toScreen,
  /** Draws `object` over the frame on the canvas, with whatever else was drawn over it since it was last shown. */
  over:(object:T.Object3D,through:T.Camera)=>{stage.add(object);draw(through);},
  /** How much mist lies (0–1, mist.ts) and its colour, and how far the lamps' glow hangs in the air (0–1). */
  setMist:(amount:number,colour:T.Color,lampGlow=0)=>{if(!mist)return;mist.value.set(colour.r,colour.g,colour.b,amount/MIST.reach);glowing.value.copy(glowColour).multiplyScalar(lampsAt.length?lampGlow*AIR_GLOW.strength:0);},
  keepDepth:()=>{},
  /** The scene's own depth buffer as last drawn, which what falls over the frame reads as it is (falling.ts). */
  get depth(){return depthOf;},
  /** Shows a path-traced image (linear, before exposure) over the settled live image, through the same finish, `amount`
   * (0–1) of it. Exposure and finish hold as the view's last frame left them, as does the focus at eye level; the grain keeps
   * moving. */
  present:(image:T.Texture,amount:number,_radius:number,_exposure:number,_indoor=0,demodulated=false)=>show(image,amount,demodulated,false),
  /** Keeps a traced image with the view it was traced for, that view's depth and what the image changed, to carry
   * through the moves that follow; `generation`: the trace's scene and sun (live-trace.ts). */
  keep:(image:T.Texture,demodulated:boolean,generation:number)=>{
   if(!light||(light.version===image.version&&light.generation===generation))return;
   const from=image.image as {width:number;height:number},previous=renderer.getRenderTarget();
   light.image.setSize(from.width,from.height);light.depth.setSize(target.width,target.height);light.ratio.setSize(Math.ceil(traced.out.width/2),Math.ceil(traced.out.height/2));
   copied.value=image;renderer.setRenderTarget(light.image);copy.render(renderer);
   renderer.setRenderTarget(light.depth);depthCopy.render(renderer);
   // The blend is still set as it was for showing this image (present).
   renderer.setRenderTarget(light.ratio);traced.ratio.render(renderer);
   renderer.setRenderTarget(previous);
   light.camera.copy(camera as T.PerspectiveCamera);light.camera.updateMatrixWorld();
   keptViewProj.value.multiplyMatrices(light.camera.projectionMatrix,light.camera.matrixWorldInverse);keptView.value.copy(light.camera.matrixWorldInverse);
   light.demodulated=demodulated;light.generation=generation;light.version=image.version;light.reach=meter&&Number.isFinite(meter.focus)?meter.focus:0;
  },
  /** The moving trace's sample starts and ends (move-trace.ts). */
  traceFrom:(width:number,height:number)=>motion?.start(width,height),
  traceDone:(image:T.Texture)=>motion?.done(image),
  /** Whether the kept image can stand in for `camera`'s view: the same scene and sun, and a small move (carry.ts). */
  carries:(camera:T.Camera,generation:number)=>!!light&&light.generation===generation&&carryApplies(light.camera,camera),
  /** Shows the kept image moved into the current view; the live image where the move uncovered something. */
  carry:()=>{if(light)show(light.image.texture,1,light.demodulated,true);},
  reset:()=>{frames=0;kept?.reset();shafts?.reset();traced.colours?.dispose();traced.colours=undefined;},
  dispose:()=>{motion?.dispose();traced.out.dispose();traced.colours?.dispose();traced.quad.material.dispose();traced.ratio.material.dispose();if(light)for(const t of [light.image,light.depth,light.lit,light.ratio])t.dispose();relight?.quad.material.dispose();copy.material.dispose();depthCopy.material.dispose();kept?.dispose();meter?.dispose();focus?.dispose();shafts?.dispose();target.dispose();level?.dispose();levelled?.material.dispose();for(const t of settled)t.dispose();blend.material.dispose();shaded?.material.dispose();shade?.dispose();glow?.dispose();output.material.dispose();},
 };
 return api as unknown as Post&{over:typeof api.over;traceFrom:typeof api.traceFrom;traceDone:typeof api.traceDone};
}
