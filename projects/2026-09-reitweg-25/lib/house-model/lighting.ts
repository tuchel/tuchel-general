import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {sunStudyReading,sunDirection,type SunStudy} from './sun-position';

/** One sky drives everything: the visible sky, image-based light and reflections,
 * sun colour and strength, haze and exposure. Sky scattering follows three's
 * Preetham sky (r186); direct sunlight uses Kasten–Young air mass extinction. */
export const SKY={turbidity:3,rayleigh:1.4,mie:.005,g:.8,clouds:.22};
const totalRayleigh=[5.804542996261093e-6,1.3562911419845635e-5,3.0265902468824876e-5];
const mieConst=[1.8399918514433978e14,2.7798023919660528e14,4.0790479543861094e14];
const clamp=T.MathUtils.clamp;

/** Linear sky radiance for a direction, excluding sun disc and clouds (a port of Sky.SkyShader). */
/** A deep blue night sky; the Preetham model alone fades to grey. Shared with the sky shader. */
const NIGHT=[.0006,.0012,.003];
const nightSky=`texColor+=vec3(${NIGHT.join(',')})*(1.0-smoothstep(-0.1,0.05,vSunDirection.y));`;
export function skyRadiance(dir:T.Vector3,sun:T.Vector3,out=new T.Color()){
 const night=1-T.MathUtils.smoothstep(sun.y,-.1,.05);
 const sunE=1000*Math.max(0,1-Math.exp(-((1.6110731556870734-Math.acos(clamp(sun.y,-1,1)))/1.5)));
 const zenith=Math.acos(Math.max(0,dir.y)),inverse=1/(Math.cos(zenith)+.15*Math.pow(93.885-zenith*180/Math.PI,-1.253));
 const cosT=dir.dot(sun),rPhase=3/(16*Math.PI)*(1+Math.pow(cosT*.5+.5,2)),g2=SKY.g*SKY.g;
 const mPhase=(1-g2)/(4*Math.PI*Math.pow(1-2*SKY.g*cosT+g2,1.5)),fade=clamp(Math.pow(1-sun.y,5),0,1);
 const c=[0,1,2].map(i=>{
  const bR=totalRayleigh[i]*SKY.rayleigh,bM=.434*(.2*SKY.turbidity*10e-18)*mieConst[i]*SKY.mie;
  const fex=Math.exp(-(bR*8.4e3*inverse+bM*1.25e3*inverse)),ratio=(bR*rPhase+bM*mPhase)/(bR+bM);
  const lin=Math.pow(sunE*ratio*(1-fex),1.5)*((1-fade)+fade*Math.pow(sunE*ratio*fex,.5));
  return (lin+.1*fex)*.04+[0,.0003,.00075][i]+NIGHT[i]*night;
 });
 return out.setRGB(c[0],c[1],c[2]);
}
/** Cosine-weighted sky irradiance on a horizontal surface. */
const hemisphere=Array.from({length:96},(_,i)=>{const y=1-(i+.5)/96,r=Math.sqrt(1-y*y),a=i*2.399963;return new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);});
export function skyIrradiance(sun:T.Vector3){
 const sum=new T.Color(),c=new T.Color();
 for(const d of hemisphere)sum.add(skyRadiance(d,sun,c).multiplyScalar(d.y));
 return sum.multiplyScalar(2*Math.PI/hemisphere.length);
}
/** Direct sun transmittance per channel from air mass (Kasten & Young 1989). */
export function sunTransmittance(elevation:number){
 if(elevation<-.833)return new T.Color(0,0,0);
 const h=Math.max(elevation,-.5),mass=1/(Math.sin(h*Math.PI/180)+.50572*Math.pow(h+6.07995,-1.6364));
 return new T.Color(Math.exp(-.14*mass),Math.exp(-.22*mass),Math.exp(-.38*mass));
}
const luminance=(c:T.Color)=>.2126*c.r+.7152*c.g+.0722*c.b;
const NOON=new T.Vector3(...sunDirection(171,65)).normalize(),noonSky=luminance(skyIrradiance(NOON));
const noonSun=luminance(sunTransmittance(65));
/** Sun strength in sky units: 4:1 direct to diffuse on a horizontal surface at a June noon. */
const SUN_SCALE=4*noonSky/(noonSun*Math.sin(65*Math.PI/180));
const NOON_KEY=noonSky*5;
/** Exposure that places an 18% grey card at 0.25 linear under the June noon key. */
const NOON_EXPOSURE=.25/(.18/Math.PI*NOON_KEY);

