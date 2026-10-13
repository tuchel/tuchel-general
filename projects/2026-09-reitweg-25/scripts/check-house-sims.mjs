import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Sims Mode (More): the two of them, in Bavarian dress, wander the house and grounds. Each figure is a skinned glTF
// with a walk cycle and an idle loop, compressed as the car models are and credited; its standing height (in shoes) is
// 1.80 m and 1.65 m plus a sole. Wandering uses the walker's own collision: walls and furniture turn the figures, doors
// let them through, drops (the pool, stairwells) stop them; they keep to the plot, the garden and the ground floor.
await build({entryPoints:['lib/house-model/sims.ts','lib/house-model/renovation-data.ts','lib/house-model/build-model.ts','lib/house-model/site-data.ts','lib/house-model/pool.ts','lib/house-model/site-openings.ts','lib/house-model/walk.ts'],outdir:'tmp/sims-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {SIMS,CLIPS,createRoutines,finishFigure}=await import('../tmp/sims-check/sims.mjs');
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
 const names=(json.animations??[]).map(a=>a.name).sort();assert.deepEqual(names,[...CLIPS].sort(),`${who}: walking, standing, working and sitting loops (${names})`);
 assert((json.images??[]).every(i=>i.mimeType==='image/webp'),`${who}: WebP textures`);
}
// Credits: every community piece by author, licence and source.
{const credits=fs.readFileSync('public/assets/models/CREDITS.md','utf8');
 for(const s of ['Elvaerwyn','node/1413','node/1799','node/1801','node/1256','MargaretToigo','node/1706','node/1727','Joel Palmius','node/25','grinsegold','node/877','RehmanPolanski','node/2477','MakeHuman','CC0','CC BY'])assert(credits.includes(s),`CREDITS.md credits ${s}`);}

// Height in shoes, read from the decoded file: crown of the head to the soles, at the bind pose.
const shod={},programs=new Set();
{const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
 for(const [who,spec] of Object.entries(SIMS)){
  // Textures are left out: decoding WebP needs a browser. The JSON is rewritten without them and the file re-packed.
  const {buffer,json}=glb(spec.url),bin=buffer.subarray(20+buffer.readUInt32LE(12));
  const textured=new Map((json.materials??[]).map(m=>[m.name,{map:!!m.pbrMetallicRoughness?.baseColorTexture,normal:!!m.normalTexture}]));
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
  // Ankles: the skin under socks and shoes is hidden, so the knee socks run into the shoes all the way round each
  // ankle, and nothing of a shoe's own sock stands above its leather.
  const at=re=>{const out=[],v=new T.Vector3();gltf.scene.traverse(o=>{if(o.isSkinnedMesh&&re.test(o.name))for(let i=0;i<o.geometry.attributes.position.count;i++)out.push(o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld).clone());});return out;};
  const socks=at(/socks/),shoes=at(/shoes/),middle=box(/body/).getCenter(new T.Vector3()).x;
  for(const side of socks.length?[-1,1]:[]){
   const leg=p=>Math.sign(p.x-middle)===side,ankle=socks.filter(p=>leg(p)&&p.y>.15&&p.y<.3);
   const cx=ankle.reduce((s,p)=>s+p.x,0)/ankle.length,cz=ankle.reduce((s,p)=>s+p.z,0)/ankle.length;
   const sector=p=>Math.floor((Math.atan2(p.z-cz,p.x-cx)+Math.PI)/(Math.PI/4))%8,near=p=>leg(p)&&Math.hypot(p.x-cx,p.z-cz)<.08;
   const collar=Array(8).fill(-1),hem=Array(8).fill(9);
   for(const p of shoes)if(near(p))collar[sector(p)]=Math.max(collar[sector(p)],p.y);
   for(const p of socks)if(near(p))hem[sector(p)]=Math.min(hem[sector(p)],p.y);
   assert(Math.max(...collar)<.12,`${who}: ${side<0?'right':'left'} shoe ${Math.max(...collar).toFixed(3)} m high at the ankle, all leather`);
   collar.forEach((c,i)=>assert(hem[i]<c,`${who}: ${side<0?'right':'left'} sock ends at ${hem[i].toFixed(3)} m, above the shoe at ${c.toFixed(3)} m (${i*45-180}° round the ankle)`));
  }
  // Finished for the viewer (with stand-ins for the textures left out): skin and cloth opaque, without the exporter's
  // white sheen; hair, brows and the clear cornea cut out; nothing casts a shadow or enters the path tracer.
  gltf.scene.traverse(o=>{if(o.isMesh){const t=textured.get(o.material.name);if(t?.map)o.material.map=new T.Texture();if(t?.normal)o.material.normalMap=new T.Texture();}});
  const materials=finishFigure(gltf.scene),named=re=>materials.filter(m=>re.test(m.name));
  assert(materials.every(m=>!m.sheen),`${who}: no fabric sheen`);
  assert(named(/body$/).length===1&&named(/body$/).every(m=>!m.transparent&&m.depthWrite),`${who}: opaque skin`);
  assert(named(/hair|eyebrow|high-poly/).length>=3&&named(/hair|eyebrow|high-poly/).every(m=>m.alphaTest===.5&&!m.transparent),`${who}: hair, brows and cornea cut out`);
  gltf.scene.traverse(o=>{if(o.isMesh)assert(!o.castShadow&&o.userData.skipPhotographic,`${who}: ${o.name} casts no shadow and is not traced`);});
  // The features that set a material's shader program apart; each program compiles the first time it is drawn.
  gltf.scene.traverse(o=>{if(o.isMesh){const m=o.material;programs.add([m.type,!!m.map,!!m.normalMap,!!m.roughnessMap,!!m.metalnessMap,!!m.emissiveMap,!!m.aoMap,!!m.alphaMap,m.alphaTest>0,m.transparent,m.side,m.vertexColors,m.sheen>0,m.clearcoat>0,m.transmission>0,m.iridescence>0,m.flatShading,o.isSkinnedMesh,!!o.morphTargetInfluences].join());}});
  const seconds=Object.fromEntries(gltf.animations.map(a=>[a.name,a.duration]));
  for(const [clip,want] of Object.entries({walk:1.1,idle:4,work:3,sit:6}))assert(Math.abs(seconds[clip]-want)<.1,`${who}: ${clip} loops in ${want} s (${seconds[clip]?.toFixed(2)})`);
 }}
