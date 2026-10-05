import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
import {computeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';
// Eye-level grass (Detailed and Extreme) is re-seeded around the walker every 4 m: about 9,200 downward rays, a clump
// wherever one first meets lawn. The rays go to one index of the surfaces shown, rebuilt only when what is shown
// changes, and a walking re-seed is spread over frames, so walking no longer stalls every 4 m; the clumps are exactly
// those that testing every surface ray by ray places.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/grass.ts','lib/house-model/experience-data.ts','lib/house-model/static-batch.ts','lib/house-model/pool.ts','lib/house-model/site-openings.ts','lib/house-model/renovation-data.ts'],outdir:'tmp/grass-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/grass-check/${name}.mjs`);
const [{buildHouseModel},{eyeLevelGrass},{places},{batchStatic},{terrainWithPoolOpening},{groundOpenings},{renovationState}]=await Promise.all(['build-model','grass','experience-data','static-batch','pool','site-openings','renovation-data'].map(load));

// The house as the viewer shows it: static batches and the surrounding lawn.
const model=buildHouseModel(true),scene=new T.Scene();scene.add(model.root);
const batches=batchStatic({root:model.root,states:model.stateCount,apply:model.applyState,rendered:model.rendered,externalRoots:[model.trees,...model.toggled]});
const show=renovations=>{model.setLevel('exterior');model.setRenovations(renovations);batches.sync(model.stateOf('exterior',renovations));scene.updateMatrixWorld(true);};
const geometry=terrainWithPoolOpening(groundOpenings()),p=geometry.attributes.position;
for(let i=0;i<p.count;i++)p.setY(i,-5*T.MathUtils.smoothstep(p.getX(i),55,140));geometry.computeVertexNormals();
const material=new T.MeshStandardMaterial();material.userData.photo='lawn';
const stage=new T.Mesh(geometry,material);stage.position.y=-.035;scene.add(stage);
const surfaces=[...batches.meshes,stage];for(const s of surfaces)s.geometry.computeBoundingSphere();
show(renovationState());

// Ray by ray, every nearby surface tested for each clump.
const RINGS=[[0,4,55],[4,9,18],[9,16,5]],capacity=RINGS.reduce((n,[a,b,d])=>n+Math.round(Math.PI*(b*b-a*a)*d),0);
const isLawn=o=>[o.material].flat().some(m=>m.userData.photo==='lawn');
for(const o of surfaces){o.geometry.computeBoundsTree=computeBoundsTree;o.geometry.computeBoundsTree();o.raycast=acceleratedRaycast;}
const rayByRay=eye=>{
 let seed=Math.floor(eye.x*131+eye.z*17)>>>0;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),out=[];ray.firstHitOnly=true;
 const near=surfaces.filter(o=>o.visible&&o.geometry.boundingSphere.center.distanceTo(eye)<o.geometry.boundingSphere.radius+18);
 for(const [inner,outer,density] of RINGS){
  const count=Math.round(Math.PI*(outer*outer-inner*inner)*density);
  for(let i=0;i<count&&out.length<capacity;i++){
   const r=Math.sqrt(inner*inner+random()*(outer*outer-inner*inner)),a=random()*Math.PI*2,x=eye.x+Math.cos(a)*r,z=eye.z+Math.sin(a)*r;
   ray.set(new T.Vector3(x,eye.y+3,z),down);ray.far=eye.y+8;
   const hit=ray.intersectObjects(near,false)[0];
   if(!hit||!isLawn(hit.object))continue;
   random();random();random();out.push([x,hit.point.y+.002,z]);
  }
 }
 return out;
};
const grass=eyeLevelGrass(scene,surfaces),mesh=scene.getObjectByName('eye-level-grass');
const placed=()=>{const m=new T.Matrix4(),v=new T.Vector3();return Array.from({length:mesh.count},(_,i)=>{mesh.getMatrixAt(i,m);return v.setFromMatrixPosition(m).toArray();});};
const same=(eye,where)=>{
 grass.showAround(eye);const ours=placed(),theirs=rayByRay(eye);
 assert.equal(ours.length,theirs.length,`${where}: ${ours.length} clumps against ${theirs.length} ray by ray`);
 ours.forEach((q,i)=>assert(q.every((c,k)=>Math.abs(c-theirs[i][k])<1e-4),`${where}: clump ${i} at ${q.map(c=>c.toFixed(3))} against ${theirs[i].map(c=>c.toFixed(3))}`));
 return ours.length;
};

// The same clumps around every place; again with the east terrace paving part of the lawn.
const eyes=Object.entries(places).map(([key,v])=>[key,new T.Vector3(...v.position)]),counts={};
for(const [key,eye] of eyes)counts[key]=same(eye,key);
assert(counts.court>1000&&counts.lane>1000,'grass grows in the courtyard and by the curb');
show({...renovationState(),terrace:true});
const terrace=new T.Vector3(7.5,1.65,5.8);
const paved=same(terrace,'east terrace, paved');show(renovationState());assert(same(terrace,'east terrace, lawn')>paved,'the terrace takes the grass beneath it');

// While walking, each re-seed is placed a few milliseconds a frame, the grass in view kept whole until the new set is
// shown; it places the same clumps, and no frame spends more than a fiftieth of the time a re-seed takes ray by ray.
const time=f=>{let best=Infinity;for(let k=0;k<3;k++){const t=performance.now();f();best=Math.min(best,performance.now()-t);}return best;};
const court=new T.Vector3(...places.court.position),next=court.clone().add(new T.Vector3(4.1,0,0));grass.showAround(court);
const shown=mesh.count;let frames=0,longest=0;grass.moveTo(next);
for(;;){const t=performance.now(),done=grass.step();longest=Math.max(longest,performance.now()-t);frames++;if(done)break;assert.equal(mesh.count,shown,'the grass in view stays until the new set is ready');}
const theirs=rayByRay(next),ours=placed();
assert.equal(ours.length,theirs.length,'a moved set: the same clumps');ours.forEach((q,i)=>assert(q.every((c,k)=>Math.abs(c-theirs[i][k])<1e-4),'a moved set: the same clumps'));
const rayByRayTime=time(()=>rayByRay(next));
assert(longest<rayByRayTime/50,`the longest frame takes ${longest.toFixed(1)} ms against ${rayByRayTime.toFixed(0)} ms for a re-seed ray by ray`);
// A move made while another is under way waits for it, so slow frames still see the grass move; the latest move wins.
{const far=next.clone().add(new T.Vector3(4.1,0,0)),farther=far.clone().add(new T.Vector3(4.1,0,0));
 grass.moveTo(far);grass.step(.01);grass.moveTo(court);grass.moveTo(farther);
 let shown=0;for(let k=0;k<1000&&shown<2;k++)if(grass.step()){shown++;assert.equal(placed().length,rayByRay(shown===1?far:farther).length,shown===1?'the move under way finishes':'then the latest');}
 assert.equal(shown,2,'both moves shown');}
// Leaving eye level drops a move under way.
grass.moveTo(court);grass.step(.01);grass.hide();assert(!grass.step()&&!mesh.visible,'hidden grass stays hidden');
grass.dispose();
console.log(`Passed: a re-seed places the same clumps as testing every surface ray by ray (${counts.court} in the courtyard, ${counts.lane} by the curb; fewer on the paved terrace); walking, it takes ${frames} frames of at most ${longest.toFixed(1)} ms against ${rayByRayTime.toFixed(0)} ms at once ray by ray.`);