/** Rooms are exposed up to about two and a half stops brighter than outdoors, as a photographer would, by how little sky
 * the camera sees (walk.ts): 5.5× in a closed room, so white walls read white, easing to 1× once a fifth of the sky is
 * open, so a terrace or the eaves are exposed as outdoors. */
const ROOM_BOOST=4.5;
export const roomExposure=(openness:number)=>1+ROOM_BOOST*(1-T.MathUtils.smoothstep(openness,.03,.2));
/** How far indoors a room exposure puts the camera: 0 outdoors, 1 in a closed room (the interior finish, look.ts). */
export const indoorOf=(room:number)=>T.MathUtils.clamp((room-1)/ROOM_BOOST,0,1);
export type LightReading=ReturnType<typeof sunStudyReading>&{exposure:number;dusk:number;daylight:number;key:number};
export function createLighting(renderer:T.WebGLRenderer,scene:T.Scene,root:T.Object3D,options:{shadowSize:number}){
 const sky=new Sky();sky.name='calculated-sun-sky';sky.userData.skipPhotographic=true;sky.scale.setScalar(20000);sky.frustumCulled=false;scene.add(sky);
 const envSky=new Sky();envSky.scale.setScalar(20000);const envScene=new T.Scene();envScene.add(envSky);
 // Image light: skylight is less saturated than the visible sky, and the ground below the
 // horizon returns neutral bounce light (lawn, paving and floors averaged) instead of Preetham's dark lower sphere.
 const ground={value:new T.Color()},saturation={value:.55};
 for(const [s,disc] of [[sky,1],[envSky,0]] as const){
  const env=disc===0;
  s.material.onBeforeCompile=shader=>{
   if(env){shader.uniforms.uGround=ground;shader.uniforms.uEnvSaturation=saturation;shader.fragmentShader='uniform vec3 uGround;uniform float uEnvSaturation;\n'+shader.fragmentShader;}
   shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );',nightSky+(env?'\ntexColor=mix(vec3(dot(texColor,vec3(0.2126,0.7152,0.0722))),texColor,uEnvSaturation);texColor=mix(texColor,uGround,smoothstep(0.0,-0.06,direction.y));':'')+'\ngl_FragColor = vec4( texColor, 1.0 );');
  };
  s.material.customProgramCacheKey=()=>env?'reitweg-env-sky':'reitweg-sky';
  const u=s.material.uniforms;u.turbidity.value=SKY.turbidity;u.rayleigh.value=SKY.rayleigh;u.mieCoefficient.value=SKY.mie;u.mieDirectionalG.value=SKY.g;u.showSunDisc.value=disc;u.cloudCoverage.value=SKY.clouds;u.cloudDensity.value=.35;}
 const cubeTarget=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType}),cubeCamera=new T.CubeCamera(.1,40000,cubeTarget);
 const pmrem=new T.PMREMGenerator(renderer);let envTarget:T.WebGLRenderTarget|null=null,envDirty=true,envAt=0;
 const sun=new T.DirectionalLight('#fff4de',3);sun.name='sun';sun.castShadow=true;
 sun.shadow.mapSize.set(options.shadowSize,options.shadowSize);sun.shadow.radius=2.2;sun.shadow.blurSamples=12;
 scene.add(sun,sun.target);
 scene.fog=new T.Fog('#dce4e2',140,460);
 // Interior lamps: recessed ceiling lights and lamp discs, on as daylight fades.
 const lamps=new T.Group();lamps.name='evening-interior-light';root.add(lamps);
 for(const [x,y,z] of [[-2.2,2.66,5],[2.3,2.66,5],[-2.2,2.66,8.3],[2.3,2.66,8.3],[3,2.45,1.7],[-4,2.45,-5.4],[-14,2.35,4.4],[-22,2.4,15]]){
  const light=new T.SpotLight('#ffd9a8',0,11,Math.PI*.42,.75,2);light.position.set(x,y,z);light.target.position.set(x,0,z);lamps.add(light,light.target);
 }
 lamps.visible=false;
 const lampMaterials:T.MeshStandardMaterial[]=[],lines:{material:T.LineBasicMaterial;base:T.Color}[]=[],backdrops:T.MeshBasicMaterial[]=[];
 root.traverse(o=>{
  const mats=(o as T.Mesh).material?(Array.isArray((o as T.Mesh).material)?(o as T.Mesh).material as T.Material[]:[(o as T.Mesh).material as T.Material]):[];
  for(const m of mats){
   if(m instanceof T.MeshStandardMaterial&&m.userData.lamp&&!lampMaterials.includes(m))lampMaterials.push(m);
   if(m instanceof T.LineBasicMaterial&&!lines.some(l=>l.material===m))lines.push({material:m,base:m.color.clone()});
   if(o.userData.scenicBackdrop&&m instanceof T.MeshBasicMaterial&&!backdrops.includes(m))backdrops.push(m);
  }
 });
 const sunVector=new T.Vector3(),horizon=new T.Color(),view=new T.Vector3(),probe=new T.Vector3();
 let reading:LightReading|undefined,room=1,viewAzimuth=NaN;
 const updateFog=(azimuth:number)=>{
  if(!scene.fog)return;viewAzimuth=azimuth;
  probe.set(Math.cos(azimuth),.035,Math.sin(azimuth)).normalize();
  skyRadiance(probe,sunVector,horizon);scene.fog.color.copy(horizon);
  // Distant ridges sit a little lighter than the sky behind them, as in the owner's photographs.
  const peak=Math.max(horizon.r,horizon.g,horizon.b,1e-6);
  for(const m of backdrops)m.color.setRGB(horizon.r*1.12/peak,horizon.g*1.12/peak,horizon.b*1.12/peak).multiplyScalar(peak*1.05);
 };
 const apply=(study:SunStudy):LightReading=>{
  const r=sunStudyReading(study);
  sunVector.set(...sunDirection(r.azimuth,r.apparentElevation)).normalize();
  for(const s of [sky,envSky])s.material.uniforms.sunPosition.value.copy(sunVector);
  const transmittance=sunTransmittance(r.apparentElevation),strength=SUN_SCALE*luminance(transmittance);
  const peak=Math.max(transmittance.r,transmittance.g,transmittance.b,1e-6);
  sun.color.setRGB(transmittance.r/peak,transmittance.g/peak,transmittance.b/peak);
  sun.intensity=strength*T.MathUtils.smoothstep(r.apparentElevation,-.833,1.5);
  sun.position.copy(sun.target.position).addScaledVector(sunVector,160);
  sun.visible=sun.intensity>0;
  const irradiance=luminance(skyIrradiance(sunVector)),key=irradiance+sun.intensity*Math.max(0,sunVector.y);
  // Lawn, paving and planting average to a mid-dark, green-leaning albedo.
  ground.value.setRGB(.15,.145,.13).multiplyScalar(key/Math.PI);
  // Partial adaptation: dusk reads as dusk, night stays legible.
  const exposure=clamp(NOON_EXPOSURE*Math.pow(NOON_KEY/Math.max(key,1e-6),.72),.02,30);
  const daylight=T.MathUtils.smoothstep(r.elevation,-8,10),dusk=1-T.MathUtils.smoothstep(r.elevation,-3,7);
  lamps.visible=dusk>.02;
  // Interior lamps light a floor to roughly 0.3% of the noon key, like 300 lux against 100 klx.
  for(const o of lamps.children)if(o instanceof T.SpotLight)o.intensity=dusk*1.6;
  for(const m of lampMaterials){m.emissiveIntensity=dusk*3;}
  for(const {material,base} of lines)material.color.copy(base).multiplyScalar(clamp(Math.pow(key/NOON_KEY,.3),.03,1)*NOON_EXPOSURE/exposure);
  reading={...r,exposure,dusk,daylight,key};
  envDirty=true;renderer.shadowMap.needsUpdate=true;
  updateFog(Number.isFinite(viewAzimuth)?viewAzimuth:0);
  return reading;
 };
 const refreshEnvironment=()=>{
  cubeCamera.update(renderer,envScene);
  envTarget=pmrem.fromCubemap(cubeTarget.texture,envTarget);
  scene.environment=envTarget.texture;scene.environmentIntensity=1;envDirty=false;
 };
 const fitShadow=(center:T.Vector3,radius:number)=>{
  const cam=sun.shadow.camera;sun.target.position.copy(center);sun.target.updateMatrixWorld();
  sun.position.copy(center).addScaledVector(sunVector,radius*2.4+60);
  Object.assign(cam,{left:-radius,right:radius,top:radius,bottom:-radius,near:1,far:radius*4.8+120});cam.updateProjectionMatrix();
  const texel=radius*2/sun.shadow.mapSize.x;sun.shadow.normalBias=texel*1.6;sun.shadow.bias=-texel*.02;
  renderer.shadowMap.needsUpdate=true;
 };
 return {
  sun,sky,lamps,apply,fitShadow,
  get reading(){return reading;},
  get exposure(){return (reading?.exposure??1)*room;},
  /** Extra exposure for where the camera stands (roomExposure). */
  setRoom:(value:number)=>{room=value;},
  /** Keeps haze matched to the horizon the camera faces; regenerates sky light when the sun moves. */
  update:(camera:T.Camera,now:number)=>{
   camera.getWorldDirection(view);const azimuth=Math.atan2(view.z,view.x);
   let changed=false;
   if(!Number.isFinite(viewAzimuth)||Math.abs(Math.atan2(Math.sin(azimuth-viewAzimuth),Math.cos(azimuth-viewAzimuth)))>.03){updateFog(azimuth);changed=true;}
   if(envDirty&&now-envAt>140){envAt=now;refreshEnvironment();changed=true;}
   return changed;
  },
  get envPending(){return envDirty;},
  /** The sky without its sun disc as a float equirectangular texture, for the path tracer. */
  equirect:(width=1024)=>{
   cubeCamera.update(renderer,envScene);
   const height=width/2,target=new T.WebGLRenderTarget(width,height,{type:T.FloatType,depthBuffer:false});
   const material=new T.ShaderMaterial({uniforms:{cube:{value:cubeTarget.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:'uniform samplerCube cube;varying vec2 vUv;void main(){float phi=(vUv.x-0.5)*6.283185307;float theta=(vUv.y-0.5)*3.141592654;vec3 d=vec3(cos(phi)*cos(theta),sin(theta),sin(phi)*cos(theta));gl_FragColor=vec4(textureCube(cube,d).rgb,1.0);}'});
   const quad=new FullScreenQuad(material),previous=renderer.getRenderTarget();
   renderer.setRenderTarget(target);quad.render(renderer);renderer.setRenderTarget(previous);
   const data=new Float32Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,data);
   target.dispose();material.dispose();quad.dispose();
   const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;
   return texture;
  },
  dispose:()=>{sky.geometry.dispose();sky.material.dispose();envSky.geometry.dispose();envSky.material.dispose();sky.removeFromParent();cubeTarget.dispose();envTarget?.dispose();pmrem.dispose();lamps.removeFromParent();scene.remove(sun,sun.target);},
 };
}
export type Lighting=ReturnType<typeof createLighting>;
