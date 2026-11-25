import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {addShaderFeature,materialsOf} from './shader-features';

/** Fair-weather cumulus on a spring morning (Extreme): a layer from 1,400 to 2,600 m above the house, about a third of
 * the sky covered, drifting east-north-east at 8 m/s while Breeze is on.
 *
 * At that height the lot's 300 m are a pinprick, so the clouds seen from anywhere on it depend only on direction: they
 * are ray-marched once into a sky texture (rebaked a band at a time while they drift, and whenever the sun moves) that the
 * visible sky and the sky light both read. Each pixel marches up to 48 steps through the layer and five toward the sun,
 * with three orders of scattering approximated after Wrenninge (2013). A second texture, 3 km across, holds how much
 * sunlight reaches each point of the ground through the clouds; every lit surface reads it, so cloud shadows cross the
 * fields. Off until the Clouds toggle (More) turns them on, so the sun's light reads alone through the day. */
/** `wind`: the clouds' velocity in metres a second, x east and −z north (from the west-south-west, as on a westerly day). */
export const CLOUDS={base:1400,top:2600,coverage:.36,extinction:.045,wind:[7.4,-3.1] as const,
 /** The sky texture is baked in bands of 64 rows; a new sun re-bakes `perFrame` of them a frame, round the sky in four
  * frames, so dragging the time of day stays smooth. */
 sky:{width:4096,height:1024,band:64,perFrame:4},shadow:{size:512,span:3000},
 /** Where the cloud field starts: the house sits in sunshine. */
 start:[1500,2000] as const};

const NOISE=`
float hash3(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm3(vec3 p,int octaves){float s=0.0,a=0.5;for(int i=0;i<5;i++){if(i>=octaves)break;s+=a*noise3(p);p=p*2.03+vec3(17.1,3.7,9.3);a*=0.5;}return s;}
uniform vec2 uWind;uniform float uCoverage;uniform float uCloudsOn;
const float BASE=${CLOUDS.base.toFixed(1)},TOP=${CLOUDS.top.toFixed(1)};
/** Cloud density (0–1) at a point, metres from the house. Three octaves of value noise sum to about 0.438 ± 0.091
 * (normal); normalised, a cell is cloud where it exceeds the coverage threshold, raised or lowered by a wider field so
 * clouds gather in groups with clear sky between. Taller where the excess is larger; flat bases, narrowing tops. Detail
 * adds the erosion that gives cumulus its cauliflower edge. */
float cloudDensity(vec3 p,bool detail){
 if(uCloudsOn<0.5)return 0.0;
 float h=(p.y-BASE)/(TOP-BASE);if(h<0.0||h>1.0)return 0.0;
 vec3 q=p+vec3(uWind.x,0.0,uWind.y);
 float groups=(fbm3(vec3(q.xz/9000.0,1.7),3)-0.438)/0.091;
 float cells=(fbm3(q/2400.0,3)-0.438)/0.091;
 float excess=cells-(uCoverage-groups*0.35);if(excess<=0.0)return 0.0;
 float top=0.25+0.75*clamp(excess/1.6,0.0,1.0);
 float d=clamp(excess/0.8,0.0,1.0)*smoothstep(0.0,0.05,h)*(1.0-smoothstep(top*0.55,top,h));
 if(detail&&d>0.0)d=clamp(d-(1.0-d)*fbm3(q/280.0+vec3(0.0,h*2.0,0.0),2)*0.8,0.0,1.0);
 return d;
}`;

/** The same for the WebGPU renderer, in WGSL: the field (`field`: the wind's offset, the coverage threshold, clouds on), the
 * sky texture's pixel and the ground's share of sunlight. */
