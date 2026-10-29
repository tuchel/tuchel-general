import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
import {MeshBVH} from 'three-mesh-bvh';
// Sky light indoors (sky-visibility.ts). A surface blends the eight probes of the 0.5 m grid around it. Probes on the far
// side of a wall or roof stand outdoors or in another room; blended in, they showed the grid as stepped blocks along the
// loft's walls under the roof slopes. The materials now blend only probes in front of the surface and joined to one
// another by clear lines (sky-links.ts). Checked on the walls and slopes around the master bedroom and the gallery: the
// probes a surface blends see the point it reads from.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/static-batch.ts','lib/house-model/sky-visibility.ts','lib/house-model/sky-links.ts','lib/house-model/experience-data.ts'],outdir:'tmp/sky-links-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const M=n=>import(`../tmp/sky-links-check/${n}.mjs`);
const [{buildHouseModel},{batchStatic},{PROBE_GRID},{createLinker,reaches},{places}]=await Promise.all(['build-model','static-batch','sky-visibility','sky-links','experience-data'].map(M));

// The house as the viewer bakes it: opaque batches, whole-house state, cut-out cards left out.
const model=buildHouseModel(true);
const batches=batchStatic({root:model.root,states:model.stateCount,apply:model.applyState,rendered:model.rendered,externalRoots:[model.trees]});
batches.sync(model.stateOf('exterior',{}));model.root.updateMatrixWorld(true);
const occluders=batches.meshes.filter(b=>[b.material].flat().every(m=>!m.transparent&&!m.alphaTest&&m.userData.photo!=='lawn'));
let count=0;for(const o of occluders)count+=o.geometry.attributes.position.count;
const positions=new Float32Array(count*3),batch=new Uint16Array(count),visible=new Uint8Array(occluders.length);
let at=0;occluders.forEach((o,b)=>{const p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++,at++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);positions.set([v.x,v.y,v.z],at*3);batch[at]=b;}visible[b]=1;for(let s=o;s;s=s.parent)if(!s.visible)visible[b]=0;});
const {box,cell}=PROBE_GRID,size=box.getSize(new T.Vector3());
const grid={min:box.min.toArray(),cell,nx:Math.round(size.x/cell),ny:Math.round(size.y/cell),nz:Math.round(size.z/cell)};
let t=performance.now();const links=createLinker(positions,batch,grid)(visible);const linkMs=performance.now()-t;
assert.equal(links.length,grid.nx*grid.ny*grid.nz);

// The same triangles for line-of-sight tests.
const keep=[];for(let v=0;v<batch.length;v+=3)if(visible[batch[v]])keep.push(v);
const tris=new Float32Array(keep.length*9);keep.forEach((v,i)=>tris.set(positions.subarray(v*3,v*3+9),i*9));
const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(tris,3));const bvh=new MeshBVH(g),ray=new T.Ray();
const clear=(a,b)=>{const d=b.clone().sub(a),len=d.length();ray.origin.copy(a);ray.direction.copy(d.divideScalar(len));return !bvh.raycastFirst(ray,T.DoubleSide,0,len);};

// The probes a surface at p facing n blends, as skyAt in sky-visibility.ts picks them; `all` = plain filtering.
const dims=[grid.nx,grid.ny,grid.nz];
const blended=(p,n,all)=>{
 const q=p.clone().addScaledVector(n,.35),gf=[0,1,2].map(i=>(q.getComponent(i)-grid.min[i])/cell-.5),g0=gf.map(Math.floor),f=gf.map((v,i)=>v-g0[i]);
 const corners=[];
 for(let k=0;k<8;k++){
  const c=[0,1,2].map(i=>Math.min(dims[i]-1,Math.max(0,g0[i]+(k>>i&1)))),centre=new T.Vector3(...c.map((v,i)=>grid.min[i]+(v+.5)*cell));
  const b=[0,1,2].reduce((w,i)=>w*((k>>i&1)?f[i]:1-f[i]),1),front=Math.min(1,Math.max(0,centre.clone().sub(p).dot(n)/.15));
  corners.push({centre,w:all?b:b*front,l:links[c[0]+c[2]*grid.nx+c[1]*grid.nx*grid.nz]});
 }
 if(all)return {q,used:corners.filter(c=>c.w>.02)};
 const l=corners.map(c=>c.l);let group=0;for(let k=0;k<8;k++)if(reaches(0,k,l))group|=1<<k;
 if(group!==255){let most=-1;for(let a=0;a<8;a++){let m=0,joined=0;for(let k=0;k<8;k++)if(reaches(a,k,l)){m+=corners[k].w;joined|=1<<k;}if(m>most){most=m;group=joined;}}}
 return {q,used:corners.filter((c,k)=>group&1<<k&&c.w>.02)};
};

