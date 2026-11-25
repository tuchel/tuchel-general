import * as T from 'three';
import {addShaderFeature,after,materialsOf,type NodeSlots} from './shader-features';
import {springMorning} from './garden-sound';

/** Optional motion and sound. Leaves and grass sway in the vertex shader; the same
 * displacement drives their shadow depth so shadows move with them. */
const legacy:Record<string,'leaf'|'grass'>={'meadow-grass':'grass','meadow-flowers':'grass','entrance-arching-ornamental-grasses':'grass'};
/** In Extreme the air stirs while the camera moves (viewer.ts): up to full over `rise` s, and down to rest over `fall` s
 * once it stops, after which the view sharpens and is path-traced as it always was. */
export const STIR={rise:1.5,fall:.8};
export function atmosphere(root:T.Object3D){
 const clock={value:0},strength={value:0};let on=false,stirred=0;
 // One breeze per material: a material shared by leaves and grass would otherwise declare it twice.
 const feature=(sway:'leaf'|'grass')=>({key:'breeze',compile:(shader:T.WebGLProgramParametersWithUniforms)=>{
  shader.uniforms.uBreezeTime=clock;shader.uniforms.uBreezeStrength=strength;
  shader.vertexShader='uniform float uBreezeTime;uniform float uBreezeStrength;\n'+after(shader.vertexShader,'begin_vertex',`
   #ifdef USE_INSTANCING
    vec3 breezeOrigin=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
   #else
    vec3 breezeOrigin=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
   #endif
   float breezePhase=breezeOrigin.x*.31+breezeOrigin.z*.23+position.x*.6+position.z*.45;
   float breezeGust=.7+.3*sin(uBreezeTime*.37+breezePhase*.22);
   float breezeSway=sin(uBreezeTime*.85+breezePhase)*.7+sin(uBreezeTime*1.63+breezePhase*.61)*.3;
   float breezeAnchor=${sway==='leaf'?'smoothstep(1.5,9.0,position.y)*.09':'pow(clamp(position.y,0.0,1.0),1.4)*.12'};
   float breezeAmount=uBreezeStrength*breezeGust*breezeAnchor;
   transformed.x+=breezeAmount*breezeSway;
   transformed.z+=breezeAmount*.6*sin(uBreezeTime*.69+breezePhase);`);
 },nodes:(slots:NodeSlots)=>{
  // The same as nodes. An instance's place in the row stands in for where it stands, to set each plant's own beat.
  const {uniform,vec3,float,sin,smoothstep,pow,clamp,positionLocal,positionGeometry,modelWorldMatrix,instanceIndex}=slots.tsl;
  const time=uniform(0).onRenderUpdate(()=>clock.value),blow=uniform(0).onRenderUpdate(()=>strength.value),p=positionGeometry;
  const phase=modelWorldMatrix.element(3).x.mul(.31).add(modelWorldMatrix.element(3).z.mul(.23)).add(float(instanceIndex).mul(1.7)).add(p.x.mul(.6)).add(p.z.mul(.45));
  const gust=sin(time.mul(.37).add(phase.mul(.22))).mul(.3).add(.7),swing=sin(time.mul(.85).add(phase)).mul(.7).add(sin(time.mul(1.63).add(phase.mul(.61))).mul(.3));
  const anchor=sway==='leaf'?smoothstep(1.5,9,p.y).mul(.09):pow(clamp(p.y,0,1),1.4).mul(.12),amount=blow.mul(gust).mul(anchor);
  slots.position=(slots.position??positionLocal).add(vec3(amount.mul(swing),0,amount.mul(.6).mul(sin(time.mul(.69).add(phase)))));
 }});
 root.traverse(o=>{
  const sway=(o.userData.sway||legacy[o.name]) as 'leaf'|'grass'|undefined;
  if(!sway)return;
  for(const m of [...materialsOf(o),...(o instanceof T.Mesh&&o.customDepthMaterial?[o.customDepthMaterial]:[])])if(!m.userData.shaderFeatures?.some((f:{key:string})=>f.key==='breeze'))addShaderFeature(m,feature(sway));
 });
 let audio:AudioContext|undefined,garden:ReturnType<typeof springMorning>|undefined;
 return {
  tick:(seconds:number)=>{clock.value=seconds;},
  breeze:(to:boolean)=>{on=to;strength.value=Math.max(on?1:0,stirred);},
  /** `level` (0–1): how much the air moves without the Breeze switch. */
  stir:(level:number)=>{stirred=level;strength.value=Math.max(on?1:0,stirred);},
  get breezing(){return strength.value>0;},
  sound:async(on:boolean)=>{
   if(!on){if(audio?.state==='running')await audio.suspend();return;}
   // A designed spring morning (garden-sound.ts): wind, bees and birdsong, not a site recording.
   if(!audio){audio=new AudioContext();garden=springMorning(audio);garden.start();}
   await audio.resume();
  },
  dispose:()=>{garden?.stop();void audio?.close();},
 };
}
