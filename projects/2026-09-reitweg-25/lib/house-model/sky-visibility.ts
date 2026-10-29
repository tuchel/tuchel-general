import * as T from 'three';
import {addShaderFeature,after,materialsOf} from './shader-features';
import type {LinkGrid} from './sky-links';

/** Precomputed sky light around the house. A 0.5 m grid of probes covers the buildings;
 * for 256 directions the building is drawn into a depth map and every probe records whether
 * it sees the sky that way. Indoors a probe sees the sky through a window or roof window in only a few
 * of them: with fewer directions, neighbouring probes differ by a whole direction and walls show the grid
 * as 0.5 m blocks. Each probe keeps that visibility as a constant plus a direction
 * (first-order spherical harmonics), so a surface receives sky light according to its
 * normal: a floor under a roof far less than a terrace, a wall beside a window more than
 * one facing a corridor. Direct sun and its shadows stay live; this scales only sky light.
 * A surface blends only the probes on its own side of walls and roofs (sky-links.ts).
 * Geometry is untouched, so there are no seams or cracks. */
const DIRECTIONS=256,PER_FRAME=6,CELL=.5,MAP=2048;
const BOX=new T.Box3(new T.Vector3(-27,-3,-11),new T.Vector3(8,8.5,21));
/** The probe grid, shared with the sun bounce (sun-bounce.ts). */
export const PROBE_GRID={box:BOX,cell:CELL};
// Light bounced between walls, floors and furniture keeps enclosed rooms from reading as black. It arrives from every
// direction, so a surface that cannot see the sky gets a share of the sky's overhead light whichever way it faces,
// scaled by how much of the sky its room sees through windows (a closed basement stays dim). The share is .7 alone,
// and .55 where bounced sunlight is traced as well (sun-bounce.ts).

