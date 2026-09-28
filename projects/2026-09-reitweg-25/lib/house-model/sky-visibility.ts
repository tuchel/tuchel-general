import * as T from 'three';
import {addShaderFeature,after,materialsOf} from './shader-features';

/** Precomputed sky light around the house. A 0.5 m grid of probes covers the buildings;
 * for 48 directions the building is drawn into a depth map and every probe records whether
 * it sees the sky that way. Each probe keeps that visibility as a constant plus a direction
 * (first-order spherical harmonics), so a surface receives sky light according to its
 * normal: a floor under a roof far less than a terrace, a wall beside a window more than
 * one facing a corridor. Direct sun and its shadows stay live; this scales only sky light.
 * Geometry is untouched, so there are no seams or cracks. */
const DIRECTIONS=48,PER_FRAME=6,CELL=.5,MAP=2048;
const BOX=new T.Box3(new T.Vector3(-27,-3,-11),new T.Vector3(8,8.5,21));
// Light bounced between walls, floors and furniture keeps enclosed rooms from reading as black.
const BOUNCE=.18;

export function bakeSkyVisibility(renderer:T.WebGLRenderer,occluders:T.Mesh[],receivers:T.Object3D[]){
 const size=BOX.getSize(new T.Vector3()),nx=Math.round(size.x/CELL),ny=Math.round(size.y/CELL),nz=Math.round(size.z/CELL);
 // Texture axes: width = x, height = z, layers = y.
 const volumes=[0,1].map(()=>{const v=new T.WebGL3DRenderTarget(nx,nz,ny,{type:T.HalfFloatType,depthBuffer:false});v.texture.minFilter=v.texture.magFilter=T.LinearFilter;v.texture.wrapS=v.texture.wrapT=v.texture.wrapR=T.ClampToEdgeWrapping;return v;});
 const probes=new Float32Array(nx*ny*nz*3),cells=new Float32Array(nx*ny*nz*2);
 for(let j=0,k=0;j<ny;j++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++,k++){
  probes.set([BOX.min.x+(x+.5)*CELL,BOX.min.y+(j+.5)*CELL,BOX.min.z+(z+.5)*CELL],k*3);cells.set([x,z],k*2);
 }
 const grid=new T.BufferGeometry();grid.setAttribute('position',new T.BufferAttribute(probes,3));grid.setAttribute('cell',new T.BufferAttribute(cells,2));
 const depth=new T.WebGLRenderTarget(MAP,MAP,{depthTexture:new T.DepthTexture(MAP,MAP,T.FloatType)});
 const extent=size.length()/2+1,eye=new T.OrthographicCamera(-extent,extent,extent,-extent,1,extent*2+60);eye.layers.set(2);
 const center=BOX.getCenter(new T.Vector3()),blocker=new T.MeshBasicMaterial({colorWrite:false,side:T.DoubleSide});
 const accumulate=new T.ShaderMaterial({
  uniforms:{depthMap:{value:depth.depthTexture},lightMatrix:{value:new T.Matrix4()},direction:{value:new T.Vector3()},resolution:{value:new T.Vector2(nx,nz)}},
  vertexShader:`attribute vec2 cell;uniform mat4 lightMatrix;uniform vec2 resolution;varying vec3 vLight;
   void main(){vec4 l=lightMatrix*vec4(position,1.0);vLight=l.xyz/l.w*0.5+0.5;gl_Position=vec4((cell+0.5)/resolution*2.0-1.0,0.0,1.0);gl_PointSize=1.0;}`,
  fragmentShader:`uniform sampler2D depthMap;uniform vec3 direction;varying vec3 vLight;
   void main(){
    bool inside=all(greaterThan(vLight.xy,vec2(0.0)))&&all(lessThan(vLight.xy,vec2(1.0)));
    float lit=(!inside||vLight.z<=texture2D(depthMap,vLight.xy).r+0.001)?1.0:0.0;
    gl_FragColor=vec4(lit,lit*direction);
   }`,
  blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.OneFactor,blendDst:T.OneFactor,blendEquationAlpha:T.AddEquation,blendSrcAlpha:T.OneFactor,blendDstAlpha:T.OneFactor,depthTest:false,depthWrite:false,
 });
 const cloud=new T.Points(grid,accumulate);cloud.frustumCulled=false;
 const pointScene=new T.Scene();pointScene.add(cloud);const pointCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const directions=Array.from({length:DIRECTIONS},(_,i)=>{const y=1-2*(i+.5)/DIRECTIONS,r=Math.sqrt(1-y*y),a=i*2.399963;return new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);});
 const uniforms={uSkyVolume:{value:volumes[0].texture as T.Texture},uSkyMin:{value:BOX.min.clone()},uSkySize:{value:size.clone()},uSkyReady:{value:0},uSkyBounce:{value:BOUNCE}};
 const patched=new Set<T.Material>();
 for(const root of receivers)root.traverse(o=>{for(const m of materialsOf(o)){
  if(patched.has(m)||!(m instanceof T.MeshStandardMaterial)||m.transparent)continue;patched.add(m);
  addShaderFeature(m,{key:'sky-visibility',compile:shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 vSkyWorld;\n'+after(shader.vertexShader,'project_vertex',`
    vec4 skyWorld=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     skyWorld=instanceMatrix*skyWorld;
    #endif
    vSkyWorld=(modelMatrix*skyWorld).xyz;`);
   shader.fragmentShader=`uniform highp sampler3D uSkyVolume;uniform vec3 uSkyMin;uniform vec3 uSkySize;uniform float uSkyReady;uniform float uSkyBounce;varying vec3 vSkyWorld;\n`+after(shader.fragmentShader,'lights_fragment_maps',`
    {
     vec3 skyN=inverseTransformDirection(normal,viewMatrix);
     vec3 skyUvw=(vSkyWorld+skyN*0.35-uSkyMin)/uSkySize;
     float skyVisible=1.0;
     if(uSkyReady>0.5&&all(greaterThan(skyUvw,vec3(0.0)))&&all(lessThan(skyUvw,vec3(1.0)))){
      vec4 s=texture(uSkyVolume,skyUvw.xzy)/${DIRECTIONS.toFixed(1)};
      skyVisible=mix(uSkyBounce,1.0,clamp(s.r+2.0*dot(s.gba,skyN),0.0,1.0));
     }
     iblIrradiance*=skyVisible;irradiance*=skyVisible;radiance*=mix(1.0,skyVisible,0.85);
    }`);
  }});
 }});
 for(const o of occluders)o.layers.enable(2);
 let world:T.Object3D|undefined=occluders[0];while(world?.parent)world=world.parent;
 let step=-1,write=1;
 const run=()=>{
  if(!(world instanceof T.Scene))return;
  const target=renderer.getRenderTarget(),auto=renderer.autoClear,clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  const shadowNeeds=renderer.shadowMap.needsUpdate,override=world.overrideMaterial,background=world.background,fog=world.fog;
  renderer.shadowMap.needsUpdate=false;renderer.setClearColor(0x000000,0);
  if(step===0)for(let j=0;j<ny;j++){renderer.setRenderTarget(volumes[write],j);renderer.clear(true,false,false);}
  for(let i=0;i<PER_FRAME&&step<DIRECTIONS;i++,step++){
   const d=directions[step];
   eye.position.copy(center).addScaledVector(d,extent+30);eye.lookAt(center);eye.updateMatrixWorld();
   world.overrideMaterial=blocker;world.background=null;world.fog=null;
   renderer.setRenderTarget(depth);renderer.autoClear=true;renderer.render(world,eye);
   world.overrideMaterial=override;world.background=background;world.fog=fog;
   accumulate.uniforms.lightMatrix.value.multiplyMatrices(eye.projectionMatrix,eye.matrixWorldInverse);accumulate.uniforms.direction.value.copy(d);
   renderer.autoClear=false;
   for(let j=0;j<ny;j++){grid.setDrawRange(j*nx*nz,nx*nz);renderer.setRenderTarget(volumes[write],j);renderer.render(pointScene,pointCamera);}
  }
  grid.setDrawRange(0,Infinity);
  renderer.setRenderTarget(target);renderer.autoClear=auto;renderer.setClearColor(clear,alpha);renderer.shadowMap.needsUpdate=shadowNeeds;
 };
 return {
  probes:nx*ny*nz,
  request:()=>{step=0;},
  /** Advances a bake a few directions per frame; true when a finished result was swapped in. */
  update:()=>{
   if(step<0)return false;
   run();
   if(step<DIRECTIONS)return false;
   uniforms.uSkyVolume.value=volumes[write].texture;uniforms.uSkyReady.value=1;write=1-write;step=-1;return true;
  },
  dispose:()=>{volumes.forEach(v=>v.dispose());depth.dispose();grid.dispose();accumulate.dispose();blocker.dispose();},
 };
}
