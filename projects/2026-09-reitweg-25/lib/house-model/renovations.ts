import * as T from 'three';
import {buildSolar} from './solar';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import kitchenLayout from '../../public/assets/kitchen-refined-layout-v4.json';
import {planPoint as p,type Level} from './site-data';
import {buildFrontWall} from './front-wall';
import {renovationState,type RenovationId,type RenovationState} from './renovation-data';

// Register the permit inset to the original ground plan with ONE uniform scale.
// The northwest pier (310,275) maps to (794,182); kitchen south wall to z465.
// Do not rotate, mirror, or independently stretch A and B.
export const kitchenPoint=(x:number,z:number)=>p(807+(x-334)*.53,182+(z-275)*.53);
const K=.53*12/434;
type MaterialFactory=(pale:string,natural?:string,roughness?:number)=>T.MeshStandardMaterial;
export function buildRenovations(ground:T.Group,roofs:T.Group,site:T.Group,material:MaterialFactory){
 const groups={} as Record<RenovationId,T.Group>;
 for(const id of Object.keys(renovationState()) as RenovationId[]){const g=new T.Group();g.name='renovation-'+id;g.visible=false;(id==='front'?site:ground).add(g);groups[id]=g;}
 const kitchenRoof=new T.Group();kitchenRoof.name='renovation-kitchen-roof';roofs.add(kitchenRoof);kitchenRoof.visible=false;
 const m={oak:material('#b49772'),stone:material('#dbd4c4'),sage:material('#939d89'),metal:material('#46524b'),linen:material('#e8e1cf'),clay:material('#ba8770'),leaf:material('#788866'),white:material('#eee9de')};
 m.oak.userData.photo='oak';m.stone.userData.photo='stone';m.linen.userData.photo='linen';
 const clear=new T.MeshPhysicalMaterial({color:'#c3d7ce',transparent:true,opacity:.22,roughness:.13,metalness:.1,depthWrite:false,side:T.DoubleSide});
 const privacy=new T.MeshPhysicalMaterial({color:'#d9dfd4',transparent:true,opacity:.78,roughness:.85,depthWrite:false,side:T.DoubleSide});
 const unit=new T.BoxGeometry(1,1,1),soft=new RoundedBoxGeometry(1,1,1,2,.065),cyl=new T.CylinderGeometry(1,1,1,20);
 const box=(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,rounded=false)=>{const o=new T.Mesh(rounded?soft:unit,mat);o.position.set(x,y+h/2,z);o.scale.set(w,h,d);o.castShadow=mat!==clear&&mat!==privacy;o.receiveShadow=true;g.add(o);return o;};
 const place=(g:T.Group,x:number,z:number,angle=0,y=.16)=>{const o=new T.Group();o.position.set(x,y,z);o.rotation.y=angle;g.add(o);return o;};
 const poly=(g:T.Group,points:number[][],y:number,h:number,mat:T.Material)=>{const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));const geo=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=new T.Mesh(geo,mat);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 function chair(g:T.Group,x:number,z:number,angle=0,stool=false){const c=place(g,x,z,angle,0),height=stool?.64:.43;box(c,0,height,0,.46,.08,.45,m.linen,true);for(const dx of [-.18,.18])for(const dz of [-.18,.18])box(c,dx,0,dz,.04,height,.04,m.oak);if(!stool){box(c,0,.51,.2,.47,.31,.06,m.oak,true);box(c,0,.54,.155,.39,.23,.04,m.linen,true);}else box(c,0,.27,.18,.4,.025,.025,m.metal);}
 function table(g:T.Group,w:number,d:number){box(g,0,.7,0,w,.07,d,m.oak,true);for(const x of [-w/2+.15,w/2-.15])for(const z of [-d/2+.15,d/2-.15])box(g,x,0,z,.065,.7,.065,m.oak);}
 function dining(g:T.Group,x:number,z:number,w:number,d:number,angle=0){const t=place(g,x,z,angle);table(t,w,d);for(const dx of [-w/3,0,w/3]){chair(t,dx,d/2+.36);chair(t,dx,-d/2-.36,Math.PI);}chair(t,-w/2-.35,0,-Math.PI/2);chair(t,w/2+.35,0,Math.PI/2);return t;}
 function planter(g:T.Group,x:number,z:number){box(g,x,.16,z,.6,.55,.6,m.stone,true);const leaves=new T.Mesh(new T.IcosahedronGeometry(.45,1),m.leaf);leaves.position.set(x,.9,z);leaves.scale.y=1.25;g.add(leaves);}
 // Full-height glazing is preserved in a cutaway so its indoor/outdoor relationship remains legible.
 function glazing(g:T.Group,a:number[],b:number[],privateBand=false){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),bay=place(g,a[0],a[1],-Math.atan2(b[1]-a[1],b[0]-a[0]),.16);const n=Math.ceil(len/1.65),h=2.55;for(let i=0;i<n;i++){const x=(i+.5)*len/n;box(bay,x,0,0,len/n-.055,privateBand?1.25:h,.026,privateBand?privacy:clear);if(privateBand)box(bay,x,1.25,0,len/n-.055,h-1.25,.026,clear);}for(let i=0;i<=n;i++)box(bay,i*len/n,0,0,.055,h,.09,m.metal);for(const y of [0,h])box(bay,len/2,y,0,len,.065,.12,m.metal);return bay;}
 const east=groups.east;
 // Bedroom / bathroom / dining / living divisions keep their original alignment.
 for(const [from,to,privateBand] of [[182,388,0],[388,524,1],[524,669,0],[669,877,0]])glazing(east,p(1229,from),p(1229,to),!!privateBand);
 // The south wall is glazed on both sides of the retained fireplace; build-model keeps the piers beside it solid.
 for(const [from,to] of [[-6,-.93],[.82,6]])glazing(east,[from,9.61],[to,9.61]);
 const farDining=dining(east,...p(1132,739),2.7,1.02,Math.PI/2);farDining.name='east-family-dining';
 // Kitchen: the complete A+B+C footprint, with the original cooking wall to the east.
 const kitchen=groups.kitchen,outline=kitchenLayout.envelope.map(([x,z])=>kitchenPoint(x,z));
 poly(kitchen,outline,.125,.035,m.stone).name='confirmed-abc-kitchen-floor';
 for(const [a,b] of [[[104,126],[626,126]],[[104,126],[104,716]],[[104,716],[334,716]],[[626,126],[626,275]]])glazing(kitchen,kitchenPoint(...a as [number,number]),kitchenPoint(...b as [number,number]));
 // Retained pier, east return and low structural beam over the opened kitchen boundary.
 for(const [x,z,w,d] of [[310,275,33,57],[600,275,39,42],[334,667,43,142]]){const [wx,wz]=kitchenPoint(x+w/2,z+d/2);box(kitchen,wx,.16,wz,w*K,2.55,d*K,m.white).name='kitchen-retained-pier';}
 for(const [a,b] of [[[334,317],[334,667]],[[343,292],[600,292]]]){const u=kitchenPoint(...a as [number,number]),v=kitchenPoint(...b as [number,number]),beam=place(kitchen,(u[0]+v[0])/2,(u[1]+v[1])/2,-Math.atan2(v[1]-u[1],v[0]-u[0]),2.65);box(beam,0,0,0,Math.hypot(v[0]-u[0],v[1]-u[1]),.16,.2,m.white);}
 // Light glazed roof only over the added A+B L, never over C or the original pitched roof.
 const roofOutline=[[104,126],[626,126],[626,275],[310,275],[310,332],[334,332],[334,716],[104,716]].map(([x,z])=>kitchenPoint(x,z));
 poly(kitchenRoof,roofOutline,2.83,.055,clear);
 for(let z=126;z<=716;z+=84){const a=kitchenPoint(104,z),b=kitchenPoint(z<=275?626:334,z);box(kitchenRoof,(a[0]+b[0])/2,2.82,a[1],b[0]-a[0],.11,.07,m.metal);}
 for(const [a,b] of [[[104,126],[104,716]],[[104,126],[626,126]],[[104,716],[334,716]],[[626,126],[626,275]]]){const u=kitchenPoint(...a as [number,number]),v=kitchenPoint(...b as [number,number]),g=place(kitchenRoof,(u[0]+v[0])/2,(u[1]+v[1])/2,-Math.atan2(v[1]-u[1],v[0]-u[0]),2.82);box(g,0,0,0,Math.hypot(v[0]-u[0],v[1]-u[1]),.13,.1,m.metal);}
 for(const o of kitchenLayout.layouts[0].objects){const [x,z]=kitchenPoint(o.x+o.w/2,o.y+o.d/2),g=place(kitchen,x,z),w=o.w*K,d=o.d*K;g.name='garden-kitchen-'+o.kind.replaceAll(' ','-');
  if(o.kind==='table'){table(g,w,d);continue;}
  if(o.kind==='chair'){const stool=o.x>300;chair(g,0,0,stool?(o.y<333?Math.PI:0):o.x<155?-Math.PI/2:o.x>225?Math.PI/2:o.y<320?Math.PI:0,stool);continue;}
  const h=o.kind==='pantry'?2.25:.9;box(g,0,0,0,w,h,d,o.kind==='island'||o.kind==='pantry'?m.oak:o.kind==='cooker'||o.kind==='second oven'?m.metal:m.sage);
  if(o.kind==='pantry'){for(let i=1;i<3;i++)box(g,-w/2-.009,1.15,(i/3-.5)*d,.02,.38,.02,m.metal);continue;}
  box(g,0,h,0,w+.045,.065,d+.055,m.stone);
  // Quiet, irregular mineral lines in the stone; these are illustrative, not a photo finish.
  for(let i=0;i<3;i++){const pts=[new T.Vector3(-w*.48,.968,d*(i/3-.35)),new T.Vector3(-w*.1,.968,d*(i/3-.25)),new T.Vector3(w*.48,.968,d*(i/3-.32))];const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#b7ad99',transparent:true,opacity:.45}));g.add(line);}
  if(o.kind==='cooker'||o.kind==='second oven'){const eastWall=o.kind==='cooker';const oven=place(g,eastWall?-w/2-.014:0,eastWall?0:d/2+.014,eastWall?Math.PI/2:0,0);box(oven,0,.2,0,eastWall?d*.82:w*.83,.46,.025,m.metal);box(oven,0,.23,.017,eastWall?d*.7:w*.7,.33,.009,clear);box(oven,0,.66,.038,eastWall?d*.6:w*.65,.028,.035,m.oak);if(eastWall){for(const dx of [-w*.23,w*.23])for(const dz of [-d*.29,0,d*.29]){const disc=new T.Mesh(cyl,m.metal);disc.position.set(dx,.974,dz);disc.scale.set(.085,.015,.085);g.add(disc);}}}
  if(o.kind==='island'){box(g,0,.968,-d*.22,w*.62,.018,.46,m.metal,true);box(g,0,.98,-d*.22,w*.52,.014,.36,m.white,true);box(g,w*.27,.99,-d*.22,.025,.28,.025,m.metal);box(g,w*.15,1.25,-d*.22,w*.26,.025,.025,m.metal);}
 }
 // Existing terrace geometry is extended out into the east lawn.
 const terrace=groups.terrace;poly(terrace,[[6,0],[11.2,0],[11.2,10.45],[6,10.45]],.06,.11,m.stone);
 box(terrace,11.38,.015,5.2,.38,.07,9.6,m.stone);dining(terrace,8.7,5.5,3.3,1.08,Math.PI/2);
 const umbrella=place(terrace,10.5,2.3,0,.17);box(umbrella,0,0,0,.055,2.55,.055,m.metal);const shade=new T.Mesh(new T.ConeGeometry(1.7,.35,8),m.linen);shade.position.y=2.55;umbrella.add(shade);planter(terrace,10.65,.55);planter(terrace,10.65,9.9);
 // Selected courtyard: long table stays in the north bay; lounge stays by the west fireplace.
 const courtyard=groups.courtyard;dining(courtyard,...p(624,728),3.5,1.04);
 const counter=place(courtyard,...p(620,687));box(counter,0,0,0,4.5,.86,.6,m.oak);box(counter,0,.86,0,4.56,.065,.65,m.stone);for(let x=-2;x<2.2;x+=.65)box(counter,x,.09,-.308,.012,.69,.013,m.metal);
 const lounge=place(courtyard,...p(416,891),-.093);box(lounge,0,.01,0,1.6,.015,2.8,m.linen);
 const sofa=(x:number,z:number,angle:number,w=2.1)=>{const g=place(lounge,x,z,angle,0);box(g,0,.06,0,w,.27,.81,m.oak,true);box(g,0,.33,0,w-.08,.16,.75,m.linen,true);box(g,0,.48,.33,w,.35,.15,m.linen,true);for(const dx of [-w/2+.07,w/2-.07])box(g,dx,.3,0,.11,.25,.86,m.oak,true);for(const dx of [-w*.3,w*.3])box(g,dx,.55,.2,.3,.3,.15,m.clay,true);};
 sofa(-.53,.18,-Math.PI/2);sofa(.33,1.85,0,1);const coffee=place(lounge,.35,.15,0,0);box(coffee,0,.25,0,.67,.09,1.2,m.stone,true);box(coffee,0,.02,0,.43,.23,.85,m.oak);planter(courtyard,...p(746,697));
 // Reading and office nook in the dining alcove (4.5 × 3.8 m between the hall wall and the east façade): a library wall
 // to the north, a deep sofa against the hall wall facing the garden, and a desk at the east window. Plan points.
 const nook=groups.nook,ink=material('#3e4a59'),ochre=material('#c39a53'),wool=material('#cbbda4'),rust=material('#9d5b41');
 const solid=(g:T.Object3D,geometry:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 {const shelves=place(nook,...p(1124,533.8));shelves.name='nook-bookshelves';const w=3.82,d=.36,h=2.3,bays=4,levels=[.08,.44,.8,1.16,1.52,1.88];
  for(let i=0;i<=bays;i++)box(shelves,-w/2+.0175+i*(w-.035)/bays,0,0,.035,h,d,m.oak);
  box(shelves,0,h-.035,0,w,.035,d,m.oak);box(shelves,0,0,0,w,.08,d,m.oak);for(const y of levels.slice(1))box(shelves,0,y-.025,0,w,.025,d,m.oak);
  // Books as single spines of varied width, height and colour, in runs with the odd gap; one merged mesh per colour.
  // A fixed seed keeps every visit the same.
  const colours=[rust,m.sage,m.linen,ink,ochre,m.white,m.clay],spines:T.BufferGeometry[][]=colours.map(()=>[]);let seed=11;const rand=()=>(seed=seed*16807%2147483647)/2147483647;
  for(let i=0;i<bays;i++)for(const y of levels){const bay=(w-.035)/bays;let x=-w/2+.05+i*bay;const end=x+bay-.07;
   while(x<end-.1){const run=Math.min(end-x,.1+rand()*.4);if(rand()>.18){const tall=.2+rand()*.07;for(let b=x;b<x+run-.02;){const t=Math.min(.02+rand()*.03,x+run-b),h=tall+rand()*.04-.02,deep=.19+rand()*.05;
    spines[Math.floor(rand()*colours.length)].push(new T.BoxGeometry(t-.003,h,deep).translate(b+t/2,y+h/2,.03+(.24-deep)/2));b+=t;}}x+=run+.012;}}
  spines.forEach((parts,k)=>{if(!parts.length)return;const o=new T.Mesh(mergeGeometries(parts),colours[k]);parts.forEach(part=>part.dispose());o.castShadow=o.receiveShadow=true;shelves.add(o);});
 }
 {const sofa=place(nook,...p(1069.8,581),Math.PI/2);sofa.name='nook-sofa';const w=1.72;
  box(sofa,0,0,0,w-.12,.1,.78,ink);box(sofa,0,.1,.02,w,.26,.88,wool,true);box(sofa,0,.1,-.34,w,.62,.2,wool,true);
  for(const x of [-w/4,w/4]){box(sofa,x,.36,.08,w/2-.2,.15,.62,wool,true);box(sofa,x,.44,-.2,w/2-.22,.38,.18,wool,true).rotation.x=-.18;}
  for(const x of [-w/2+.09,w/2-.09])box(sofa,x,.1,.02,.18,.5,.88,wool,true);
  box(sofa,-w/2+.36,.48,-.1,.42,.38,.13,rust,true).rotation.z=-.2;box(sofa,w/2-.4,.48,-.1,.4,.36,.13,m.sage,true).rotation.z=.18;box(sofa,w/2-.42,.515,.12,.5,.025,.62,ochre);
 }
 // An arc lamp over the sofa, a pouf and a rug; the desk faces the garden with its lamp, laptop and a few books.
 {const lamp=place(nook,...p(1072,545.2));solid(lamp,cyl,m.metal,0,.01,0,.14,.02,.14);box(lamp,0,0,0,.028,1.75,.028,m.metal);box(lamp,0,1.72,.36,.022,.022,.72,m.metal);solid(lamp,cyl,m.linen,0,1.6,.72,.18,.22,.18);}
 solid(place(nook,...p(1112,583)),cyl,rust,0,.2,0,.3,.4,.3);box(place(nook,...p(1106,591)),0,0,0,2.2,.012,2.4,m.clay);
 {const desk=place(nook,...p(1202.3,596));desk.name='nook-desk';box(desk,0,.72,0,.75,.04,1.7,m.oak);for(const x of [-.32,.32])for(const z of [-.8,.8])box(desk,x,0,z,.035,.72,.035,m.metal);
  solid(desk,cyl,m.metal,.24,.77,-.6,.08,.02,.08);box(desk,.24,.76,-.6,.018,.4,.018,m.metal);box(desk,.16,1.12,-.6,.2,.04,.07,m.metal);
  box(desk,-.08,.76,.05,.24,.015,.33,m.metal);box(desk,.05,.775,.05,.012,.22,.33,ink);box(desk,.2,.76,.55,.22,.06,.3,rust);box(desk,.2,.82,.55,.2,.04,.28,m.sage);
  chair(desk,-.72,0,-Math.PI/2);
 }
 // A leafy plant in the corner: broad leaves spiralling up out of a stone pot.
 {const plant=place(nook,...p(1203,552)),leaf=new T.IcosahedronGeometry(1,1);solid(plant,cyl,m.stone,0,.21,0,.19,.42,.19);
  for(let i=0;i<11;i++){const a=i*2.4,r=.06+.012*i;const o=solid(plant,leaf,m.leaf,Math.cos(a)*r,.55+i*.06,Math.sin(a)*r,.07,.2,.15);o.rotation.set(0,-a,.55);}}
 groups.front.add(buildFrontWall(material,true));
 const solarRoof=buildSolar(roofs,groups.solar);
 const set=(state:RenovationState,level:Level)=>{for(const id of Object.keys(groups) as RenovationId[])groups[id].visible=state[id];kitchenRoof.visible=state.kitchen;solarRoof.visible=state.solar;for(const o of kitchen.children)if(o.name==='kitchen-retained-pier'){o.scale.y=level==='exterior'?2.55:1.01;o.position.y=.16+o.scale.y/2;}};
 return {groups,kitchenRoof,set};
}
