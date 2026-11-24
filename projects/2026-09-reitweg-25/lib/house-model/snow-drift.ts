import * as T from 'three';
import {SNOW} from './snow';

/** Snow blown against the house: low banks along its gable walls, where no eave keeps the ground clear, on whatever
 * side stands outdoors. A bank is `height` m deep at the wall and runs `width` m out, each varying along the wall, and
 * tapers to nothing at the wall's ends. They grow and melt with the lying snow (`show`). */
export const DRIFT={height:[.1,.34],width:[.45,1.05],step:.4,taper:1.6,/** Clear of the wall's own corners (m). */inset:.15};
const PROFILE=[[0,1],[.22,.84],[.5,.5],[.78,.16],[1,0]];
const wave=(t:number,seed:number)=>.5+.27*Math.sin(t*.9+seed)+.15*Math.sin(t*2.3+seed*1.7)+.08*Math.sin(t*5.1+seed*.6);

/** The banks' geometry. `outlines`: the house's parts in plan, as closed polygons of [x, z]; `clear(x, z)`: outdoors
 * and free of anything built there. A gable wall is a side that runs across its part's longest side. */
export function driftGeometry(outlines:number[][][],clear:(x:number,z:number)=>boolean){
 const position:number[]=[],index:number[]=[];let seed=1;
 for(const outline of outlines){
  const sides=outline.map((a,i)=>{const b=outline[(i+1)%outline.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);return {a,b,len,u:[(b[0]-a[0])/len,(b[1]-a[1])/len]};});
  const long=sides.reduce((m,s)=>s.len>m.len?s:m),cx=outline.reduce((s,q)=>s+q[0],0)/outline.length,cz=outline.reduce((s,q)=>s+q[1],0)/outline.length;
  for(const side of sides){
   if(Math.abs(side.u[0]*long.u[0]+side.u[1]*long.u[1])>.5)continue;
   // Outward: away from the part's middle.
   let n=[-side.u[1],side.u[0]];const mid=[(side.a[0]+side.b[0])/2,(side.a[1]+side.b[1])/2];if((mid[0]-cx)*n[0]+(mid[1]-cz)*n[1]<0)n=[-n[0],-n[1]];
   const count=Math.max(1,Math.round((side.len-2*DRIFT.inset)/DRIFT.step)),at=(i:number)=>DRIFT.inset+(side.len-2*DRIFT.inset)*i/count;
   const open=Array.from({length:count+1},(_,i)=>{const d=at(i),x=side.a[0]+side.u[0]*d,z=side.a[1]+side.u[1]*d;return clear(x+n[0]*.35,z+n[1]*.35)&&clear(x+n[0]*.9,z+n[1]*.9);});
   for(let i=0;i<=count;){
    if(!open[i]){i++;continue;}
    let j=i;while(j<count&&open[j+1])j++;
    // One bank from sample i to j, tapered at both ends.
    const start=at(i),end=at(j),base=position.length/3;seed+=2.37;
    for(let k=i;k<=j;k++){
     const d=at(k),taper=T.MathUtils.smoothstep(Math.min(d-start,end-d),0,DRIFT.taper),h=T.MathUtils.lerp(DRIFT.height[0],DRIFT.height[1],wave(d,seed))*taper,w=T.MathUtils.lerp(DRIFT.width[0],DRIFT.width[1],wave(d,seed+9))*(.35+.65*taper);
     const x=side.a[0]+side.u[0]*d,z=side.a[1]+side.u[1]*d;
     for(const [out,up] of PROFILE)position.push(x+n[0]*out*w,up*h,z+n[1]*out*w);
    }
    const ring=PROFILE.length;
    for(let k=0;k<j-i;k++)for(let q=0;q<ring-1;q++){const a=base+k*ring+q,b=a+ring;index.push(a,b,a+1,a+1,b,b+1);}
    i=j+1;
   }
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setIndex(index);geometry.computeVertexNormals();
 return geometry;
}
/** The banks as one mesh under `parent`, rebuilt for what is built (`build`), out of the static batches, the walker's
 * way and the photographs' scene. Both faces are drawn, whichever way a wall was traced. */
export function snowDrifts(parent:T.Object3D,outlines:number[][][]){
 const material=new T.MeshStandardMaterial({color:new T.Color(...SNOW.albedo).multiplyScalar(.94),roughness:.9,side:T.DoubleSide});material.name='snow-drift';
 const mesh=new T.Mesh(new T.BufferGeometry(),material);mesh.name='snow-drifts';mesh.visible=false;mesh.castShadow=mesh.receiveShadow=true;
 Object.assign(mesh.userData,{dynamic:true,skipPhotographic:true,passable:true,skipSnow:true});parent.add(mesh);
 return {
  mesh,
  /** Cuts the banks again: at the start, and when a renovation changes what stands by the walls. */
  build:(clear:(x:number,z:number)=>boolean)=>{mesh.geometry.dispose();mesh.geometry=driftGeometry(outlines,clear);},
  /** How much snow lies (0–1): the banks rise with it. */
  show:(amount:number)=>{mesh.visible=amount>.02&&!!mesh.geometry.index?.count;mesh.scale.y=Math.max(amount,.001);},
  dispose:()=>{mesh.geometry.dispose();material.dispose();mesh.removeFromParent();},
 };
}
