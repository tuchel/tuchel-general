import * as T from 'three';
import {createMover} from './walk';
import {plotOutline,type Point} from './site-data';

/** Sims Mode: the two of them, in Bavarian dress, wander the house and grounds. Each figure is a skinned glTF built
 * from MakeHuman's base mesh, skins and community clothes (public/assets/models/CREDITS.md), with an in-place walk
 * cycle and an idle loop. Heights are standing heights without shoes; `speed` (m/s) matches the walk cycle's stride, so
 * the feet do not slide; `start` is where each figure first stands, on the courtyard lawn a few metres in front of the
 * courtyard's eye-level view. */
export const SIMS={
 him:{url:'/assets/models/sims-him.glb',height:1.80,speed:.9,start:[-11.2,10.1] as Point},
 her:{url:'/assets/models/sims-her.glb',height:1.65,speed:.8,start:[-11.9,11.1] as Point},
} as const;
/** Feet stay between these heights (m): the garden, terraces and ground floor, not the stairs to the upper floor or the
 * basement. */
export const FLOOR_RANGE=[-.5,.75] as const;
const TURN=2.6,FADE=.35,RADIUS=.28,APART=.9;

export type Figure={root:T.Object3D;speed:number;start:Point;mixer?:T.AnimationMixer;walk?:T.AnimationAction;idle?:T.AnimationAction};
type Wanderer=Figure&{mode:'idle'|'walk';until:number;heading:number;target:number;stuck:number;open:number;sky:number};

