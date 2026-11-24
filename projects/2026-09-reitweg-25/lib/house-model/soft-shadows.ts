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
export const plainShadow=<M extends T.Material>(material:M)=>{(material.defines??={}).SOFT_SHADOW_PLAIN='';return material;};

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
