import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// Layout Updates: the garden bedroom, whose north wall behind the bed has no window, becomes a family room (a television
// where the bed stood, an L-shaped couch and an armchair); the library nook's desk moves to the hall wall and a lounge chair with an
// ottoman takes the east window; the living room gets an L-shaped couch in its south-west corner with the glass coffee
// table inside the L, a second lounge chair, a warm rug before the fire and, with the east façade, a centred dining table.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/renovation-data.ts','lib/house-model/site-data.ts'],outdir:'tmp/layout-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const load=name=>import(`../tmp/layout-check/${name}.mjs`);
const [{buildHouseModel},{renovations,renovationState},{planPoint:p}]=await Promise.all(['build-model','renovation-data','site-data'].map(load));
assert.equal(renovations.find(r=>r.id==='nook').title,'Layout Updates','the renovation is named Layout Updates');

const model=buildHouseModel(true),root=model.root,ground=root.getObjectByName('ground-floor');
const shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
const named=name=>root.getObjectByName(name);
const set=(nook,east,level='ground')=>{model.setRenovations({...renovationState(),nook,east});model.setLevel(level);root.updateMatrixWorld(true);};
// The north wall behind the bed, seen in the whole-house view (the ground-floor view cuts walls at 1.17 m but not glass
// above them).
const window=(nook,east)=>{set(nook,east,'exterior');const hit=first([2.8,2,-8],[2.8,2,-10.5]);set(nook,east);return hit;};
const bounds=o=>new T.Box3().setFromObject(o);
// Interior faces: the north and south façades and the west façade, 0.45 m thick, clad 0.105 m outside the outline.
const north=-9.61+.12+.225,south=9.61-.12-.225,west=-6+.12+.225;
// What a horizontal ray meets first among shown meshes (walls, glass, furniture).
const first=(from,to)=>{const u=new T.Vector3(...from),v=new T.Vector3(...to),ray=new T.Raycaster(u,v.clone().sub(u).normalize(),0,u.distanceTo(v));const meshes=[];ground.traverse(o=>{if(o.isMesh&&shown(o))meshes.push(o);});return ray.intersectObjects(meshes,false)[0];};
const glassy=hit=>!!hit&&[hit.object.material].flat().some(m=>m.transparent);

