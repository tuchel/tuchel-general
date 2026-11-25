import * as T from 'three';

/** The sun's shadows soften with the distance to what casts them (Extreme): crisp where a post meets the ground, soft at
 * the far end of a tree's shadow. Each lit point looks, in `search` places of the shadow map round its own, for what
 * stands between it and the sun; the shadow's edge is then as wide as their mean distance times `spread` (the sun's
 * apparent radius, about twice the real one so that it reads at a garden's distances), never narrower than
 * `sharpest` texels of the map nor wider than `widest` metres, and is averaged over `taps` places. The places turn by
 * the golden angle each frame, `turns` in all, so the frames a view gathers (post.ts, temporal.ts) smooth the grain.
 *
 * It replaces three's unfiltered shadow lookup, which Extreme's renderer is set to and no other preset uses. The lookup
 * has one free number from the light, its shadow's radius; that carries the frame's turn (whole part) and the half
 * width in metres of the shadow map's view over 1024 (fraction), from which the shader has the map's scale. */
export const SOFT_SHADOW={spread:.01,sharpest:1.2,widest:.35,search:8,taps:12,turns:64};
/** The depth the shadow map covers, in metres, for a view of this half width (lighting.ts, fitShadow). */
export const SHADOW_RANGE={perRadius:4.8,fixed:119};
/** The number the sun's shadow carries to the lookup. */
export const packShadow=(turn:number,radius:number)=>turn%SOFT_SHADOW.turns+Math.min(radius,1023)/1024;

/** Leaves and grass blades are drawn many deep, and a shadow's edge on one is lost among the rest: for them three
 * places close by suffice. */
export const plainShadow=<M extends T.Material>(material:M)=>{(material.defines??={}).SOFT_SHADOW_PLAIN='';material.userData.plainShadow=true;return material;};

const signature='float getShadow( sampler2D shadowMap,',lookup=/float depth = texture2D\( shadowMap, shadowCoord\.xy \)\.r;[\s\S]*?shadow = step\( shadowCoord\.z, depth \);\s*#endif/;
const glsl=`
		float softIgn(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
		vec2 softDisc(int i,float count,float phi){float r=sqrt((float(i)+0.5)/count),t=float(i)*2.399963+phi;return vec2(cos(t),sin(t))*r;}
		float softShadow(sampler2D map,vec2 size,float carried,vec3 at){
			float radius=fract(carried)*1024.0,perMetre=0.5/radius,range=radius*${SHADOW_RANGE.perRadius.toFixed(2)}+${SHADOW_RANGE.fixed.toFixed(1)};
			float phi=(softIgn(gl_FragCoord.xy)+floor(carried)*0.618034)*6.2831853;
			#ifdef SOFT_SHADOW_PLAIN
			float plain=0.0;for(int i=0;i<3;i++)plain+=step(at.z,texture2D(map,at.xy+softDisc(i,3.0,phi)*1.5/size.x).r);return plain/3.0;
			#else
			// How the lit surface's own depth runs across the map: a wide disc on a slope must not shadow itself.
			vec3 dx=dFdx(at),dy=dFdy(at);float det=dx.x*dy.y-dx.y*dy.x;
			vec2 slope=abs(det)>1e-14?vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/det:vec2(0.0);
			float steep=length(slope),most=6.0/(perMetre*range);if(steep>most)slope*=most/steep;
			float search=${SOFT_SHADOW.widest.toFixed(2)}*perMetre,sum=0.0,count=0.0;
			for(int i=0;i<${SOFT_SHADOW.search};i++){
				vec2 o=softDisc(i,${SOFT_SHADOW.search}.0,phi)*search;float d=texture2D(map,at.xy+o).r;
				if(d<at.z+dot(slope,o)-0.03/range){sum+=d;count+=1.0;}
			}
			// Nothing in the way, or everything: no edge here.
			if(count<0.5)return 1.0;
			if(count>${SOFT_SHADOW.search}.0-0.5)return 0.0;
			float width=clamp((at.z-sum/count)*range*${SOFT_SHADOW.spread.toFixed(3)}*perMetre,${SOFT_SHADOW.sharpest.toFixed(1)}/size.x,search),lit=0.0;
			for(int i=0;i<${SOFT_SHADOW.taps};i++){vec2 o=softDisc(i,${SOFT_SHADOW.taps}.0,phi+1.3)*width;lit+=step(at.z+dot(slope,o),texture2D(map,at.xy+o).r);}
			return lit/${SOFT_SHADOW.taps}.0;
			#endif
		}
`;
/** Three's unfiltered shadow lookup becomes the softened one, once for the page. Only a renderer whose shadow map type
 * is `BasicShadowMap` compiles it. */
