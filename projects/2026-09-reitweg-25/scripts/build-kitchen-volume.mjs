import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=new URL('../public/assets/',import.meta.url);
// The same source-pixel coordinate system as build-kitchen-studies.mjs.
const envelope=[[104,126],[626,126],[626,275],[639,275],[639,809],[334,809],[334,716],[104,716]];
const removed=[{x:343,y:275,w:91,d:42},{x:516,y:275,w:84,d:42},{x:334,y:332,w:43,d:131}];
const box=(x,y,w,d,h,color,kind)=>({x,y,w,d,h,color,kind});
const seat=(x,y,w=30,d=28)=>box(x,y,w,d,34,'#ddd0b9','chair');
const counter=(x,y,w,d)=>box(x,y,w,d,57,'#b6bba6','counter');
const island=(x,y,w,d)=>box(x,y,w,d,57,'#cbb48f','island');
const dining=(x,y,w,d)=>box(x,y,w,d,47,'#b99c76','table');
const sofa=(x,y,w,d)=>box(x,y,w,d,42,'#c8c9b8','sofa');
const range=(x,y,w,d)=>box(x,y,w,d,57,'#5e665d','cooker');
const walls=[box(310,275,33,57,174,'#c6bba7','retained pier'),box(600,275,39,42,174,'#c6bba7','wall'),box(620,317,19,347,18,'#c6bba7','cut wall'),box(334,667,43,142,18,'#c6bba7','cut wall'),box(377,799,41,10,18,'#c6bba7','cut wall'),box(478,799,125,10,18,'#c6bba7','cut wall')];
const layouts=[
 {slug:'kitchen-abc-social',title:'The social kitchen',zones:['A · garden dining','B · morning lounge','C · generous working kitchen'],change:'Open west and north connections; retain the east cooker.',objects:[
  counter(566,333,54,169),range(566,518,54,99),counter(566,632,54,32),counter(377,345,34,93),island(389,467,90,190),
  dining(169,328,70,220),... [340,417,494].flatMap(y=>[seat(128,y),seat(252,y)]),seat(190,288),seat(190,561),
  sofa(380,153,178,51),box(420,225,77,31,25,'#d1c4aa','coffee table'),seat(553,207,46,43)
 ]},
 {slug:'kitchen-abc-garden',title:'Cook in the garden',zones:['A · kitchen facing the garden','B · breakfast and coffee','C · dining and a serving wall'],change:'Open both connections; relocate cooker, sink and services to A.',objects:[
  counter(115,329,43,101),range(115,444,43,92),counter(115,550,43,112),island(228,426,60,161),
  counter(565,346,55,305),dining(419,451,76,181),... [462,527,592].flatMap(y=>[seat(380,y),seat(508,y)]),seat(442,411),seat(442,645),
  sofa(373,150,190,37),dining(423,207,95,35),seat(435,249),seat(482,249)
 ]},
 {slug:'kitchen-abc-family',title:'The all-day family room',zones:['A · a proper garden lounge','B + northwest corner · dining','C · a redesigned kitchen'],change:'Open both connections; keep cooker east and move the island.',objects:[
  counter(566,342,54,160),range(566,518,54,99),counter(566,633,54,31),counter(386,333,139,36),island(434,461,69,159),
  dining(166,184,185,70),seat(125,206),seat(365,206),... [189,267].flatMap(x=>[seat(x,143),seat(x,268)]),
  sofa(117,438,53,195),box(210,495,70,88,25,'#d1c4aa','coffee table'),seat(272,620,48,48),
  sofa(500,158,92,40)
 ]}
];

