import * as T from 'three';
import {computeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {interiorRooms,type InteriorRoom} from './interior-data';
import {planPoint,UPPER_PLAN_X_OFFSET} from './site-data';
import {addShaderFeature,after,before,materialsOf} from './shader-features';

/** Reflections of the rooms themselves (Extreme). `rooms`: those that get one; `size`: each map's side; `height`: the
 * probe's height above the floor; `reach`: how far (m) a room's walls are looked for. */
export const ROOM_PROBES={rooms:['kitchen','dining','living','main-atrium','bedroom','upper-bedroom','garage'],size:256,height:1.45,reach:12};
type ProbeRoom=Pick<InteriorRoom,'id'|'level'|'center'>;
/** Rooms reflected without a place on the Views map: the garage, between the two cars' bays (garage-cars.ts). */
const PROBE_ONLY:ProbeRoom[]=[{id:'garage',level:'ground',center:[252,657]}];
export const probeRooms=():ProbeRoom[]=>ROOM_PROBES.rooms.map(id=>interiorRooms.find(r=>r.id===id)??PROBE_ONLY.find(r=>r.id===id)!);

/** Octahedral layout of directions over a square, y up: the upper half sphere fills the inner diamond. */
export function octEncode(d:T.Vector3){
 const s=Math.abs(d.x)+Math.abs(d.y)+Math.abs(d.z),x=d.x/s,y=d.y/s,z=d.z/s,sign=(v:number)=>v>=0?1:-1;
 const u=y>=0?x:(1-Math.abs(z))*sign(x),v=y>=0?z:(1-Math.abs(x))*sign(z);
 return new T.Vector2(u*.5+.5,v*.5+.5);
}
export function octDecode(uv:T.Vector2){
 const fx=uv.x*2-1,fz=uv.y*2-1,n=new T.Vector3(fx,1-Math.abs(fx)-Math.abs(fz),fz),t=Math.max(-n.y,0);
 n.x+=n.x>=0?-t:t;n.z+=n.z>=0?-t:t;return n.normalize();
}
const GLSL_OCT=`
vec2 roomOct(vec3 d){vec3 n=d/(abs(d.x)+abs(d.y)+abs(d.z));vec2 s=vec2(n.x>=0.0?1.0:-1.0,n.z>=0.0?1.0:-1.0);
 vec2 f=n.y>=0.0?n.xz:(1.0-abs(n.zx))*s;return f*0.5+0.5;}
vec3 roomDir(vec2 uv){vec2 f=uv*2.0-1.0;vec3 n=vec3(f.x,1.0-abs(f.x)-abs(f.y),f.y);float t=max(-n.y,0.0);
 n.x+=n.x>=0.0?-t:t;n.z+=n.z>=0.0?-t:t;return normalize(n);}`;
/** Where the ray from `p` along `r` leaves `box`, seen from the probe at `centre`: the direction to look up. */
export function boxProject(p:T.Vector3,r:T.Vector3,box:T.Box3,centre:T.Vector3){
 const exit=(a:'x'|'y'|'z')=>r[a]>0?(box.max[a]-p[a])/r[a]:r[a]<0?(box.min[a]-p[a])/r[a]:Infinity;
 const t=Math.min(exit('x'),exit('y'),exit('z'));
 return p.clone().addScaledVector(r,t).sub(centre).normalize();
}

/** Each room's box and probe: the floor and ceiling straight down and up from its plan centre, past anything nearer
 * than 0.9 m (an island, a table, a pendant lamp); each wall the median of six rays at 1.9 and 2.3 m above the floor
 * (over most furniture, under few door heads) and half a metre to either side, out to `reach`. */
export function roomBoxes(rooms:ReturnType<typeof probeRooms>,solids:T.Mesh[]){
 for(const o of solids){const g=o.geometry as T.BufferGeometry&{boundsTree?:unknown;computeBoundsTree?:typeof computeBoundsTree};if(!g.boundsTree){g.computeBoundsTree=computeBoundsTree;g.computeBoundsTree();}o.raycast=acceleratedRaycast;}
 const ray=new T.Raycaster();(ray as T.Raycaster&{firstHitOnly?:boolean}).firstHitOnly=true;
 const cast=(from:T.Vector3,dir:T.Vector3,far:number)=>{ray.set(from,dir);ray.far=far;return ray.intersectObjects(solids,false)[0]?.distance??far;};
 const past=(from:T.Vector3,dir:T.Vector3,far:number)=>new T.Raycaster(from,dir,.9,far).intersectObjects(solids,false)[0]?.distance??far;
 return rooms.map(room=>{
  const [px,pz]=planPoint(...room.center),x=px+(room.level==='upper'?UPPER_PLAN_X_OFFSET:0),start=room.level==='upper'?4.4:1.2;
  const floor=start-past(new T.Vector3(x,start,pz),new T.Vector3(0,-1,0),3);
  const centre=new T.Vector3(x,floor+ROOM_PROBES.height,pz),ceiling=centre.y+past(centre,new T.Vector3(0,1,0),5);
  const box=new T.Box3(new T.Vector3(x,floor,pz),new T.Vector3(x,ceiling,pz));
  for(const [axis,sign] of [['x',1],['x',-1],['z',1],['z',-1]] as const){
   const dir=new T.Vector3().setComponent(axis==='x'?0:2,sign),side=new T.Vector3().setComponent(axis==='x'?2:0,1),hits:number[]=[];
   for(const h of [1.9,2.3])for(const o of [-.5,0,.5])hits.push(cast(new T.Vector3(x,floor+h,pz).addScaledVector(side,o),dir,ROOM_PROBES.reach));
   hits.sort((a,b)=>a-b);const d=(hits[2]+hits[3])/2;
   if(sign>0)box.max[axis]=centre[axis]+d;else box.min[axis]=centre[axis]-d;
  }
  return {room,box,centre};
 });
}

/** The probes: baked from inside each room in the whole-house view, one cube face a frame, nearest room first, into
 * one layer each of a mipmapped octahedral map; again when asked (a new sun or renovations). Standard materials look a
 * reflection up where its ray leaves the room's box, blurred with roughness, in place of the sky's, while the camera
 * is inside a baked room (`setCamera`); views from outside keep the sky's. `beforeFace`: readies the scene for a face's
 * camera (trees in its view). */
/** What the WebGPU renderer bakes the probes with. */
export type ProbesGPU={tsl:any;NodeMaterial:new()=>T.Material;QuadMesh:new(material:T.Material)=>{render(renderer:unknown):void};CubeRenderTarget:new(size:number,options:object)=>T.WebGLCubeRenderTarget}; // eslint-disable-line @typescript-eslint/no-explicit-any
const WGSL_OCT=`
fn roomOct(d:vec3<f32>)->vec2<f32>{let n=d/(abs(d.x)+abs(d.y)+abs(d.z));let s=vec2<f32>(select(-1.0,1.0,n.x>=0.0),select(-1.0,1.0,n.z>=0.0));
 let f=select((1.0-abs(n.zx))*s,n.xz,n.y>=0.0);return f*0.5+0.5;}
fn roomDir(uv:vec2<f32>)->vec3<f32>{let f=uv*2.0-1.0;var n=vec3<f32>(f.x,1.0-abs(f.x)-abs(f.y),f.y);let t=max(-n.y,0.0);
 n.x+=select(t,-t,n.x>=0.0);n.z+=select(t,-t,n.z>=0.0);return normalize(n);}`;
export function createRoomProbes(renderer:T.WebGLRenderer,scene:T.Scene,receivers:T.Object3D[],solids:()=>T.Mesh[],beforeFace?:(camera:T.Camera)=>void,gpu?:ProbesGPU){
 const rooms=probeRooms(),count=rooms.length,size=ROOM_PROBES.size,lods=Math.log2(size);
 const maps=(gpu?new T.RenderTarget(size,size,{type:T.HalfFloatType,depthBuffer:false,depth:count}):new T.WebGLArrayRenderTarget(size,size,count,{type:T.HalfFloatType,depthBuffer:false})) as T.WebGLArrayRenderTarget;
 Object.assign(maps.texture,{generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter,magFilter:T.LinearFilter});
 const cube=gpu?new gpu.CubeRenderTarget(size,{type:T.HalfFloatType}):new T.WebGLCubeRenderTarget(size,{type:T.HalfFloatType});cube.texture.generateMipmaps=false;
 const eye=new T.CubeCamera(.05,400,cube);
 // The same conversion as a node material for the WebGPU renderer.
 const convertGPU=()=>{const {wgsl,wgslFn,uv,vec4,cubeTexture}=gpu!.tsl,m=new gpu!.NodeMaterial();
  Object.assign(m,{fragmentNode:vec4(cubeTexture(cube.texture,wgslFn('fn roomDirAt(uv:vec2<f32>)->vec3<f32>{return roomDir(uv);}',[wgsl(WGSL_OCT)])({uv:uv()})).rgb,1),depthTest:false,depthWrite:false});
  return new gpu!.QuadMesh(m);};
 const convert:{render(renderer:unknown):void;dispose?():void;material?:T.Material}=gpu?convertGPU():new FullScreenQuad(new T.ShaderMaterial({uniforms:{cube:{value:cube.texture}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`uniform samplerCube cube;varying vec2 vUv;${GLSL_OCT}\nvoid main(){gl_FragColor=vec4(textureCube(cube,roomDir(vUv)).rgb,1.0);}`,depthTest:false,depthWrite:false}));
 const uniforms={uRoomMaps:{value:maps.texture},uRoomMin:{value:rooms.map(()=>new T.Vector3())},uRoomMax:{value:rooms.map(()=>new T.Vector3())},
  uRoomCentre:{value:rooms.map(()=>new T.Vector3())},uRoomReady:{value:rooms.map(()=>0)},uRoomActive:{value:0}};
 const patched=new Set<T.Material>();let shared:any; // eslint-disable-line @typescript-eslint/no-explicit-any
 const receive=(root:T.Object3D)=>root.traverse(o=>{for(const m of materialsOf(o)){
  if(patched.has(m)||!(m instanceof T.MeshStandardMaterial))continue;patched.add(m);
  addShaderFeature(m,{key:'room-reflection',compile:shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 vRoomWorld;\n'+after(shader.vertexShader,'project_vertex',`
    vec4 roomWorld=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     roomWorld=instanceMatrix*roomWorld;
    #endif
    vRoomWorld=(modelMatrix*roomWorld).xyz;`);
   shader.fragmentShader=`uniform highp sampler2DArray uRoomMaps;uniform vec3 uRoomMin[${count}];uniform vec3 uRoomMax[${count}];uniform vec3 uRoomCentre[${count}];uniform float uRoomReady[${count}];uniform float uRoomActive;varying vec3 vRoomWorld;${GLSL_OCT}\n`+before(shader.fragmentShader,'lights_fragment_end',`
    #ifdef USE_ENVMAP
    if(uRoomActive>0.5){
     vec3 roomN=inverseTransformDirection(normal,viewMatrix),roomR=reflect(normalize(vRoomWorld-cameraPosition),roomN)+vec3(1e-5);
     for(int i=0;i<${count};i++){
      if(uRoomReady[i]<0.5||any(lessThan(vRoomWorld,uRoomMin[i]-0.05))||any(greaterThan(vRoomWorld,uRoomMax[i]+0.05)))continue;
      // Where the reflected ray leaves the room's box, seen from the probe; rougher surfaces read blurrier levels.
      vec3 far=max((uRoomMax[i]-vRoomWorld)/roomR,(uRoomMin[i]-vRoomWorld)/roomR);
      vec3 seen=normalize(vRoomWorld+roomR*min(min(far.x,far.y),far.z)-uRoomCentre[i]);
      radiance=textureLod(uRoomMaps,vec3(roomOct(seen),float(i)),sqrt(material.roughness)*${lods.toFixed(1)}).rgb*envMapIntensity;
      // A clear coat (car paint) reflects the room too, as sharp as its own roughness.
      #ifdef USE_CLEARCOAT
      clearcoatRadiance=textureLod(uRoomMaps,vec3(roomOct(seen),float(i)),sqrt(material.clearcoatRoughness)*${lods.toFixed(1)}).rgb*envMapIntensity;
      #endif
      break;
     }
    }
    #endif`);
  },variant:'',nodes:slots=>{
   // The same as nodes: the room the point stands in decides which layer the reflection is read from.
   const {If,wgsl,wgslFn,uniform,uniformArray,renderGroup,vec3,float,int,texture,normalize,reflect,sqrt,positionWorld,cameraPosition,materialEnvIntensity,materialRoughness}=slots.tsl;
   // One set for every material, in the group bound once a render: a set per material is a buffer and an update per
   // drawn object each frame.
   const {low,high,middle,ready,active,maps3,oct}=shared??={oct:wgslFn('fn roomOctAt(d:vec3<f32>)->vec2<f32>{return roomOct(d);}',[wgsl(WGSL_OCT)]),
    low:uniformArray(uniforms.uRoomMin.value).setGroup(renderGroup),high:uniformArray(uniforms.uRoomMax.value).setGroup(renderGroup),middle:uniformArray(uniforms.uRoomCentre.value).setGroup(renderGroup),
    ready:uniformArray(uniforms.uRoomReady.value,'float').setGroup(renderGroup),active:uniform(0).setGroup(renderGroup).onRenderUpdate(()=>uniforms.uRoomActive.value),
    maps3:texture(maps.texture).setUpdateMatrix(false)};
   slots.indirect.push((context:any)=>{ // eslint-disable-line @typescript-eslint/no-explicit-any
    // Only inside a baked room, and only that room's layer, is anything read: branches, as in the GLSL's loop.
    If(active.greaterThan(.5),()=>{
     const p=positionWorld,r=normalize(reflect(normalize(p.sub(cameraPosition)),slots.normal??vec3(0,1,0))).add(1e-5).toVar(),level=sqrt(slots.roughness??materialRoughness).mul(lods).toVar();
     // The first room the point stands in, then one look-up there: a look-up in each room's branch is paid for at
     // every pixel where the graphics card turns branches into selections.
     const index=int(-1).toVar();
     for(let i=count-1;i>=0;i--)If(ready.element(i).greaterThan(.5).and(p.greaterThanEqual(low.element(i).sub(.05)).all()).and(p.lessThanEqual(high.element(i).add(.05)).all()),()=>{index.assign(i);});
     If(index.greaterThanEqual(0),()=>{
      const lo=low.element(index),hi=high.element(index),far=hi.sub(p).div(r).max(lo.sub(p).div(r)),seen=normalize(p.add(r.mul(far.x.min(far.y).min(far.z))).sub(middle.element(index)));
      context.radiance.assign(maps3.depth(float(index)).sample(oct({d:seen})).level(level).rgb.mul(materialEnvIntensity));
     });
    });
   });
  }});
 }});
 for(const root of receivers)receive(root);
 let boxes:ReturnType<typeof roomBoxes>|undefined,dirty=true,room=-1,face=0;let stale=true,making=false;const done=new Set<number>();
 const from=new T.Vector3();
 return {
  /** Bakes again: a new sun, or renovations changed what is in the rooms. */
  request:()=>{dirty=true;},
  /** Something that arrives after the house (the garage's cars) reflects its room too, and is baked into it. */
  add:(root:T.Object3D)=>{receive(root);dirty=true;stale=true;},
  /** One cube face of the next probe; call in the whole-house view only. True when a room's map was swapped in. */
  step(camera:T.Camera){
   if(dirty){boxes=roomBoxes(rooms,solids());dirty=false;done.clear();room=-1;
    boxes.forEach(({box,centre},i)=>{uniforms.uRoomMin.value[i].copy(box.min);uniforms.uRoomMax.value[i].copy(box.max);uniforms.uRoomCentre.value[i].copy(centre);});}
   if(!boxes)return false;
   if(room<0){
    camera.getWorldPosition(from);let best=-1;
    boxes.forEach(({centre},i)=>{if(!done.has(i)&&(best<0||centre.distanceTo(from)<boxes![best].centre.distanceTo(from)))best=i;});
    if(best<0)return false;room=best;face=0;eye.position.copy(boxes[best].centre);eye.updateMatrixWorld(true);
    if(eye.coordinateSystem!==renderer.coordinateSystem){eye.coordinateSystem=renderer.coordinateSystem;eye.updateCoordinateSystem();}
   }
   const target=renderer.getRenderTarget(),active=uniforms.uRoomActive.value,shadows=renderer.shadowMap.autoUpdate;
   // A cube face is another kind of target than the view's, for which three's WebGPU renderer prepares every material
   // again: at the first face that held the page 2 s (M3 Max). In the background first, with nothing culled, and
   // again for what arrives after the house.
   if(gpu&&(stale||making)){
    if(!making){
     stale=false;making=true;const culled:T.Object3D[]=[];scene.traverse(o=>{if(o.frustumCulled){culled.push(o);o.frustumCulled=false;}});
     renderer.setRenderTarget(cube,0);const made=renderer.compileAsync(scene,eye.children[0] as T.Camera);renderer.setRenderTarget(target);
     for(const o of culled)o.frustumCulled=true;void made.catch(()=>{}).then(()=>{making=false;});
    }
    return false;}
   uniforms.uRoomActive.value=0;renderer.shadowMap.autoUpdate=false;
   try{
    const lens=eye.children[face] as T.PerspectiveCamera;beforeFace?.(lens);
    renderer.setRenderTarget(cube,face);renderer.render(scene,lens);face++;
    if(face<6)return false;
    renderer.setRenderTarget(maps,room);convert.render(renderer);
    uniforms.uRoomReady.value[room]=1;done.add(room);room=-1;return true;
   }finally{renderer.setRenderTarget(target);uniforms.uRoomActive.value=active;renderer.shadowMap.autoUpdate=shadows;}
  },
  /** Room reflections are used while `camera` stands in a baked room. */
  setCamera(camera:T.Camera){
   camera.getWorldPosition(from);
   uniforms.uRoomActive.value=boxes?.some(({box},i)=>uniforms.uRoomReady.value[i]>.5&&box.containsPoint(from))?1:0;
  },
  get boxes(){return boxes;},
  /** True while the camera stands in a baked room, where the reflections show (as of the last `setCamera`). */
  get active(){return uniforms.uRoomActive.value>.5;},
  /** Rooms still to bake. */
  get baking(){return dirty||done.size<count;},
  dispose:()=>{maps.dispose();cube.dispose();convert.dispose?.();(convert.material as T.Material|undefined)?.dispose();},
 };
}
export type RoomProbes=ReturnType<typeof createRoomProbes>;