const CLOUDS_WGSL=`
const CLOUD_BASE=${CLOUDS.base.toFixed(1)};const CLOUD_TOP=${CLOUDS.top.toFixed(1)};const CLOUD_EXTINCTION=${CLOUDS.extinction};
fn cloudHash(p0:vec3<f32>)->f32{var p=fract(p0*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
fn cloudNoise(x:vec3<f32>)->f32{let i=floor(x);var f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(cloudHash(i),cloudHash(i+vec3<f32>(1.0,0.0,0.0)),f.x),mix(cloudHash(i+vec3<f32>(0.0,1.0,0.0)),cloudHash(i+vec3<f32>(1.0,1.0,0.0)),f.x),f.y),
  mix(mix(cloudHash(i+vec3<f32>(0.0,0.0,1.0)),cloudHash(i+vec3<f32>(1.0,0.0,1.0)),f.x),mix(cloudHash(i+vec3<f32>(0.0,1.0,1.0)),cloudHash(i+vec3<f32>(1.0,1.0,1.0)),f.x),f.y),f.z);}
fn cloudFbm(p0:vec3<f32>,octaves:i32)->f32{var s=0.0;var a=0.5;var p=p0;for(var i=0;i<octaves;i++){s+=a*cloudNoise(p);p=p*2.03+vec3<f32>(17.1,3.7,9.3);a*=0.5;}return s;}
fn cloudDensity(p:vec3<f32>,detail:bool,field:vec4<f32>)->f32{
 if(field.w<0.5){return 0.0;}
 let h=(p.y-CLOUD_BASE)/(CLOUD_TOP-CLOUD_BASE);if(h<0.0||h>1.0){return 0.0;}
 let q=p+vec3<f32>(field.x,0.0,field.y);
 let groups=(cloudFbm(vec3<f32>(q.xz/9000.0,1.7),3)-0.438)/0.091;
 let cells=(cloudFbm(q/2400.0,3)-0.438)/0.091;
 let excess=cells-(field.z-groups*0.35);if(excess<=0.0){return 0.0;}
 let top=0.25+0.75*clamp(excess/1.6,0.0,1.0);
 var d=clamp(excess/0.8,0.0,1.0)*smoothstep(0.0,0.05,h)*(1.0-smoothstep(top*0.55,top,h));
 if(detail&&d>0.0){d=clamp(d-(1.0-d)*cloudFbm(q/280.0+vec3<f32>(0.0,h*2.0,0.0),2)*0.8,0.0,1.0);}
 return d;
}
fn cloudHg(c:f32,g:f32)->f32{let g2=g*g;return (1.0-g2)/(12.566371*pow(1.0+g2-2.0*g*c,1.5));}
fn cloudSky(at:vec2<f32>,pixel:vec2<f32>,field:vec4<f32>,sun:vec3<f32>,sunLight:vec3<f32>,ambient:vec3<f32>)->vec4<f32>{
 let elevation=asin(clamp(at.y*at.y,0.0,1.0));let azimuth=(at.x-0.5)*6.2831853;
 let dir=vec3<f32>(cos(azimuth)*cos(elevation),sin(elevation),sin(azimuth)*cos(elevation));
 if(dir.y<0.012){return vec4<f32>(0.0,0.0,0.0,1.0);}
 let t0=CLOUD_BASE/dir.y;let t1=min(CLOUD_TOP/dir.y,t0+16000.0);
 if(t0>40000.0){return vec4<f32>(0.0,0.0,0.0,1.0);}
 let stepLength=(t1-t0)/48.0;let jitter=fract(52.9829189*fract(dot(pixel,vec2<f32>(0.06711056,0.00583715))));
 let c=dot(dir,sun);
 var light=vec3<f32>(0.0);var transmittance=1.0;
 for(var i=0;i<48;i++){
  let p=dir*(t0+stepLength*(f32(i)+jitter));
  let d=cloudDensity(p,true,field);if(d<=0.001){continue;}
  var tau=0.0;var ls=60.0;var q=p;
  for(var j=0;j<5;j++){q+=sun*ls;tau+=cloudDensity(q,false,field)*ls;ls*=1.8;}
  tau*=CLOUD_EXTINCTION;
  let sigma=d*CLOUD_EXTINCTION;let h=(p.y-CLOUD_BASE)/(CLOUD_TOP-CLOUD_BASE);
  var lit=vec3<f32>(0.0);var a=1.0;var b=1.0;
  for(var k=0;k<3;k++){lit+=b*mix(cloudHg(c,0.8*a),cloudHg(c,-0.3*a),0.3)*exp(-tau*a)*sunLight;a*=0.5;b*=0.5;}
  let scatter=sigma*(lit+ambient*(0.35+0.65*h)/3.14159265);
  let stepT=exp(-sigma*stepLength);
  light+=transmittance*scatter*(1.0-stepT)/max(sigma,1e-6);transmittance*=stepT;
  if(transmittance<0.01){break;}
 }
 let haze=exp(-t0/26000.0);
 return vec4<f32>(light*haze,mix(1.0,transmittance,haze));
}
fn cloudShade(at:vec2<f32>,field:vec4<f32>,sun:vec3<f32>)->vec4<f32>{
 if(sun.y<0.02){return vec4<f32>(1.0);}
 let ground=vec3<f32>((at.x-0.5)*${CLOUDS.shadow.span.toFixed(1)},0.0,(at.y-0.5)*${CLOUDS.shadow.span.toFixed(1)});
 let t0=CLOUD_BASE/sun.y;let t1=CLOUD_TOP/sun.y;let stepLength=(t1-t0)/16.0;var tau=0.0;
 for(var i=0;i<16;i++){tau+=cloudDensity(ground+sun*(t0+stepLength*(f32(i)+0.5)),false,field)*stepLength;}
 return vec4<f32>(vec3<f32>(exp(-tau*CLOUD_EXTINCTION)),1.0);
}`;