const inPlot=(x:number,z:number,margin:number)=>{
 let inside=false;
 for(let i=0,j=plotOutline.length-1;i<plotOutline.length;j=i++){const [xi,zi]=plotOutline[i],[xj,zj]=plotOutline[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}
 if(!inside||!margin)return inside;
 // Keep clear of the boundary hedges and fences.
 for(let i=0,j=plotOutline.length-1;i<plotOutline.length;j=i++){
  const [ax,az]=plotOutline[j],[bx,bz]=plotOutline[i],dx=bx-ax,dz=bz-az,t=T.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
  if(Math.hypot(x-ax-dx*t,z-az-dz*t)<margin)return false;
 }
 return true;
};
const PLOT_CENTRE=plotOutline.reduce((c,[x,z])=>[c[0]+x/plotOutline.length,c[1]+z/plotOutline.length],[0,0]);

/** Wandering: each figure walks a while in one direction, turning smoothly, then stands a few seconds and sets off
 * again. Walls and furniture slide it aside and, if it makes no headway, turn it; doors let it through; drops stop it,
 * as for the eye-level walker (walk.ts). It keeps to the plot, the garden and the ground floor, and steps round the
 * other figure. `random` is Math.random in the viewer, seeded in the check. */
export function createWanderers(figures:Figure[],surfaces:()=>T.Mesh[],random=Math.random){
 const mover=createMover(surfaces,RADIUS),move=new T.Vector3(),chest=new T.Vector3();let time=0,placed=false,meshes:T.Mesh[]=[],gathered=-1;
 const between=(a:number,b:number)=>a+(b-a)*random();
 const ws:Wanderer[]=figures.map(f=>({...f,mode:'idle',until:between(.5,2),heading:between(-Math.PI,Math.PI),target:0,stuck:0,open:1,sky:0}));
 ws.forEach(w=>{w.target=w.heading;w.root.rotation.y=w.heading;});
 const play=(w:Wanderer,mode:'idle'|'walk')=>{
  w.mode=mode;const on=mode==='walk'?w.walk:w.idle,off=mode==='walk'?w.idle:w.walk;
  if(on){on.enabled=true;on.setEffectiveWeight(1);on.reset().fadeIn(FADE).play();}off?.fadeOut(FADE);
 };
 const place=(meshes:T.Mesh[])=>{
  for(const w of ws){const [x,z]=w.start,y=mover.groundAt(x,z,1.5,meshes)??0;w.root.position.set(x,y,z);w.idle?.play();w.walk?.play().setEffectiveWeight(0);}
  placed=true;
 };
 return {
  figures:ws as readonly Wanderer[],
  /** Advances every figure by `dt` seconds; returns true (they are always moving, if only breathing). */
  step:(dt:number)=>{
   // What is solid is gathered twice a second: floors and renovations change only on a click.
   if(!placed||time-gathered>.5){meshes=mover.solids();gathered=time;}
   if(!placed)place(meshes);time+=dt;
   for(const w of ws){
    const p=w.root.position;
    if(w.mode==='idle'&&time>w.until){
     // Set off: a fresh direction, leaning toward the middle of the plot from near its edge.
     w.target=between(-Math.PI,Math.PI);
     if(!inPlot(p.x,p.z,4))w.target=Math.atan2(PLOT_CENTRE[0]-p.x,PLOT_CENTRE[1]-p.z)+between(-.6,.6);
     w.until=time+between(6,16);w.stuck=0;play(w,'walk');
    }
    if(w.mode==='walk'){
     // Turn smoothly toward the chosen heading; step round the other figure when close.
     for(const o of ws)if(o!==w&&o.root.position.distanceTo(p)<APART){const away=Math.atan2(p.x-o.root.position.x,p.z-o.root.position.z);w.target=away+between(-.5,.5);}
     const diff=Math.atan2(Math.sin(w.target-w.heading),Math.cos(w.target-w.heading));
     w.heading+=Math.sign(diff)*Math.min(Math.abs(diff),TURN*dt);
     const pace=w.speed*(Math.abs(diff)>1.2?.4:1);
     move.set(Math.sin(w.heading),0,Math.cos(w.heading)).multiplyScalar(pace*dt);
     const wanted=move.length(),next=mover.slide(p,move,meshes);
     const ok=!!next&&next.y>=FLOOR_RANGE[0]&&next.y<=FLOOR_RANGE[1]&&inPlot(next.x,next.z,.6);
     const progress=ok?Math.hypot(next.x-p.x,next.z-p.z):0;
     if(ok)p.copy(next);
     // No headway (a wall head-on, a drop, the boundary or a stair): turn well away.
     if(progress<.35*wanted)w.stuck+=dt;else w.stuck=Math.max(0,w.stuck-dt);
     if(w.stuck>.4){w.target=w.heading+Math.PI*between(.5,1.5)*(random()<.5?-1:1);w.stuck=0;}
     if(w.walk)w.walk.timeScale=T.MathUtils.clamp(progress/Math.max(1e-6,w.speed*dt),.3,1);
     if(time>w.until){w.until=time+between(2,6);play(w,'idle');}
    }
    w.root.rotation.y=w.heading;
    // Light indoors: how much sky the figure sees, eased, so it dims inside as the rooms do (read every half second).
    if(time>w.sky){w.sky=time+.5;w.open=mover.openness(chest.copy(p).setY(p.y+1.3));}
    w.mixer?.update(dt);
   }
   return true;
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

/** Both figures, loaded, with their materials finished for the viewer: hair, beard, brows and the chamois tuft cut out
 * by alpha, the eyes' clear cornea blended; the figures take the scene's shadows and light but cast only their soft
 * contact shadows. A file that fails to load leaves its figure out. */
export async function loadSims(){
 const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const group=new T.Group();group.name='sims';
 const loaded=await Promise.allSettled(Object.entries(SIMS).map(async([name,spec])=>{
  const gltf=await loader.loadAsync(spec.url),root=new T.Group();root.name=`sims-${name}`;root.add(gltf.scene);
  const materials=new Set<T.MeshStandardMaterial>();
  gltf.scene.traverse(o=>{
   if(!(o instanceof T.Mesh))return;
   // The path tracer and its photographs read static meshes only (photographic-scene.ts); the figures stay out of them.
   o.castShadow=false;o.receiveShadow=true;o.frustumCulled=false;o.userData.skipPhotographic=true;
   for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial)materials.add(m);
  });
  for(const m of materials){
   if(/hair|beard|eyebrow|eyelash|tuft/.test(m.name)){m.transparent=false;m.alphaTest=.5;m.depthWrite=true;m.side=T.DoubleSide;}
   else if(/high-poly/.test(m.name)){m.transparent=true;m.depthWrite=false;}
   m.userData.envBase=m.envMapIntensity;
  }
  const shadow=contactShadow();shadow.userData.skipPhotographic=true;root.add(shadow);
  const mixer=new T.AnimationMixer(gltf.scene),clip=(n:string)=>gltf.animations.find(a=>a.name===n);
  const walk=clip('walk')?mixer.clipAction(clip('walk')!):undefined,idle=clip('idle')?mixer.clipAction(clip('idle')!):undefined;
  group.add(root);
  return {root,speed:spec.speed,start:spec.start,mixer,walk,idle,materials:[...materials]} satisfies Figure&{materials:T.MeshStandardMaterial[]};
 }));
 for(const r of loaded)if(r.status==='rejected')console.warn('Sims figure unavailable',r.reason);
 return {group,figures:loaded.flatMap(r=>r.status==='fulfilled'?[r.value]:[])};
}
