import * as T from 'three';

/** Smoke from the living room's chimney while snow lies (Extreme): the fire is lit. `puffs` soft discs rise from the
 * chimney's mouth at `rise` m/s, lean with the wind (`wind`, m/s east and south, the snow's own), swell from
 * `size[0]` to `size[1]` m over `life` s and thin away. Drawn over the finished image like the snow, behind whatever
 * the scene's depth says is nearer. */
export const SMOKE={puffs:44,life:9,rise:1.3,wind:[.35,.12],size:[.45,3.2],opacity:.45,day:[.78,.78,.8],night:[.2,.21,.25]};
/** The boiler's flue gas at the north gable's black pipe, while rain or snow falls or snow lies: white vapour, a
 * narrower and shorter plume than the fire's, gone within a few metres. */
export const FLUE_VAPOUR:typeof SMOKE={puffs:26,life:4.5,rise:1.1,wind:[.35,.12],size:[.22,1.5],opacity:.34,day:[.93,.94,.95],night:[.26,.27,.31]};
const f=(v:number)=>v.toFixed(3);

export function createSmoke(mouth:T.Vector3,look=SMOKE){
 const quad=new T.PlaneGeometry(1,1),geometry=new T.InstancedBufferGeometry();
 geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));geometry.setAttribute('uv',quad.getAttribute('uv'));
 const seed=new Float32Array(look.puffs*2);let state=7919;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<look.puffs;i++)seed.set([(i+random())/look.puffs,random()],i*2);
 geometry.setAttribute('seed',new T.InstancedBufferAttribute(seed,2));geometry.instanceCount=look.puffs;
 const uniforms={uTime:{value:0},uMouth:{value:mouth.clone()},uView:{value:new T.Vector2(1,1)},uDepth:{value:null as T.Texture|null},uLight:{value:new T.Color()},uAmount:{value:1}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:`attribute vec2 seed;uniform float uTime;uniform vec3 uMouth;varying vec2 vUv;varying float vAlpha;varying float vAway;varying float vSeed;
   void main(){
    float age=fract(uTime/${f(look.life)}+seed.x),t=age*${f(look.life)},turn=seed.y*6.283;
    // It leaves the mouth fast and slows; the wind takes it more the higher it is.
    vec3 p=uMouth+vec3(0.0,${f(look.rise)}*t*(1.0-0.35*age),0.0)+vec3(${f(look.wind[0])},0.0,${f(look.wind[1])})*t*age*1.6
     +vec3(sin(turn+t*0.7),0.0,cos(turn*1.3+t*0.5))*0.22*t*0.3;
    float size=mix(${f(look.size[0])},${f(look.size[1])},pow(age,0.7));
    vec4 mv=viewMatrix*vec4(p,1.0);mv.xy+=position.xy*size;
    vUv=uv;vSeed=seed.y;vAway=-mv.z;
    vAlpha=${f(look.opacity)}*smoothstep(0.0,0.06,age)*(1.0-smoothstep(0.35,1.0,age));
    gl_Position=projectionMatrix*mv;
   }`,
  fragmentShader:`uniform sampler2D uDepth;uniform vec2 uView;uniform vec3 uLight;uniform float uAmount;varying vec2 vUv;varying float vAlpha;varying float vAway;varying float vSeed;
   float hash(vec2 c){vec3 p=fract(vec3(c.xyx)*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   float noise(vec2 g){vec2 i=floor(g),f=g-i;f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
   void main(){
    float behind=texture2D(uDepth,gl_FragCoord.xy/uView).r-vAway;if(behind<0.0)discard;
    vec2 q=vUv*2.0-1.0;float r=length(q)+0.35*(noise(q*2.3+vSeed*17.0)-0.5);
    float a=vAlpha*uAmount*(1.0-smoothstep(0.25,1.0,r))*smoothstep(0.0,0.5,behind);
    if(a<0.003)discard;
    gl_FragColor=vec4(uLight*(0.85+0.3*noise(q*3.1+vSeed*5.0)),a);
   }`});
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;
 const day=new T.Color(...look.day),night=new T.Color(...look.night);
 return {
  mesh,
  /** Draws the smoke over the frame on the canvas, `seconds` on. `depth`: the scene's, in metres from the camera;
   * `daylight` (0–1); `amount` (0–1): how much of it there is. */
  draw:(renderer:T.WebGLRenderer,camera:T.Camera,depth:T.Texture,seconds:number,daylight:number,amount:number)=>{
   uniforms.uTime.value=seconds;uniforms.uDepth.value=depth;uniforms.uLight.value.copy(night).lerp(day,daylight);uniforms.uAmount.value=amount;renderer.getDrawingBufferSize(uniforms.uView.value);
   const clear=renderer.autoClear;renderer.autoClear=false;renderer.setRenderTarget(null);renderer.render(mesh,camera);renderer.autoClear=clear;
  },
  dispose:()=>{geometry.dispose();quad.dispose();material.dispose();},
 };
}
export type Smoke=ReturnType<typeof createSmoke>;
