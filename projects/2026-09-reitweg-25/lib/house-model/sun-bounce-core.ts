import * as T from 'three';
import {MeshBVH,SAH} from 'three-mesh-bvh';

/** Sunlight bounced indoors, traced on the processor (sun-bounce.worker.ts runs it off the page's thread).
 * Rays leave each point of the sky-light grid that has something overhead; where one lands, the surface's position,
 * facing and colour are kept. Lighting them for a sun direction then needs no more rays: the sun's view of the house is
 * drawn into a depth map, and each landing counts the share of its footprint that the sun reaches. */
export type Grid={min:[number,number,number];cell:number;nx:number;ny:number;nz:number};
export type Shaded={probes:Int32Array;light:Float32Array;direction:Float32Array;neighbours:Uint32Array;open:Uint8Array};
const TAPS=8,MAP=1024;
// The 26 neighbours one cell away, as offsets; bit k of a point's mask says it sees neighbour k.
export const NEIGHBOURS:[number,number,number][]=[];
for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y||z)NEIGHBOURS.push([x,y,z]);

export function createTracer(positions:Float32Array,batch:Uint16Array,albedo:Float32Array,grid:Grid,rays:number,part=0,parts=1){
 const {min,cell,nx,ny,nz}=grid,count=nx*ny*nz,footprint=Math.tan(Math.acos(1-2/rays));
 const centre=(p:number,out:T.Vector3)=>{const x=p%nx,z=Math.floor(p/nx)%nz,y=Math.floor(p/(nx*nz));return out.set(min[0]+(x+.5)*cell,min[1]+(y+.5)*cell,min[2]+(z+.5)*cell);};
 let bvh:MeshBVH|undefined,vertexBatch=new Uint16Array(0);
 let probes=new Int32Array(0),start=new Int32Array(0),open=new Uint8Array(0),neighbours=new Uint32Array(0);
 let hit=new Float32Array(0),facing=new Int8Array(0),hitBatch=new Uint16Array(0);
 const ray=new T.Ray(),o=new T.Vector3(),d=new T.Vector3(),up=new T.Vector3(0,1,0);
 const trace=(far=Infinity)=>bvh!.raycastFirst(ray,T.DoubleSide,0,far);
 return {
  /** Builds the tree from the shown batches and traces this worker's share of the points. */
  setVisible(visible:Uint8Array){
   const keep:number[]=[];for(let v=0;v<batch.length;v+=3)if(visible[batch[v]])keep.push(v);
   const p=new Float32Array(keep.length*9);vertexBatch=new Uint16Array(keep.length*3);
   keep.forEach((v,i)=>{p.set(positions.subarray(v*3,v*3+9),i*9);vertexBatch.fill(batch[v],i*3,i*3+3);});
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));bvh=new MeshBVH(g,{strategy:SAH});
   // Points under a roof or ceiling, excluding those just inside a floor or slab; every parts-th one is this worker's.
   const chosen:number[]=[];let k=0;
   for(let q=0;q<count;q++){
    ray.origin.copy(centre(q,o));ray.direction.copy(up);const h=trace(12);
    if(!h||h.distance<.3&&h.face!.normal.dot(up)>0)continue;
    if(k++%parts===part)chosen.push(q);
   }
   probes=Int32Array.from(chosen);start=new Int32Array(probes.length+1);open=new Uint8Array(probes.length);neighbours=new Uint32Array(probes.length);
   hit=new Float32Array(probes.length*rays*3);facing=new Int8Array(probes.length*rays*3);hitBatch=new Uint16Array(probes.length*rays);
   let n=0;
   probes.forEach((q,i)=>{
    start[i]=n;centre(q,o);ray.origin.copy(o);
    // A different turn of the same even spread of directions at every point, so gaps between rays do not line up.
    const u=((q*0.6180339887)%1),w=((q*0.7548776662)%1);let inside=0;
    for(let r=0;r<rays;r++){
     const y=1-2*(r+u)/rays,s=Math.sqrt(Math.max(0,1-y*y)),a=r*2.399963+6.283185*w;
     ray.direction.set(Math.cos(a)*s,y,Math.sin(a)*s);
     const h=trace();if(!h)continue;
     const nrm=h.face!.normal;if(nrm.dot(ray.direction)>0){inside++;nrm.negate();}
     hit[n*3]=h.point.x;hit[n*3+1]=h.point.y;hit[n*3+2]=h.point.z;facing[n*3]=Math.round(nrm.x*127);facing[n*3+1]=Math.round(nrm.y*127);facing[n*3+2]=Math.round(nrm.z*127);
     hitBatch[n]=vertexBatch[h.face!.a];n++;
    }
    // A point that mostly sees the backs of faces sits inside a wall or slab; smoothing fills it from its neighbours.
    open[i]=inside<rays/2?1:0;
    if(!open[i])return;
    let mask=0;NEIGHBOURS.forEach(([x,y,z],b)=>{d.set(x,y,z).multiplyScalar(cell);const len=d.length();ray.origin.copy(o);ray.direction.copy(d).divideScalar(len);if(!trace(len))mask|=1<<b;});
    neighbours[i]=mask;
   });
   start[probes.length]=n;
  },
  /** Lights the kept landings for a sun direction; light is per unit of sunlight. */
  shade(sun:[number,number,number]):Shaded{
   const s=new T.Vector3(...sun).normalize(),depth=sunDepth(bvh!.geometry.attributes.position.array as Float32Array,s,grid);
   const light=new Float32Array(probes.length*4),direction=new Float32Array(probes.length*4);
   const q=new T.Vector3(),n=new T.Vector3(),t=new T.Vector3(),b=new T.Vector3(),tap=new T.Vector3(),x=new T.Vector3(1,0,0);
   probes.forEach((p,i)=>{
    centre(p,o);let r=0,g=0,bl=0,total=0;d.set(0,0,0);
    for(let k=start[i];k<start[i+1];k++){
     n.set(facing[k*3],facing[k*3+1],facing[k*3+2]).normalize();const c=n.dot(s);if(c<=0)continue;
     q.fromArray(hit,k*3);const dist=q.distanceTo(o);q.addScaledVector(n,.04);
     t.crossVectors(n,Math.abs(n.y)<.9?up:x).normalize();b.crossVectors(n,t);
     // The sun test spreads over the ray's footprint, so a sun patch counts by the share of it the ray covers.
     // Grazing sun needs more depth allowance: one texel of the map spans more depth on a steep surface.
     const radius=Math.min(dist*footprint,.8),bias=.05+.05*Math.min(8,Math.sqrt(1-c*c)/c);let seen=0;
     for(let j=0;j<TAPS;j++){const rr=radius*Math.sqrt((j+.5)/TAPS),e=j*2.399963+6.283185*(p*0.6180339887%1);tap.copy(q).addScaledVector(t,Math.cos(e)*rr).addScaledVector(b,Math.sin(e)*rr);seen+=depth.lit(tap,bias);}
     if(!seen)continue;
     const a=hitBatch[k]*3,f=c*seen/TAPS,lr=albedo[a]*f,lg=albedo[a+1]*f,lb=albedo[a+2]*f,m=.2126*lr+.7152*lg+.0722*lb;
     r+=lr;g+=lg;bl+=lb;total+=m;q.sub(o).normalize();d.addScaledVector(q,m);
    }
    light.set([r/rays,g/rays,bl/rays,open[i]],i*4);direction.set([d.x,d.y,d.z,total],i*4);
   });
   return {probes,light,direction,neighbours,open};
  },
 };
}

