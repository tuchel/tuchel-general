import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The hall, the kitchen and the living room as photographed: in the hall, a long dark sideboard of drawers stands against
// the dining-room wall north of its doorway, a large canvas leaning on it; in the kitchen, a broad sage hood on a black
// band rises to the ceiling over open shelf units either side of the cooker, black cylinder lights hang over the island
// and the range, two brass pendants over the breakfast table, and linen curtains beside its window; in the living room,
// the fireplace has a dark slate hearth and a sunburst mirror over it, and linen curtains hang to the floor either side of
// both south windows.
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
  // The sunburst mirror over the fireplace, about 0.75 m across, centred about 2 m up on the chimney breast.
  const sun=box('living-sunburst-mirror'),sc=sun.getCenter(new T.Vector3());
  assert(Math.abs(sc.x+.055)<.1&&sc.y>1.85&&sc.y<2.3&&sun.max.x-sun.min.x>.65&&sun.max.x-sun.min.x<.85&&sun.max.z<9.25,'the sunburst mirror hangs over the fireplace');
  // Curtains either side of both south windows (x −4.4 to −1.8 and 1.83 to 4.26), clear of the glass, floor to rod.
  const panels=[];root.getObjectByName('living-room-linen-curtains').traverse(o=>{if(o.isMesh&&o.geometry.type==='PlaneGeometry'){const b=new T.Box3().setFromObject(o);if(b.min.z>8.8)panels.push(b);}});
  assert.equal(panels.length,4,`four curtains at the south windows (${panels.length})`);
  for(const [lo,hi] of [[-4.4,-1.8],[1.83,4.26]]){assert(panels.some(b=>b.max.x<lo+.03&&b.max.x>lo-.2),`a curtain west of the window from x ${lo}`);assert(panels.some(b=>b.min.x>hi-.03&&b.min.x<hi+.2),`a curtain east of the window to x ${hi}`);}
  for(const b of panels)assert(b.min.y<.25&&b.max.y>2.45&&b.max.z<9.27,'each curtain hangs to the floor inside the wall');
 }
 model.dispose();
}
console.log('Passed: the hall sideboard and its canvas against the dining-room wall; the kitchen\'s hood, shelf units, lights, pendants and curtains; and the living room\'s slate hearth, sunburst mirror and curtains either side of both south windows.');
