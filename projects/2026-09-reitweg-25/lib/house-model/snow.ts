import * as T from 'three';
import {addShaderFeature,after,before,hasShaderFeature,materialsOf} from './shader-features';
import {COVER} from './sky-links';
import {GARAGE,BIN_ROOM,garagePoint} from './front-garage';
import {winterGardenOutline,WG_GLASS_EDGE} from './renovations';
import type {RenovationState} from './renovation-data';

export {SNOW_SEASON,snowOn} from './snow-season';
/** How lying snow looks (when it lies: snow-season.ts). `slope`: how fast it thins as a surface steepens (it holds to
 * about 50°); `albedo`: fresh snow, a little blue; `shade`: what it does to sky and bounced light, so its shadows read
 * blue; `covers`: how many roofs can keep it off what they cover (snowCovers). */
export const SNOW={slope:2,albedo:[.9,.93,.97],shade:[.9,.96,1.08],covers:4};

/** Where a roof the sky light's grid does not know of keeps the snow off what is under it (sky-links.ts, COVER, takes in
 * only the house, and leaves glass out as the sky light does): the front garage and its bin room, which stand outside
 * the grid, and the Winter Garden under its glass roof. Each is a rectangle in plan, `corners` three of its corners in order, covering
 * everything below `top`; `glass`: the roof itself carries a little snow. */
export type SnowCover={corners:[number,number][];top:number;glass?:boolean};
export function snowCovers(state:RenovationState):SnowCover[]{
 const rect=({m0,m1,v0,v1}:{m0:number;m1:number;v0:number;v1:number})=>[garagePoint(m0,v0),garagePoint(m1,v0),garagePoint(m1,v1)];
 const xs=winterGardenOutline.map(p=>p[0]),zs=winterGardenOutline.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
 return [
  ...(state.garage?[{corners:rect(GARAGE),top:GARAGE.eave},{corners:rect(BIN_ROOM),top:2}]:[]),
  // The outline's corner inside the house is indoors as well, and lower than the house's own roof.
  ...(state.kitchen&&!state.catslide?[{corners:[[x0,z0],[x1,z0],[x1,z1]] as [number,number][],top:WG_GLASS_EDGE-.1,glass:true}]:[]),
 ];
}
/** Whether a point is under one of `covers`. */
export const underCover=(covers:SnowCover[],x:number,y:number,z:number)=>covers.some(({corners:[a,b,c],top})=>{
 const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],s=((x-a[0])*u[0]+(z-a[1])*u[1])/(u[0]*u[0]+u[1]*u[1]),t=((x-b[0])*v[0]+(z-b[1])*v[1])/(v[0]*v[0]+v[1]*v[1]);
 return y<top&&s>0&&s<1&&t>0&&t<1;});

/** How a material takes the snow. `surface`: it lies on what faces up under an open sky. `water`: the pool freezes over
 * under a thin, broken cover. `glass`: a dusting on a glass roof. `far`: the Alps and their foreland whiten. */
export type SnowKind='surface'|'water'|'glass'|'far';

