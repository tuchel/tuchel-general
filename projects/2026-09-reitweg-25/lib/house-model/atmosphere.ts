import * as T from 'three';
import {addShaderFeature,after,materialsOf} from './shader-features';
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
