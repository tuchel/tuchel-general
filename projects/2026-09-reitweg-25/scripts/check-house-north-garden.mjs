import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Round the main house and along its north gable, as photographed from the north-west corner, the kitchen terrace, the
// entrance walk and the courtyard (cameras fitted to the gable, the eaves and the corners): a strip of pale gravel with a
// steel edge wherever lawn or beds meet the walls; between the north gable and the hedge, a mulched bed with a young
// cherry about 1.8 m out from the wall, its crown grown away from the house; a dark green mesh fence from the north-east corner
// to the hedge; a black flue pipe up the gable by the north-west corner, through the verge to above the roof; and a pine
// in the bed north of the link.
await build({entryPoints:['lib/house-model/build-model.ts'],outdir:'tmp/north-garden-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/north-garden-check/build-model.mjs');
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
for(const realism of [false,true]){
 const model=buildHouseModel(realism),root=model.root;model.setLevel('exterior');root.updateMatrixWorld(true);
 const mode=realism?'detailed':'model';
 const shown=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;},ground=[];root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&shown(o))ground.push(o);});
 // What a raindrop meets first, below eaves height.
 const first=(x,z)=>{ray.set(new T.Vector3(x,1.2,z),down);ray.far=1.4;return ray.intersectObjects(ground,false)[0]?.object;};
 // The gravel strip, 0.5 m wide outside the cladding: along both gables, the west wall's ends beside the kitchen terrace
 // and the courtyard paving, and the east wall from the north-east corner to the terrace; mulch or lawn beyond it.
 const strip=[];for(let x=-6.3;x<=6.3;x+=.4){strip.push([x,-9.97,'the north gable'],[x,9.97,'the south gable']);}
 for(let z=-9.9;z<=-9;z+=.3)strip.push([-6.36,z,'the west wall by the kitchen terrace'],[6.36,z,'the east wall by the north-east corner']);
 for(let z=8.8;z<=9.9;z+=.3)strip.push([-6.36,z,'the west wall by the courtyard']);
 // Light-well grates and the chimney stand in the strip.
 const wells=[[-.8,.52],[1.17,2.48]],south=[[1,3.7],[-.5,.4]];
 for(const [x,z,what] of strip){if((z<0?wells:south).some(([a,b])=>x>a-.06&&x<b+.06)&&Math.abs(x)<6)continue;
  const o=first(x,z);assert.equal(o?.name,'house-gravel-strip',`${mode}: gravel along ${what} at (${x.toFixed(2)}, ${z.toFixed(2)}): ${o?.name||o?.parent?.name||'nothing'}`);}
 for(const [x,z] of [[-3,-10.45],[3,10.45]])assert.notEqual(first(x,z)?.name,'house-gravel-strip',`${mode}: the gravel strip is about 0.5 m wide (${x}, ${z})`);
 {const edge=root.getObjectByName('gravel-strip-edge');assert(edge,`${mode}: a steel edge holds the gravel`);const b=new T.Box3().setFromObject(edge);
  assert(b.max.y<.07&&b.min.x<-6.5&&b.max.x>6.5&&b.min.z<-10.1&&b.max.z>10.1,`${mode}: the steel edge runs round the strip, low`);}
 // Mulch from the gravel to the hedge, from the north-west corner to the fence; no lawn there.
 for(const [x,z] of [[-5,-11],[-2,-12.5],[1,-13.5],[4.5,-11.5],[-6.4,-12]]){const o=first(x,z);assert.equal(o?.name,'north-gable-mulch',`${mode}: mulch between the north gable and the hedge at (${x}, ${z}): ${o?.name||'nothing'}`);}
 assert.notEqual(first(7.5,-11.5)?.name,'north-gable-mulch',`${mode}: the mulch stops at the fence`);
 // The fence: about 1 m tall, from the north-east corner north to the hedge.
 {const fence=root.getObjectByName('north-garden-fence');assert(fence,`${mode}: the fence from the north-east corner`);const b=new T.Box3().setFromObject(fence);
  assert(b.max.y>.95&&b.max.y<1.1,`${mode}: the fence stands about 1 m (${b.max.y.toFixed(2)})`);assert(b.min.x>5.3&&b.max.x<6.2,`${mode}: the fence runs north from the corner (x ${b.min.x.toFixed(2)}–${b.max.x.toFixed(2)})`);
  assert(b.max.z>-10.4&&b.min.z<-13.8,`${mode}: from the gravel to the hedge (z ${b.min.z.toFixed(2)} to ${b.max.z.toFixed(2)})`);}
 // The flue: a black pipe 0.2 m across on the gable 0.8 m from the north-west corner, standing off the cladding, from
 // under the kitchen window's sill to a metre above the roof beside it.
 {const flue=root.getObjectByName('north-gable-flue');assert(flue,`${mode}: the flue pipe on the north gable`);const b=new T.Box3().setFromObject(flue),c=b.getCenter(new T.Vector3());
  const roof=2.95+(6.55-Math.abs(c.x))*(8-2.95)/6.55;
  assert(Math.abs(c.x+5.3)<.3&&b.max.z<-9.75&&b.min.z>-10.2,`${mode}: the flue stands outside the north gable by the north-west corner (${c.x.toFixed(2)}, ${b.min.z.toFixed(2)}–${b.max.z.toFixed(2)})`);
  assert(b.min.y<.8&&b.max.y>roof+.8&&b.max.y<roof+1.4,`${mode}: the flue rises from ${b.min.y.toFixed(2)} m to ${b.max.y.toFixed(2)} m, past the roof at ${roof.toFixed(2)} m`);}
 if(realism){
  const trees=root.getObjectByName('garden-trees'),found=[],v=new T.Vector3();
  for(const set of trees.userData.treeSets)set.matrices.forEach(matrix=>{const at=new T.Vector3().setFromMatrixPosition(matrix),box=new T.Box3(),leaves=[];
   for(const mesh of [set.bark,...set.crowns]){const p=mesh.geometry.attributes.position;for(let k=0;k<p.count;k+=3){v.fromBufferAttribute(p,k).applyMatrix4(matrix);box.expandByPoint(v);if(mesh!==set.bark)leaves.push(v.clone());}}
   found.push({x:at.x,z:at.z,kind:set.kind,box,leaves});});
  const one=(name,x,z)=>{const list=found.filter(t=>Math.hypot(t.x-x,t.z-z)<1);assert.equal(list.length,1,`${name}: one tree at (${x}, ${z}), found ${list.length}`);return list[0];};
  // The cherry: a broadleaf about 7.5 m tall, its trunk about 1.8 m out from the gable; its crown spreads 2.5 m and more toward
  // the hedge and stops short of the cladding, clear of the gable's verge.
  const cherry=one('the cherry by the north gable',-2,-11.5);
  assert.equal(cherry.kind,'broadleaf','the cherry is a broadleaf');assert(cherry.box.max.y>7&&cherry.box.max.y<8,`the cherry stands about 7.5 m (${cherry.box.max.y.toFixed(2)})`);
  assert(cherry.box.min.z<cherry.z-2.5,`the cherry's crown spreads toward the hedge (to z ${cherry.box.min.z.toFixed(2)})`);
  const wall=cherry.leaves.filter(q=>q.z>-10.15&&Math.abs(q.x)<6.6);assert.equal(wall.length,0,`the cherry's leaves stay clear of the gable and its verge (${wall.length} within)`);
  // No tree stands where the grounds plan put one west of the gable, on lawn in the aerial photograph.
  assert.equal(found.filter(t=>Math.hypot(t.x+8.9,t.z+14.7)<2).length,0,'no tree north-west of the house');
  // The pine in the bed north of the link: about 6.8 m tall.
  const pine=one('the pine north of the link',-11,-2.09);assert.equal(pine.kind,'pine','a pine north of the link');
  assert(pine.box.max.y>6.3&&pine.box.max.y<7.3,`the pine north of the link stands about 6.8 m (${pine.box.max.y.toFixed(2)})`);
 }
 model.dispose();
}
console.log('Passed: a pale gravel strip with a steel edge round the main house, mulch between the north gable and the hedge, the fence from the north-east corner, the flue up the north gable, the cherry 1.8 m off the gable with its crown grown away from the house, and the pine north of the link.');
