import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** Ground mist at daybreak (Extreme): air that thickens toward the lawn, `depth` m deep (its density falls by e over
 * that height), through which 1/`reach` of the light is lost per metre along the ground at its fullest. It lies while
 * the sun is between `sun[0]` and `sun[1]` degrees, fullest just after sunrise, and a third as much at the same sun in
 * the evening; `summer` is what a midsummer morning keeps of it. Looked up from each pixel's depth, so it costs one
 * pass and shows in the path-traced still as well (post.ts). It lies unevenly: within 150 m its density runs between
 * `patch[0]` and `patch[1]` of the mean, in pools about `patchSize` m across. */
export const MIST={depth:1.3,reach:38,sun:[-7,13] as const,peak:2,evening:.3,summer:.45,patch:[.55,1.45] as const,patchSize:14};

/** How much mist lies (0–1) at the sun's elevation (degrees), `minutes` into day `day` of the year. */
export function mistAmount(elevation:number,minutes:number,day:number){
 const [lo,hi]=MIST.sun,rise=T.MathUtils.smoothstep(elevation,lo,MIST.peak)*(1-T.MathUtils.smoothstep(elevation,MIST.peak,hi));
 const season=T.MathUtils.lerp(1,MIST.summer,Math.max(0,Math.cos((day-172)/365*2*Math.PI)));
 return rise*(minutes<720?1:MIST.evening)*season;
}
/** `vec3 mistOver(colour, eye, point, mist)`: `colour` seen from `eye` at `point` (world), through mist of colour
 * `mist.rgb` and ground density `mist.a` per metre. */
export const mistGlsl=`
float mistHash(vec2 c){vec3 p=fract(vec3(c.xyx)*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float mistPools(vec2 g){vec2 i=floor(g),f=g-i;f=f*f*(3.0-2.0*f);return mix(mix(mistHash(i),mistHash(i+vec2(1.0,0.0)),f.x),mix(mistHash(i+vec2(0.0,1.0)),mistHash(i+vec2(1.0,1.0)),f.x),f.y);}
vec3 mistOver(vec3 colour,vec3 eye,vec3 point,vec4 mist){
 if(mist.a<=0.0)return colour;
 float h=${MIST.depth.toFixed(2)},dy=(point.y-eye.y)/h,a=exp(-max(eye.y,0.0)/h),b=exp(-max(point.y,0.0)/h);
 float mean=abs(dy)<0.01?a:(a-b)/dy;
 float far=length(point-eye),pools=mix(mix(${MIST.patch[0].toFixed(2)},${MIST.patch[1].toFixed(2)},mistPools(point.xz/${MIST.patchSize.toFixed(1)})*0.65+mistPools(point.xz/${(MIST.patchSize/2.7).toFixed(1)}+7.3)*0.35),1.0,smoothstep(90.0,150.0,far));
 return mix(mist.rgb,colour,exp(-mist.a*pools*far*max(mean,0.0)));
}`;

/** Lamp glow in thick air (Extreme): the lit windows and the path lights hang a halo in mist, rain and falling snow,
 * and a faint one (`clear` of it) on any night. A ray passing a lamp at distance h gathers its light in proportion to
 * the angle the lamp sees the ray under, over h: exact for a point lamp in even air, with nothing in the way; the air between takes
 * the light within about `reach` m, so a halo stays round its lamp. `nearest`
 * (m) keeps a ray through the lamp itself finite; at most `most` lamps are counted. */
export const AIR_GLOW={clear:.25,strength:.001,reach:2.5,colour:'#ffd9a8',nearest:.35,most:32};
/** `vec3 lampGlow(eye, dir, dist)`: the glow a ray from `eye` along `dir` gathers in `dist` m, from the lamps at
 * `glowLamps` and of colour and strength `glow`. */
export const glowGlsl=(count:number)=>`
uniform vec3 glowLamps[${Math.max(1,count)}];uniform vec3 glow;
vec3 lampGlow(vec3 eye,vec3 dir,float dist){
 if(glow.r<=0.0)return vec3(0.0);
 float sum=0.0;
 for(int i=0;i<${count};i++){vec3 q=glowLamps[i]-eye;float along=dot(q,dir),h=max(sqrt(max(dot(q,q)-along*along,0.0)),${AIR_GLOW.nearest.toFixed(2)});sum+=(atan((dist-along)/h)+atan(along/h))/h*exp(-h/${AIR_GLOW.reach.toFixed(1)});}
 return glow*sum;
}`;

export class MistPass extends Pass{
 private material:T.ShaderMaterial;private quad:FullScreenQuad;
 /** `mist`: the uniform shared with the traced blend: colour and ground density. */
 constructor(private camera:T.PerspectiveCamera,depth:T.Texture,private mist:{value:T.Vector4},glow:{value:T.Vector3},lamps:T.Vector3[]=[]){
  super();
  this.material=new T.ShaderMaterial({
   uniforms:{frame:{value:null},depth:{value:depth},mist,glow,glowLamps:{value:lamps.length?lamps:[new T.Vector3()]},projectionInverse:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},far:{value:1000}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:`uniform sampler2D frame;uniform sampler2D depth;uniform vec4 mist;uniform mat4 projectionInverse;uniform mat4 cameraWorld;uniform float far;varying vec2 vUv;${mistGlsl}${glowGlsl(lamps.length)}
    void main(){
     vec4 colour=texture2D(frame,vUv);
     vec4 view=projectionInverse*vec4(vUv*2.0-1.0,1.0,1.0);vec3 dirView=normalize(view.xyz/view.w);
     // The sky stands for the land far off: mist lies along the horizon.
     float d=texture2D(depth,vUv).r,dist=d>=far*0.999?600.0:d/max(-dirView.z,1e-3);
     vec3 eye=(cameraWorld*vec4(0.0,0.0,0.0,1.0)).xyz,dir=normalize(mat3(cameraWorld)*dirView);
     gl_FragColor=vec4(mistOver(colour.rgb,eye,eye+dir*dist,mist)+lampGlow(eye,dir,dist),colour.a);
    }`,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const u=this.material.uniforms;u.frame.value=read.texture;u.projectionInverse.value.copy(this.camera.projectionMatrixInverse);u.cameraWorld.value.copy(this.camera.matrixWorld);u.far.value=this.camera.far;
  renderer.setRenderTarget(this.renderToScreen?null:write);this.quad.render(renderer);
 }
 dispose(){this.material.dispose();this.quad.dispose();}
}
