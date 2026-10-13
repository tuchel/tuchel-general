import * as T from 'three';
import {createMover} from './walk';
import type {Point} from './site-data';
import {ROUTINES,type Step} from './sims-routines';

/** Sims Mode: the two of them, in Bavarian dress, go about a five-minute day of their own in the house and garden
 * (sims-routines.ts), from the start each time it is turned on. Each figure is a skinned glTF built from MakeHuman's base
 * mesh, skins and community clothes (public/assets/models/CREDITS.md), with an in-place walk cycle and loops for
 * standing, working with the hands and sitting. Heights are standing heights without shoes; `speed` (m/s) matches the
 * walk cycle's stride, so the feet do not slide. */
export const SIMS={
 him:{url:'/assets/models/sims-him.glb',height:1.80,speed:.9,routine:ROUTINES.him},
 her:{url:'/assets/models/sims-her.glb',height:1.65,speed:.8,routine:ROUTINES.her},
} as const;
/** The loops each figure plays. */
export const CLIPS=['walk','idle','work','sit'] as const;
export type Clip=typeof CLIPS[number];
/** The largest step up or down a figure takes between floors (m), as the eye-level walker does (walk.ts). */
const STEP=.45,TURN=4,FADE=.4,SETTLE=.6;

export type Figure={root:T.Object3D;speed:number;routine:readonly Step[];mixer?:T.AnimationMixer;actions?:Partial<Record<Clip,T.AnimationAction>>};
type Leg={walk:true;points:Point[];at:number[];length:number;pace:number;start:number;end:number}|{walk:false;clip:Clip;from:Point;spot:Point;face:Point;start:number;end:number};

/** A routine as a timetable: each walk takes its length at the figure's speed (times its pace), each stay its seconds. */
export function timetable(routine:readonly Step[],speed:number){
 const legs:Leg[]=[];let time=0,last:Point|undefined;
 for(const step of routine){
  if('path' in step){
   const at=[0];for(let i=1;i<step.path.length;i++)at.push(at[i-1]+Math.hypot(step.path[i][0]-step.path[i-1][0],step.path[i][1]-step.path[i-1][1]));
   const pace=step.pace??1,length=at.at(-1)!;legs.push({walk:true,points:step.path,at,length,pace,start:time,end:time+=length/(speed*pace)});last=step.path.at(-1);
  }else{
   const from=last??(routine.find((s):s is Extract<Step,{path:Point[]}>=>'path' in s)!.path[0]);
   legs.push({walk:false,clip:step.stay,from,spot:step.at??from,face:step.face,start:time,end:time+=step.seconds});
  }
 }
 return {legs,length:time};
}
const along=(leg:Extract<Leg,{walk:true}>,d:number):[number,number,number]=>{
 let i=1;while(i<leg.at.length-1&&leg.at[i]<d)i++;
 const [ax,az]=leg.points[i-1],[bx,bz]=leg.points[i],span=leg.at[i]-leg.at[i-1],t=span?T.MathUtils.clamp((d-leg.at[i-1])/span,0,1):1;
 return [ax+(bx-ax)*t,az+(bz-az)*t,Math.atan2(bx-ax,bz-az)];
};

/** The figures following their routines over the scene's surfaces: walks follow their paths, the feet on the floor below
 * (a stair one tread at a time); a stay turns the figure to face its point and, to sit, settles it onto the seat. A floor
 * that is hidden (the upper floor in the ground-floor cutaway) holds the figure at its height rather than dropping it. */
export function createRoutines(figures:Figure[],surfaces:()=>T.Mesh[]){
 const mover=createMover(surfaces);let meshes:T.Mesh[]=[],gathered=-1,clock=0;
 const ws=figures.map(f=>({...f,table:timetable(f.routine,f.speed),time:0,y:0,heading:0,clip:undefined as Clip|undefined,open:1,sky:0,x:0,z:0}));
 const play=(w:typeof ws[number],clip:Clip)=>{
  if(w.clip===clip)return;const on=w.actions?.[clip],off=w.clip&&w.actions?.[w.clip];w.clip=clip;
  if(on){on.enabled=true;on.setEffectiveWeight(1);on.reset().fadeIn(FADE).play();}off?.fadeOut(FADE);
 };
 // Where a figure stands at `time`: [x, z, heading or undefined, the leg].
 const at=(w:typeof ws[number],time:number)=>{
  const t=((time%w.table.length)+w.table.length)%w.table.length,leg=w.table.legs.find(l=>t<l.end)??w.table.legs.at(-1)!;
  if(leg.walk){const [x,z,h]=along(leg,(t-leg.start)*w.speed*leg.pace);return {x,z,heading:h,leg};}
  // Settle onto the seat at the start of a stay and back off it at the end.
  const k=Math.min(T.MathUtils.smoothstep(t-leg.start,0,SETTLE),T.MathUtils.smoothstep(leg.end-t,0,SETTLE));
  return {x:leg.from[0]+(leg.spot[0]-leg.from[0])*k,z:leg.from[1]+(leg.spot[1]-leg.from[1])*k,heading:Math.atan2(leg.face[0]-leg.from[0],leg.face[1]-leg.from[1]),leg};
 };
 // Feet onto the floor below, a little at a time along the way so a stair is climbed tread by tread.
 const settle=(w:typeof ws[number],x:number,z:number)=>{
  const n=Math.max(1,Math.ceil(Math.hypot(x-w.x,z-w.z)/.15));
  for(let i=1;i<=n;i++){const px=w.x+(x-w.x)*i/n,pz=w.z+(z-w.z)*i/n,y=mover.groundAt(px,pz,w.y+STEP,meshes);if(y!==undefined&&y>w.y-STEP)w.y=y;}
  w.x=x;w.z=z;
 };
 const restart=()=>{
  meshes=mover.solids();gathered=clock;
  for(const w of ws){
   w.time=0;w.clip=undefined;for(const a of Object.values(w.actions??{}))a?.stop();
   const p=at(w,0),first=w.table.legs.find(l=>l.walk);w.x=p.x;w.z=p.z;w.y=mover.groundAt(p.x,p.z,1.5,meshes)??0;w.heading=p.heading;
   if(first?.walk)w.heading=along(first,0)[2];
   w.root.position.set(w.x,w.y,w.z);w.root.rotation.y=w.heading;w.sky=0;
  }
 };
 return {
  figures:ws as readonly typeof ws[number][],
  /** Starts both from the beginning of their routines. */
  restart,
  /** Advances every figure by `dt` seconds. */
  step:(dt:number)=>{
   clock+=dt;if(gathered<0)restart();
   // What is solid is gathered twice a second: floors and renovations change only on a click.
   if(clock-gathered>.5){meshes=mover.solids();gathered=clock;}
   for(const w of ws){
    w.time+=dt;const p=at(w,w.time),leg=p.leg;
    if(leg.walk)settle(w,p.x,p.z);else{w.x=p.x;w.z=p.z;}
    play(w,leg.walk?'walk':leg.clip);
    if(leg.walk&&w.actions?.walk)w.actions.walk.timeScale=leg.pace;
    const diff=Math.atan2(Math.sin(p.heading-w.heading),Math.cos(p.heading-w.heading));w.heading+=Math.sign(diff)*Math.min(Math.abs(diff),TURN*dt);
    w.root.position.set(w.x,w.y,w.z);w.root.rotation.y=w.heading;
    // Light indoors: how much sky the figure sees, eased, so it dims inside as the rooms do (read every half second).
    if(clock>w.sky){w.sky=clock+.5;w.open=mover.openness(new T.Vector3(w.x,w.y+1.3,w.z));}
    w.mixer?.update(dt);
   }
  },
 };
}

