import * as T from 'three';
import {addShaderFeature,after,materialsOf} from './shader-features';

/** Optional motion and sound. Leaves and grass sway in the vertex shader; the same
 * displacement drives their shadow depth so shadows move with them. */
const legacy:Record<string,'leaf'|'grass'>={'meadow-grass':'grass','meadow-flowers':'grass','entrance-arching-ornamental-grasses':'grass'};
export function atmosphere(root:T.Object3D){
 const clock={value:0},strength={value:0};
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
 let audio:AudioContext|undefined,source:AudioBufferSourceNode|undefined;
 return {
  tick:(seconds:number)=>{clock.value=seconds;},
  breeze:(on:boolean)=>{strength.value=on?1:0;},
  get breezing(){return strength.value>0;},
  sound:async(on:boolean)=>{
   if(!on){if(audio?.state==='running')await audio.suspend();return;}
   if(!audio){
    // Designed garden ambience: filtered brown noise, not a site recording.
    audio=new AudioContext();const buffer=audio.createBuffer(1,audio.sampleRate*8,audio.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+Math.random()*.035-.0175)*.995;data[i]=last;}
    source=audio.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;const gain=audio.createGain();gain.gain.value=.16;
    source.connect(filter).connect(gain).connect(audio.destination);source.start();
   }
   await audio.resume();
  },
  dispose:()=>{source?.stop();void audio?.close();},
 };
}