export function bakeSkyVisibility(renderer:T.WebGLRenderer,occluders:T.Mesh[],receivers:T.Object3D[],bounce=.7){
 const size=BOX.getSize(new T.Vector3()),nx=Math.round(size.x/CELL),ny=Math.round(size.y/CELL),nz=Math.round(size.z/CELL);
 // Texture axes: width = x, height = z, layers = y.
 const volumes=[0,1].map(()=>{const v=new T.WebGL3DRenderTarget(nx,nz,ny,{type:T.HalfFloatType,depthBuffer:false});v.texture.minFilter=v.texture.magFilter=T.LinearFilter;v.texture.wrapS=v.texture.wrapT=v.texture.wrapR=T.ClampToEdgeWrapping;return v;});
 const probes=new Float32Array(nx*ny*nz*3),cells=new Float32Array(nx*ny*nz*2);
 for(let j=0,k=0;j<ny;j++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++,k++){
  probes.set([BOX.min.x+(x+.5)*CELL,BOX.min.y+(j+.5)*CELL,BOX.min.z+(z+.5)*CELL],k*3);cells.set([x,z],k*2);
 }
 const grid=new T.BufferGeometry();grid.setAttribute('position',new T.BufferAttribute(probes,3));grid.setAttribute('cell',new T.BufferAttribute(cells,2));
 // Only depth is read; the colour layer is one byte a texel.
 const depth=new T.WebGLRenderTarget(MAP,MAP,{format:T.RedFormat,depthTexture:new T.DepthTexture(MAP,MAP,T.FloatType)});
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
 // Which neighbouring probes see each other (sky-links.ts), worked out off the page's thread for each shown state.
 const links=new T.Data3DTexture(new Uint8Array(nx*ny*nz),nx,nz,ny);links.format=T.RedFormat;links.minFilter=links.magFilter=T.NearestFilter;
 const uniforms={uSkyVolume:{value:volumes[0].texture as T.Texture},uSkyLinks:{value:links},uSkyMin:{value:BOX.min.clone()},uSkyGrid:{value:new T.Vector3(nx,ny,nz)},uSkyCell:{value:CELL},uSkyReady:{value:0},uSkyLinked:{value:0},uSkyBounce:{value:bounce}};
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
   shader.fragmentShader=`uniform highp sampler3D uSkyVolume;uniform highp sampler3D uSkyLinks;uniform vec3 uSkyMin;uniform vec3 uSkyGrid;uniform float uSkyCell;uniform float uSkyReady;uniform float uSkyLinked;uniform float uSkyBounce;varying vec3 vSkyWorld;
    // Whether corner b of a grid cell is reached from corner a along clear edges, x then y then z or the reverse
    // (sky-links.ts reaches()).
    bool skyReach(int a,int b,int l[8]){
     int at=a;bool clear=true;
     for(int i=0;i<3;i++){int bit=1<<i;if(((at^b)&bit)==0)continue;if((l[at&~bit]&bit)==0){clear=false;break;}at^=bit;}
     if(clear)return true;
     at=a;
     for(int i=2;i>=0;i--){int bit=1<<i;if(((at^b)&bit)==0)continue;if((l[at&~bit]&bit)==0)return false;at^=bit;}
     return true;
    }
    // The eight probes around a surface, blended as filtering would, but only those in front of it and joined to one
    // another, the group that weighs most: a probe behind the surface, or past a wall or roof beside it, stands in
    // another room or outdoors.
    vec4 skyAt(vec3 p,vec3 n){
     vec3 g=(p+n*0.35-uSkyMin)/uSkyCell-0.5,g0=floor(g),f=g-g0;
     vec4 v[8];float w[8];int l[8];
     for(int k=0;k<8;k++){
      vec3 o=vec3(float(k&1),float((k>>1)&1),float((k>>2)&1)),c=clamp(g0+o,vec3(0.0),uSkyGrid-1.0),t=mix(1.0-f,f,o);
      ivec3 at=ivec3(c.xzy);
      v[k]=texelFetch(uSkyVolume,at,0);
      w[k]=t.x*t.y*t.z*clamp(dot(uSkyMin+(c+0.5)*uSkyCell-p,n)/0.15,0.0,1.0);
      l[k]=uSkyLinked>0.5?int(texelFetch(uSkyLinks,at,0).r*255.0+0.5):7;
     }
     int group=0;
     for(int k=0;k<8;k++)if(skyReach(0,k,l))group|=1<<k;
     if(group!=255){
      float most=-1.0;
      for(int a=0;a<8;a++){float m=0.0;int joined=0;for(int k=0;k<8;k++)if(skyReach(a,k,l)){m+=w[k];joined|=1<<k;}if(m>most){most=m;group=joined;}}
     }
     vec4 s=vec4(0.0);float total=0.0;
     for(int k=0;k<8;k++)if((group&(1<<k))!=0){s+=w[k]*v[k];total+=w[k];}
     return total>1e-3?s/total:texture(uSkyVolume,((g+0.5)/uSkyGrid).xzy);
    }\n`+after(shader.fragmentShader,'lights_fragment_maps',`
    {
     vec3 skyN=inverseTransformDirection(normal,viewMatrix);
     vec3 skyG=(vSkyWorld+skyN*0.35-uSkyMin)/uSkyCell;
     float open=1.0,bounce=uSkyBounce;
     if(uSkyReady>0.5&&all(greaterThan(skyG,vec3(0.0)))&&all(lessThan(skyG,uSkyGrid))){
      vec4 s=skyAt(vSkyWorld,skyN)/${DIRECTIONS.toFixed(1)};
      open=clamp(s.r+2.0*dot(s.gba,skyN),0.0,1.0);bounce=uSkyBounce*mix(0.15,1.0,clamp(s.r*5.0,0.0,1.0));
     }
     vec3 overhead=iblIrradiance;
     #if defined( USE_ENVMAP ) && defined( STANDARD )
      overhead=getIBLIrradiance((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz);
     #endif
     float skyVisible=mix(bounce,1.0,open);
     // Oak floors and warm plaster make bounced light warmer than the sky; where sunlight is traced indoors, by the colours
     // of the very surfaces round the point (sun-bounce.ts, bounceTint).
     vec3 bounceColour=vec3(1.08,.97,.84);
     #ifdef BOUNCE_TINT
      bounceColour=bounceTint(skyN,bounceColour);
     #endif
     iblIrradiance=iblIrradiance*open+overhead*bounce*bounceColour*(1.0-open);irradiance*=skyVisible;radiance*=mix(1.0,skyVisible,0.85);
     // A clear coat (car paint) sees as little of the sky indoors as the layer beneath it.
     #ifdef USE_CLEARCOAT
     clearcoatRadiance*=mix(1.0,skyVisible,0.85);
     #endif
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
 // The links worker gets the house once, in world space, tagged with its batch; leaves and other cut-out cards let light
 // through and are left out.
 let linker:Worker|undefined,job=0,sent='';
 const linkable=occluders.filter(o=>materialsOf(o).every(m=>!m.alphaTest));
 const shown=(o:T.Object3D)=>{for(let a:T.Object3D|null=o;a;a=a.parent)if(!a.visible)return false;return true;};
 const relink=()=>{
  if(!linker){
   let count=0;for(const o of linkable)count+=o.geometry.attributes.position.count;
   const positions=new Float32Array(count*3),batch=new Uint16Array(count),v=new T.Vector3();
   let at=0;linkable.forEach((o,b)=>{const p=o.geometry.attributes.position;o.updateMatrixWorld();for(let i=0;i<p.count;i++,at++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);positions[at*3]=v.x;positions[at*3+1]=v.y;positions[at*3+2]=v.z;batch[at]=b;}});
   const linkGrid:LinkGrid={min:BOX.min.toArray() as [number,number,number],cell:CELL,nx,ny,nz};
   linker=new Worker(new URL('./sky-links.worker.ts',import.meta.url),{type:'module'});
   linker.postMessage({kind:'init',positions,batch,grid:linkGrid},[positions.buffer,batch.buffer]);
   linker.onmessage=({data}:MessageEvent<{kind:'links';job:number;links:Uint8Array}>)=>{
    if(data.job!==job)return;
    links.image.data=data.links;links.needsUpdate=true;uniforms.uSkyLinked.value=1;
   };
  }
  const visible=Uint8Array.from(linkable,o=>shown(o)?1:0),key=visible.join('');
  if(key===sent)return;sent=key;
  linker.postMessage({kind:'visible',visible,job:++job});
 };
 return {
  probes:nx*ny*nz,
  request:()=>{step=0;relink();},
  /** Advances a bake a few directions per frame; true when a finished result was swapped in. */
  update:()=>{
   if(step<0)return false;
   run();
   if(step<DIRECTIONS)return false;
   uniforms.uSkyVolume.value=volumes[write].texture;uniforms.uSkyReady.value=1;write=1-write;step=-1;return true;
  },
  dispose:()=>{linker?.terminate();links.dispose();volumes.forEach(v=>v.dispose());depth.dispose();grid.dispose();accumulate.dispose();blocker.dispose();},
 };
}