/** A soft contact shadow under a figure: the static shadow map does not follow moving things. */
function contactShadow(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot(x-size/2+.5,y-size/2+.5)/(size/2),a=Math.max(0,1-r)**1.6;data.set([0,0,0,Math.round(a*255)],(y*size+x)*4);}
 const map=new T.DataTexture(data,size,size);map.needsUpdate=true;
 const mesh=new T.Mesh(new T.PlaneGeometry(.95,.95).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map,transparent:true,opacity:.42,depthWrite:false}));
 mesh.renderOrder=1;mesh.name='contact-shadow';return mesh;
}

/** A figure's materials finished for the viewer. Each set of material features is a shader program of its own, and
 * every program compiles the first time it is drawn, which stalls the page; so the figure keeps to three: everything is
 * a plain standard material, two-sided, with a colour map (white where it has none) and no normal map; hair, beard,
 * brows, lashes and the eyes' clear cornea are cut out by alpha; the rest, skin included, is opaque (the exporter marks
 * MakeHuman's materials as blended); the chamois tuft keeps its vertex colours. Fabric sheen is left out: as exported
 * it is full white, which washes the cloth out. The figure takes the scene's shadows and light but casts none (its
 * contact shadow stands in), and stays out of the path tracer and its photographs, which read static meshes only
 * (photographic-scene.ts). */
export function finishFigure(scene:T.Object3D){
 const finished=new Map<T.Material,T.MeshStandardMaterial>(),white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);
 white.colorSpace=T.SRGBColorSpace;white.needsUpdate=true;
 const finish=(source:T.Material)=>{
  let m=finished.get(source);if(m)return m;
  m=new T.MeshStandardMaterial().copy(source as T.MeshStandardMaterial);
  m.map??=white;m.normalMap=null;m.side=T.DoubleSide;m.transparent=false;m.opacity=1;m.depthWrite=true;
  m.alphaTest=/hair|beard|eyebrow|eyelash|high-poly/.test(m.name)?.5:0;
  m.userData.envBase=m.envMapIntensity;finished.set(source,m);return m;
 };
 scene.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  o.castShadow=false;o.receiveShadow=true;o.frustumCulled=false;o.userData.skipPhotographic=true;
  o.material=Array.isArray(o.material)?o.material.map(finish):finish(o.material);
 });
 return [...finished.values()];
}

/** Both figures, loaded and finished (finishFigure). A file that fails to load leaves its figure out. */
export async function loadSims(){
 const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const group=new T.Group();group.name='sims';
 const loaded=await Promise.allSettled(Object.entries(SIMS).map(async([name,spec])=>{
  const gltf=await loader.loadAsync(spec.url),root=new T.Group();root.name=`sims-${name}`;root.add(gltf.scene);
  const materials=finishFigure(gltf.scene);
  const shadow=contactShadow();shadow.userData.skipPhotographic=true;root.add(shadow);
  const mixer=new T.AnimationMixer(gltf.scene),actions:Partial<Record<Clip,T.AnimationAction>>={};
  for(const name of CLIPS){const clip=gltf.animations.find(a=>a.name===name);if(clip)actions[name]=mixer.clipAction(clip);}
  group.add(root);
  return {root,speed:spec.speed,routine:spec.routine,mixer,actions,materials:[...materials]} satisfies Figure&{materials:T.MeshStandardMaterial[]};
 }));
 for(const r of loaded)if(r.status==='rejected')console.warn('Sims figure unavailable',r.reason);
 return {group,figures:loaded.flatMap(r=>r.status==='fulfilled'?[r.value]:[])};
}
