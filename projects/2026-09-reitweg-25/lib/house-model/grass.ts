import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {materialsOf} from './shader-features';

/** Real blades around an eye-level camera: dense within a few metres, thinning to the
 * textured lawn by 16 m. Clumps grow only where a downward ray first meets lawn. */
const RINGS:[number,number,number][]=[[0,4,55],[4,9,18],[9,16,5]];
export function eyeLevelGrass(scene:T.Scene,surfaces:T.Mesh[]){
 const blades=5,positions:number[]=[],colors:number[]=[],normals:number[]=[];
 const palette=['#4a7426','#5f8f33','#739f3d','#3a6120','#86a549'].map(c=>new T.Color(c));
 for(let b=0;b<blades;b++){
  const a=b/blades*Math.PI+(b%2)*.4,h=.07+(b%3)*.035,w=.006,lean=.02+b*.006,c=palette[b%palette.length],tip=c.clone().multiplyScalar(1.25);
  const dx=Math.cos(a),dz=Math.sin(a),ox=(b-2)*.012,oz=((b*7)%5-2)*.01;
  const base=[[ox-dx*w,0,oz-dz*w],[ox+dx*w,0,oz+dz*w]],top=[ox+Math.sin(a)*lean,h,oz-Math.cos(a)*lean];
  for(const [p,col] of [[base[0],c],[base[1],c],[top,tip]] as const){positions.push(...p);colors.push(col.r,col.g,col.b);normals.push(0,1,0);}
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,side:T.DoubleSide});
 const capacity=RINGS.reduce((n,[a,b,d])=>n+Math.round(Math.PI*(b*b-a*a)*d),0);
 const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='eye-level-grass';mesh.receiveShadow=true;mesh.visible=false;mesh.count=0;mesh.frustumCulled=false;mesh.userData.sway='grass';
 scene.add(mesh);
 const lawn=new Set(surfaces.filter(s=>materialsOf(s).some(m=>m.userData.photo==='lawn')));
 const ray=new T.Ray(),m=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3(),color=new T.Color();
 // One index, in world space, of the faces a downward ray can meet on the surfaces shown, each vertex marked lawn or
 // not; built again only when what is shown changes. A clump is then one lookup, not a test of every surface.
 let index:{key:string;bvh:MeshBVH;lawn:Uint8Array}|undefined;
 const v0=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3();
 const facesUp=(shown:T.Mesh[],visit:(isLawn:boolean)=>void)=>{
  for(const o of shown){
   const g=o.geometry,p=g.attributes.position,ids=g.index,count=ids?ids.count:p.count,side=materialsOf(o)[0].side,isLawn=lawn.has(o);
   // A mirrored transform turns faces over, as Mesh.raycast sees them.
   const turn=o.matrixWorld.determinant()<0?-1:1;
   for(let i=0;i+2<count;i+=3){
    v0.fromBufferAttribute(p,ids?ids.getX(i):i).applyMatrix4(o.matrixWorld);v1.fromBufferAttribute(p,ids?ids.getX(i+1):i+1).applyMatrix4(o.matrixWorld);v2.fromBufferAttribute(p,ids?ids.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
    const up=turn*((v1.z-v0.z)*(v2.x-v0.x)-(v1.x-v0.x)*(v2.z-v0.z));
    if(side===T.DoubleSide?up!==0:side===T.BackSide?up<0:up>0)visit(isLawn);
   }
  }
 };
 const indexed=()=>{
  const shown=surfaces.filter(o=>o.visible),key=shown.map(o=>o.id).join();
  if(index?.key===key)return index;
  index?.bvh.geometry.dispose();
  let n=0;facesUp(shown,()=>{n++;});
  const positions=new Float32Array(n*9),marks=new Uint8Array(n*3);n=0;
  facesUp(shown,isLawn=>{v0.toArray(positions,n*9);v1.toArray(positions,n*9+3);v2.toArray(positions,n*9+6);if(isLawn)marks.fill(1,n*3,n*3+3);n++;});
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  return index={key,bvh:new MeshBVH(geometry),lawn:marks};
 };
 // Clumps are placed into a staging copy and shown together, so the grass in view stays whole until the new set is ready.
 const matrices=new Float32Array(capacity*16),shades=new Float32Array(capacity*3);
 function* seeding(eye:T.Vector3){
  const {bvh,lawn:onLawn}=indexed();let n=0,seed=Math.floor(eye.x*131+eye.z*17)>>>0;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(const [inner,outer,density] of RINGS){
   const count=Math.round(Math.PI*(outer*outer-inner*inner)*density);
   for(let i=0;i<count&&n<capacity;i++){
    if(i%64===63)yield;
    const r=Math.sqrt(inner*inner+random()*(outer*outer-inner*inner)),a=random()*Math.PI*2,x=eye.x+Math.cos(a)*r,z=eye.z+Math.sin(a)*r;
    ray.origin.set(x,eye.y+3,z);ray.direction.set(0,-1,0);
    const hit=bvh.raycastFirst(ray,T.DoubleSide,0,eye.y+8);
    if(!hit||!onLawn[hit.face!.a])continue;
    q.setFromAxisAngle(new T.Vector3(0,1,0),random()*Math.PI*2);s.setScalar(.7+random()*.7);
    m.compose(new T.Vector3(x,hit.point.y+.002,z),q,s).toArray(matrices,n*16);
    const shade=.8+random()*.4;color.setRGB(shade,shade,shade*.9).toArray(shades,n*3);n++;
   }
  }
  for(let i=0;i<n;i++){mesh.setMatrixAt(i,m.fromArray(matrices,i*16));mesh.setColorAt(i,color.fromArray(shades,i*3));}
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.visible=n>0;
 }
 // A move made while another is under way waits for it, so slow frames still see the grass move.
 let pending:Generator|undefined,queued:T.Vector3|undefined;
 return {
  /** Grass around `eye`, placed at once. */
  showAround:(eye:T.Vector3)=>{pending=queued=undefined;const job=seeding(eye.clone());while(!job.next().done);},
  /** Grass around `eye`, placed a few milliseconds a frame by step(); the grass shown stays until then. */
  moveTo:(eye:T.Vector3)=>{queued=eye.clone();},
  /** Places clumps for up to `budget` ms; true when a moved set of grass has just been shown. */
  step:(budget=3)=>{
   if(!pending&&queued){pending=seeding(queued);queued=undefined;}
   if(!pending)return false;
   const end=performance.now()+budget;
   while(performance.now()<end)if(pending.next().done){pending=undefined;return true;}
   return false;
  },
  hide:()=>{pending=queued=undefined;mesh.visible=false;},
  dispose:()=>{pending=queued=undefined;geometry.dispose();material.dispose();mesh.removeFromParent();index?.bvh.geometry.dispose();index=undefined;},
 };
}
