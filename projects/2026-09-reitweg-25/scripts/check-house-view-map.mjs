import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/view-map.ts','lib/house-model/site-data.ts','lib/house-model/experience-data.ts'],outdir:'tmp/view-map-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm'});
const {sheets,mapMarkers,MARKER,wholeViews}=await import('../tmp/view-map-check/view-map.mjs');
const {planPoint,UPPER_PLAN_X_OFFSET}=await import('../tmp/view-map-check/site-data.mjs');
const places=Object.keys((await import('../tmp/view-map-check/experience-data.mjs')).places);

// Every eye-level place appears once, on the sheet for where it stands.
const all=Object.keys(sheets).flatMap(s=>mapMarkers(s,true).map(m=>({...m,sheet:s})));
for(const id of places)assert.equal(all.filter(m=>m.id===id).length,1,`${id} is on one map`);
const on=(id)=>all.find(m=>m.id===id);
for(const id of ['lane','entrance','pool','court'])assert.equal(on(id).sheet,'grounds',`${id} is outside`);
for(const id of ['living','dining','kitchen'])assert.equal(on(id).sheet,'ground',`${id} is on the ground floor`);
for(const id of ['bedroom','upstairs'])assert.equal(on(id).sheet,'upper',`${id} is on the upper floor`);
// Overviews from one side sit on the frame of the grounds map, pointing at what they look at; the whole lot and the plan view are buttons.
for(const id of ['courtyard','east','arrival']){const m=on(id);assert.equal(m.sheet,'grounds');assert.equal(m.kind,'air');assert(Math.min(m.x,1-m.x,m.y,1-m.y)<.08,`${id} is on the frame`);}
assert.equal(all.filter(m=>m.kind==='air').length,3);assert.deepEqual(wholeViews,['estate','top']);
assert.equal(mapMarkers('grounds',false).filter(m=>m.kind==='air').length,0,'overviews are for the whole house only');

// Registration: a plan point lands where it was traced on its sheet (the sheets are 2200 px wide; tracing used 1888 px).
const K=2200/1888,near=(a,b,msg)=>assert(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6,msg);
near(sheets.ground.toSheet(...planPoint(1100,611)),[1100*K,611*K],'ground floor');
near(sheets.upper.toSheet(planPoint(1165,700)[0]+UPPER_PLAN_X_OFFSET,planPoint(1165,700)[1]),[1165*K,700*K],'upper floor');
near(sheets.grounds.toSheet(0,0),[874*K,531.5*K],'site plan');
// Headings follow the view: the family room looks toward the garden (east-south-east), the kitchen northwest, the courtyard west.
const heading=id=>on(id).heading;
assert(heading('living')>0&&heading('living')<45,'family room looks east-south-east');
assert(heading('kitchen')<-100&&heading('kitchen')>-170,'kitchen looks northwest');
assert(Math.abs(Math.abs(heading('court'))-180)<20,'courtyard looks west');
assert(heading('bedroom')>60&&heading('bedroom')<120,'bedroom looks south');

// At phone and computer widths, every dot, arrow and label sits inside its map and clear of the others.
// Label widths are estimated at 6.4 px per character plus padding (11.5 px system font).
for(const width of [331,384,434]){
 for(const sheet of Object.keys(sheets)){
  const [,,cw,ch]=sheets[sheet].crop,w=sheet==='grounds'?width:(width-MARKER.pair)/2,h=w*ch/cw,boxes=[];
  for(const m of mapMarkers(sheet,true)){
   const cx=m.x*w,cy=m.y*h,r=m.kind==='air'?MARKER.air/2:MARKER.dot/2,lw=m.label.length*6.4+2*MARKER.pad,lh=MARKER.labelHeight,g=r+MARKER.gap;
   const label=m.side==='right'?[cx+g,cy-lh/2,lw,lh]:m.side==='left'?[cx-g-lw,cy-lh/2,lw,lh]:m.side==='above'?[cx-lw/2,cy-g-lh,lw,lh]:m.side==='above-left'?[cx+MARKER.overhang-lw,cy-g-lh,lw,lh]:[cx-lw/2,cy+g,lw,lh];
   boxes.push({name:`${m.id} dot`,b:[cx-r,cy-r,2*r,2*r]},{name:`${m.id} label`,b:label});
  }
  for(const {name,b:[x,y,bw,bh]} of boxes)assert(x>=0&&y>=0&&x+bw<=w&&y+bh<=h,`${name} fits the ${sheet} map at ${width}px`);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const [a,b]=[boxes[i].b,boxes[j].b];
   if(boxes[i].name.split(' ')[0]===boxes[j].name.split(' ')[0])continue;
   assert(a[0]+a[2]<=b[0]||b[0]+b[2]<=a[0]||a[1]+a[3]<=b[1]||b[1]+b[3]<=a[1],`${boxes[i].name} clears ${boxes[j].name} on the ${sheet} map at ${width}px`);
  }
 }
}
console.log('Passed: nine eye-level places and three side overviews on the site and floor plans, registered to the model, pointing the way each view looks, with labels clear of one another at 331–434 px.');
