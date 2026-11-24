import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
import {MeshBVH} from 'three-mesh-bvh';
// Snow lies by the sun study's date: from mid-December to the end of February, whole through January. It lies on what
// faces up under an open sky and on nothing under a roof: the materials read what stands over each point from the sky
// light's grid (sky-links.ts, COVER) and from the roofs the grid does not know (snow.ts, snowCovers). Checked here
// against the model itself: every upward face with a roof over it is one the snow is kept off, and the open ground,
// roofs and terraces are not.
fs.mkdirSync('tmp/snow-check',{recursive:true});
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/static-batch.ts','lib/house-model/sky-visibility.ts','lib/house-model/sky-links.ts','lib/house-model/snow.ts','lib/house-model/renovation-data.ts','lib/house-model/christmas-tree.ts','lib/house-model/snow-slab.ts'],outdir:'tmp/snow-check',outExtension:{'.js':'.mjs'},bundle:true,splitting:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const M=n=>import(`../tmp/snow-check/${n}.mjs`);
const [{buildHouseModel},{batchStatic},{PROBE_GRID},{createLinker,coverSize,COVER},{snowOn,SNOW_SEASON,snowCovers,underCover,snowSurfaces,snow},{renovationState},{christmasTree,CHRISTMAS_TREE},{snowSlabs,SLAB}]=await Promise.all(['build-model','static-batch','sky-visibility','sky-links','snow','renovation-data','christmas-tree','snow-slab'].map(M));

// The dates.
const day=(month,date)=>Math.round((Date.UTC(2026,month-1,date)-Date.UTC(2026,0,1))/864e5)+1;
for(const [m,d] of [[3,1],[4,15],[6,21],[9,1],[10,15],[11,23],[12,10]])assert.equal(snowOn(day(m,d)),0,`no snow on ${d}.${m}.`);
for(const [m,d] of [[12,23],[12,31],[1,1],[1,20],[2,12]])assert.equal(snowOn(day(m,d)),1,`snow lies whole on ${d}.${m}.`);
for(const [m,d] of [[12,16],[2,20]]){const s=snowOn(day(m,d));assert(s>.2&&s<.8,`snow lies in part on ${d}.${m}. (${s.toFixed(2)})`);}
for(let d=SNOW_SEASON.settle[0];d<SNOW_SEASON.settle[1];d++)assert(snowOn(d+1)>=snowOn(d),'it settles day by day');
for(let d=SNOW_SEASON.melt[0];d<SNOW_SEASON.melt[1];d++)assert(snowOn(d+1)<=snowOn(d),'it melts day by day');
assert.equal(snowOn(365),snowOn(1),'the year turns without a step');

