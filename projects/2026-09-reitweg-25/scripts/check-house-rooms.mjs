import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The hall, the kitchen, the living room and the gallery as photographed. In the hall: a long dark sideboard of drawers
// against the dining-room wall north of its doorway, a large canvas leaning on it; a steel glazed door in that doorway; a
// plaster head over the opening into the west corridor; a warm grey-beige stone floor. Window frames are oak inside and
// black outside. In the kitchen: one thin solid oak top on the island; a broad sage hood on a black band over open shelf
// units either side of the cooker; black cylinder lights over the island and the range; two brass pendants over the
// breakfast table; linen curtains beside its window, on two casements. In the living room: a chimney breast standing
// proud of the wall with a firebrick-lined firebox in a smooth limestone surround, a dark slate hearth and a sunburst
// mirror; linen curtains either side of both south windows. Curtains and fittings take the house's shadows. In the gallery: a low knee wall
// under a deep spruce shelf of books, stacks of books below, rafters over it and twin spotlights on the slope.
await build({entryPoints:['lib/house-model/build-model.ts'],outdir:'tmp/rooms-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/rooms-check/build-model.mjs');
const lightness=m=>m.color.getHSL({h:0,s:0,l:0},T.SRGBColorSpace).l;
for(const realism of [false,true]){
 const model=buildHouseModel(realism),root=model.root;root.updateMatrixWorld(true);const mode=realism?'detailed':'model';
 const box=name=>{const o=root.getObjectByName(name);assert(o,`${mode}: ${name}`);return new T.Box3().setFromObject(o);};
 // The sideboard: about 2.45 m long, 0.5 m deep and 0.9 m tall, its back to the wall (inner face at x 0.96), its south end
 // clear of the dining-room doorway (z 2.31).
 {const b=box('hall-sideboard'),size=b.getSize(new T.Vector3());
  assert(b.max.x>.92&&b.max.x<.97,`${mode}: the sideboard stands against the dining-room wall (x ${b.max.x.toFixed(2)})`);
  assert(size.z>2.35&&size.z<2.6&&size.x>.42&&size.x<.58,`${mode}: the sideboard is about 2.45 × 0.5 m (${size.z.toFixed(2)} × ${size.x.toFixed(2)})`);
  assert(b.max.y-.16>.85&&b.max.y-.16<.95,`${mode}: the sideboard is about 0.9 m tall (${(b.max.y-.16).toFixed(2)})`);
  assert(b.max.z<2.2,`${mode}: the sideboard ends clear of the dining-room doorway (z ${b.max.z.toFixed(2)})`);
  const c=box('hall-canvas');assert(c.min.y>b.max.y-.02&&c.max.y>2.4&&c.max.x<.97&&c.min.z>b.min.z&&c.max.z<b.max.z,`${mode}: a large canvas leans on the wall above the sideboard`);}
 // The dining-room doorway is 0.9 m wide between piers, as drawn on the ground plan (z 2.50–3.42), and a black steel
 // glazed door closes it at the dining room's face of the wall.
 {const meshes=[],ray=new T.Raycaster(),shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const east=z=>{ray.set(new T.Vector3(.3,1.2,z),new T.Vector3(1,0,0));return ray.intersectObjects(meshes,false).find(h=>shown(h.object));};
  for(const z of [2.42,3.5]){const hit=east(z);assert(hit&&Math.abs(hit.point.x-.96)<.03,`${mode}: the hall wall stands beside the dining-room doorway at z ${z} (${hit?.point.x.toFixed(2)})`);}
  // The opening from the hall into the west corridor (z 2.2–3.4) has a plaster head at door height, level with the dining
  // and sitting-room doors.
  {const west=y=>{ray.set(new T.Vector3(-1,y,2.79),new T.Vector3(-1,0,0));return ray.intersectObjects(meshes,false).find(h=>shown(h.object)&&![h.object.material].flat().some(m=>m.transparent));};
   const head=west(2.6),open=west(1.5);assert(head&&Math.abs(head.point.x+3.2)<.05,`${mode}: a head over the hall's west opening (${head?.point.x.toFixed(2)})`);assert(!open||open.point.x<-3.5,`${mode}: the hall's west opening is open below the head`);}
  const d=box('hall-dining-door'),dc=d.getCenter(new T.Vector3());
  assert(Math.abs(dc.z-2.96)<.05&&d.max.z-d.min.z>.85&&dc.x>1&&dc.x<1.14&&d.max.y>2.3,`${mode}: a glazed door closes the dining-room doorway at the dining room's face (x ${dc.x.toFixed(2)}, z ${dc.z.toFixed(2)})`);}
 // The island's worktop is one solid oak top about 4.5 cm thick, without floorboard seams, over its cabinets.
 {const top=root.getObjectByName('kitchen-island-top');assert(top,`${mode}: the island top`);const b=new T.Box3().setFromObject(top);
  assert(b.max.y-b.min.y<.05&&b.max.y-b.min.y>.035,`${mode}: the island top is about 4.5 cm thick (${(b.max.y-b.min.y).toFixed(3)} m)`);
  assert(top.material.userData.photo!=='oak',`${mode}: the island top has no floorboard seams`);
  let oak=0;root.getObjectByName('kitchen-island').traverse(o=>{if(o.isMesh&&o!==top&&o.material===top.material)oak++;});assert.equal(oak,0,`${mode}: no second slab under the island top`);}
 // The hood over the cooker (z −5.33): about 2.1 m wide and 0.7 m deep, from its black band 2 m up to the ceiling; an open
 // shelf unit either side of the cooker beneath it.
 {const h=box('kitchen-hood'),size=h.getSize(new T.Vector3()),c=h.getCenter(new T.Vector3());
  assert(size.z>1.95&&size.z<2.3&&size.x>.6&&size.x<.85&&Math.abs(c.z+5.33)<.2,`${mode}: the hood is about 2.1 × 0.7 m over the cooker (${size.z.toFixed(2)} × ${size.x.toFixed(2)} at z ${c.z.toFixed(2)})`);
  assert(h.min.y>1.95&&h.min.y<2.1&&h.max.y>2.75,`${mode}: the hood runs from ${h.min.y.toFixed(2)} m up to the ceiling (${h.max.y.toFixed(2)} m)`);
  const units=[];root.traverse(o=>{if(o.name==='kitchen-open-shelves')units.push(new T.Box3().setFromObject(o));});assert.equal(units.length,2,`${mode}: two open shelf units`);
  for(const u of units)assert(u.max.y<h.min.y+.01&&u.min.y>1&&Math.abs(u.getCenter(new T.Vector3()).z+5.33)<1.1,`${mode}: an open shelf unit beside the cooker under the hood`);
  assert(units.some(u=>u.max.z<-5.8)&&units.some(u=>u.min.z>-4.9),`${mode}: the shelf units stand either side of the cooker`);}
 if(realism){
  const named=name=>{const list=[];root.traverse(o=>{if(o.name===name)list.push(new T.Box3().setFromObject(o));});return list;};
  const lights=named('kitchen-downlight');assert(lights.length>=6&&lights.every(b=>b.max.y>2.75&&b.min.y>2.55),`black cylinder lights at the kitchen ceiling (${lights.length})`);
  const pendants=named('kitchen-pendant');assert(pendants.length===2&&pendants.every(b=>Math.abs((b.min.z+b.max.z)/2+8.07)<.3&&b.min.y>1.6&&b.min.y<1.9),'two pendants over the breakfast table');
  const drapes=named('kitchen-window-curtain');assert(drapes.length===2&&drapes.some(b=>b.max.x<-4.17)&&drapes.some(b=>b.min.x>-3.03)&&drapes.every(b=>b.min.z>-9.265&&b.min.y<.9),'curtains either side of the breakfast window');
  // The hearth: dark slate before the fireplace, about 1.9 m wide and up to 0.7 m deep.
  const hearth=root.getObjectByName('living-hearth');assert(hearth,'the hearth');const h=new T.Box3().setFromObject(hearth),hs=h.getSize(new T.Vector3());
  assert(lightness(hearth.material)<.35,`the hearth is dark slate (lightness ${lightness(hearth.material).toFixed(2)})`);
  assert(hs.x>1.7&&hs.x<2.05&&hs.z>.4&&hs.z<.75&&h.max.y<.22&&h.max.z<9.25,`the hearth lies before the fireplace (${hs.x.toFixed(2)} × ${hs.z.toFixed(2)} m)`);
  // Curtains, piping, the mirror and the light fittings take the house's shadows: lit as if outdoors, the curtains glowed
  // beside windows facing away from the sun.
  {const unshaded=[];root.getObjectByName('photo-led-interior-details').traverse(o=>{if(o.isMesh&&!o.receiveShadow)unshaded.push(o.name||o.parent.name);});assert.equal(unshaded.length,0,`meshes lit through the house's shadows: ${[...new Set(unshaded)].join(', ')}`);}
  // The chimney breast stands about 0.35 m proud of the wall (face at z 8.92); its open firebox is pale firebrick, about a
  // third of a metre deep, inside a smooth cream limestone surround.
  {const ray=new T.Raycaster(),meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});const first=(x,y)=>{ray.set(new T.Vector3(x,y,7.5),new T.Vector3(0,0,1));return ray.intersectObjects(meshes,false).find(h=>!h.object.name.startsWith('living-room-linen'));};
   const side=first(-.055-.75,1.6);assert(side&&side.point.z>8.85&&side.point.z<8.98,`the chimney breast stands proud of the wall (face at z ${side?.point.z.toFixed(2)})`);
   const fire=first(-.055,.45);assert(fire&&fire.point.z>side.point.z+.25&&fire.object.name==='living-firebrick',`a firebrick-lined firebox behind the surround (${fire?.object.name} at z ${fire?.point.z.toFixed(2)})`);
   assert(lightness(fire.object.material)>.45,'the firebrick is pale');
   const surround=[];root.getObjectByName('living-fireplace-surround').traverse(o=>{if(o.isMesh)surround.push(o.material);});
   assert(surround.length>=3&&surround.every(m=>m.userData.photo!=='stone'&&lightness(m)>.78),'the surround is smooth cream limestone');}
  // The sunburst mirror over the fireplace, about 0.75 m across, centred about 2 m up on the chimney breast.
  const sun=box('living-sunburst-mirror'),sc=sun.getCenter(new T.Vector3());
  assert(Math.abs(sc.x+.055)<.1&&sc.y>1.85&&sc.y<2.3&&sun.max.x-sun.min.x>.65&&sun.max.x-sun.min.x<.85&&sun.max.z<9.25,'the sunburst mirror hangs over the fireplace');
  // Curtains either side of both south windows (x −4.4 to −1.8 and 1.83 to 4.26), clear of the glass, floor to rod.
  const panels=[];root.getObjectByName('living-room-linen-curtains').traverse(o=>{if(o.isMesh&&o.geometry.type==='PlaneGeometry'){const b=new T.Box3().setFromObject(o);if(b.min.z>8.8)panels.push(b);}});
  assert.equal(panels.length,4,`four curtains at the south windows (${panels.length})`);
  for(const [lo,hi] of [[-4.4,-1.8],[1.83,4.26]]){assert(panels.some(b=>b.max.x<lo+.03&&b.max.x>lo-.2),`a curtain west of the window from x ${lo}`);assert(panels.some(b=>b.min.x>hi-.03&&b.min.x<hi+.2),`a curtain east of the window to x ${hi}`);}
  for(const b of panels)assert(b.min.y<.25&&b.max.y>2.45&&b.max.z<9.27,'each curtain hangs to the floor inside the wall');
  // The hall, kitchen and dining floors are a warm grey-beige stone, mid-toned against the white walls: the photographs put
  // the floor at about a quarter of the walls' brightness, in a browner hue.
  {const ray=new T.Raycaster(),meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});ray.set(new T.Vector3(-1,1,0),new T.Vector3(0,-1,0));const floorHit=ray.intersectObjects(meshes,false)[0];
   const stone=new T.Color(floorHit.object.material.userData.timber??floorHit.object.material.color),hsl=stone.getHSL({h:0,s:0,l:0},T.SRGBColorSpace),srgb=stone.clone().convertLinearToSRGB();
   assert(hsl.l>.35&&hsl.l<.55&&srgb.r-srgb.b>.12,`the hall floor is warm mid-toned stone (#${stone.getHexString(T.SRGBColorSpace)})`);}
  // Windows are oak on the room face and black outside (owner photographs of the kitchen and the living room); the
  // breakfast window is two casements on a centre mullion.
  {const ray=new T.Raycaster(),meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
   const finish=(x,z,dz)=>{ray.set(new T.Vector3(x,1.5,z),new T.Vector3(0,0,dz));const hit=ray.intersectObjects(meshes,false).find(h=>![h.object.material].flat().some(m=>m.transparent));if(!hit)return 'nothing';const mat=Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material;return mat.userData.photo??mat.color.getHexString();};
   for(const [x,z,dz,what] of [[-4.17,-8.5,-1,'breakfast window jamb'],[-3.6,-8.5,-1,'breakfast window mullion'],[-4.37,8.5,1,'living-room window jamb'],[-3.36,8.5,1,'living-room window mullion']])assert.equal(finish(x,z,dz),'oak',`the ${what} is oak inside`);
   for(const [x,z,dz,what] of [[-4.17,-10.5,1,'breakfast window jamb'],[-4.37,10.5,-1,'living-room window jamb']])assert.notEqual(finish(x,z,dz),'oak',`the ${what} is black outside`);}
  // The gallery: the west knee wall is about 0.45 m high, the rafters landing on a deep spruce shelf along its top. Books
  // stand in a row on the shelf and lie in stacks on the floor in front of it; no shelf unit stands there.
  assert(!root.getObjectByName('gallery-bookshelf'),'no shelf unit in the gallery');
  const floor=3.07,shelf=box('gallery-shelf'),books=box('gallery-books'),stacks=named('gallery-book-stack');
  assert(shelf.max.y-floor>.4&&shelf.max.y-floor<.5&&shelf.max.z-shelf.min.z>6&&shelf.max.x-shelf.min.x>.25&&shelf.min.x<-5,`the shelf tops the west knee wall about 0.45 m up (${(shelf.max.y-floor).toFixed(2)} m at x ${shelf.min.x.toFixed(2)})`);
  {const ray=new T.Raycaster(),meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});ray.set(new T.Vector3(-2,floor+.2,-2.8),new T.Vector3(-1,0,0));const hit=ray.intersectObjects(meshes,false)[0];
   assert(hit&&hit.point.x<-5&&hit.point.x>shelf.min.x-.05,`the knee wall stands under the shelf (x ${hit?.point.x.toFixed(2)})`);
   ray.set(new T.Vector3(-2,floor+.6,-2.8),new T.Vector3(-1,0,0));const over=ray.intersectObjects(meshes,false).find(h=>h.object.name!=='gallery-books');assert(over&&/ceiling/.test(over.object.name),`the sloped ceiling, not a wall, above the shelf (${over?.object.name})`);}
  // Rafters every 0.9 m or so over the gallery, each roof window between two, as along the rest of the roof.
  const rafters=[];root.getObjectByName('main-roof').traverse(o=>{if(o.name==='roof-rafter'&&o.position.x<0&&o.position.z>-3.2&&o.position.z<3.7)rafters.push(o.position.z);});
  assert(rafters.length>=6,`rafters over the gallery (${rafters.length})`);
  // Black twin spotlights hang from the west slope above the gallery's edge, between the rafters.
  const spots=named('gallery-spot');assert(spots.length>=6&&spots.every(b=>b.max.x<-2.2&&b.min.x>-3.2&&b.min.y>4.9&&!rafters.some(z=>Math.abs(z-(b.min.z+b.max.z)/2)<.12)),`twin spotlights on the west slope over the gallery (${spots.length})`);
  assert(books.min.y>shelf.max.y-.01&&books.max.y<shelf.max.y+.3&&books.max.z-books.min.z>5,'a row of books stands on the shelf');
  assert(stacks.length>=6&&stacks.every(b=>b.min.y<floor+.01&&b.max.y<floor+.42&&b.min.x>shelf.min.x-.05&&b.max.x<shelf.max.x+.45),`stacks of books lie on the floor in front of the shelf (${stacks.length})`);
 }
 model.dispose();
}
console.log('Passed: the hall\'s sideboard, canvas, dining-room door, corridor head and stone floor; oak window frames; the kitchen\'s island top, hood, shelf units, lights, pendants and curtains; the living room\'s chimney breast, firebox, surround, hearth, mirror and curtains; fittings in the house\'s shadows; and the gallery\'s knee wall, shelf, books, rafters and spotlights.');
