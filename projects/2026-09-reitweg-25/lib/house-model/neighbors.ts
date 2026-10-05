import * as T from 'three';
import data from './neighbors.json';

/** The neighbors' buildings across the fence (Nos. 21 and 23 to the north, No. 27 to the south), from the Bavarian
 * survey's LoD2 building models: footprints from the cadastre, standard roof forms from airborne laser scanning.
 * Placed by fitting this house's own LoD2 building to the model (scripts/build-neighbors.mjs), each on the model's
 * ground at its own height, in plain off-white massing so they read as presence, not detail. */
export const NEIGHBORS=data;

/** Triangles of a planar ring of [x, y, z, ...], wound like the ring. */
function triangulate(ring:number[],out:number[]){
 const points=Array.from({length:ring.length/3},(_,i)=>new T.Vector3(ring[i*3],ring[i*3+1],ring[i*3+2]));
 const normal=new T.Vector3();
 points.forEach((p,i)=>{const q=points[(i+1)%points.length];normal.x+=(p.y-q.y)*(p.z+q.z);normal.y+=(p.z-q.z)*(p.x+q.x);normal.z+=(p.x-q.x)*(p.y+q.y);});
 // Drop the axis the ring faces most; triangulate in the other two.
 const n=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)],drop=n.indexOf(Math.max(...n));
 const flat=points.map(p=>{const a=p.toArray();a.splice(drop,1);return new T.Vector2(a[0],a[1]);});
 const e1=new T.Vector3(),e2=new T.Vector3();
 for(const [a,b,c] of T.ShapeUtils.triangulateShape(flat,[])){
  const [pa,pb,pc]=[points[a],points[b],points[c]],turned=e1.subVectors(pb,pa).cross(e2.subVectors(pc,pa)).dot(normal)<0;
  for(const p of turned?[pa,pc,pb]:[pa,pb,pc])out.push(p.x,p.y,p.z);
 }
}

/** One mesh of the neighbors' walls and roofs, each building standing on `groundAt` under its footprint. */
export function neighborHouses(groundAt:(x:number,z:number)=>number){
 const positions:number[]=[];
 for(const b of data.buildings){
  const f=b.footprint,base=Math.min(...Array.from({length:f.length/2},(_,i)=>groundAt(f[i*2],f[i*2+1])))-.05,start=positions.length;
  for(const ring of [...b.walls,...b.roofs])triangulate(ring,positions);
  for(let i=start+1;i<positions.length;i+=3)positions[i]+=base;
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color:'#dfdad0',roughness:.92});
 const mesh=new T.Mesh(geometry,material);mesh.name='neighbor-houses';mesh.castShadow=mesh.receiveShadow=true;
 return mesh;
}
