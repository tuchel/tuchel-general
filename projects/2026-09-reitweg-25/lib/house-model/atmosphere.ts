import * as T from 'three';
import type {Mood} from './experience-data';
export function atmosphere(root:T.Object3D,scene:T.Scene,sun:T.DirectionalLight,hemisphere:T.HemisphereLight,renderer:T.WebGLRenderer){
 const clock={value:0},strength={value:0};const seen=new Set<T.Material>();
 root.traverse(o=>{
  if(!(o instanceof T.InstancedMesh))return;
  const leaf=o.name==='individual-tree-leaves',grass=['meadow-grass','meadow-flowers','entrance-arching-ornamental-grasses'].includes(o.name);
  if(!leaf&&!grass)return;
  for(const mat of Array.isArray(o.material)?o.material:[o.material]){
   if(seen.has(mat)||!(mat instanceof T.MeshStandardMaterial))continue;seen.add(mat);
   const previous=mat.onBeforeCompile,cache=mat.customProgramCacheKey();
   mat.onBeforeCompile=(shader,renderer)=>{previous.call(mat,shader,renderer);shader.uniforms.uBreezeTime=clock;shader.uniforms.uBreezeStrength=strength;
    shader.vertexShader='uniform float uBreezeTime;uniform float uBreezeStrength;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     #ifdef USE_INSTANCING
     vec3 breezeOrigin=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
     float phase=breezeOrigin.x*.31+breezeOrigin.z*.23;
     float proximity=1.0-smoothstep(35.0,100.0,distance(cameraPosition,breezeOrigin));
     float gust=.7+.3*sin(uBreezeTime*.37+phase*.22);
     float sway=sin(uBreezeTime*.85+phase)*.7+sin(uBreezeTime*1.63+phase*.61)*.3;
     float anchor=${leaf?'1.0':'pow(clamp(position.y,0.0,1.0),1.4)'};
     float amplitude=uBreezeStrength*proximity*gust*anchor;
     transformed.x+=amplitude*sway*${leaf?'.055/max(length(instanceMatrix[0].xyz),.03)':'.12'};
     transformed.z+=amplitude*sin(uBreezeTime*.69+phase)*${leaf?'.035/max(length(instanceMatrix[2].xyz),.03)':'.07'};
     ${leaf?'transformed.y+=sin(uBreezeTime*2.1+phase)*amplitude*.008/max(length(instanceMatrix[1].xyz),.03);':''}
     #endif`);
   };mat.customProgramCacheKey=()=>cache+'-gentle-breeze-v2';mat.needsUpdate=true;
  }
 });
 const warm=new T.Group();warm.name='evening-interior-light';root.add(warm);
 for(const [x,y,z] of [[-2.2,2.66,5],[2.3,2.66,5],[-2.2,2.66,8.3],[2.3,2.66,8.3],[3,2.45,1.7],[-4,2.45,-5.4],[-14,2.35,4.4],[-22,2.4,15]]){const light=new T.SpotLight('#ffe4ba',25,12,Math.PI*.44,.7,2);light.position.set(x,y,z);light.target.position.set(x,0,z);warm.add(light,light.target);}
 let audio:AudioContext|undefined,gain:GainNode|undefined,source:AudioBufferSourceNode|undefined;
 return {tick:(seconds:number)=>{clock.value=seconds;},breeze:(on:boolean)=>{strength.value=on?1:0;},mood:(mood:Mood)=>{
  const evening=mood==='evening',soft=mood==='overcast';sun.position.set(...(evening?[-68,15,25]:[-42,61,41]) as [number,number,number]);sun.color.set(evening?'#ffbf77':soft?'#edf2ff':'#fff4de');sun.intensity=evening?1.8:soft?.35:3.3;hemisphere.intensity=evening?.16:soft?.8:.35;hemisphere.color.set(evening?'#a9b9dc':'#eff6ff');scene.environmentIntensity=evening?.06:soft?.2:.12;scene.backgroundIntensity=evening?.045:soft?.14:.12;renderer.toneMappingExposure=evening?.95:.82;warm.children.forEach(o=>{if(o instanceof T.Light)o.intensity=evening?80:25;});root.traverse(o=>{if(o instanceof T.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m instanceof T.MeshStandardMaterial&&m.emissive.getHex()!==0)m.emissiveIntensity=evening?3:0;}});
 },sound:async(on:boolean)=>{if(!on){if(audio?.state==='running')await audio.suspend();return;}if(!audio){audio=new AudioContext();const buffer=audio.createBuffer(1,audio.sampleRate*8,audio.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.035-.0175)*.995;data[i]=last;}source=audio.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;gain=audio.createGain();gain.gain.value=.16;source.connect(filter).connect(gain).connect(audio.destination);source.start();}await audio.resume();},dispose:()=>{source?.stop();void audio?.close();}};
}