/** The sun's view of the house as a depth map: its nearest surface along the sun's direction, texel by texel. */
function sunDepth(p:Float32Array,s:T.Vector3,grid:Grid){
 const {min,cell,nx,ny,nz}=grid,size=[nx*cell,ny*cell,nz*cell],extent=Math.hypot(...size)/2+1;
 const c=new T.Vector3(min[0]+size[0]/2,min[1]+size[1]/2,min[2]+size[2]/2);
 const u=new T.Vector3().crossVectors(Math.abs(s.y)<.99?new T.Vector3(0,1,0):new T.Vector3(1,0,0),s).normalize(),v=new T.Vector3().crossVectors(s,u);
 const scale=MAP/(2*extent),map=new Float32Array(MAP*MAP).fill(Infinity),w=new T.Vector3();
 const project=(x:number,y:number,z:number,out:number[])=>{w.set(x-c.x,y-c.y,z-c.z);out[0]=(w.dot(u)+extent)*scale;out[1]=(w.dot(v)+extent)*scale;out[2]=-w.dot(s);};
 const A=[0,0,0],B=[0,0,0],C=[0,0,0];
 for(let i=0;i<p.length;i+=9){
  project(p[i],p[i+1],p[i+2],A);project(p[i+3],p[i+4],p[i+5],B);project(p[i+6],p[i+7],p[i+8],C);
  const area=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);if(Math.abs(area)<1e-9)continue;
  const x0=Math.max(0,Math.floor(Math.min(A[0],B[0],C[0]))),x1=Math.min(MAP-1,Math.ceil(Math.max(A[0],B[0],C[0])));
  const y0=Math.max(0,Math.floor(Math.min(A[1],B[1],C[1]))),y1=Math.min(MAP-1,Math.ceil(Math.max(A[1],B[1],C[1])));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const px=x+.5,py=y+.5;
   const wa=((B[0]-px)*(C[1]-py)-(B[1]-py)*(C[0]-px))/area,wb=((C[0]-px)*(A[1]-py)-(C[1]-py)*(A[0]-px))/area,wc=1-wa-wb;
   if(wa<-1e-4||wb<-1e-4||wc<-1e-4)continue;
   const z=wa*A[2]+wb*B[2]+wc*C[2],k=y*MAP+x;if(z<map[k])map[k]=z;
  }
 }
 const at=[0,0,0];
 return {lit:(q:T.Vector3,bias:number)=>{project(q.x,q.y,q.z,at);const x=Math.floor(at[0]),y=Math.floor(at[1]);if(x<0||y<0||x>=MAP||y>=MAP)return 1;return at[2]<=map[y*MAP+x]+bias?1:0;}};
}

