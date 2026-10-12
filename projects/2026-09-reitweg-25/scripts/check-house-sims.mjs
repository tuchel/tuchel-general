import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Sims Mode (More): the two of them, in Bavarian dress, wander the house and grounds. Each figure is a skinned glTF
// with a walk cycle and an idle loop, compressed as the car models are and credited; its standing height (in shoes) is
// 1.80 m and 1.65 m plus a sole. Wandering uses the walker's own collision: walls and furniture turn the figures, doors
// let them through, drops (the pool, stairwells) stop them; they keep to the plot, the garden and the ground floor.
await build({entryPoints:['lib/house-model/sims.ts','lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/pool.ts','lib/house-model/site-openings.ts','lib/house-model/walk.ts'],outdir:'tmp/sims-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {SIMS,createWanderers,FLOOR_RANGE}=await import('../tmp/sims-check/sims.mjs');
const {buildHouseModel}=await import('../tmp/sims-check/build-model.mjs');
const {plotOutline}=await import('../tmp/sims-check/site-data.mjs');

// The two figures: heights without shoes, as given.
assert.deepEqual(Object.keys(SIMS),['him','her']);
assert.equal(SIMS.him.height,1.80);assert.equal(SIMS.her.height,1.65);

// Files: compressed (meshopt, quantized, WebP), skinned, with a walk and an idle animation, each under 8 MB.
const glb=file=>{
 const buffer=fs.readFileSync('public'+file),length=buffer.readUInt32LE(12);
 return {buffer,json:JSON.parse(buffer.subarray(20,20+length).toString())};
};
for(const [who,spec] of Object.entries(SIMS)){
 const {buffer,json}=glb(spec.url);
 assert(buffer.length<8e6,`${who}: ${(buffer.length/1e6).toFixed(1)} MB`);
 for(const e of json.extensionsRequired??[])assert(['EXT_meshopt_compression','KHR_mesh_quantization','EXT_texture_webp'].includes(e),`${who}: ${e} is decoded`);
 assert(json.extensionsUsed?.includes('EXT_meshopt_compression'),`${who}: meshopt geometry`);
 // One skin per skinned part, all on the same rig of 53 bones.
 const joints=new Set((json.skins??[]).flatMap(s=>s.joints));assert(json.skins?.length>=1&&joints.size===53,`${who}: one skeleton (${joints.size} joints over ${json.skins?.length} skins)`);
 const names=(json.animations??[]).map(a=>a.name).sort();assert.deepEqual(names,['idle','walk'],`${who}: walk and idle (${names})`);
 assert((json.images??[]).every(i=>i.mimeType==='image/webp'),`${who}: WebP textures`);
}
// Credits: every community piece by author, licence and source.
{const credits=fs.readFileSync('public/assets/models/CREDITS.md','utf8');
 for(const s of ['Elvaerwyn','node/1413','node/1799','node/1801','node/1256','MargaretToigo','node/1706','node/1727','Joel Palmius','node/25','grinsegold','node/877','RehmanPolanski','node/2477','MakeHuman','CC0','CC BY'])assert(credits.includes(s),`CREDITS.md credits ${s}`);}

// Height in shoes, read from the decoded file: crown of the head to the soles, at the bind pose.
const shod={};
{const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
 for(const [who,spec] of Object.entries(SIMS)){
  // Textures are left out: decoding WebP needs a browser. The JSON is rewritten without them and the file re-packed.
  const {buffer,json}=glb(spec.url),bin=buffer.subarray(20+buffer.readUInt32LE(12));
  delete json.images;delete json.textures;delete json.samplers;
  for(const m of json.materials??[]){for(const k of Object.keys(m.pbrMetallicRoughness??{}))if(k.endsWith('Texture'))delete m.pbrMetallicRoughness[k];for(const k of Object.keys(m))if(k.endsWith('Texture'))delete m[k];delete m.extensions;}
  json.extensionsRequired=(json.extensionsRequired??[]).filter(e=>e!=='EXT_texture_webp');json.extensionsUsed=(json.extensionsUsed??[]).filter(e=>e!=='EXT_texture_webp');
  let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,0x20)]);
  const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(20+text.length+bin.length,8);head.writeUInt32LE(text.length,12);head.writeUInt32LE(0x4e4f534a,16);
  const packed=Buffer.concat([head,text,bin]);
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.length),'');
  gltf.scene.updateMatrixWorld(true);
  const box=part=>{const b=new T.Box3();gltf.scene.traverse(o=>{if(o.isSkinnedMesh&&part.test(o.name)){o.computeBoundingBox();b.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return b;};
  const top=box(/body/).max.y,soles=box(/shoes/).min.y;shod[who]=top-soles;
  assert(shod[who]>spec.height-.005&&shod[who]<spec.height+.045,`${who}: ${shod[who].toFixed(3)} m in shoes for ${spec.height} m`);
  const walk=gltf.animations.find(a=>a.name==='walk'),idle=gltf.animations.find(a=>a.name==='idle');
  assert(Math.abs(walk.duration-1.1)<.05&&Math.abs(idle.duration-4)<.1,`${who}: walk ${walk.duration.toFixed(2)} s, idle ${idle.duration.toFixed(2)} s`);
 }}

// Wandering, over the merged scene's surfaces as the walk check builds them, for four simulated minutes.
const model=buildHouseModel(true);model.setLevel('exterior');model.root.updateMatrixWorld(true);
const meshes=[];model.root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&model.rendered(o))meshes.push(o);});
model.upper.visible=true;model.upper.traverse(o=>{if(o.isMesh&&!o.userData.alsoExterior)o.visible=false;});model.basement.visible=true;
{const {terrainWithPoolOpening}=await import('../tmp/sims-check/pool.mjs'),{groundOpenings}=await import('../tmp/sims-check/site-openings.mjs');
 const stage=new T.Mesh(terrainWithPoolOpening(groundOpenings()),new T.MeshStandardMaterial());stage.position.y=-.035;stage.updateMatrixWorld(true);meshes.push(stage);}