/** The normalised noise level above which a cell is cloud, for a share of the sky covered: the cells and the grouping
 * field add as two normals, the second at 0.35 weight (spread √(1 + 0.35²) ≈ 1.06). */
export function coverageThreshold(share:number){
 // Inverse of the standard normal distribution (Acklam's rational approximation, central region).
 const q=.5-share,r=q*q,z=q*(((((-39.69683028665376*r+220.9460984245205)*r-275.9285104469687)*r+138.357751867269)*r-30.66479806614716)*r+2.506628277459239)/(((((-54.47609879822406*r+161.5858368580409)*r-155.6989798598866)*r+66.80131188771972)*r-13.28068155211544)*r+1);
 return z*Math.hypot(1,.35);
}
/** What the WebGPU renderer draws them with: `three/tsl` and three's node material and full-screen quad. */
export type CloudsGPU={tsl:any;NodeMaterial:new()=>T.Material;QuadMesh:new(material:T.Material)=>{render(renderer:unknown):void}}; // eslint-disable-line @typescript-eslint/no-explicit-any
export function createClouds(renderer:T.WebGLRenderer,gpu?:CloudsGPU){
 const {sky:S,shadow:H}=CLOUDS;
 const wind={value:new T.Vector2(...CLOUDS.start)},coverage={value:coverageThreshold(CLOUDS.coverage)};
 const Target=(gpu?T.RenderTarget:T.WebGLRenderTarget) as typeof T.WebGLRenderTarget,make=(w:number,h:number)=>new Target(w,h,{type:T.HalfFloatType,depthBuffer:false,wrapS:T.RepeatWrapping,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
 const skyTarget=make(S.width,S.height),shadowTarget=make(H.size,H.size),houseTarget=new Target(1,1,{depthBuffer:false});
 shadowTarget.texture.wrapS=T.ClampToEdgeWrapping;
 const on={value:0},common={uWind:wind,uCoverage:coverage,uCloudsOn:on,uSun:{value:new T.Vector3(0,1,0)},uSunLight:{value:new T.Vector3()},uAmbient:{value:new T.Vector3()},uExtinction:{value:CLOUDS.extinction}};
 const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
 // The sky texture: columns are azimuth, rows the square root of the sine of elevation, so the horizon, where clouds
 // stack up and most views see sky, gets most of the rows.
 const skyMaterial=new T.ShaderMaterial({
  uniforms:{...common,uBand:{value:new T.Vector2(0,1)}},vertexShader:vertex,
  fragmentShader:`${NOISE}
   uniform vec3 uSun;uniform vec3 uSunLight;uniform vec3 uAmbient;uniform float uExtinction;uniform vec2 uBand;varying vec2 vUv;
   float hg(float c,float g){float g2=g*g;return (1.0-g2)/(12.566371*pow(1.0+g2-2.0*g*c,1.5));}
   void main(){
    float v=mix(uBand.x,uBand.y,vUv.y),elevation=asin(clamp(v*v,0.0,1.0)),azimuth=(vUv.x-0.5)*6.2831853;
    vec3 dir=vec3(cos(azimuth)*cos(elevation),sin(elevation),sin(azimuth)*cos(elevation));
    if(dir.y<0.012){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
    float t0=BASE/dir.y,t1=min(TOP/dir.y,t0+16000.0);
    if(t0>40000.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
    float stepLength=(t1-t0)/48.0,jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
    float c=dot(dir,uSun),phase=mix(hg(c,0.8),hg(c,-0.3),0.3);
    vec3 light=vec3(0.0);float transmittance=1.0;
    for(int i=0;i<48;i++){
     vec3 p=dir*(t0+stepLength*(float(i)+jitter));
     float d=cloudDensity(p,true);if(d<=0.001)continue;
     // Optical depth toward the sun, five widening steps.
     float tau=0.0,ls=60.0;vec3 q=p;
     for(int j=0;j<5;j++){q+=uSun*ls;tau+=cloudDensity(q,false)*ls;ls*=1.8;}
     tau*=uExtinction;
     float sigma=d*uExtinction,h=(p.y-BASE)/(TOP-BASE);
     vec3 sun=vec3(0.0);float a=1.0,b=1.0;
     for(int k=0;k<3;k++){sun+=b*mix(hg(c,0.8*a),hg(c,-0.3*a),0.3)*exp(-tau*a)*uSunLight;a*=0.5;b*=0.5;}
     // Sky light arrives from all around at about the sky's average radiance (its irradiance over π), less low in the cloud.
     vec3 scatter=sigma*(sun+uAmbient*(0.35+0.65*h)/3.14159265);
     float stepT=exp(-sigma*stepLength);
     light+=transmittance*scatter*(1.0-stepT)/max(sigma,1e-6);transmittance*=stepT;
     if(transmittance<0.01)break;
    }
    // Distant clouds fade into the haze.
    float haze=exp(-t0/26000.0);
    gl_FragColor=vec4(light*haze,mix(1.0,transmittance,haze));
   }`,depthTest:false,depthWrite:false});
 // The shadow texture: sunlight reaching the ground through the layer, for a 3 km square centred on the house.
 const shadowMaterial=new T.ShaderMaterial({
  uniforms:{...common},vertexShader:vertex,
  fragmentShader:`${NOISE}
   uniform vec3 uSun;uniform float uExtinction;varying vec2 vUv;
   void main(){
    if(uSun.y<0.02){gl_FragColor=vec4(1.0);return;}
    vec3 ground=vec3((vUv.x-0.5)*${H.span.toFixed(1)},0.0,(vUv.y-0.5)*${H.span.toFixed(1)});
    float t0=BASE/uSun.y,t1=TOP/uSun.y,stepLength=(t1-t0)/16.0,tau=0.0;
    for(int i=0;i<16;i++)tau+=cloudDensity(ground+uSun*(t0+stepLength*(float(i)+0.5)),false)*stepLength;
    gl_FragColor=vec4(vec3(exp(-tau*uExtinction)),1.0);
   }`,depthTest:false,depthWrite:false});
 // The same two as node materials: the band's rows come from the quad's own coordinate, as above.
 const band2=new T.Vector2(0,1),nodes=()=>{
  const {wgsl,wgslFn,uniform,uv,vec2,vec4,mix,screenCoordinate}=gpu!.tsl,code=wgsl(CLOUDS_WGSL);
  const field=vec4(uniform(wind.value),coverage.value,uniform(0).onRenderUpdate(()=>on.value)),sun=uniform(common.uSun.value),rows=uniform(band2);
  const quad=(fragmentNode:unknown)=>{const m=new gpu!.NodeMaterial();Object.assign(m,{fragmentNode,depthTest:false,depthWrite:false});return new gpu!.QuadMesh(m);};
  return [quad(wgslFn('fn cloudSkyAt(at:vec2<f32>,pixel:vec2<f32>,field:vec4<f32>,sun:vec3<f32>,sunLight:vec3<f32>,ambient:vec3<f32>)->vec4<f32>{return cloudSky(at,pixel,field,sun,sunLight,ambient);}',[code])({at:vec2(uv().x,mix(rows.x,rows.y,uv().y)),pixel:screenCoordinate.xy,field,sun,sunLight:uniform(common.uSunLight.value),ambient:uniform(common.uAmbient.value)})),
   quad(wgslFn('fn cloudShadeAt(at:vec2<f32>,field:vec4<f32>,sun:vec3<f32>)->vec4<f32>{return cloudShade(at,field,sun);}',[code])({at:uv(),field,sun}))];
 };
 const [skyQuad,shadowQuad]:{render(renderer:unknown):void;dispose?():void}[]=gpu?nodes():[new FullScreenQuad(skyMaterial),new FullScreenQuad(shadowMaterial)];
 // Drawn without clearing: the WebGPU renderer would clear the whole texture for one band of it.
 const draw=(quad:{render(renderer:unknown):void},target:T.WebGLRenderTarget)=>{
  const previous=renderer.getRenderTarget(),clears=renderer.autoClear,mapping=renderer.toneMapping,space=renderer.outputColorSpace;
  renderer.autoClear=false;renderer.toneMapping=T.NoToneMapping;renderer.outputColorSpace=T.LinearSRGBColorSpace;
  renderer.setRenderTarget(target);quad.render(renderer);renderer.setRenderTarget(previous);
  renderer.autoClear=clears;renderer.toneMapping=mapping;renderer.outputColorSpace=space;
 };
 const bands=Math.ceil(S.height/S.band);
 // `owed`: bands still to re-bake for a new sun; `drifting`: the wind moved the clouds since the last full round.
 let band=0,owed=bands,drifting=false,lastWind=0;
 const shadowUniforms={uCloudShadow:{value:shadowTarget.texture},uCloudSpan:{value:H.span}};
 const drawBand=()=>{
  const y=band*S.band,h=Math.min(S.band,S.height-y);
  skyMaterial.uniforms.uBand.value.set(y/S.height,(y+h)/S.height);band2.copy(skyMaterial.uniforms.uBand.value);
  skyTarget.viewport.set(0,y,S.width,h);skyTarget.scissor.set(0,y,S.width,h);skyTarget.scissorTest=true;
  draw(skyQuad,skyTarget);skyTarget.scissorTest=false;skyTarget.viewport.set(0,0,S.width,S.height);
  band=(band+1)%bands;
 };
 // The WebGPU renderer reads pixels back later, not at once: the sun's share at the house is read after each new shadow.
 let house=1;
 const drawShadow=()=>{
  draw(shadowQuad,shadowTarget);
  if(gpu&&on.value){draw(shadowQuad,houseTarget);void (renderer as unknown as {readRenderTargetPixelsAsync(t:unknown,x:number,y:number,w:number,h:number):Promise<Uint8Array>}).readRenderTargetPixelsAsync(houseTarget,0,0,1,1).then(data=>{house=data[0]/255;});}
 };
 return {
  sky:skyTarget.texture,
  shadow:shadowTarget.texture,
  /** GLSL for the sky shaders: the clouds' light (rgb) and the sky's transmittance (a) for a direction. */
  sample:`vec4 cloudsToward(vec3 d){if(d.y<=0.0)return vec4(0.0,0.0,0.0,1.0);return texture2D(uClouds,vec2(atan(d.z,d.x)/6.2831853+0.5,sqrt(d.y)));}`,
  /** The same as nodes of `tsl`, for a direction node. */
  toward:(tsl:any,d:any)=>tsl.select(d.y.lessThanEqual(0),tsl.vec4(0,0,0,1),tsl.texture(skyTarget.texture,tsl.vec2(tsl.atan(d.z,d.x).div(Math.PI*2).add(.5),tsl.sqrt(tsl.max(d.y,0))))), // eslint-disable-line @typescript-eslint/no-explicit-any
  /** New sun: direction, irradiance on a surface facing it, and the sky's irradiance (lighting.ts units). */
  setSun:(direction:T.Vector3,sunLight:T.Color,ambient:T.Color)=>{
   common.uSun.value.copy(direction);common.uSunLight.value.set(sunLight.r,sunLight.g,sunLight.b);common.uAmbient.value.set(ambient.r,ambient.g,ambient.b);owed=bands;
  },
  /** Moves the clouds to where the wind has taken them after `seconds` of Breeze. */
  drift:(seconds:number)=>{
   if(Math.abs(seconds-lastWind)<1/30)return;lastWind=seconds;
   // The field is sampled at position + offset, so the clouds travel opposite to the offset's change: with the wind.
   wind.value.set(CLOUDS.start[0]-CLOUDS.wind[0]*seconds,CLOUDS.start[1]-CLOUDS.wind[1]*seconds);if(on.value)drifting=true;
  },
  /** Draws up to `count` bands of the sky texture after a new sun (one while the clouds drift) and the shadow texture;
   * true when anything changed. */
  update:(count=1)=>{
   if(!owed&&!drifting)return false;
   for(let i=Math.min(Math.max(1,count),owed||1);i>0;i--){drawBand();owed=Math.max(0,owed-1);}
   drawShadow();if(!owed&&band===0)drifting=false;return true;
  },
  /** A new sun's sky is still being baked. */
  get baking(){return owed>0;},
  get enabled(){return on.value>0;},
  /** Shows or clears the clouds; the sky and the shadow re-bake as for a new sun. True when that is a change. */
  setEnabled:(value:boolean)=>{if(value===on.value>0)return false;on.value=value?1:0;owed=bands;drifting=false;return true;},
  /** Sunlight reaching the house through the clouds (0–1), for the path tracer's sun. */
  atHouse:()=>{
   if(!on.value)return 1;
   if(gpu)return house;
   // One byte-format pixel at the centre of the square: readable on every device, unlike half floats.
   const previous=renderer.getRenderTarget(),data=new Uint8Array(4);
   renderer.setRenderTarget(houseTarget);shadowQuad.render(renderer);renderer.readRenderTargetPixels(houseTarget,0,0,1,1,data);renderer.setRenderTarget(previous);
   return data[0]/255;
  },
  /** Shades the sun on every lit material under `roots` by the cloud shadow. */
  shade:(roots:T.Object3D[])=>{
   const done=new Set<T.Material>();
   for(const root of roots)root.traverse(o=>{for(const m of materialsOf(o)){
    if(done.has(m)||!(m instanceof T.MeshStandardMaterial))continue;done.add(m);
    addShaderFeature(m,{key:'cloud-shadow',compile:shader=>{
     Object.assign(shader.uniforms,shadowUniforms);
     shader.vertexShader='varying vec3 vCloudWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 cloudWorld=vec4(transformed,1.0);
      #ifdef USE_BATCHING
       cloudWorld=batchingMatrix*cloudWorld;
      #endif
      #ifdef USE_INSTANCING
       cloudWorld=instanceMatrix*cloudWorld;
      #endif
      vCloudWorld=(modelMatrix*cloudWorld).xyz;`);
     const chunk=T.ShaderChunk.lights_fragment_begin,anchor='getDirectionalLightInfo( directionalLight, directLight );';
     if(!chunk.includes(anchor))throw new Error('lights_fragment_begin has no directional light step');
     shader.fragmentShader='uniform sampler2D uCloudShadow;uniform float uCloudSpan;varying vec3 vCloudWorld;\n'+shader.fragmentShader.replace('#include <lights_fragment_begin>',
      chunk.replace(anchor,anchor+'\ndirectLight.color*=texture2D(uCloudShadow,vCloudWorld.xz/uCloudSpan+0.5).r;'));
    },variant:'',nodes:slots=>{const {texture,positionWorld}=slots.tsl,share=texture(shadowTarget.texture,positionWorld.xz.div(H.span).add(.5)).r;slots.sunlight=slots.sunlight?slots.sunlight.mul(share):share;}});
   }});
  },
  dispose:()=>{skyTarget.dispose();shadowTarget.dispose();houseTarget.dispose();skyMaterial.dispose();shadowMaterial.dispose();skyQuad.dispose?.();shadowQuad.dispose?.();},
 };
}
export type Clouds=ReturnType<typeof createClouds>;