// Off: the house as it is, furniture included with the east façade on: that renovation changes only the façade.
for(const east of [false,true]){
 set(false,east);
 assert(shown(named('garden-bedroom-bed'))&&shown(named('garden-bedroom-rug')),'the bed and its rug stay without Layout Updates');
 {const wall=window(false,east);assert(wall&&!glassy(wall)&&Math.abs(wall.point.z-north)<.03,'no window behind the bed');}
 for(const name of ['family-room','living-room-layout','living-dining-table'])assert(!shown(named(name)),`${name} only with Layout Updates`);
 assert(shown(named('living-west-sofa'))&&shown(named('living-east-sofa'))&&shown(named('living-glass-table')),`the living room keeps both sofas and its glass table${east?' with the east façade':''}`);
 assert(!named('east-family-dining'),'the east façade brings no dining table of its own');
}
for(const east of [false,true]){
 set(true,east);
 // Garden bedroom → family room.
 assert(!shown(named('garden-bedroom-bed'))&&!shown(named('garden-bedroom-rug')),'no bed in the family room');
 const wall=window(true,east);assert(wall&&!glassy(wall)&&Math.abs(wall.point.z-north)<.03,'the north wall stays solid behind the television');
 // In the ground-floor view no glass stands above the cut wall.
 assert(!glassy(first([2.8,2,-8],[2.8,2,-10.5])),'no window glass above the cut wall');
 const tv=bounds(named('family-room-tv')),couch=bounds(named('family-room-l-couch')),chair=bounds(named('family-room-armchair'));
 assert(tv.min.z-north<.06&&tv.min.z>=north-.001,'the television hangs on the north wall');
 assert(Math.abs((tv.min.x+tv.max.x)/2-p(1124,0)[0])<.3,'where the bed stood');
 assert(tv.max.y-tv.min.y>.7&&tv.min.y>.6,'at viewing height');
 // An 85-inch screen at least (2.159 m across the diagonal), over a console as wide.
 const screen=bounds(named('family-room-tv-screen')),diagonal=Math.hypot(screen.max.x-screen.min.x,screen.max.y-screen.min.y);
 assert(diagonal>=2.159,`the screen is at least 85 inches (${(diagonal/.0254).toFixed(1)} in)`);
 const media=bounds(named('family-room-console'));assert(media.max.x-media.min.x>=tv.max.x-tv.min.x,'the console is as wide as the television');
 assert(couch.max.x-couch.min.x>2.6&&couch.max.z-couch.min.z>2.2,'an L-shaped couch');
 const seat=couch.min.z+(couch.max.z-couch.min.z)*.75;assert(seat-north>2.4&&seat-north<4.2,'facing the television from 2.4–4.2 m');
 assert(chair.min.x>couch.max.x-.2,'the armchair stands east of the couch');
 // Library nook: desk on the hall wall, lounge chair and ottoman at the east window, no sofa.
 assert(!named('nook-sofa'),'the nook has no sofa');
 const desk=bounds(named('nook-desk')),lounge=bounds(named('nook-lounge-chair')),ottoman=bounds(named('nook-ottoman'));
 assert(desk.min.x<p(1050,0)[0]+.25,'the desk stands against the hall wall');
 assert(lounge.max.x>p(1215,0)[0]-.45&&Math.abs((lounge.min.z+lounge.max.z)/2-p(0,596)[1])<.5,'the lounge chair takes the desk’s place at the east window');
 assert(ottoman.max.x<lounge.min.x+.05,'its ottoman in front of it');
 // Living room: L couch in the south-west corner, glass table within the L, lounge chair beside it, rug before the fire.
 const lc=bounds(named('living-l-couch')),table=bounds(named('living-glass-table-in-l')),easy=bounds(named('living-lounge-chair')),rug=bounds(named('living-fireside-rug'));
 assert(lc.min.x-west<.06&&south-lc.max.z<.06,'the L couch is pressed into the south-west corner');
 assert(lc.max.x-lc.min.x>2.2&&lc.max.z-lc.min.z>2.2,'an L along both walls');
 assert(table.min.x>lc.min.x+.9&&table.max.z<lc.max.z-.9&&table.max.x<lc.max.x+.05&&table.min.z>lc.min.z-.05,'the glass table sits inside the L');
 assert(easy.min.x>table.max.x-.6&&easy.max.z<table.max.z,'the lounge chair beside the table');
 assert(Math.abs((rug.min.x+rug.max.x)/2-(-.055))<.25&&rug.max.z<south-.5&&rug.max.z>south-1.2,'a rug in front of the fireplace');
 assert(!shown(named('living-west-sofa'))&&!shown(named('living-glass-table')),'the old sofa and table make way');
 // The east sofa makes way for a dining table centred between the room's north wall and the fireplace wall, with or
 // without the east façade.
 const dining=named('living-dining-table'),d=bounds(dining),room=(p(0,669)[1]+.09+south)/2;
 assert(shown(dining)&&!shown(named('living-east-sofa')),'a dining table in place of the east sofa');
 assert(Math.abs((d.min.z+d.max.z)/2-room)<.15,`centred between the north and south walls (${((d.min.z+d.max.z)/2).toFixed(2)} vs ${room.toFixed(2)})`);
 // Nothing new stands in other furniture: no mesh of a new piece meets a mesh of another piece (an L's bounding box
 // holds its own inner corner, so meshes are compared, not pieces). A chair and its ottoman stand together.
 const pieces=['family-room-l-couch','family-room-armchair','family-room-console','nook-desk','nook-desk-chair','nook-lounge-chair','nook-ottoman','living-l-couch','living-glass-table-in-l','living-lounge-chair','living-lounge-ottoman','living-dining-table'];
 const together=new Set(['nook-lounge-chair|nook-ottoman','living-lounge-chair|living-lounge-ottoman','nook-desk|nook-desk-chair']);
 const meshes=o=>{const out=[];o.traverse(m=>{if(m.isMesh&&shown(m))out.push(new T.Box3().setFromObject(m).expandByScalar(-.02));});return out;};
 const meet=(a,b)=>{const x=meshes(a),y=meshes(b);return x.some(u=>y.some(v=>u.intersectsBox(v)));};
 const inside=o=>{for(let q=o;q;q=q.parent)if(pieces.includes(q.name))return true;return false;};
 const others=[];ground.traverse(o=>{if(o.isGroup&&o.name&&shown(o)&&/sofa|table|chair|bench|bed|cabinet|desk|lamp|plant|wardrobe|dining|cane/.test(o.name)&&!inside(o))others.push(o);});
 for(const [i,name] of pieces.entries()){
  const a=named(name);
  for(const other of pieces.slice(i+1))if(!together.has(`${name}|${other}`)&&!together.has(`${other}|${name}`)&&!a.getObjectByName(other)&&!named(other).getObjectByName(name))assert(!meet(a,named(other)),`${name} clear of ${other}`);
  for(const o of others){if(o.getObjectByName(name)||a.getObjectByName(o.name)||pieces.some(n=>o.getObjectByName(n)))continue;assert(!meet(a,o),`${name} clear of ${o.name}`);}
 }
 // The way from the hall into the nook, and the west door of the living room, stay clear at knee height.
 assert(!first([p(1040,641)[0],.5,p(1040,641)[1]],[p(1150,641)[0],.5,p(1150,641)[1]]),'the hall doorway into the nook is clear');
 assert(!first([west+.05,.5,5.8],[west+1.2,.5,5.8]),'the living room’s west door is clear');
}
set(false,false);
console.log('Passed: Layout Updates turns the garden bedroom into a family room (no window behind the bed either way, television where the bed stood, L couch facing it, armchair), moves the nook’s desk to the hall wall with a lounge chair and ottoman at the east window, and gives the living room an L couch in its south-west corner around the glass table, a second lounge chair, a fireside rug and a dining table centred where the east sofa stood; nothing overlaps, doorways stay clear, and without it the house is as before, east façade or not.');