const label=(x,y,t,size=18,color='#526353')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-family="Arial,sans-serif">${t}</text>`;
const points=a=>a.map(p=>p.join(',')).join(' ');
function plan(l){
 let s=`<rect width="750" height="1000" fill="#faf9f4"/>${label(70,65,l.title,27)}<polygon points="${points(envelope)}" fill="#eee9df" stroke="#247553" stroke-width="4"/>`;
 // Existing grey wall geometry is shown as retained solids or proposed removals.
 s+=walls.map(o=>`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.d}" fill="#74796e"/>`).join('');
 s+=removed.map(o=>`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.d}" fill="none" stroke="#b35b3c" stroke-width="2.5" stroke-dasharray="7 5"/>`).join('');
 s+='<path d="M434 284H516M341 463V667" fill="none" stroke="#b35b3c" stroke-width="3" stroke-dasharray="7 5"/>';
 s+=l.objects.map(o=>`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.d}" rx="${o.kind==='chair'?7:3}" fill="${o.color}" stroke="#7c7868" stroke-width="1.6"/>${o.kind==='cooker'?[.25,.5,.75].map(t=>`<circle cx="${o.x+o.w/2}" cy="${o.y+o.d*t}" r="8" fill="none" stroke="#f7f4e9" stroke-width="2"/>`).join(''):''}`).join('');
 s+=label(63,421,'A',24)+label(580,105,'B',24)+label(665,716,'C',24);
 s+=label(70,848,'Green = confirmed envelope · Rust dashes = proposed opening',17);
 s+=l.zones.map((t,i)=>label(70,881+i*24,t,17)).join('')+label(70,970,'Openings, supports and furniture fit need verification.',15);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1000" viewBox="0 0 750 1000"><title>${l.title} — A+B+C layout</title>${s}</svg>`;
}
// Deterministic cutaway: north and west glass remain; east/south walls are cut low
// for visibility. Uniform illustrative wall height; this is not a roof proposal.
const project=(x,y,z=0)=>[790+(x-y)*.90,110+(x+y)*.43-z*.92];
const poly=(p,fill,stroke='#b1aa9b',opacity=1)=>`<polygon points="${points(p)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="${opacity}"/>`;
function cube(o){const {x,y,w,d,h,color}=o;const p=(a,b,z)=>project(a,b,z);return poly([p(x,y,0),p(x+w,y,0),p(x+w,y,h),p(x,y,h)],color)+poly([p(x+w,y,0),p(x+w,y+d,0),p(x+w,y+d,h),p(x+w,y,h)],color)+poly([p(x,y+d,0),p(x+w,y+d,0),p(x+w,y+d,h),p(x,y+d,h)],color)+poly([p(x,y,h),p(x+w,y,h),p(x+w,y+d,h),p(x,y+d,h)],color);}
function model(l){let s='<rect width="1450" height="1060" fill="#f5f2ea"/>';
 s+=poly(envelope.map(([x,y])=>project(x,y)), '#e3dac9','#747665');
 for(const [x1,y1,x2,y2] of [[104,126,626,126],[104,126,104,716]]){
  s+=poly([project(x1,y1),project(x2,y2),project(x2,y2,174),project(x1,y1,174)],'#d5e3de','#778375',.52);
  const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/87);
  for(let i=0;i<=n;i++){const x=x1+(x2-x1)*i/n,y=y1+(y2-y1)*i/n;const a=project(x,y),b=project(x,y,174);s+=`<path d="M${a}L${b}" stroke="#5b6657" stroke-width="4"/>`;}
 }
 const all=[...walls,...l.objects].sort((a,b)=>(a.x+a.y+a.w/2+a.d/2)-(b.x+b.y+b.w/2+b.d/2));
 s+=all.map(cube).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1450" height="1060" viewBox="0 0 1450 1060"><title>${l.title} — fixed geometry cutaway reference</title>${s}</svg>`;
}
for(const l of layouts){
 const svg=plan(l),modelSvg=model(l);
 writeFileSync(new URL(l.slug+'-plan.svg',root),svg);writeFileSync(new URL(l.slug+'-model.svg',root),modelSvg);
 await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(l.slug+'-plan.png',root)));
 await sharp(Buffer.from(modelSvg)).png().toFile(fileURLToPath(new URL(l.slug+'-model.png',root)));
}
writeFileSync(new URL('kitchen-abc-layouts.json',root),JSON.stringify({source:'Exposé PDF p19; source crop x60/y70/w750/h880 at 216dpi',geometry:'Shared A+B+C envelope; openings are proposals, not structural approval',envelope,removed,layouts},null,2));
