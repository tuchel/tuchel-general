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

/** For every cell of the grid, which of its corners each corner reaches (`reaches`): what the materials would otherwise
 * search for at every pixel. A cell is named by its lowest corner, from one below the grid (a surface in the outer half
 * cell blends probes repeated at the edge, as the shader clamps them) to the last probe: (nx+1)·(nz+1)·(ny+1) cells, x
 * fastest, then z, then y. Each cell has two RGBA texels side by side, one byte per corner: bit k of byte a is set when
 * corner a reaches corner k. */
export function reachTable(links:Uint8Array,grid:LinkGrid){
 const {nx,ny,nz}=grid,table=new Uint8Array((nx+1)*(nz+1)*(ny+1)*8),l=new Uint8Array(8);
 const walk=(a:number,b:number,b0:number,b1:number,b2:number)=>{let at=a;for(const bit of [b0,b1,b2]){if(!((at^b)&bit))continue;if(!(l[at&~bit]&bit))return false;at^=bit;}return true;};
 for(let y=-1,t=0;y<ny;y++)for(let z=-1;z<nz;z++)for(let x=-1;x<nx;x++,t+=8){
  let open=true;
  for(let k=0;k<8;k++){
   const cx=Math.min(nx-1,Math.max(0,x+(k&1))),cy=Math.min(ny-1,Math.max(0,y+((k>>1)&1))),cz=Math.min(nz-1,Math.max(0,z+((k>>2)&1)));
   l[k]=links[(cy*nz+cz)*nx+cx];if(l[k]!==7)open=false;
  }
  if(open){table.fill(255,t,t+8);continue;}
  for(let a=0;a<8;a++){let mask=0;for(let k=0;k<8;k++)if(walk(a,k,1,2,4)||walk(a,k,4,2,1))mask|=1<<k;table[t+a]=mask;}
 }
 return table;
}
