import * as T from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
import {addShaderFeature,after,materialsOf} from './shader-features';

/** Precomputed sky light for the house. For each of 48 directions the building is drawn
 * into a depth map; every vertex then tests whether it sees the sky that way, weighted by
 * the cosine to its normal. The sum lives in a texture that materials read per vertex, so
 * rooms under a roof receive less sky light than a terrace, and corners less than a floor's
 * centre. Direct sun and its shadows stay live; this replaces only sky (image-based) light. */
const DIRECTIONS=48,PER_FRAME=8,EXTENT=46,MAP=2048,WIDTH=2048;
const AREA=new T.Box3(new T.Vector3(-42,-4,-30),new T.Vector3(34,12,40));
// Light bounced between walls, floors and furniture keeps enclosed rooms from reading as black.
const BOUNCE=.2;

export function bakeSkyVisibility(renderer:T.WebGLRenderer,batches:T.Mesh[]){
 const receivers=batches.filter(b=>{
  const box=b.geometry.boundingBox;if(!box||!AREA.intersectsBox(box))return false;
  return materialsOf(b).every(m=>m instanceof T.MeshStandardMaterial&&!m.transparent&&m.userData.photo!=='lawn');
 });
 // Long edges get extra vertices so light can vary across a floor or wall.
 const tessellate=new TessellateModifier(.9,6);
 for(const b of receivers){
  const box=b.geometry.boundingBox!,extent=box.getSize(new T.Vector3());
  if(Math.max(extent.x,extent.y,extent.z)<1.2)continue;
  const g=tessellate.modify(b.geometry);g.computeBoundingBox();g.computeBoundingSphere();b.geometry.dispose();b.geometry=g;
 }
 const count=receivers.reduce((n,b)=>n+b.geometry.attributes.position.count,0),height=Math.max(1,Math.ceil(count/WIDTH));
 const positions=new Float32Array(count*3),normals=new Float32Array(count*3),texels=new Float32Array(count*2);
 let offset=0;
 for(const b of receivers){
  const p=b.geometry.attributes.position,n=b.geometry.attributes.normal,t=new Float32Array(p.count*2);
  b.updateMatrixWorld();const nm=new T.Matrix3().getNormalMatrix(b.matrixWorld),v=new T.Vector3();
  for(let i=0;i<p.count;i++){
   const k=offset+i;t[i*2]=k%WIDTH;t[i*2+1]=Math.floor(k/WIDTH);texels.set([t[i*2],t[i*2+1]],k*2);
   v.fromBufferAttribute(p,i).applyMatrix4(b.matrixWorld);positions.set([v.x,v.y,v.z],k*3);
   v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();normals.set([v.x,v.y,v.z],k*3);
  }
  b.geometry.setAttribute('skyTexel',new T.BufferAttribute(t,2));
  offset+=p.count;
 }
 const points=new T.BufferGeometry();
 points.setAttribute('position',new T.BufferAttribute(positions,3));points.setAttribute('normal',new T.BufferAttribute(normals,3));points.setAttribute('skyTexel',new T.BufferAttribute(texels,2));
 const results=[0,1].map(()=>new T.WebGLRenderTarget(WIDTH,height,{type:T.HalfFloatType,depthBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter}));
 const depth=new T.WebGLRenderTarget(MAP,MAP,{depthTexture:new T.DepthTexture(MAP,MAP,T.FloatType)});
 const eye=new T.OrthographicCamera(-EXTENT,EXTENT,EXTENT,-EXTENT,1,260);eye.layers.set(2);
 const center=AREA.getCenter(new T.Vector3()),blocker=new T.MeshBasicMaterial({colorWrite:false,side:T.DoubleSide});
 const accumulate=new T.ShaderMaterial({
  uniforms:{depthMap:{value:depth.depthTexture},lightMatrix:{value:new T.Matrix4()},direction:{value:new T.Vector3()},resolution:{value:new T.Vector2(WIDTH,height)}},
  vertexShader:`attribute vec2 skyTexel;uniform mat4 lightMatrix;uniform vec2 resolution;uniform vec3 direction;varying vec3 vLight;varying float vWeight;
   void main(){
    vec4 l=lightMatrix*vec4(position+normal*0.06,1.0);vLight=l.xyz/l.w*0.5+0.5;
    vWeight=max(dot(normal,direction),0.0);
    gl_Position=vec4((skyTexel+0.5)/resolution*2.0-1.0,0.0,1.0);gl_PointSize=1.0;
   }`,
  fragmentShader:`uniform sampler2D depthMap;varying vec3 vLight;varying float vWeight;
   void main(){
    bool inside=all(greaterThan(vLight.xy,vec2(0.0)))&&all(lessThan(vLight.xy,vec2(1.0)));
    float lit=(!inside||vLight.z<=texture2D(depthMap,vLight.xy).r+0.0015)?1.0:0.0;
    gl_FragColor=vec4(lit*vWeight,vWeight,0.0,1.0);
   }`,
  blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.OneFactor,blendDst:T.OneFactor,depthTest:false,depthWrite:false,
 });
 const cloud=new T.Points(points,accumulate);cloud.frustumCulled=false;
 const pointScene=new T.Scene();pointScene.add(cloud);
 const pointCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const directions=Array.from({length:DIRECTIONS},(_,i)=>{const y=1-2*(i+.5)/DIRECTIONS,r=Math.sqrt(1-y*y),a=i*2.399963;return new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);});
 const uniform={value:results[0].texture as T.Texture},floor={value:BOUNCE};
 const patched=new Set<T.Material>();
 for(const b of receivers)for(const m of materialsOf(b)){
  if(patched.has(m))continue;patched.add(m);
  addShaderFeature(m,{key:'sky-visibility',compile:shader=>{
   shader.uniforms.uSkyVisibility=uniform;shader.uniforms.uSkyFloor=floor;
   shader.vertexShader='attribute vec2 skyTexel;uniform sampler2D uSkyVisibility;uniform float uSkyFloor;varying float vSkyVisibility;\n'+after(shader.vertexShader,'begin_vertex',`
    vSkyVisibility=1.0;
    if(skyTexel.x>=0.0){vec4 s=texelFetch(uSkyVisibility,ivec2(skyTexel),0);if(s.g>0.0)vSkyVisibility=mix(uSkyFloor,1.0,clamp(s.r/s.g,0.0,1.0));}`);
   shader.fragmentShader='varying float vSkyVisibility;\n'+after(shader.fragmentShader,'lights_fragment_maps','iblIrradiance*=vSkyVisibility;irradiance*=vSkyVisibility;radiance*=mix(1.0,vSkyVisibility,0.85);');
  }});
 }
 // Any other mesh sharing a patched material reads "open sky".
 const fillOthers=(root:T.Object3D)=>root.traverse(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh||mesh.geometry.attributes.skyTexel)return;
  if(materialsOf(mesh).some(m=>patched.has(m)))mesh.geometry.setAttribute('skyTexel',new T.BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count*2).fill(-1),2));
 });
 let sceneRoot:T.Object3D|undefined=batches[0];while(sceneRoot?.parent)sceneRoot=sceneRoot.parent;if(sceneRoot)fillOthers(sceneRoot);
 const occluders=batches.filter(b=>materialsOf(b).every(m=>!m.transparent&&m.userData.photo!=='lawn'));
 for(const o of occluders)o.layers.enable(2);
 let step=-1,write=1;
 const run=()=>{
  if(!sceneRoot)return;
  const world=sceneRoot as T.Scene;
  const previousTarget=renderer.getRenderTarget(),previousAuto=renderer.autoClear,clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),shadowAuto=renderer.shadowMap.autoUpdate,needs=renderer.shadowMap.needsUpdate;
  const override=world.overrideMaterial,background=world.background,fog=world.fog;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
  if(step===0){renderer.setRenderTarget(results[write]);renderer.setClearColor(0x000000,0);renderer.clear(true,false,false);}
  for(let i=0;i<PER_FRAME&&step<DIRECTIONS;i++,step++){
   const d=directions[step];
   eye.position.copy(center).addScaledVector(d,130);eye.lookAt(center);eye.updateMatrixWorld();
   world.overrideMaterial=blocker;world.background=null;world.fog=null;
   renderer.setRenderTarget(depth);renderer.autoClear=true;renderer.render(world,eye);
   world.overrideMaterial=override;world.background=background;world.fog=fog;
   accumulate.uniforms.lightMatrix.value.multiplyMatrices(eye.projectionMatrix,eye.matrixWorldInverse);accumulate.uniforms.direction.value.copy(d);
   renderer.setRenderTarget(results[write]);renderer.autoClear=false;renderer.render(pointScene,pointCamera);
  }
  renderer.setRenderTarget(previousTarget);renderer.autoClear=previousAuto;renderer.setClearColor(clear,alpha);
  renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=needs;
 };
 return {
  vertices:count,
  request:()=>{step=0;},
  /** Advances a bake a few directions per frame; true when a finished result was swapped in. */
  update:()=>{
   if(step<0)return false;
   run();
   if(step<DIRECTIONS)return false;
   uniform.value=results[write].texture;write=1-write;step=-1;return true;
  },
  dispose:()=>{results.forEach(r=>r.dispose());depth.dispose();points.dispose();accumulate.dispose();blocker.dispose();},
 };
}