/** Averages each point with the neighbours it sees, three times, so bounced light spreads about a metre without passing
 * through walls. Points inside walls take the average of all their neighbours. Returns the atlases the materials read:
 * layers side by side, x within a layer, then layer (height), across; z down. */
export function smoothIntoAtlas(parts:Shaded[],grid:Grid){
 const {nx,ny,nz}=grid,count=nx*ny*nz;
 let light=new Float32Array(count*4),direction=new Float32Array(count*4);
 const traced=new Uint8Array(count),valid=new Uint8Array(count),mask=new Uint32Array(count);
 for(const s of parts)s.probes.forEach((p,i)=>{traced[p]=1;valid[p]=s.open[i];mask[p]=s.neighbours[i];light.set(s.light.subarray(i*4,i*4+4),p*4);direction.set(s.direction.subarray(i*4,i*4+4),p*4);});
 const weight=NEIGHBOURS.map(([x,y,z])=>Math.exp(-.5*(x*x+y*y+z*z)));
 for(let pass=0;pass<3;pass++){
  const nl=new Float32Array(count*4),nd=new Float32Array(count*4),nv=new Uint8Array(count);
  for(let p=0;p<count;p++){
   if(!traced[p])continue;
   const x=p%nx,z=Math.floor(p/nx)%nz,y=Math.floor(p/(nx*nz));
   let sum=0;const add=(q:number,w:number)=>{for(let c=0;c<4;c++){nl[p*4+c]+=w*light[q*4+c];nd[p*4+c]+=w*direction[q*4+c];}sum+=w;};
   if(valid[p])add(p,1);
   NEIGHBOURS.forEach(([dx,dy,dz],b)=>{
    const X=x+dx,Y=y+dy,Z=z+dz;if(X<0||Y<0||Z<0||X>=nx||Y>=ny||Z>=nz)return;
    const q=X+Z*nx+Y*nx*nz;if(!traced[q]||!valid[q])return;if(valid[p]&&!(mask[p]&1<<b))return;
    add(q,weight[b]);
   });
   if(sum>0){for(let c=0;c<4;c++){nl[p*4+c]/=sum;nd[p*4+c]/=sum;}nv[p]=1;}
  }
  light=nl;direction=nd;valid.set(nv);
 }
 // The grid is x fastest, then z, then y; the atlas puts layers (y) side by side.
 const atlasLight=new Float32Array(count*4),atlasDirection=new Float32Array(count*4);
 for(let p=0;p<count;p++){const x=p%nx,z=Math.floor(p/nx)%nz,y=Math.floor(p/(nx*nz)),a=(z*nx*ny+y*nx+x)*4;atlasLight.set(light.subarray(p*4,p*4+4),a);atlasDirection.set(direction.subarray(p*4,p*4+4),a);}
 return {light:atlasLight,direction:atlasDirection};
}