const GLSL=`
uniform float uSnow;uniform vec4 uSnowCoverA[${SNOW.covers}];uniform vec4 uSnowCoverB[${SNOW.covers}];
float snowLie=0.0,snowTone=1.0;
#define LEAF_GLOW (1.0-snowLie)
// A hash without sin, which loses large arguments on some graphics cards.
float snowHash(vec2 c){vec3 p=fract(vec3(c.xyx)*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float snowNoise(vec2 p){vec2 i=floor(p),f=p-i;f=f*f*(3.0-2.0*f);
 return mix(mix(snowHash(i),snowHash(i+vec2(1.0,0.0)),f.x),mix(snowHash(i+vec2(0.0,1.0)),snowHash(i+vec2(1.0,1.0)),f.x),f.y);}
// Under a cover (snowCovers): xy how far inside its outline (0 at the edge), the roof's own and any; z its height.
vec3 snowCover(vec3 p){vec3 c=vec3(0.0,0.0,-1e4);
 for(int k=0;k<${SNOW.covers};k++){vec2 d=p.xz-uSnowCoverA[k].xy;
  float e=1.0-smoothstep(0.94,1.0,max(abs(dot(d,uSnowCoverA[k].zw)),abs(dot(d,uSnowCoverB[k].xy))));
  if(e>0.0){c.z=max(c.z,uSnowCoverB[k].z);c.y=max(c.y,e*step(p.y,uSnowCoverB[k].z));c.x=max(c.x,e*step(0.5,uSnowCoverB[k].w)*step(uSnowCoverB[k].z,p.y));}}
 return c;}
// How much of a surface the snow covers: all of what lies flat under an open sky, thinning with the slope, and in soft
// patches, which widen as it settles or melts. The patches fade where they would be smaller than a pixel.
float snowOn(vec3 p,float up,float open,float slope,float grain){
 float w=max(fwidth(p.x),fwidth(p.z));
 float broad=mix(0.5,snowNoise(p.xz*0.31+p.y*0.17),1.0-smoothstep(0.6,2.4,w)),fine=mix(0.5,snowNoise((p.xz*2.3+p.y*1.1)*grain+17.0),1.0-smoothstep(0.08,0.35,w*grain));
 snowTone=0.955+0.07*broad+0.02*fine;
 float mid=mix(0.5,snowNoise(p.zx*0.83+p.y*0.4+41.0),1.0-smoothstep(0.25,0.9,w));
 float depth=uSnow*1.25-0.25+(broad*0.45+mid*0.33+fine*0.22-0.5)*mix(1.1,0.3,uSnow)-(1.0-up)*slope-(1.0-open)*1.3-(grain-1.0)*0.13*(1.0-fine);
 return smoothstep(0.0,0.2,depth)*smoothstep(0.0,0.12,uSnow);}
`;
const amount={value:0};
const coverA={value:Array.from({length:SNOW.covers},()=>new T.Vector4())},coverB={value:Array.from({length:SNOW.covers},()=>new T.Vector4(0,0,-1e4,0))};
const uniforms={uSnow:amount,uSnowCoverA:coverA,uSnowCoverB:coverB};
/** A world position for the fragment shader: the sky light's own where the material has it (sky-visibility.ts). */
function worldPosition(shader:T.WebGLProgramParametersWithUniforms){
 if(shader.vertexShader.includes('vSkyWorld'))return 'vSkyWorld';
 shader.vertexShader='varying vec3 vSnowWorld;\n'+after(shader.vertexShader,'project_vertex',`
  vec4 snowWorld=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   snowWorld=instanceMatrix*snowWorld;
  #endif
  vSnowWorld=(modelMatrix*snowWorld).xyz;`);
 shader.fragmentShader='varying vec3 vSnowWorld;\n'+shader.fragmentShader;
 return 'vSnowWorld';
}
/** How a `surface` material takes it, by uniform, so that all of them keep the programs they shared: x the height grass
 * loses under it, y how far a flower shrinks to nothing, z how far what still shows pales to straw, w the slope's weight (little for setts, whose joints fill). */
const HOW={surface:new T.Vector4(0,0,0,SNOW.slope),leaf:new T.Vector4(0,0,0,1.6),blade:new T.Vector4(.75,0,1,SNOW.slope),bloom:new T.Vector4(0,1,0,SNOW.slope),sett:new T.Vector4(0,0,0,.25)};
/** x: the most of a surface it hides: all of a roof or a lawn, most of a leaf, and half of what a bare tree keeps of its
 * leaf cards, which stand for twigs (foliage.ts) and so read as rimed, not as white leaves. y: how far the leaf or lawn
 * that still shows darkens to its winter green. z: how fine it clumps: a leaf card carries it in tufts, not as a white
 * leaf. */