export function installSoftShadows(){
 const chunk=T.ShaderChunk.shadowmap_pars_fragment;
 if(chunk.includes('softShadow('))return;
 // The unfiltered lookup is the last of the two that read a plain depth texture.
 const found=lookup.exec(chunk),at=found?chunk.lastIndexOf(signature,found.index):-1;
 if(!found||at<0)throw new Error('three’s shadow lookup has changed');
 T.ShaderChunk.shadowmap_pars_fragment=chunk.slice(0,at)+glsl.trim()+'\n\t\t'+chunk.slice(at).replace(lookup,'shadow = softShadow( shadowMap, shadowMapSize, shadowRadius, shadowCoord.xyz );');
}

/** The same lookup for the WebGPU renderer, as the sun's shadow's own filter: the search and the taps in WGSL, the
 * depth loaded texel by texel and compared here, as the GLSL does (three binds the map for one kind of sampling only). Leaves and grass (plainShadow) take the
 * three close places, as in the GLSL. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function softShadowFilter(tsl:any){
 const {Fn,If,wgsl,wgslFn,vec2,ivec2,float,reference,renderGroup,screenCoordinate,texture}=tsl;
 const code=wgsl(`
fn softIgn(p:vec2<f32>)->f32{return fract(52.9829189*fract(dot(p,vec2<f32>(0.06711056,0.00583715))));}
fn softDisc(i:f32,count:f32,phi:f32)->vec2<f32>{let r=sqrt((i+0.5)/count);let t=i*2.399963+phi;return vec2<f32>(cos(t),sin(t))*r;}`);
 const ign=wgslFn('fn softIgnAt(p:vec2<f32>)->f32{return softIgn(p);}',[code]);
 const disc=wgslFn('fn softDiscAt(i:f32,count:f32,phi:f32)->vec2<f32>{return softDisc(i,count,phi);}',[code]);
 return Fn(({depthTexture,shadowCoord,shadow}:any,builder:any)=>{
  const map=texture(depthTexture),at=shadowCoord.xyz;
  const carried=reference('radius','float',shadow).setGroup(renderGroup),size=reference('mapSize','vec2',shadow).setGroup(renderGroup);
  const radius=carried.fract().mul(1024),perMetre=float(.5).div(radius),range=radius.mul(SHADOW_RANGE.perRadius).add(SHADOW_RANGE.fixed);
  const phi=ign({p:screenCoordinate.xy}).add(carried.floor().mul(.618034)).mul(Math.PI*2).toVar();
  const depthAt=(o:any)=>map.load(ivec2(at.xy.add(o).clamp(0,.9999).mul(size))).r,compare=(o:any,z:any=at.z)=>depthAt(o).greaterThanEqual(z).select(1,0);
  if(builder.material.userData?.plainShadow){
   let plain=float(0);
   for(let i=0;i<3;i++)plain=plain.add(compare(disc({i:float(i),count:float(3),phi}).mul(float(1.5).div(size.x))));
   return plain.div(3);
  }
  // A wide disc on a slope must not shadow itself: how the lit surface's own depth runs across the map.
  const dx=at.dFdx().toVar(),dy=at.dFdy().toVar(),det=dx.x.mul(dy.y).sub(dx.y.mul(dy.x)).toVar();
  const run=vec2(dy.y.mul(dx.z).sub(dx.y.mul(dy.z)),dx.x.mul(dy.z).sub(dy.x.mul(dx.z))).div(det.abs().max(1e-14).mul(det.sign()));
  const most=float(6).div(perMetre.mul(range)),slope=run.mul(float(1).min(most.div(run.length().max(1e-6)))).toVar();
  const search=float(SOFT_SHADOW.widest).mul(perMetre).toVar();
  let sum=float(0),count=float(0);
  for(let i=0;i<SOFT_SHADOW.search;i++){
   const o=disc({i:float(i),count:float(SOFT_SHADOW.search),phi}).mul(search),d=depthAt(o);
   const blocks=d.lessThan(at.z.add(slope.dot(o)).sub(float(.03).div(range)));
   sum=sum.add(d.mul(blocks.select(1,0)));count=count.add(blocks.select(1,0));
  }
  const total=sum.toVar(),hits=count.toVar();
  // Nothing in the way, or everything: no edge here, and no taps are taken.
  const result=float(1).toVar();
  If(hits.greaterThan(SOFT_SHADOW.search-.5),()=>{result.assign(0);}).ElseIf(hits.greaterThan(.5),()=>{
   const width=at.z.sub(total.div(hits)).mul(range).mul(SOFT_SHADOW.spread).mul(perMetre).clamp(float(SOFT_SHADOW.sharpest).div(size.x),search).toVar();
   let lit=float(0);
   for(let i=0;i<SOFT_SHADOW.taps;i++){const o=disc({i:float(i),count:float(SOFT_SHADOW.taps),phi:phi.add(1.3)}).mul(width);lit=lit.add(compare(o,at.z.add(slope.dot(o))));}
   result.assign(lit.div(SOFT_SHADOW.taps));
  });
  return result;
 });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
