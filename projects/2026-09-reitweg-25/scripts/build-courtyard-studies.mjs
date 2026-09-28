import {writeFileSync} from 'node:fs';
import sharp from 'sharp';
const out='public/assets/';
// Trace coordinates from ground-floor.png, crop x340/y740/w1200/h740.
// Positions are source pixels, never survey dimensions. Keep the angled west wing.
const paving=[[97,58],[600,58],[600,248],[180,248],[138,680],[35,669]];
const covered=[[97,58],[600,58],[600,157],[190,157],[138,680],[35,669]];
const posts=[[181,146],[329,150],[464,150],[167,280],[153,414],[140,548]];
const box=(x,y,w,d,h,color,kind)=>({x,y,w,d,h,color,kind});
const chair=(x,y)=>box(x,y,26,29,30,'#c6c9b6','cozy chair');
const diningChair=(x,y)=>box(x,y,22,23,29,'#d4c7ad','dining chair');
const daybed=(x,y,w=34,d=82)=>box(x,y,w,d,20,'#dad6c5','daybed');
const table=(x,y,w,d)=>box(x,y,w,d,31,'#b69770','dining table');
const bench=(x,y,w,d)=>box(x,y,w,d,30,'#c5c8b5','banquette');
const coffee=(x,y,w=25,d=20)=>box(x,y,w,d,16,'#c2ae8a','side table');
const cozy=[chair(129,239),chair(122,311),coffee(124,280,24,18)];
const westBeds=[daybed(104,436),daybed(91,568)];
export const courtyardLayouts=[
 {slug:'courtyard-long-table-v3',title:'The long-table courtyard',letter:'A',zones:['Eight-seat dining at the north terrace','Two quiet daybeds along the west wing','A pair of cozy seats beside the fireplace'],description:'A long banquette and timber table make dining the heart of the courtyard. Two daybeds sit farther down the west wing; a pair of soft chairs creates a smaller fireside conversation spot. The table reaches the roof edge, so the outer seats are on the uncovered terrace.',objects:[...cozy,...westBeds,bench(294,63,143,28),table(309,99,112,37),diningChair(281,104),diningChair(432,104),diningChair(350,146),diningChair(393,146)]},
 {slug:'courtyard-daybed-room-v3',title:'The daybed garden room',letter:'B',zones:['Two daybeds in the deeper north bay','A round four-seat table on the open paving','Cozy fireside chairs in the west wing'],description:'Bring the daybeds together beneath the north roof so lounging feels like a garden living room. A round four-seat table sits on the existing open terrace in front, while two chairs make a separate nook near the fireplace. This gives lounging the most shelter; dining is outdoors.',objects:[...cozy,daybed(272,68,83,36),daybed(390,68,83,36),coffee(365,77,17,20),{...table(359,164,51,51),kind:'round dining table'},diningChair(373,133),diningChair(373,224),diningChair(329,178),diningChair(418,178)]},
 {slug:'courtyard-garden-salon-v3',title:'Three little outdoor rooms',letter:'C',zones:['Compact six-seat dining in the north corner','A sheltered sofa and cozy fireside chairs','Two daybeds toward the pool'],description:'A smaller banquette table leaves room for a proper sofa beneath the north roof. Keep two inviting chairs beside the fireplace and place the daybeds farther toward the pool. A more varied arrangement for reading, eating and spending the whole afternoon outside; the dining chairs reach the open terrace.',objects:[...cozy,...westBeds,bench(221,62,103,27),table(235,97,81,35),diningChair(204,102),diningChair(325,102),diningChair(252,142),diningChair(289,142),box(390,64,91,37,32,'#bfc7b4','sofa'),coffee(421,122,32,22),chair(518,139)]}
];
const pts=p=>p.map(v=>v.join(',')).join(' ');
const esc=s=>s.replaceAll('&','&amp;');
const txt=(x,y,s,size=17,color='#54614f')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${esc(s)}</text>`;
const project=(x,y,z=0)=>[615+(x-y)*.87,110+(x+y)*.44-z*.95];
const poly=(points,fill,stroke='#aa9f89',opacity=1)=>`<polygon points="${pts(points)}" fill="${fill}" stroke="${stroke}" stroke-width="1" opacity="${opacity}"/>`;
function cube(o,z=0){const {x,y,w,d,h,color}=o;const p=(a,b,c)=>project(a,b,c);return poly([p(x,y,z),p(x+w,y,z),p(x+w,y,z+h),p(x,y,z+h)],color)+poly([p(x+w,y,z),p(x+w,y+d,z),p(x+w,y+d,z+h),p(x+w,y,z+h)],color)+poly([p(x,y+d,z),p(x+w,y+d,z),p(x+w,y+d,z+h),p(x,y+d,z+h)],color)+poly([p(x,y,z+h),p(x+w,y,z+h),p(x+w,y+d,z+h),p(x,y+d,z+h)],color);}
function furniture(o){let s=cube(o);const {x,y,w,d,h,kind}=o;
 if(['daybed','sofa','banquette','cozy chair','dining chair'].includes(kind)){
  s+=cube(box(x+2,y+2,w-4,d-4,4,'#e5e0ce','cushion'),h);
  if(kind==='daybed')s+=cube(box(x+3,y+3,w>d?15:w-6,w>d?d-6:15,5,'#b5c0a8','pillow'),h+4);
  else s+=cube(box(x,y,w,5,13,'#b8bfa7','back'),h);
 }
 if(kind==='round dining table'){
  const r=w/2,ring=Array.from({length:40},(_,i)=>project(x+r+Math.cos(i*Math.PI/20)*r,y+r+Math.sin(i*Math.PI/20)*r,h+1));s=poly(ring,'#b69770');
 }
 return s;
}
function plan(l){let s='<rect width="1200" height="940" fill="#faf9f4"/>';
 s+=txt(35,35,l.letter+' · '+l.title,27);s+='<g transform="translate(20,55)">';
 s+=`<polygon points="${pts(paving)}" fill="#e7dfd0" stroke="#66735f" stroke-width="2"/><polygon points="${pts(covered)}" fill="#d1d9cd" opacity=".7"/>`;
 s+='<path d="M97 58H600V248M97 58L35 669" fill="none" stroke="#5d5548" stroke-width="9"/>';
 s+='<rect x="87" y="138" width="29" height="82" fill="#b7a283"/><rect x="91" y="150" width="18" height="25" fill="#655a47"/>';
 s+='<rect x="440" y="508" width="637" height="177" fill="#c2dce1" stroke="#799ea5"/>';
 s+=`<path d="${l.letter==='B'?'M590 204H493V119H190L116 232L62 650':'M590 204H190L116 232L62 650'}" fill="none" stroke="#ac7456" stroke-width="3" stroke-dasharray="7 7"/>`;
 // This route follows the open paving edge; it is an intent, not a verified clearance.
 for(const o of l.objects){s+=o.kind==='round dining table'?`<circle cx="${o.x+o.w/2}" cy="${o.y+o.d/2}" r="${o.w/2}" fill="${o.color}" stroke="#83755e"/>`:`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.d}" rx="4" fill="${o.color}" stroke="#83755e"/>`;if(o.kind==='daybed')s+=`<rect x="${o.x+3}" y="${o.y+3}" width="${o.w>o.d?13:o.w-6}" height="${o.w>o.d?o.d-6:13}" rx="3" fill="#9fae8f"/>`;}
 s+=posts.map(([x,y])=>`<rect x="${x-3}" y="${y-3}" width="6" height="6" fill="#473f34"/>`).join('');
 s+='<circle cx="338" cy="330" r="56" fill="#d5dfc8" stroke="#92a280" stroke-dasharray="5 5"/>';
 s+=txt(308,335,'Tree',15)+txt(690,596,'EXISTING POOL',19)+txt(638,94,'HOUSE',17)+txt(190,17,'NORTH BAY / ENTRANCE LINK',17)+txt(227,275,'OPEN COURTYARD',15)+txt(10,730,'Source-plan tracing · furniture and tree positions are indicative',16);
 s+='</g>';
 s+=l.zones.map((t,i)=>txt(45,837+i*26,t,18)).join('');
 s+=txt(665,841,'Green wash = existing covered area',15)+txt(665,868,'Rust dashes = intended circulation',15)+txt(665,895,'Check door swings, rain cover and furniture fit.',15);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="940" viewBox="0 0 1200 940"><title>${l.title} — source-based layout</title>${s}</svg>`;
}
function model(l){let s='<rect width="1580" height="1070" fill="#f6f3ec"/>';
 const lawn=[[180,248],[585,248],[585,325],[1110,325],[1110,710],[138,680]];
 s+=poly(lawn.map(([x,y])=>project(x,y)),'#d6ddc7');s+=poly(paving.map(([x,y])=>project(x,y)),'#dfd5c2');
 s+=poly([[423,492],[1093,492],[1093,702],[423,702]].map(([x,y])=>project(x,y)),'#e7e0cf');s+=poly([[440,508],[1077,508],[1077,685],[440,685]].map(([x,y])=>project(x,y)),'#b3d3d8');
 // Roof surfaces are removed only to reveal furniture. These are the existing roof-edge beams.
 s+=poly([project(97,58),project(600,58),project(600,58,106),project(97,58,106)],'#73604b');
 s+=poly([project(35,669),project(97,58),project(97,58,106),project(35,669,106)],'#6a5847');
 for(let x=100;x<600;x+=9)s+=`<path d="M${project(x,58)}L${project(x,58,106)}" stroke="#4e4537" stroke-width=".8"/>`;
 for(let y=64;y<669;y+=9){const x=97-(y-58)*62/611;s+=`<path d="M${project(x,y)}L${project(x,y,106)}" stroke="#4e4537" stroke-width=".8"/>`;}
 // Glazed source openings shown schematically; verify frame and door details in photographs.
 s+=poly([project(495,58),project(588,58),project(588,58,90),project(495,58,90)],'#b1c2b6','#433e34',.8);
 for(const [y1,y2] of [[227,332],[476,582]]){const x1=97-(y1-58)*62/611,x2=97-(y2-58)*62/611;s+=poly([project(x1,y1),project(x2,y2),project(x2,y2,90),project(x1,y1,90)],'#b1c2b6','#433e34',.8);}
 const fireplace=box(86,138,29,82,40,'#bcae97','existing fireplace');
 s+=cube(fireplace);s+=poly([project(116,147,12),project(116,174,12),project(116,174,35),project(116,147,35)],'#413c32');
 const all=[...l.objects,...posts.map(([x,y])=>box(x-3,y-3,6,6,106,'#64503c','post'))].sort((a,b)=>(a.x+a.y)-(b.x+b.y));s+=all.map(furniture).join('');
 s+=`<path d="M${project(181,146,106)}L${project(600,150,106)}M${project(181,146,106)}L${project(128,672,106)}" fill="none" stroke="#64503c" stroke-width="6"/>`;
 // Small translucent canopy establishes the existing tree without hiding the furniture.
 const tr=project(338,330,0),top=project(338,330,105);s+=`<path d="M${tr}L${top}" stroke="#807051" stroke-width="7"/><ellipse cx="${top[0]}" cy="${top[1]-23}" rx="59" ry="41" fill="#aeba99" opacity=".55"/>`;
 s+=txt(55,965,l.letter+' · '+l.title,28)+txt(55,1002,'Existing roof omitted for visibility. Posts and paving follow the source plan.',18)+txt(55,1031,'Furniture, tree and heights are indicative; no new enclosure or roof removal proposed.',17);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1580" height="1070" viewBox="0 0 1580 1070"><title>${l.title} — courtyard isometric model</title>${s}</svg>`;
}
for(const l of courtyardLayouts){for(const [kind,svg] of [['plan',plan(l)],['model',model(l)]]){writeFileSync(out+l.slug+'-'+kind+'.svg',svg);await sharp(Buffer.from(svg)).png().toFile(out+l.slug+'-'+kind+'.png');}}
writeFileSync(out+'courtyard-layouts-v3.json',JSON.stringify({source:'ground-floor.png crop x340 y740 width1200 height740; exposé PDF page19',status:'Source-based unmeasured concept; no compass correction applied to page coordinates',paving,covered,posts,tree:'Indicative position from photographs, not drawn in the source plan',layouts:courtyardLayouts},null,2));