const MOST={surface:{value:new T.Vector3(1,0,1)},lawn:{value:new T.Vector3(1,.7,1)},leaf:{value:new T.Vector3(.85,1,4)},twig:{value:new T.Vector3(.5,0,1)}};
const feature=(kind:SnowKind,how=HOW.surface,most=MOST.surface)=>({key:'snow-'+kind,last:true,compile:(shader:T.WebGLProgramParametersWithUniforms)=>{
 Object.assign(shader.uniforms,uniforms);
 if(kind==='far'){
  shader.fragmentShader='uniform float uSnow;\n'+after(shader.fragmentShader,'color_fragment','diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(0.83,0.88,0.93),uSnow*0.8);');
  return;
 }
 const p=worldPosition(shader),sky=shader.fragmentShader.includes('uSkyVolume');
 // Open to falling snow: nothing stands higher over the point (sky-links.ts, COVER: the last layer of the sky light's
 // reach texture, a height every quarter metre, blended between). Nothing in the grid until that is worked out;
 // everything outside it.
 const open=sky?`
  float snowOpen=1.0;
  {vec2 g=(${p}.xz-uSkyMin.xz)/${COVER.cell.toFixed(2)};
   if(${p}.y<uSkyMin.y+uSkyGrid.y*uSkyCell&&all(greaterThan(g,vec2(0.0)))&&all(lessThan(g,uSkyGrid.xz*uSkyCell/${COVER.cell.toFixed(2)}))){
    g-=0.5;vec2 g0=floor(g),f=g-g0;float h[4];
    for(int k=0;k<4;k++){ivec2 c=ivec2(max(g0+vec2(float(k&1),float(k>>1)),0.0));vec4 t=texelFetch(uSkyReach,ivec3(c.x,c.y>>1,int(uSkyGrid.y)+1),0);h[k]=(c.y&1)==0?t.r:t.g;}
    float over=uSkyMin.y+mix(mix(h[0],h[1],f.x),mix(h[2],h[3],f.x),f.y)*uSkyGrid.y*uSkyCell;
    snowOpen=uSkyLinked*smoothstep(-0.7,-0.4,${p}.y-over);}}`:'float snowOpen=1.0;';
 // Which way the surface itself faces, as modelled: a roof's slates and a wall's boards (the surface sets' relief) do
 // not gather it in stripes, and a leaf seen from behind carries what it carries seen from the front.
 const normal=`vec3 snowN=vec3(0.0,1.0,0.0);
  #ifndef FLAT_SHADED
   snowN=inverseTransformDirection(normalize(vNormal),viewMatrix);
  #endif`;
 shader.fragmentShader=GLSL+shader.fragmentShader;
 if(kind==='water'){
  // Ice under a thin, wind-broken cover of snow, still and matt: the water no longer moves or shows the pool's floor.
  shader.fragmentShader=before(shader.fragmentShader,'lights_physical_fragment',`if(uSnow>0.0){
   float ice=smoothstep(0.15,0.7,uSnow),drift=snowOn(${p},1.0,1.0,0.0,1.0)*smoothstep(0.5,0.72,snowNoise(${p}.xz*0.55+5.0)*0.7+snowNoise(${p}.xz*2.1)*0.3);
   diffuseColor.rgb=mix(mix(diffuseColor.rgb,vec3(0.62,0.74,0.78),ice),vec3(${SNOW.albedo.join(',')}),drift);roughnessFactor=mix(roughnessFactor,mix(0.25,0.88,drift),ice);
   normal=normalize(mix(normal,normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz),ice));snowLie=max(ice*0.6,drift*0.92);}`);
  shader.fragmentShader=before(shader.fragmentShader,'opaque_fragment','diffuseColor.a=mix(diffuseColor.a,1.0,snowLie);');
  return;
 }
 if(kind==='glass'){
  // Only a glass roof (snowCovers): windows, balustrades and glass indoors stay clear. Glass is black (fresnelGlass), so
  // the snow on it is lit apart, by the sky and sun a flat roof takes; seen from the room below, by what comes through.
  shader.fragmentShader=before(shader.fragmentShader,'opaque_fragment',`if(uSnow>0.0){
   ${normal}
   float lie=snowCover(${p}).x*snowOn(${p},snowN.y,1.0,${SNOW.slope.toFixed(1)},1.0)*0.6;
   if(lie>0.0){vec3 snowUp=normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz),snowLight=vec3(0.0);
    #if defined( USE_ENVMAP ) && defined( STANDARD )
     snowLight=getIBLIrradiance(snowUp);
    #endif
    #if NUM_DIR_LIGHTS > 0
     snowLight+=directionalLights[0].color*max(0.0,dot(directionalLights[0].direction,snowUp));
    #endif
    outgoingLight=mix(outgoingLight,vec3(${SNOW.albedo.join(',')})*snowLight*RECIPROCAL_PI*(gl_FrontFacing?1.0:0.4),lie);diffuseColor.a=mix(diffuseColor.a,1.0,lie);}}`);
  return;
 }
 // Grass keeps a quarter of its height under the snow and flowers nothing (HOW); what shows of a blade pales to straw.
 shader.uniforms.uSnowHow={value:how};shader.uniforms.uSnowMost=most;
 shader.vertexShader='uniform float uSnow;uniform vec4 uSnowHow;varying float vSnowTip;\n'+after(shader.vertexShader,'begin_vertex','vSnowTip=clamp(position.y*5.0,0.0,1.0);transformed*=1.0-uSnowHow.y*uSnow;transformed.y*=1.0-uSnowHow.x*uSnow;');
 shader.fragmentShader='uniform vec4 uSnowHow;uniform vec3 uSnowMost;varying float vSnowTip;\n'+before(shader.fragmentShader,'lights_physical_fragment',`if(uSnow>0.0){
  ${normal}
  ${open}
  vec3 snowUnder=snowCover(${p});
  snowLie=snowOn(${p},snowN.y,snowOpen*(1.0-snowUnder.y),uSnowHow.w,uSnowMost.z)*uSnowMost.x;
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.5,0.44,0.3),uSnow*uSnowHow.z*0.6)*mix(vec3(1.0),vec3(0.6,0.62,0.56),uSnow*uSnowMost.y);snowLie=max(snowLie,uSnowHow.z*uSnow*vSnowTip*0.8);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${SNOW.albedo.join(',')})*snowTone,snowLie);roughnessFactor=mix(roughnessFactor,0.86,snowLie);metalnessFactor*=1.0-snowLie;
 }`);
 // Snow in shade is lit by the sky alone, and reads blue.
 shader.fragmentShader=before(shader.fragmentShader,'aomap_fragment',`reflectedLight.indirectDiffuse*=mix(vec3(1.0),vec3(${SNOW.shade.join(',')}),snowLie);`);
}});