// The shaders: no sampler of their own (materials are near the 16 a graphics card allows), no hash by sin (lost on
// large arguments), one uniform for the amount.
const source=fs.readFileSync('lib/house-model/snow.ts','utf8');
assert(!/uniform\s+(highp\s+)?sampler/.test(source),'snow adds no sampler');assert(!/\bsin\(/.test(source),'no sin in the snow shaders');
assert(!/defines|needsUpdate/.test(source),'the amount never recompiles a shader');

// Snow mode (snowfall.ts): the flakes are one draw placed by its vertex shader, with no buffer written after the first
// frame; the viewer builds them when it is first turned on and draws them only while it is on, over the settled image.
const fall=fs.readFileSync('lib/house-model/snowfall.ts','utf8'),viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
assert.equal(fall.match(/new T\.Points\(/g)?.length,1,'the flakes are one draw');assert(!/needsUpdate|setUsage/.test(fall),'no buffer is written while it snows');
assert(/if\(on&&!snowfall\)\{const made=snowfall=createSnowfall\(/.test(viewer),'the flakes are built when snow mode is first turned on');
assert(/flakes=falling&&snowing&&flakesReady\?snowfall:undefined/.test(viewer)&&/if\(post\.accumulated>0\)\{post\.replay\(\);fall\(\);return;\}/.test(viewer),'a resting view is not drawn again under the flakes');

// The Christmas tree (christmas-tree.ts): hidden until the viewer shows it with the whole snow, outside the static batches
// and the photographs' scene, three draws of modest size, under the family room's ceiling and inside its walls.
{const tree=christmasTree(),meshes=[];tree.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
 assert(!tree.group.visible&&tree.glow.intensity===0&&!tree.glow.castShadow,'the tree and its glow start hidden, and the glow casts no shadow');
 assert.equal(meshes.length,3,'the tree is three draws');assert(meshes.every(o=>o.userData.dynamic&&o.userData.skipPhotographic&&o.userData.passable&&!o.material.map),'the tree stays out of batches, photographs and the walker’s way, without textures');
 const triangles=meshes.reduce((n,o)=>n+o.geometry.attributes.position.count/3,0),box=new T.Box3().setFromObject(tree.group);
 assert(triangles<30000,`the tree is ${triangles} triangles`);
 assert(box.min.y>.159&&box.max.y<2.62&&box.max.z<9.26&&box.max.x<5.6,`the tree stands inside the room (${box.min.toArray().map(v=>v.toFixed(2))} to ${box.max.toArray().map(v=>v.toFixed(2))})`);
 tree.show(true,2,1);assert(tree.group.visible&&tree.glow.intensity>0&&Math.abs(meshes[2].material.emissiveIntensity*2-CHRISTMAS_TREE.bulb)<1e-6,'shown, its bulbs hold their brightness on the screen and its glow comes on with the lamps');
 tree.show(false,2,1);assert(!tree.group.visible&&tree.glow.intensity===0,'and off with it');tree.dispose();}
assert(/festive\?\.show\(study\.enabled&&\(snowing\|\|snowOn\(study\.day\)===1\)/.test(viewer),'the tree stands while the snow lies whole or falls');

// The model as the viewer shows it, whole-house view.
const model=buildHouseModel(true);
const batches=batchStatic({root:model.root,states:model.stateCount,apply:model.applyState,rendered:model.rendered,externalRoots:[model.trees,...model.toggled]});
const {box,cell}=PROBE_GRID,size=box.getSize(new T.Vector3());
const grid={min:box.min.toArray(),cell,nx:Math.round(size.x/cell),ny:Math.round(size.y/cell),nz:Math.round(size.z/cell)};
const materials=o=>[o.material].flat(),shown=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
// Every renovation's batches take the snow, under the model's root or a toggled group; the uniform is one object.
snowSurfaces([model.root]);
const keyed=m=>(m.userData.shaderFeatures??[]).some(f=>f.key.startsWith('snow-'));
for(const b of batches.meshes)for(const m of materials(b))if(m.isMeshStandardMaterial&&!m.userData.lamp&&!m.emissive.getHex()&&(!m.transparent||m.userData.water))assert(keyed(m),`${b.name} (${b.parent.name||'root'}) takes the snow`);
assert(batches.meshes.some(b=>model.toggled.includes(b.parent)&&materials(b).every(keyed)),'renovations’ batches among them');
for(const m of new Set(batches.meshes.flatMap(materials)))if(keyed(m))assert.equal(m.userData.shaderFeatures.at(-1).key.slice(0,5),'snow-','snow composes after every other feature');
snow.amount=.5;assert.equal(snow.amount,.5);snow.amount=0;

const occluders=batches.meshes.filter(b=>materials(b).every(m=>!m.transparent&&!m.alphaTest&&m.userData.photo!=='lawn'));
const world=list=>{let count=0;for(const o of list)count+=o.geometry.attributes.position.count;
 const positions=new Float32Array(count*3),batch=new Uint16Array(count),v=new T.Vector3();let at=0;
 list.forEach((o,b)=>{const p=o.geometry.attributes.position;o.updateMatrixWorld();for(let i=0;i<p.count;i++,at++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);positions.set([v.x,v.y,v.z],at*3);batch[at]=b;}});
 return {positions,batch};};
const panes=batches.meshes.filter(b=>materials(b).every(m=>m.transparent&&!m.userData.water)),linked=[...occluders,...panes];
const house=world(linked),link=createLinker(house.positions,house.batch,grid,occluders.length);
// Everything that can stand over a point: the same batches and the glass, without leaves and hedges.
const solid=batches.meshes.filter(b=>materials(b).every(m=>!m.alphaTest&&!m.userData.hedgeBody&&!m.userData.water&&m.userData.photo!=='lawn'&&m.userData.photo!=='foliage'));
const all=world(solid);
const states={'as built':{},'front garage':{garage:true},'Winter Garden':{kitchen:true},'Winter Garden, large panes':{kitchen:true,wideGlass:true},'Winter Garden, zinc roof':{kitchen:true,catslide:true},'every renovation':Object.fromEntries(Object.keys(renovationState()).map(id=>[id,true]))};
const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),ray=new T.Ray();
for(const [label,on] of Object.entries(states)){
 const state={...renovationState(),...on};model.setLevel('exterior');model.setRenovations(state);batches.sync(model.stateOf('exterior',state));model.root.updateMatrixWorld(true);
 const cover=new Uint8Array(coverSize(grid));link(Uint8Array.from(linked,o=>shown(o)?1:0),cover);
 const covers=snowCovers(state);assert(covers.length<=4,'the roofs the grid does not know fit the uniforms');
 // What the materials read: the height over a point, blended between the quarter-metre samples.
 const over=(x,z)=>{const gx=(x-grid.min[0])/COVER.cell-.5,gz=(z-grid.min[2])/COVER.cell-.5,x0=Math.floor(gx),z0=Math.floor(gz),fx=gx-x0,fz=gz-z0;
  const h=(i,j)=>{i=Math.max(0,i);j=Math.max(0,j);return cover[((j>>1)*(grid.nx+1)*2+i)*4+(j&1)]/255;};
  return grid.min[1]+((h(x0,z0)*(1-fx)+h(x0+1,z0)*fx)*(1-fz)+(h(x0,z0+1)*(1-fx)+h(x0+1,z0+1)*fx)*fz)*grid.ny*grid.cell;};
 const inGrid=(x,y,z)=>x>grid.min[0]&&x<grid.min[0]+grid.nx*cell&&z>grid.min[2]&&z<grid.min[2]+grid.nz*cell&&y<grid.min[1]+grid.ny*cell;
 const snowed=(x,y,z)=>!underCover(covers,x,y,z)&&(!inGrid(x,y,z)||y-over(x,z)>-.55);
 const keep=[];for(let v=0;v<all.batch.length;v+=3)if(shown(solid[all.batch[v]]))keep.push(v);
 const tris=new Float32Array(keep.length*9);keep.forEach((v,i)=>tris.set(all.positions.subarray(v*3,v*3+9),i*9));
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(tris,3));const bvh=new MeshBVH(g);
 let roofed=0,wrong=0,open=0,bare=0;const worst=[];
 for(let f=0;f<keep.length;f++){
  a.fromArray(tris,f*9);b.fromArray(tris,f*9+3);c.fromArray(tris,f*9+6);n.subVectors(b,a).cross(c.clone().sub(a));const area=n.length()/2;n.normalize();
  if(n.y<.6||area<.01)continue;
  // The face's middle, and nearer each corner: a large face can run from under a roof into the open.
  for(const w of [[1/3,1/3,1/3],[.7,.15,.15],[.15,.7,.15],[.15,.15,.7]]){
   const p=new T.Vector3().addScaledVector(a,w[0]).addScaledVector(b,w[1]).addScaledVector(c,w[2]);
   ray.origin.copy(p).setY(p.y+.03);ray.direction.set(0,1,0);
   const hit=bvh.raycastFirst(ray,T.DoubleSide,0,40),lies=snowed(p.x,p.y,p.z);
   // A roof at least a metre over it, and its edge most of a metre away.
   const deep=hit&&hit.distance>1&&[[.9,0],[-.9,0],[0,.9],[0,-.9]].every(([dx,dz])=>{ray.origin.set(p.x+dx,p.y+.03,p.z+dz);return (bvh.raycastFirst(ray,T.DoubleSide,0,40)?.distance??0)>1;});
   if(deep){roofed+=area/4;if(lies){wrong+=area/4;worst.push([area/4,p.toArray().map(v=>v.toFixed(1)).join(',')]);}}
   else if(!hit&&[[.9,0],[-.9,0],[0,.9],[0,-.9]].every(([dx,dz])=>{ray.origin.set(p.x+dx,p.y+.03,p.z+dz);return !bvh.raycastFirst(ray,T.DoubleSide,0,40);})){open+=area/4;if(!lies)bare+=area/4;}
  }
 }
 worst.sort((x,y)=>y[0]-x[0]);
 assert(wrong<roofed*.004,`${label}: snow under a roof on ${wrong.toFixed(1)} of ${roofed.toFixed(0)} m² (${worst.slice(0,5).map(w=>w[1]).join(' · ')})`);
 assert(bare<open*.004,`${label}: ${bare.toFixed(1)} of ${open.toFixed(0)} m² of open surfaces take no snow`);
 console.log(`${label}: ${roofed.toFixed(0)} m² under roofs stay clear (${wrong.toFixed(2)} m² not), ${open.toFixed(0)} m² in the open take the snow (${bare.toFixed(2)} m² not).`);
}

// The roofs' packed layer (snow-slab.ts): one material, a mesh under every roof slope, cut only once snow lies, as deep
// as the roof's pitch lets it lie, open around the roof windows and the chimney, and out of the batches, the walker's
// way and the photographs.
{const slabs=snowSlabs(model.root,()=>undefined),source=fs.readFileSync('lib/house-model/snow-slab.ts','utf8');
 assert(!/\bsin\(/.test(source)&&!/defines|needsUpdate/.test(source),'the layer is shaped by the snow uniforms alone');
 assert(slabs.meshes.length>=10&&slabs.meshes.every(m=>m.material===slabs.material&&!m.visible&&!m.geometry.index),'no layer is cut or drawn before snow lies');
 const panels=model.root.getObjectByName(SLAB.panels);panels.visible=false;slabs.show(true);let triangles=0;const pitch={};
 for(const m of slabs.meshes){
  assert(m.userData.dynamic&&m.userData.skipPhotographic&&m.userData.passable&&m.castShadow&&m.receiveShadow,`${m.parent.name}: the layer casts and takes shadow and stays out of batches, obstacles and photographs`);
  assert(m.visible&&m.geometry.index,`${m.parent.name} carries a layer`);triangles+=m.geometry.index.count/3;
  const n=new T.Vector3().fromBufferAttribute(m.geometry.attributes.normal,0).transformDirection(m.matrixWorld),slab=m.geometry.attributes.slab;
  pitch[m.parent.name]=Math.round(T.MathUtils.radToDeg(Math.acos(n.y)));
  let margin=0,lip=0;for(let i=0;i<slab.count;i++){if(slab.getX(i)<0)margin++;if(slab.getY(i)===1&&slab.getX(i)<.001)lip++;}
  assert(lip>20,`${m.parent.name}: the layer has an edge to round off`);
  if(/^(main|guest)-roof-slope--1$/.test(m.parent.name))assert(margin>100,`${m.parent.name}: the layer is melted back around its roof windows`);
 }
 const deep=name=>SLAB.depth*Math.min(1,(SLAB.none-pitch[name])/(SLAB.none-SLAB.full));
 assert(deep('main-roof-slope-1')>.12&&deep('main-roof-slope-1')<.18,`the main roof carries ${deep('main-roof-slope-1').toFixed(2)} m`);
 assert.equal(deep('bin-room-roof'),SLAB.depth,'a low roof carries the whole depth');
 assert(triangles<200000,`the layers are ${triangles} triangles`);
 panels.visible=true;slabs.show(true);
 assert(slabs.meshes.every(m=>m.visible!==SLAB.panelled.test(m.parent.name)),'the roofs under solar panels go without the layer');
 panels.visible=false;slabs.show(false);assert(slabs.meshes.every(m=>!m.visible),'nothing of it is drawn without snow');
 console.log(`The roofs' packed snow: ${slabs.meshes.length} layers, ${triangles} triangles; ${Object.entries(pitch).map(([k,v])=>`${k} ${v}° ${(deep(k)*100).toFixed(0)} cm`).join(', ')}.`);
 slabs.dispose();}
model.dispose();
console.log('Passed: snow lies from mid-December to the end of February, on open surfaces only, for the house as built and with its renovations.');
