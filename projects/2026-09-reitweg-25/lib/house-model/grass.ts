import * as T from 'three';
import {computeBoundsTree,disposeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';
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
 const lawn=new Set(surfaces.filter(s=>materialsOf(s).some(m=>m.userData.photo==='lawn')).map(s=>s.uuid));
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),m=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3(),color=new T.Color();
 ray.firstHitOnly=true;
 let prepared=false;
 const prepare=()=>{
  if(prepared)return;prepared=true;
  for(const o of surfaces){const g=o.geometry as T.BufferGeometry&{computeBoundsTree:typeof computeBoundsTree};g.computeBoundsTree=computeBoundsTree;g.computeBoundsTree();o.raycast=acceleratedRaycast;}
 };
 return {
  showAround:(eye:T.Vector3)=>{
   prepare();let n=0,seed=Math.floor(eye.x*131+eye.z*17)>>>0;
   const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   const near=surfaces.filter(o=>o.visible&&o.geometry.boundingSphere&&o.geometry.boundingSphere.center.distanceTo(eye)<o.geometry.boundingSphere.radius+18);
   for(const [inner,outer,density] of RINGS){
    const count=Math.round(Math.PI*(outer*outer-inner*inner)*density);
    for(let i=0;i<count&&n<capacity;i++){
     const r=Math.sqrt(inner*inner+random()*(outer*outer-inner*inner)),a=random()*Math.PI*2,x=eye.x+Math.cos(a)*r,z=eye.z+Math.sin(a)*r;
     ray.set(new T.Vector3(x,eye.y+3,z),down);ray.far=eye.y+8;
     const hit=ray.intersectObjects(near,false)[0];
     if(!hit||!lawn.has(hit.object.uuid))continue;
     q.setFromAxisAngle(new T.Vector3(0,1,0),random()*Math.PI*2);s.setScalar(.7+random()*.7);
     m.compose(new T.Vector3(x,hit.point.y+.002,z),q,s);mesh.setMatrixAt(n,m);
     const shade=.8+random()*.4;mesh.setColorAt(n,color.setRGB(shade,shade,shade*.9));n++;
    }
   }
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.visible=n>0;
  },
  hide:()=>{mesh.visible=false;},
  dispose:()=>{geometry.dispose();material.dispose();mesh.removeFromParent();for(const o of surfaces){const g=o.geometry as T.BufferGeometry&{boundsTree?:unknown;disposeBoundsTree?:typeof disposeBoundsTree};if(g.boundsTree){g.disposeBoundsTree=disposeBoundsTree;g.disposeBoundsTree();}}},
 };
}