// Walls and slopes round the master bedroom and the gallery: rays from standing height in 24 directions, level and
// up toward the roof; around each hit a 1.6 m patch of the surface every 10 cm.
const surfaces=[];
for(const place of [places.bedroom])for(const lift of [0,.6,1.2])for(let a=0;a<24;a++){
 const o=new T.Vector3(...place.position),d=new T.Vector3(Math.cos(a/24*Math.PI*2),lift,Math.sin(a/24*Math.PI*2)).normalize();
 ray.origin.copy(o);ray.direction.copy(d);const h=bvh.raycastFirst(ray,T.DoubleSide,0,10);if(!h)continue;
 const n=h.face.normal.clone();if(n.dot(d)>0)n.negate();surfaces.push({point:h.point.clone(),n,sloped:Math.abs(n.y)>.2&&Math.abs(n.y)<.98});
}
assert(surfaces.length>40&&surfaces.some(s=>s.sloped),`walls and roof slopes found round the bedroom (${surfaces.length})`);
let points=0,leakPlain=0,leakLinked=0,sloped=0;
for(const {point,n,sloped:slope} of surfaces){
 const u=new T.Vector3().crossVectors(n,Math.abs(n.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize(),v=new T.Vector3().crossVectors(n,u);
 for(let i=-8;i<=8;i++)for(let j=-8;j<=8;j++){
  const p=point.clone().addScaledVector(u,i*.1).addScaledVector(v,j*.1);
  // Still on a surface facing the same way, with room in front of it.
  ray.origin.copy(p).addScaledVector(n,.03);ray.direction.copy(n).negate();const h=bvh.raycastFirst(ray,T.DoubleSide,0,.06);
  if(!h||Math.abs(h.face.normal.dot(n))<.99)continue;ray.direction.copy(n);if(bvh.raycastFirst(ray,T.DoubleSide,0,.4))continue;
  points++;if(slope)sloped++;
  const plain=blended(p,n,true),linked=blended(p,n,false);
  if(plain.used.some(c=>!clear(plain.q,c.centre)))leakPlain++;
  if(linked.used.some(c=>!clear(linked.q,c.centre)))leakLinked++;
 }
}
const share=x=>(100*x/points).toFixed(1)+'%';
assert(points>3000&&sloped>200,`enough surface sampled (${points} points, ${sloped} on slopes)`);
assert(leakPlain>points*.05,`plain filtering reads through walls and roofs here (${share(leakPlain)} of points)`);
assert(leakLinked<leakPlain/4,`the linked blend mostly does not (${share(leakLinked)} of points, against ${share(leakPlain)})`);
// The bake: enough directions that a probe seeing the sky through one roof window differs little from its neighbour.
assert(/DIRECTIONS=256\b/.test(fs.readFileSync('lib/house-model/sky-visibility.ts','utf8')),'256 sky directions');
console.log(`Passed: ${points} points on the walls and slopes round the master bedroom read sky light through a wall or roof ${share(leakPlain)} of the time with plain filtering and ${share(leakLinked)} with linked probes; links for ${links.length} probes in ${(linkMs/1000).toFixed(1)} s.`);