// Turning Sims Mode on adds few shader programs, and the viewer compiles them in the background before the figures
// appear: compiling one stalls the page, on some computers for a second or more.
assert(programs.size<=3,`the figures share ${programs.size} shader programs, at most 3 (opaque, cut out, the tuft's vertex colours)`);

// The routines, over the merged scene's surfaces as the viewer batches them: in the house as it stands, with each
// renovation on, and with all of them. Five minutes each, beginning and ending on the courtyard lawn; every step on a
// floor (a stair tread by tread), through nothing solid but doors, on the plot, never within 0.6 m of each other; each
// working stay at something within reach, each seated one on a seat.
const {renovationState}=await import('../tmp/sims-check/renovation-data.mjs');
const {terrainWithPoolOpening}=await import('../tmp/sims-check/pool.mjs'),{groundOpenings}=await import('../tmp/sims-check/site-openings.mjs');
const {mergeGeometries}=await import('three/addons/utils/BufferGeometryUtils.js');
const model=buildHouseModel(true);model.setLevel('exterior');
const stage=new T.Mesh(terrainWithPoolOpening(groundOpenings()),new T.MeshStandardMaterial());stage.position.y=-.035;stage.updateMatrixWorld(true);
// What the whole-house view draws in a renovation state, upper-floor rooms through the roofs included, merged into opaque
// and see-through meshes; doors and gates stay out: the figures pass through them.
const surfaces=state=>{
 model.setLevel('exterior');model.setRenovations({...renovationState(),...state});model.root.updateMatrixWorld(true);
 const drawn=[];model.root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&model.rendered(o)&&!o.userData.passable)drawn.push(o);});drawn.push(stage);
 const parts={opaque:[],clear:[]};
 for(const o of drawn){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);g.applyMatrix4(o.matrixWorld);(([o.material].flat().some(m=>m.transparent))?parts.clear:parts.opaque).push(g);}
 return Object.entries(parts).filter(([,l])=>l.length).map(([kind,list])=>{const m=new T.Mesh(mergeGeometries(list),new T.MeshBasicMaterial({transparent:kind==='clear'}));m.updateMatrixWorld(true);return m;});
};
const inPlot=(x,z)=>{let inside=false;for(let i=0,j=plotOutline.length-1;i<plotOutline.length;j=i++){const [xi,zi]=plotOutline[i],[xj,zj]=plotOutline[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;};
const ids=Object.keys(renovationState()),states=[{},...ids.map(id=>({[id]:true})),Object.fromEntries(ids.map(id=>[id,true]))];
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),dt=1/30,who=Object.keys(SIMS);
const lengths={},outdoors={},upstairs={};
for(const state of states){
 const name=Object.keys(state).length>1?'all renovations':Object.keys(state)[0]??'the house as it stands',meshes=surfaces(state);
 const figures=Object.values(SIMS).map(spec=>({root:new T.Group(),speed:spec.speed,routine:spec.routine}));
 const routines=createRoutines(figures,()=>meshes);routines.step(0);
 const loop=Math.max(...routines.figures.map(w=>w.table.length));
 routines.figures.forEach((w,i)=>{lengths[who[i]]=w.table.length;const first=w.table.legs.find(l=>l.walk),last=w.table.legs.findLast(l=>l.walk);
  assert(Math.hypot(first.points[0][0]-last.points.at(-1)[0],first.points[0][1]-last.points.at(-1)[1])<.01,`${who[i]}'s routine ends where it begins`);});
 for(let t=0;t<loop;t+=dt){
  const before=routines.figures.map(w=>w.root.position.clone()),legs=routines.figures.map(w=>w.table.legs.find(l=>((w.time%w.table.length))<l.end));
  routines.step(dt);
  routines.figures.forEach((w,i)=>{
   const p=w.root.position,leg=legs[i],at=`${who[i]} at ${t.toFixed(1)} s, ${name} (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
   assert(inPlot(p.x,p.z),`${at}: on the plot`);
   if(leg?.walk!==false||leg.clip!=='sit'){
    ray.set(new T.Vector3(p.x,p.y+.3,p.z),down);ray.far=.4;assert(ray.intersectObjects(meshes,false).length,`${at}: feet on a floor`);
    const d=p.clone().sub(before[i]);d.y=0;const len=d.length();
    if(len>1e-4){d.normalize();const side=new T.Vector3(-d.z,0,d.x);
     for(const h of [.5,1.2])for(const o of [-.2,0,.2]){ray.set(before[i].clone().addScaledVector(side,o).setY(before[i].y+h),d);ray.far=len;const hit=ray.intersectObjects(meshes,false)[0];assert(!hit,`${at}: walks through nothing solid at ${h} m`);}}
   }
   if(w.open>.3&&Object.keys(state).length===0)outdoors[who[i]]=(outdoors[who[i]]??0)+dt;
   if(p.y>2.5&&Object.keys(state).length===0)upstairs[who[i]]=(upstairs[who[i]]??0)+dt;
  });
  const [a,b]=routines.figures.map(w=>w.root.position);assert(Math.hypot(a.x-b.x,a.z-b.z)>.6||Math.abs(a.y-b.y)>2,`they keep apart (${t.toFixed(1)} s, ${name})`);
  for(const [i,w] of routines.figures.entries()){const leg=w.table.legs.find(l=>(w.time%w.table.length)<l.end);
   if(leg&&!leg.walk&&(w.time%w.table.length)-leg.start>.7&&(w.time%w.table.length)-leg.start<.7+dt){
    const p=w.root.position,face=new T.Vector3(leg.face[0]-p.x,0,leg.face[1]-p.z).normalize(),at=`${who[i]}'s ${leg.clip} at ${leg.spot.map(v=>v.toFixed(1))}, ${name}`;
    if(leg.clip==='work')assert([.35,.6,.9].some(h=>{ray.set(p.clone().setY(p.y+h),face);ray.far=.85;return ray.intersectObjects(meshes,false).length;}),`${at}: something within reach`);
    if(leg.clip==='sit'){ray.set(new T.Vector3(leg.spot[0],p.y+1.2,leg.spot[1]),down);ray.far=1.2;const hit=ray.intersectObjects(meshes,false)[0];assert(hit&&hit.point.y-p.y>.3&&hit.point.y-p.y<.55,`${at}: a seat under the hips (${hit?(hit.point.y-p.y).toFixed(2):'none'} m)`);}
   }}
 }
}
for(const w of who)assert(Math.abs(lengths[w]-300)<5,`${w}'s routine takes five minutes (${lengths[w].toFixed(0)} s)`);
// Her day: the stove, upstairs to the master bedroom, the family room, a walk round the garden. His: the garden, the
// garage workbench, the post from the front gate, a coffee.
const near=(w,clip,[x,z],d)=>{const legs=createRoutines([{root:new T.Group(),speed:SIMS[w].speed,routine:SIMS[w].routine}],()=>[]).figures[0].table.legs;return legs.some(l=>!l.walk&&l.clip===clip&&Math.hypot(l.spot[0]-x,l.spot[1]-z)<d);};
assert(near('her','work',[-1.83,-5.33],1)&&near('her','work',[1.2,6.3],1.4)&&near('her','sit',[1.4,6.2],.6)&&near('her','work',[-.06,8.9],1),'her day: the stove, the bed made and sat on, the family-room fire');
assert(near('him','work',[-16.5,3.2],1)&&near('him','idle',[-33.9,-5.4],1)&&near('him','work',[-1.83,-5.33],1),'his day: the workbench, the post from the gate, the stove');
assert(upstairs.her>30&&outdoors.her>60&&outdoors.him>60,`upstairs ${upstairs.her?.toFixed(0)} s; in the garden ${outdoors.her?.toFixed(0)} and ${outdoors.him?.toFixed(0)} s`);

// The More panel offers it, off by default; the viewer loads the figures the first time it is turned on.
{const panels=fs.readFileSync('components/studio/model/model-panels.tsx','utf8'),page=fs.readFileSync('components/studio/model/house-model.tsx','utf8'),viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
 assert(/>Sims Mode</.test(panels)&&/aria-pressed=\{p\.sims\}/.test(panels),'a Sims Mode button in More');
 assert(/\[sims,setSims\]=useState\(false\)/.test(page)&&/api\.current\?\.setSims\(sims\)/.test(page),'off by default, and passed to the viewer');
 assert(/setSims:/.test(viewer)&&/import\('\.\/sims'\)/.test(viewer),'the viewer loads the figures on demand');
 const compiled=viewer.search(/compileAsync\(group/),added=viewer.search(/scene\.add\(group\)/);
 assert(compiled>0&&compiled<added,'the viewer compiles the figures\' shaders before adding them to the scene');
 assert(/simsOn=on;if\(on\)sims\?\.routines\.restart\(\)/.test(viewer),'turned on, they start their routines from the beginning');
 assert(/w\.root\.visible=level!=='ground'\|\|w\.y<2/.test(viewer),'the ground-floor cutaway leaves out whoever is upstairs');}
console.log(`Passed: two figures, ${shod.him.toFixed(2)} m and ${shod.her.toFixed(2)} m in shoes, each a skinned, compressed glTF with walking, standing, working and sitting loops, credited, drawn with ${programs.size} shader programs compiled before they appear; their five-minute routines (her ${upstairs.her.toFixed(0)} s upstairs, ${outdoors.her.toFixed(0)} s in the garden; him ${outdoors.him.toFixed(0)} s in the garden) keep to floors and doors, apart, in the house as it stands and with every renovation. More offers Sims Mode, off by default.`);