// As the viewer batches them: the solid surfaces in two merged meshes, opaque and see-through (glass counts as solid
// for walking, not for the light indoors). Doors and gates stay out: the figures pass through them.
{const {mergeGeometries}=await import('three/addons/utils/BufferGeometryUtils.js');
 const shown=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
 const parts={opaque:[],clear:[]};
 for(const o of meshes){
  if(o.userData.passable||!shown(o))continue;
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);
  g.applyMatrix4(o.matrixWorld);(([o.material].flat().some(m=>m.transparent))?parts.clear:parts.opaque).push(g);
 }
 meshes.length=0;
 for(const [kind,list] of Object.entries(parts))if(list.length){const m=new T.Mesh(mergeGeometries(list),new T.MeshBasicMaterial({transparent:kind==='clear'}));m.updateMatrixWorld(true);meshes.push(m);}}
let seed=7;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const figures=Object.values(SIMS).map(spec=>({root:new T.Group(),speed:spec.speed,start:spec.start}));
const sims=createWanderers(figures,()=>meshes,random);sims.step(0);   // stands each figure at its start
const inPlot=(x,z)=>{let inside=false;for(let i=0,j=plotOutline.length-1;i<plotOutline.length;j=i++){const [xi,zi]=plotOutline[i],[xj,zj]=plotOutline[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;};
// Solid surfaces, as the walker sees them: crossing one between frames would mean walking through it.
const solid=meshes.filter(o=>!o.userData.passable&&(()=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;})());
const ray=new T.Raycaster();
const dt=1/30,travelled=figures.map(()=>0),late=figures.map(()=>0),cells=figures.map(()=>new Set()),indoors=figures.map(()=>0);let walking=0,frames=0;
for(let t=0;t<240;t+=dt){
 const before=figures.map(f=>f.root.position.clone());
 sims.step(dt);frames++;
 figures.forEach((f,i)=>{
  const p=f.root.position,step=p.distanceTo(before[i]);travelled[i]+=step;if(t>180)late[i]+=step;cells[i].add(`${Math.floor(p.x/4)},${Math.floor(p.z/4)}`);
  if(sims.figures[i].open<.3)indoors[i]+=dt;
  assert(inPlot(p.x,p.z),`figure ${i} stays on the plot (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
  assert(p.y>=FLOOR_RANGE[0]-1e-6&&p.y<=FLOOR_RANGE[1]+1e-6,`figure ${i} keeps to the garden and ground floor (feet at ${p.y.toFixed(2)} m)`);
  if(step>1e-4){
   const d=p.clone().sub(before[i]);d.y=0;const len=d.length();d.normalize();
   for(const h of [.5,1.2]){ray.set(before[i].clone().setY(before[i].y+h),d);ray.far=len;assert.equal(ray.intersectObjects(solid,false).length,0,`figure ${i} walks through nothing solid at ${h} m (t ${t.toFixed(1)} s)`);}
  }
 });
 if(sims.figures.some(w=>w.mode==='walk'))walking++;
}
figures.forEach((f,i)=>{
 assert(travelled[i]>40,`figure ${i} walks ${travelled[i].toFixed(1)} m in four minutes`);
 assert(late[i]>4,`figure ${i} is still walking in the last minute (${late[i].toFixed(1)} m)`);
 assert(cells[i].size>=8,`figure ${i} goes about the grounds (${cells[i].size} 4 m squares)`);
});
assert(walking/frames>.4&&walking/frames<.97,`they pause now and then (walking ${(100*walking/frames).toFixed(0)} % of the time)`);

// The More panel offers it, off by default; the viewer loads the figures the first time it is turned on.
{const panels=fs.readFileSync('components/studio/model/model-panels.tsx','utf8'),page=fs.readFileSync('components/studio/model/house-model.tsx','utf8'),viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
 assert(/>Sims Mode</.test(panels)&&/aria-pressed=\{p\.sims\}/.test(panels),'a Sims Mode button in More');
 assert(/\[sims,setSims\]=useState\(false\)/.test(page)&&/api\.current\?\.setSims\(sims\)/.test(page),'off by default, and passed to the viewer');
 assert(/setSims:/.test(viewer)&&/import\('\.\/sims'\)/.test(viewer),'the viewer loads the figures on demand');}
console.log(`Passed: two figures, ${shod.him.toFixed(2)} m and ${shod.her.toFixed(2)} m in shoes, each a skinned, compressed glTF with walk and idle, credited; over four minutes they walk ${travelled.map(v=>v.toFixed(0)).join(' and ')} m (${indoors.map(v=>v.toFixed(0)).join(' and ')} s indoors), pausing now and then, through nothing solid, on the plot, the garden and the ground floor. More offers Sims Mode, off by default.`);
