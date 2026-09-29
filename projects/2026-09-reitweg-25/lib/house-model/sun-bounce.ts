import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {MeshBVH,MeshBVHUniformStruct,FloatVertexAttributeTexture,BVHShaderGLSL,CENTER} from 'three-mesh-bvh';
import {addShaderFeature,before,materialsOf} from './shader-features';
import {PROBE_GRID} from './sky-visibility';

/** Sunlight that enters a room lands on a floor or wall and lights the rest of the room from there.
 * Every point of the sky-light grid casts rays against the house; where a ray lands on a sunlit surface, that
 * surface's colour times its sunlight arrives from the ray's direction. The sun test is spread across the ray's
 * footprint, so a sun patch counts by the share of it each ray covers rather than all or nothing. Each point keeps
 * the colour of the gathered light plus its main direction, per unit of sunlight: materials scale it by the live sun's
 * strength and colour, and a new sun direction, floor, renovation or level bakes it again over the next frames. */
const MAP=2048,TAPS=8;
const {box:BOX,cell:CELL}=PROBE_GRID;
const visibleIn=(o:T.Object3D)=>{for(let a:T.Object3D|null=o;a;a=a.parent)if(!a.visible)return false;return true;};

export function bakeSunBounce(renderer:T.WebGLRenderer,occluders:T.Mesh[],receivers:T.Object3D[],sun:T.DirectionalLight,rays:number){
 const size=BOX.getSize(new T.Vector3()),nx=Math.round(size.x/CELL),ny=Math.round(size.y/CELL),nz=Math.round(size.z/CELL);
 // Layers side by side: x within a layer, then layer (height), across; z down. Two targets for the traced and
 // half-smoothed points, two for the finished result shown while the next one bakes.
 const targets=[0,1,2,3].map(()=>{const t=new T.WebGLRenderTarget(nx*ny,nz,{count:2,type:T.HalfFloatType,depthBuffer:false});for(const x of t.textures){x.minFilter=x.magFilter=T.LinearFilter;x.generateMipmaps=false;}return t;});
 // One merged copy of every opaque part of the house, in world space, tagged with its batch.
 let count=0;for(const o of occluders)count+=o.geometry.attributes.position.count;
 const position=new Float32Array(count*3),batch=new Float32Array(count),v=new T.Vector3();
 let at=0;occluders.forEach((o,b)=>{
  const p=o.geometry.attributes.position;o.updateMatrixWorld();
  for(let i=0;i<p.count;i++,at++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);position.set([v.x,v.y,v.z],at*3);batch[at]=b;}
 });
 const merged=new T.BufferGeometry(),batchAttribute=new T.BufferAttribute(batch,1);merged.setAttribute('position',new T.BufferAttribute(position,3));merged.setAttribute('batch',batchAttribute);
 // Batch table: reflectance, and whether the batch is shown in the current floor and renovation state.
 const table=new T.DataTexture(new Float32Array(occluders.length*4),occluders.length,1,T.RGBAFormat,T.FloatType);table.minFilter=table.magFilter=T.NearestFilter;
 const albedo=new T.Color();
 occluders.forEach((o,b)=>{const m=materialsOf(o)[0] as T.MeshStandardMaterial;albedo.copy(m.userData.albedo??m.color??new T.Color(.5,.5,.5));table.image.data!.set([Math.min(albedo.r,.9),Math.min(albedo.g,.9),Math.min(albedo.b,.9),1],b*4);});
 const bvh=new MeshBVHUniformStruct(),batchOf=new FloatVertexAttributeTexture();
 // The tree over some 180,000 triangles takes a few hundred milliseconds, so it is built in a worker, on a copy: the
 // worker borrows the arrays it is given. Where workers cannot load, it is built here instead.
 let built=false,building=false;
 const build=()=>{
  if(building)return;building=true;
  const finish=(tree:MeshBVH)=>{bvh.updateFrom(tree);batchOf.updateFrom(batchAttribute);built=true;};
  const copy=new T.BufferGeometry();copy.setAttribute('position',merged.attributes.position.clone());
  void import('three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js').then(({GenerateMeshBVHWorker})=>{const worker=new GenerateMeshBVHWorker();return worker.generate(copy,{strategy:CENTER}).finally(()=>worker.dispose());})
   .then(finish,()=>finish(new MeshBVH(merged,{strategy:CENTER})));
 };

 // The sun's view of the same geometry: hidden batches fold away in the vertex shader.
 // Only depth is read; the colour layer is one byte a texel.
 const sunMap=new T.WebGLRenderTarget(MAP,MAP,{format:T.RedFormat,depthTexture:new T.DepthTexture(MAP,MAP,T.FloatType)});
 const extent=size.length()/2+1,eye=new T.OrthographicCamera(-extent,extent,extent,-extent,1,extent*2+60),center=BOX.getCenter(new T.Vector3());
 const sunScene=new T.Scene(),sunMesh=new T.Mesh(merged,new T.ShaderMaterial({
  uniforms:{batches:{value:table}},side:T.DoubleSide,colorWrite:false,
  vertexShader:`attribute float batch;uniform sampler2D batches;
   void main(){gl_Position=texelFetch(batches,ivec2(int(batch+0.5),0),0).a<0.5?vec4(2.0,2.0,2.0,1.0):projectionMatrix*viewMatrix*vec4(position,1.0);}`,
  fragmentShader:'void main(){}',
 }));
 sunMesh.frustumCulled=false;sunScene.add(sunMesh);

 const rayFunctions=BVHShaderGLSL.bvh_ray_functions.replace('uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;','uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;\nif ( ! shown( indices.x ) ) continue;');
 if(rayFunctions===BVHShaderGLSL.bvh_ray_functions)throw new Error('three-mesh-bvh triangle loop changed');
 const shared={bvh:{value:bvh},batchOf:{value:batchOf},batches:{value:table},gridMin:{value:BOX.min.clone()},grid:{value:new T.Vector3(nx,ny,nz)},cell:{value:CELL}};
 const prelude=`precision highp isampler2D;precision highp usampler2D;
  ${BVHShaderGLSL.common_functions}${BVHShaderGLSL.bvh_struct_definitions}
  uniform BVH bvh;uniform sampler2D batchOf;uniform sampler2D batches;uniform vec3 gridMin;uniform vec3 grid;uniform float cell;
  layout(location=0) out vec4 outLight;layout(location=1) out vec4 outDirection;
  vec4 batchAt(uint vertex){return texelFetch(batches,ivec2(int(texelFetch1D(batchOf,vertex).r+0.5),0),0);}
  bool shown(uint vertex){return batchAt(vertex).a>0.5;}
  ${rayFunctions}
  ivec3 probeAt(ivec2 px){int layer=px.x/int(grid.x);return ivec3(px.x-layer*int(grid.x),layer,px.y);}
  vec3 centre(ivec3 p){return gridMin+(vec3(p)+0.5)*cell;}`;
 const pass=(uniforms:Record<string,T.IUniform>,main:string)=>new T.ShaderMaterial({glslVersion:T.GLSL3,defines:{TAPS},uniforms:{...shared,...uniforms},vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:prelude+main});
 const trace=pass({rays:{value:rays},sunDepth:{value:sunMap.depthTexture},sunMatrix:{value:new T.Matrix4()},sunDirection:{value:new T.Vector3()},footprint:{value:Math.tan(Math.acos(1-2/rays))}},`
  uniform int rays;uniform sampler2D sunDepth;uniform mat4 sunMatrix;uniform vec3 sunDirection;uniform float footprint;
  float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
  float sunlit(vec3 q){
   vec4 l=sunMatrix*vec4(q,1.0);vec3 s=l.xyz/l.w*0.5+0.5;
   if(any(lessThan(s.xy,vec2(0.0)))||any(greaterThan(s.xy,vec2(1.0))))return 1.0;
   return s.z<=texture(sunDepth,s.xy).r+0.0004?1.0:0.0;
  }
  void main(){
   vec3 origin=centre(probeAt(ivec2(gl_FragCoord.xy)));
   // A different turn of the same even spread of directions at every point, so gaps between rays do not line up.
   float u=hash(origin),w=hash(origin.zxy+3.1),inside=0.0;
   vec3 light=vec3(0.0),direction=vec3(0.0);float total=0.0;
   // A uniform count keeps drivers from unrolling the traversal.
   for(int i=0;i<rays;i++){
    float y=1.0-2.0*(float(i)+u)/float(rays),r=sqrt(max(0.0,1.0-y*y)),a=float(i)*2.399963+6.283185*w;
    vec3 d=vec3(cos(a)*r,y,sin(a)*r);
    uvec4 face=uvec4(0u);vec3 n=vec3(0.0),bary=vec3(0.0);float side=1.0,dist=0.0;
    if(!bvhIntersectFirstHit(bvh,origin,d,face,n,bary,side,dist))continue;
    if(side<0.0)inside+=1.0;
    // n faces back along the ray, toward this point: the side of the surface that lights it.
    float c=dot(n,sunDirection);if(c<=0.0)continue;
    vec3 q=origin+d*dist+n*0.04,t=normalize(cross(n,abs(n.y)<0.9?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0))),b=cross(n,t);
    float radius=min(dist*footprint,0.8),seen=0.0;
    for(int k=0;k<TAPS;k++){float s=radius*sqrt((float(k)+0.5)/float(TAPS)),e=float(k)*2.399963+6.283185*u;seen+=sunlit(q+(t*cos(e)+b*sin(e))*s);}
    vec3 l=batchAt(face.x).rgb*c*seen/float(TAPS);
    float m=dot(l,vec3(0.2126,0.7152,0.0722));light+=l;direction+=m*d;total+=m;
   }
   // A point that mostly sees the backs of faces sits inside a wall or slab; alpha marks it for the smoothing passes.
   outLight=vec4(light/float(rays),inside<0.5*float(rays)?1.0:0.0);outDirection=vec4(direction,total);
  }`);
 // Smoothing: each point averages the neighbours it can see, a cell apart and then two, so no light passes through walls.
 // Points inside walls take the average of all their neighbours.
 const smooth=pass({light:{value:null},direction:{value:null},stride:{value:1}},`
  uniform sampler2D light;uniform sampler2D direction;uniform int stride;
  void main(){
   ivec3 p=probeAt(ivec2(gl_FragCoord.xy));vec3 origin=centre(p);
   bool open=texelFetch(light,ivec2(gl_FragCoord.xy),0).a>0.5;
   vec4 l=vec4(0.0),d=vec4(0.0);float sum=0.0;
   for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    ivec3 q=p+ivec3(x,y,z)*stride;
    if(any(lessThan(q,ivec3(0)))||any(greaterThanEqual(q,ivec3(grid))))continue;
    ivec2 at=ivec2(q.y*int(grid.x)+q.x,q.z);vec4 here=texelFetch(light,at,0);
    if(here.a<0.5)continue;
    if(open&&(x!=0||y!=0||z!=0)){
     vec3 to=centre(q)-origin;float len=length(to);
     uvec4 face=uvec4(0u);vec3 n=vec3(0.0),bary=vec3(0.0);float side=1.0,dist=0.0;
     if(bvhIntersectFirstHit(bvh,origin,to/len,face,n,bary,side,dist)&&dist<len)continue;
    }
    float k=exp(-0.5*float(x*x+y*y+z*z));l+=k*here;d+=k*texelFetch(direction,at,0);sum+=k;
   }
   outLight=sum>0.0?vec4(l.rgb/sum,1.0):vec4(0.0,0.0,0.0,1.0);outDirection=sum>0.0?d/sum:vec4(0.0);
  }`);
 const quad=new FullScreenQuad(trace);

 const uniforms={uBounceLight:{value:targets[0].textures[0] as T.Texture},uBounceDirection:{value:targets[0].textures[1] as T.Texture},uBounceSun:{value:new T.Color(0,0,0)},
  uBounceMin:{value:BOX.min.clone()},uBounceGrid:{value:new T.Vector3(nx,ny,nz)},uBounceCell:{value:CELL},uBounceReady:{value:0}};
 const patched=new Set<T.Material>();
 for(const root of receivers)root.traverse(o=>{for(const m of materialsOf(o)){
  if(patched.has(m)||!(m instanceof T.MeshStandardMaterial)||m.transparent)continue;patched.add(m);
  addShaderFeature(m,{key:'sun-bounce',compile:shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 vBounceWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 bounceWorld=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     bounceWorld=instanceMatrix*bounceWorld;
    #endif
    vBounceWorld=(modelMatrix*bounceWorld).xyz;`);
   shader.fragmentShader=`uniform sampler2D uBounceLight;uniform sampler2D uBounceDirection;uniform vec3 uBounceSun;uniform vec3 uBounceMin;uniform vec3 uBounceGrid;uniform float uBounceCell;uniform float uBounceReady;varying vec3 vBounceWorld;
    vec4 bounceAt(sampler2D t,vec3 g){
     float j0=clamp(floor(g.y),0.0,uBounceGrid.y-1.0),j1=min(j0+1.0,uBounceGrid.y-1.0);
     vec2 xz=clamp(g.xz+0.5,vec2(0.5),uBounceGrid.xz-0.5),atlas=vec2(uBounceGrid.x*uBounceGrid.y,uBounceGrid.z);
     return mix(texture(t,vec2(j0*uBounceGrid.x+xz.x,xz.y)/atlas),texture(t,vec2(j1*uBounceGrid.x+xz.x,xz.y)/atlas),clamp(g.y-j0,0.0,1.0));
    }\n`+before(shader.fragmentShader,'lights_fragment_end',`
    if(uBounceReady>0.5){
     vec3 bounceN=inverseTransformDirection(normal,viewMatrix),g=(vBounceWorld+bounceN*0.35-uBounceMin)/uBounceCell-0.5;
     if(all(greaterThan(g,vec3(-0.5)))&&all(lessThan(g,uBounceGrid-0.5))){
      vec4 d=bounceAt(uBounceDirection,g);
      // First-order spherical harmonics: the gathered light's average colour, stronger on the side it comes from.
      if(d.w>1e-6)iblIrradiance+=uBounceSun*bounceAt(uBounceLight,g).rgb*max(0.0,1.0+2.0*dot(d.xyz,bounceN)/d.w);
     }
    }`);
  }});
 }});

 // A layer is 70 × 64 points; one traced layer per frame keeps each frame's share small. Smoothing is cheaper: two.
 let phase=-1,layer=0,pending=false,write=2;
 const run=(work:()=>void)=>{
  const target=renderer.getRenderTarget(),auto=renderer.autoClear,shadowNeeds=renderer.shadowMap.needsUpdate;
  renderer.shadowMap.needsUpdate=false;
  try{work();}finally{renderer.setRenderTarget(target);renderer.autoClear=auto;renderer.shadowMap.needsUpdate=shadowNeeds;}
 };
 const start=()=>{
  occluders.forEach((o,b)=>{table.image.data![b*4+3]=visibleIn(o)?1:0;});table.needsUpdate=true;
  const s=sun.position.clone().sub(sun.target.position).normalize();
  eye.position.copy(center).addScaledVector(s,extent+30);eye.lookAt(center);eye.updateMatrixWorld();
  trace.uniforms.sunMatrix.value.multiplyMatrices(eye.projectionMatrix,eye.matrixWorldInverse);trace.uniforms.sunDirection.value.copy(s);
  run(()=>{renderer.setRenderTarget(sunMap);renderer.autoClear=true;renderer.render(sunScene,eye);});
  phase=0;layer=0;
 };
 return {
  /** Starts a fresh bake after the current one; call when the sun or the shown geometry changes. */
  request:()=>{pending=true;},
  /** Advances a bake a few layers per frame: trace, then two smoothing passes; true when a finished result was swapped in. */
  update:()=>{
   uniforms.uBounceSun.value.copy(sun.color).multiplyScalar(sun.visible?sun.intensity:0);
   if(phase<0){if(!pending)return false;if(!built){build();return false;}pending=false;start();return false;}
   const target=targets[phase===0?0:phase===1?1:write],to=Math.min(ny,layer+(phase===0?1:2));
   if(phase>0){const from=targets[phase-1];smooth.uniforms.light.value=from.textures[0];smooth.uniforms.direction.value=from.textures[1];smooth.uniforms.stride.value=phase;}
   quad.material=phase===0?trace:smooth;
   run(()=>{target.scissor.set(layer*nx,0,(to-layer)*nx,nz);target.scissorTest=true;renderer.setRenderTarget(target);quad.render(renderer);});
   layer=to;if(layer<ny)return false;
   layer=0;phase++;if(phase<3)return false;
   uniforms.uBounceLight.value=target.textures[0];uniforms.uBounceDirection.value=target.textures[1];uniforms.uBounceReady.value=1;write=5-write;phase=-1;return true;
  },
  dispose:()=>{targets.forEach(t=>t.dispose());sunMap.depthTexture?.dispose();sunMap.dispose();merged.dispose();table.dispose();bvh.dispose();batchOf.dispose();trace.dispose();smooth.dispose();(sunMesh.material as T.Material).dispose();quad.dispose();},
 };
}