const BLADES=/grass/,BLOOMS=/flowers|blooms|perennials/,SETTS=/cobble/;
/** Lets the snow lie on every lit material under `roots`: one uniform (snow.amount) on the programs they already have,
 * which costs a branch while it is 0. Materials that light themselves (lamps, screens) and see-through ones other than
 * glass and water are left alone. Call it after the sky light has taken its materials (sky-visibility.ts), and again for
 * what arrives later. */
export function snowSurfaces(roots:T.Object3D[]){
 for(const root of roots)root.traverse(o=>{for(const m of materialsOf(o)){
  if(hasSnow(m)||o.userData.skipSnow)continue;
  if(m instanceof T.MeshBasicMaterial){if(o.userData.scenicBackdrop)addShaderFeature(m,feature('far'));continue;}
  if(!(m instanceof T.MeshStandardMaterial)||m.userData.lamp||m.emissive.getHex())continue;
  if(m.userData.water)addShaderFeature(m,feature('water'));
  else if(m.transparent){if(hasShaderFeature(m,'fresnel-glass'))addShaderFeature(m,feature('glass'));}
  // Leaves and needles take a dusting on whatever of the crown faces up, steeper than a roof holds it.
  else{const leaf=m.userData.foliage==='leaves'||m.userData.photo==='foliage'||m.userData.hedgeBody;
   addShaderFeature(m,feature('surface',BLOOMS.test(o.name)?HOW.bloom:BLADES.test(o.name)?HOW.blade:SETTS.test(o.name)?HOW.sett:leaf?HOW.leaf:HOW.surface,hasShaderFeature(m,'leaf-fall')?MOST.twig:leaf?MOST.leaf:m.userData.photo==='lawn'?MOST.lawn:MOST.surface));}
 }});
}
const hasSnow=(m:T.Material)=>!!(m.userData.shaderFeatures as {key:string}[]|undefined)?.some(f=>f.key.startsWith('snow-'));
/** The snow on show, 0–1, and the roofs that keep it off what they cover: uniforms, so neither recompiles a shader. */
export const snow={
 get amount(){return amount.value;},set amount(v:number){amount.value=v;},
 cover:(covers:SnowCover[])=>{
  for(let k=0;k<SNOW.covers;k++){
   const c=covers[k];if(!c){coverB.value[k].set(0,0,-1e4,0);continue;}
   const [a,b,d]=c.corners,u=[(b[0]-a[0])/2,(b[1]-a[1])/2],v=[(d[0]-b[0])/2,(d[1]-b[1])/2],uu=u[0]*u[0]+u[1]*u[1],vv=v[0]*v[0]+v[1]*v[1];
   coverA.value[k].set(a[0]+u[0]+v[0],a[1]+u[1]+v[1],u[0]/uu,u[1]/uu);coverB.value[k].set(v[0]/vv,v[1]/vv,c.top,c.glass?1:0);
  }
 },
};
