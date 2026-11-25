import * as T from 'three';
import {COVER} from './sky-links';
import {SNOW,snowRoofs} from './snow';
import {drawOver,fallingNodes,fallingQuads,held,type FallingGPU} from './falling';

/** Rain mode: `count` drops in a box of air (metres) that follows the camera, set ahead of it. They fall at `fall` m/s
 * on a wind (`wind`, m/s east and south) and are drawn as the streak a drop leaves while a camera's shutter is open
 * (`shutter` s), `width` m across. `ease`: the seconds the ground takes to wet, and to dry again. */
export const RAINFALL={count:20000,box:[26,16,26],fall:[7,9.5],wind:[1.1,.35],shutter:.035,width:.004,opacity:.65,ease:5};
const f=(v:number)=>v.toFixed(4);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The same drops for the WebGPU renderer: the vertex and fragment shaders below as nodes, on squares (falling.ts). */
function streaks(gpu:FallingGPU,u:any,sky?:Record<string,T.IUniform>){
 const {attribute,vec2,vec3,vec4,float,mix,max,min,abs,dot,length,smoothstep,varying,cameraViewMatrix}=gpu.tsl,fall=fallingNodes(gpu,u,sky);
 const r=attribute('chance','float'),fallen=vec3(RAINFALL.wind[0],mix(RAINFALL.fall[0],RAINFALL.fall[1],r).negate(),RAINFALL.wind[1]);
 const {p,shows}=fall.wrap(attribute('seed','vec3').mul(u.uBox).add(fallen.mul(u.uTime)));
 // The streak on screen: from the drop to where it was when the shutter opened.
 const mv=cameraViewMatrix.mul(vec4(p,1)),was=cameraViewMatrix.mul(vec4(p.sub(fallen.mul(RAINFALL.shutter)),1)),d=max(mv.z.negate(),.05);
 const along=mv.xy.div(d).sub(was.xy.div(max(was.z.negate(),.05))).mul(fall.scale),len=max(length(along),1),across=float(RAINFALL.width).mul(fall.scale).div(d),width=max(across,1);
 const alpha=shows.mul(RAINFALL.opacity).mul(min(1,across.add(.25))).mul(smoothstep(.3,1.2,d));
 const {vertex,at}=fall.sprite(mv.xyz.add(was.xyz).mul(.5),min(len.add(width),96),alpha.lessThan(.004).or(mv.z.negate().lessThan(.12)));
 const lean=varying(vec2(along.div(len))),thin=varying(width.div(max(len,width))),line=smoothstep(thin.mul(.5),thin,abs(at.x.mul(lean.y).sub(at.y.mul(lean.x)))).oneMinus().mul(smoothstep(.6,1,abs(dot(at,lean))).oneMinus());
 const material=new gpu.NodeMaterial() as any;u.uDepth=fall.depth;
 Object.assign(material,{vertexNode:vertex,fragmentNode:vec4(u.uLight,varying(alpha).mul(line).mul(fall.seen(varying(d)))),transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
 return material as T.Material;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
/** The drops: one draw of points, placed by the vertex shader from the time alone, each a streak along its fall. None
 * falls under a roof, as with the snow (snowfall.ts): rooms and the loggia stay dry while it rains beyond them. Drawn
 * over the finished image, behind whatever the scene's depth says is nearer. `sky`: the sky light's uniforms. */
export function createRainfall(sky?:Record<string,T.IUniform>,gpu?:FallingGPU){
 const seeds=new Float32Array(RAINFALL.count*3),chance=new Float32Array(RAINFALL.count);
 let state=20260611;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<RAINFALL.count;i++){seeds.set([random(),random(),random()],i*3);chance[i]=random();}
 const geometry=gpu?fallingQuads(seeds,chance):new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(seeds,3)).setAttribute('chance',new T.BufferAttribute(chance,1));
 const uniforms={uTime:held(gpu,0),uBox:held(gpu,new T.Vector3(...RAINFALL.box)),uMiddle:held(gpu,new T.Vector3()),uView:held(gpu,new T.Vector2(1,1)),uDepth:{value:null as T.Texture|null},uLight:held(gpu,new T.Color()),...snowRoofs,...sky};
 const material=gpu?streaks(gpu,uniforms,sky):new T.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,defines:sky?{ROOFED:1}:{},
  vertexShader:`attribute float chance;uniform float uTime;uniform vec3 uBox;uniform vec3 uMiddle;uniform vec2 uView;uniform vec4 uSnowCoverA[${SNOW.covers}];uniform vec4 uSnowCoverB[${SNOW.covers}];
   #ifdef ROOFED
   uniform highp sampler3D uSkyReach;uniform vec3 uSkyMin;uniform vec3 uSkyGrid;uniform float uSkyCell;uniform float uSkyLinked;
   #endif
   varying float vAlpha;varying float vAway;varying vec2 vLean;varying float vThin;
   void main(){
    float r=chance,speed=mix(${f(RAINFALL.fall[0])},${f(RAINFALL.fall[1])},r);
    vec3 fallen=vec3(${f(RAINFALL.wind[0])},-speed,${f(RAINFALL.wind[1])});
    vec3 p=position*uBox+fallen*uTime;
    p=uMiddle+mod(p-uMiddle+uBox*0.5,uBox)-uBox*0.5;
    vec3 edge=abs(p-uMiddle)/(uBox*0.5);
    float alpha=${f(RAINFALL.opacity)}*(1.0-smoothstep(0.8,1.0,max(edge.x,max(edge.y,edge.z))));
    for(int k=0;k<${SNOW.covers};k++){vec2 d=p.xz-uSnowCoverA[k].xy;
     if(p.y<uSnowCoverB[k].z&&max(abs(dot(d,uSnowCoverA[k].zw)),abs(dot(d,uSnowCoverB[k].xy)))<1.0)alpha=0.0;}
    #ifdef ROOFED
    vec2 g=(p.xz-uSkyMin.xz)/${f(COVER.cell)};
    if(uSkyLinked>0.5&&all(greaterThan(g,vec2(0.0)))&&all(lessThan(g,uSkyGrid.xz*uSkyCell/${f(COVER.cell)}))){
     ivec2 c=ivec2(g);vec4 t=texelFetch(uSkyReach,ivec3(c.x,c.y>>1,int(uSkyGrid.y)+1),0);
     if(p.y<uSkyMin.y+((c.y&1)==0?t.r:t.g)*uSkyGrid.y*uSkyCell-0.1)alpha=0.0;
    }
    #endif
    // The streak on screen: from the drop to where it was when the shutter opened.
    vec4 mv=viewMatrix*vec4(p,1.0),was=viewMatrix*vec4(p-fallen*${f(RAINFALL.shutter)},1.0);
    float d=max(-mv.z,0.05),scale=uView.y*projectionMatrix[1][1]*0.5;
    vec2 a=mv.xy/d,b=was.xy/max(-was.z,0.05),along=(a-b)*scale;
    float len=max(length(along),1.0),width=max(${f(RAINFALL.width)}*scale/d,1.0);
    vLean=along/len;vThin=width/max(len,width);
    vAlpha=alpha*min(1.0,${f(RAINFALL.width)}*scale/d/1.0+0.25)*smoothstep(0.3,1.2,d);vAway=d;
    gl_PointSize=min(len+width,96.0);
    vec4 mid=vec4((mv.xyz+was.xyz)*0.5,1.0);
    gl_Position=vAlpha<0.004||-mv.z<0.12?vec4(2.0,2.0,2.0,1.0):projectionMatrix*mid;
   }`,
  fragmentShader:`uniform sampler2D uDepth;uniform vec2 uView;uniform vec3 uLight;varying float vAlpha;varying float vAway;varying vec2 vLean;varying float vThin;
   void main(){
    if(vAway>texture2D(uDepth,gl_FragCoord.xy/uView).r)discard;
    vec2 q=(gl_PointCoord-0.5)*vec2(2.0,-2.0);float along=dot(q,vLean),across=abs(q.x*vLean.y-q.y*vLean.x);
    float line=(1.0-smoothstep(vThin*0.5,vThin,across))*(1.0-smoothstep(0.6,1.0,abs(along)));
    if(line<0.01)discard;
    gl_FragColor=vec4(uLight,vAlpha*line);
   }`});
 const points=gpu?new T.Mesh(geometry,material):new T.Points(geometry,material);points.frustumCulled=false;
 const day=new T.Color(.78,.81,.85),night=new T.Color(.28,.31,.38),eye=new T.Vector3();
 return {
  points,
  /** Draws the rain over the frame on the canvas, `seconds` into the fall. `depth`: the scene's, as last drawn, in
   * metres from the camera (post.ts, keepDepth). `daylight` (0–1): pale grey by day, dim at night. */
  draw:(renderer:T.WebGLRenderer,camera:T.Camera,depth:T.Texture,seconds:number,daylight:number)=>{
   camera.getWorldDirection(uniforms.uMiddle.value).multiply(uniforms.uBox.value).multiplyScalar(.4).add(camera.getWorldPosition(eye));
   uniforms.uTime.value=seconds;uniforms.uDepth.value=depth;uniforms.uLight.value.copy(night).lerp(day,daylight);renderer.getDrawingBufferSize(uniforms.uView.value);
   drawOver(renderer,points,camera,gpu);
  },
  dispose:()=>{geometry.dispose();material.dispose();},
 };
}
export type Rainfall=ReturnType<typeof createRainfall>;
