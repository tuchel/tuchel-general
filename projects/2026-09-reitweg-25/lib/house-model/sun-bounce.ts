import * as T from 'three';
import {addShaderFeature,before,materialsOf} from './shader-features';
import {PROBE_GRID} from './sky-visibility';
import {bounceGain,type Grid} from './sun-bounce-core';

/** Sunlight that enters a room lands on a floor or wall and lights the rest of the room from there.
 * Every point of the sky-light grid under a roof casts rays against the house; where a ray lands on a sunlit surface,
 * that surface's colour times its sunlight arrives from the ray's direction. The tracing runs on the processor, in
 * background workers (sun-bounce-core.ts): the graphics card only reads the finished result, since Safari on Apple
 * silicon drops the WebGL context when a shader runs as long as tracing takes. Each point keeps the colour of the
 * gathered light plus its main direction, per unit of sunlight: materials scale it by the live sun's strength and
 * colour; a new sun direction re-lights the kept rays, and a new floor, renovation or level traces them again.
 * `bounces` beyond the first are traced through the grid itself, each landing lit by the bounce before (Extreme traces
 * four); a factor stands in for the rest (bounceGain). */
const {box:BOX,cell:CELL}=PROBE_GRID;
const visibleIn=(o:T.Object3D)=>{for(let a:T.Object3D|null=o;a;a=a.parent)if(!a.visible)return false;return true;};

export function bakeSunBounce(occluders:T.Mesh[],receivers:T.Object3D[],sun:T.DirectionalLight,rays:number,bounces=1){
 const size=BOX.getSize(new T.Vector3()),nx=Math.round(size.x/CELL),ny=Math.round(size.y/CELL),nz=Math.round(size.z/CELL);
 const grid:Grid={min:BOX.min.toArray() as [number,number,number],cell:CELL,nx,ny,nz};
 // The atlases the materials read: half floats filter on every WebGL2 device, including iOS.
 const atlas=()=>{const t=new T.DataTexture(new Uint16Array(nx*ny*nz*4),nx*ny,nz,T.RGBAFormat,T.HalfFloatType);t.minFilter=t.magFilter=T.LinearFilter;return t;};
 const lightTexture=atlas(),directionTexture=atlas();
 const uniforms={uBounceLight:{value:lightTexture},uBounceDirection:{value:directionTexture},uBounceSun:{value:new T.Color(0,0,0)},
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

 // Workers start on the first request: each gets the house once, in world space, tagged with its batch.
 let workers:Worker[]=[],job=0,busy=false,pending=false,fresh=false,sent='';
 const start=()=>{
  let count=0;for(const o of occluders)count+=o.geometry.attributes.position.count;
  const positions=new Float32Array(count*3),batch=new Uint16Array(count),albedo=new Float32Array(occluders.length*3),v=new T.Vector3();
  let at=0;occluders.forEach((o,b)=>{
   const p=o.geometry.attributes.position;o.updateMatrixWorld();
   for(let i=0;i<p.count;i++,at++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);positions[at*3]=v.x;positions[at*3+1]=v.y;positions[at*3+2]=v.z;batch[at]=b;}
   const m=materialsOf(o)[0] as T.MeshStandardMaterial,c=(m.userData.albedo??m.color??new T.Color(.5,.5,.5)) as T.Color;
   albedo.set([Math.min(c.r,.9),Math.min(c.g,.9),Math.min(c.b,.9)],b*3);
  });
  // Two cores stay free for the page; a phone's six cores give it four workers at most.
  const parts=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||4)-2));
  // The first worker gathers each bounce from the others over message ports, so bounces never pass through the page.
  const channels=Array.from({length:parts-1},()=>new MessageChannel());
  workers=Array.from({length:parts},(_,part)=>{
   const w=new Worker(new URL('./sun-bounce.worker.ts',import.meta.url),{type:'module'});
   const peers=part===0?channels.map(c=>c.port1):[channels[part-1].port2];
   w.postMessage({kind:'init',positions,batch,albedo,grid,rays,part,parts,bounces,peers},peers);
   if(part===0)w.onmessage=({data}:MessageEvent<{kind:'atlas';job:number;light:Uint16Array;direction:Uint16Array}>)=>{
    if(data.job!==job)return;
    lightTexture.image.data=data.light;directionTexture.image.data=data.direction;lightTexture.needsUpdate=directionTexture.needsUpdate=true;
    uniforms.uBounceReady.value=1;busy=false;fresh=true;
   };
   return w;
  });
 };
 const send=()=>{
  if(!workers.length)start();
  const visible=Uint8Array.from(occluders,o=>visibleIn(o)?1:0),key=visible.join('');
  if(key!==sent){sent=key;for(const w of workers)w.postMessage({kind:'geometry',visible});}
  const s=sun.position.clone().sub(sun.target.position).normalize();
  job++;busy=true;pending=false;
  for(const w of workers)w.postMessage({kind:'sun',sun:s.toArray(),job});
 };
 return {
  /** Starts a fresh bake after the current one; call when the sun or the shown geometry changes. */
  request:()=>{pending=true;},
  /** Keeps the sun's strength live and starts waiting bakes; true when a finished result was swapped in. */
  update:()=>{
   uniforms.uBounceSun.value.copy(sun.color).multiplyScalar(sun.visible?sun.intensity*bounceGain(bounces):0);
   if(pending&&!busy)send();
   if(!fresh)return false;fresh=false;return true;
  },
  dispose:()=>{workers.forEach(w=>w.terminate());lightTexture.dispose();directionTexture.dispose();},
 };
}
