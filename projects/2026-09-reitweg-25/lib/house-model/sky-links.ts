import * as T from 'three';
import {MeshBVH,SAH} from 'three-mesh-bvh';

/** Which neighbouring probes of the sky-light grid (sky-visibility.ts) see each other. A surface blends the eight probes
 * around it; where a wall, floor or roof passes between them, some stand in another room or outdoors and carry its light
 * through, and the grid shows as 0.5 m steps along every wall and slope that cuts across it. Each probe keeps three bits,
 * one per axis (x 1, y 2, z 4): whether the straight line to the next probe up that axis is clear. The materials then
 * blend only the probes joined to one another, the group that weighs most around the surface (skyAt in sky-visibility.ts).
 * A probe inside a wall or slab sees only the backs of faces and is joined to none. */
export type LinkGrid={min:[number,number,number];cell:number;nx:number;ny:number;nz:number};

export function createLinker(positions:Float32Array,batch:Uint16Array,grid:LinkGrid){
 const {min,cell,nx,ny,nz}=grid,ray=new T.Ray(),axes=[new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)];
 /** Grid order: x fastest, then z, then y, as the sky volume's layers. */
 return (visible:Uint8Array)=>{
  const keep:number[]=[];for(let v=0;v<batch.length;v+=3)if(visible[batch[v]])keep.push(v);
  const p=new Float32Array(keep.length*9);keep.forEach((v,i)=>p.set(positions.subarray(v*3,v*3+9),i*9));
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));
  const links=new Uint8Array(nx*ny*nz);
  if(!keep.length){links.fill(7);return links;}
  const bvh=new MeshBVH(g,{strategy:SAH});
  for(let y=0,k=0;y<ny;y++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++,k++){
   ray.origin.set(min[0]+(x+.5)*cell,min[1]+(y+.5)*cell,min[2]+(z+.5)*cell);
   let bits=0;
   for(let a=0;a<3;a++){
    if((a===0?x+1>=nx:a===1?y+1>=ny:z+1>=nz))continue;
    ray.direction.copy(axes[a]);
    if(!bvh.raycastFirst(ray,T.DoubleSide,0,cell))bits|=1<<a;
   }
   links[k]=bits;
  }
  return links;
 };
}

/** Whether corner `b` of a grid cell is reached from corner `a` (bit 0 x, bit 1 y, bit 2 z) along the cell's edges, x
 * then y then z or the reverse; `links` holds the eight corners' bits. As the shader reads it (sky-visibility.ts). */
export function reaches(a:number,b:number,links:ArrayLike<number>){
 const walk=(order:number[])=>{let at=a;for(const bit of order){if(!((at^b)&bit))continue;if(!(links[at&~bit]&bit))return false;at^=bit;}return true;};
 return walk([1,2,4])||walk([4,2,1]);
}
