import * as T from 'three';
import {passable} from './walk';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {planPoint as p} from './site-data';

/** Recognizable existing pieces reconstructed from the original photo library.
 * Room registration follows the exposé. Furniture dimensions are visual estimates.
 * Proposed renovation renders are deliberately not used as existing-state evidence.
 */
export function furnishHouse(ground:T.Group,upper:T.Group,basement:T.Group,material:(pale:string,natural?:string,roughness?:number)=>T.MeshStandardMaterial){
 const m={outdoorWood:material('#c1baa7','#827e71'),oak:material('#c4b69f','#af8555'),pine:material('#d7c8ad','#c4a276'),cream:material('#ede9de','#eee6d5'),sage:material('#ced0bd','#a5ad8d'),charcoal:material('#737970','#323a35'),grey:material('#cecec3','#a2a493'),rust:material('#c3b5a5','#a35f49'),pink:material('#dacbc3','#c79992'),navy:material('#9ca7a5','#3b5260'),white:material('#f0eee5','#eeeae1'),brass:material('#c0b49b','#ad8c48'),marble:material('#9da79b','#45614f'),leaf:material('#95a382','#6e865a')};
 for(const [key,surface] of Object.entries({outdoorWood:'oak',oak:'oak',pine:'oak',cream:'linen',grey:'linen'}))m[key as keyof typeof m].userData.photo=surface;
 const nickel=material('#d5d8d6','#c3c7c6',.25);nickel.metalness=.85;const zellige=material('#aab08a','#5f6b38',.18);const clay=material('#dccdb6','#b99c7c',.95);const tile=material('#e2ddd2','#d4cbbb',.4);
 const clear=new T.MeshPhysicalMaterial({color:'#cfddda',roughness:.12,transparent:true,opacity:.4,depthWrite:false,side:T.DoubleSide});
 const unit=new T.BoxGeometry(1,1,1),soft=new RoundedBoxGeometry(1,1,1,2,.08),cyl=new T.CylinderGeometry(1,1,1,20),ball=new T.SphereGeometry(1,12,8);
 function mesh(parent:T.Group,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,w=1,h=1,d=1){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 const box=(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,round=false)=>mesh(g,round?soft:unit,mat,x,y+h/2,z,w,h,d);
 const round=(g:T.Group,x:number,y:number,z:number,r:number,h:number,mat:T.Material)=>mesh(g,cyl,mat,x,y+h/2,z,r,h,r);
 const group=(parent:T.Group,x:number,y:number,z:number,angle=0)=>{const g=new T.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);return g;};
 const place=(parent:T.Group,x:number,z:number,angle=0)=>{const q=p(x,z);return group(parent,q[0],parent===upper?3.1:parent===basement?-2.3:.16,q[1],angle);};
 const rod=(g:T.Group,a:number[],b:number[],width:number,mat:T.Material)=>{const u=new T.Vector3(...a),v=new T.Vector3(...b),len=u.distanceTo(v);const o=mesh(g,cyl,mat,...u.clone().add(v).multiplyScalar(.5).toArray() as [number,number,number],width/2,len,width/2);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.sub(u).normalize());return o;};
 const rug=(g:T.Group,w:number,d:number,mat=m.cream,pattern=false)=>{box(g,0,.01,0,w,.012,d,mat);if(pattern)for(let i=-w/2+.15;i<w/2;i+=.24){const stripe=box(g,i,.024,0,.025,.006,d,m.charcoal);stripe.rotation.y=.12;} };
 function chair(parent:T.Group,x:number,z:number,angle=0,mat=m.white){const g=group(parent,x,0,z,angle);box(g,0,.43,0,.48,.06,.46,m.pine,true);for(const a of [-.2,.2])for(const b of [-.19,.19])rod(g,[a,0,b],[a*.86,.48,b*.86],.038,mat);rod(g,[-.23,.45,.2],[-.23,.86,.22],.035,mat);rod(g,[.23,.45,.2],[.23,.86,.22],.035,mat);box(g,0,.8,.22,.49,.09,.045,mat,true);rod(g,[-.18,.47,.21],[0,.79,.22],.026,mat);rod(g,[.18,.47,.21],[0,.79,.22],.026,mat);}
 function table(g:T.Group,w:number,d:number,height=.75,mat=m.oak){box(g,0,height-.07,0,w,.07,d,mat,true);for(const x of [-w/2+.12,w/2-.12])for(const z of [-d/2+.12,d/2-.12])box(g,x,0,z,.065,height-.07,.065,mat===clear?m.charcoal:mat);}
 function sofa(parent:T.Group,x:number,z:number,w:number,angle=0,mat=m.cream,arms=true){const g=group(parent,x,0,z,angle);box(g,0,.11,0,w,.28,.95,mat,true);box(g,0,.36,.39,w,.4,.2,mat,true);const n=Math.max(2,Math.round(w/.8));for(let i=0;i<n;i++)box(g,-w/2+(i+.5)*w/n,.39,-.04,w/n-.035,.12,.66,mat,true);if(arms)for(const dx of [-w/2+.08,w/2-.08])box(g,dx,.28,0,.16,.34,.96,mat,true);for(const [x,color] of [[-w*.3,m.grey],[w*.3,m.rust]] as [number,T.Material][]){const o=box(g,x,.53,.28,.34,.3,.15,color,true);o.rotation.z=x<0?-.13:.15;}return g;}
 function bench(parent:T.Group,x:number,z:number,w:number,angle=0){const g=group(parent,x,0,z,angle);box(g,0,0,0,w,.4,.66,m.oak);box(g,0,.4,-.03,w-.03,.12,.56,m.grey,true);box(g,0,.46,.28,w,.37,.09,m.pine);for(let i=0;i<Math.floor(w/.75);i++)box(g,-w/2+.4+i*.75,.52,.2,.4,.31,.13,i%2?m.pink:m.rust,true);}
 function bed(g:T.Group,w=1.8,fourPoster=false,low=false,nightstandSides=[-1,1]){const base=low?.12:.29;box(g,0,.04,0,w+.12,base,2.18,m.oak);box(g,0,base+.04,0,w,.19,2.09,m.cream,true);box(g,0,.14,-1.08,w+.1,.76,.12,fourPoster?m.oak:m.cream,true);box(g,0,base+.245,.38,w-.04,.04,1.2,low?m.rust:m.cream,true);for(const x of [-w/4,w/4])box(g,x,base+.25,-.65,w*.4,.13,.44,m.white,true);if(fourPoster){for(const x of [-w/2-.05,w/2+.05])for(const z of [-1.1,1.1])box(g,x,0,z,.085,2.05,.085,m.oak);for(const x of [-w/2-.05,w/2+.05])box(g,x,2,0,.075,.07,2.27,m.oak);for(const z of [-1.1,1.1])box(g,0,2,z,w+.18,.07,.075,m.oak);}for(const side of nightstandSides)round(g,side*(w/2+.42),0,-.73,.23,.42,m.oak);}
 function cabinets(g:T.Group,w:number,height=.88,mat=m.pine,top=true){box(g,0,0,0,w,height,.6,mat);const n=Math.round(w/.55);for(let i=0;i<n;i++){const x=-w/2+(i+.5)*w/n;box(g,x,.04,-.307,w/n-.018,height-.08,.015,mat);box(g,x+.13,height*.75,-.326,.11,.018,.025,m.brass);}if(top)box(g,0,height,0,w+.04,.055,.65,m.oak);}
 function sink(g:T.Group,x=0,z=0,y=.95){box(g,x,y,z,.5,.08,.37,m.white,true);box(g,x,y+.045,z,.39,.02,.27,m.grey,true);rod(g,[x,y,z+.22],[x,y+.31,z+.22],.024,m.charcoal);rod(g,[x,y+.31,z+.22],[x,y+.31,z+.04],.024,m.charcoal);}
 function tub(g:T.Group){const shape=new T.Shape();shape.absellipse(0,0,.43,.9,0,Math.PI*2,false,0);const hole=new T.Path();hole.absellipse(0,0,.35,.78,0,Math.PI*2,true,0);shape.holes.push(hole);const geo=new T.ExtrudeGeometry(shape,{depth:.45,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:32});geo.rotateX(-Math.PI/2);mesh(g,geo,m.white,0,.12,0);mesh(g,cyl,m.white,0,.12,0,.35,.05,.78);rod(g,[-.58,0,0],[-.58,.78,0],.025,m.brass);rod(g,[-.58,.78,0],[-.27,.78,0],.025,m.brass);}
 function vanity(g:T.Group,w=1.8,double=true){box(g,0,.79,0,w,.075,.52,m.oak);box(g,0,.16,0,w,.05,.46,m.oak);for(const x of [-w/2+.035,w/2-.035])for(const z of [-.22,.22])box(g,x,0,z,.03,.83,.03,m.charcoal);for(const x of double?[-w*.25,w*.25]:[0]){box(g,x,.865,0,double?.5:.45,.12,.4,m.white,true);box(g,x,.97,0,.34,.008,.26,m.grey);rod(g,[x,.89,.24],[x,1.13,.24],.018,m.brass);rod(g,[x,1.13,.24],[x,1.13,.05],.018,m.brass);}}
 function desk(g:T.Group,w=2.6){box(g,0,.73,0,w,.07,.62,m.oak);for(const x of [-w/2+.28,w/2-.28]){box(g,x,0,0,.45,.73,.52,m.white);for(const y of [.15,.32,.49])box(g,x,y,-.267,.39,.009,.015,m.grey);}chair(g,0,-.75,Math.PI,m.charcoal);box(g,.35,.8,0,.48,.04,.3,m.charcoal);box(g,.35,.84,.19,.48,.29,.025,m.charcoal);}
 function plant(g:T.Group){round(g,0,0,0,.24,.43,m.rust);for(let i=0;i<7;i++){const a=i*2.4,x=Math.cos(a)*.35,z=Math.sin(a)*.35;rod(g,[0,.35,0],[x,1+i*.07,z],.018,m.leaf);const leaf=mesh(g,ball,m.leaf,x,1+i*.07,z,.16,.26,.08);leaf.rotation.z=a;}}
 const kitchenStart=ground.children.length;
 // Ground: sage kitchen, butcher-block island, Lacanche-style range and breakfast banquette.
 // Off-white island with the sink at the hall end (IMG_1444); sage perimeter units.
 let g=place(ground,870,337);cabinets(group(g,0,0,0,Math.PI/2),3.1,.86,m.white);box(g,0,.915,0,1.07,.06,3.15,m.oak);sink(g,0,.8,.98);
 // Range run from the north wall to the pier, cooker opposite the island; chrome trim (IMG_1448).
 g=place(ground,947,297,Math.PI/2);cabinets(g,5.1,.88,m.sage);const cooker=group(g,-1.1,0,-.03);box(cooker,0,0,-.04,1.13,.91,.64,m.charcoal);for(const x of [-.28,.28]){box(cooker,x,.15,-.366,.5,.49,.025,m.charcoal);box(cooker,x,.58,-.4,.35,.028,.045,nickel);}box(cooker,0,.91,-.04,1.16,.035,.67,m.charcoal);for(const x of [-.33,.33])for(const z of [-.22,.15])round(cooker,x,.946,z,.115,.018,m.charcoal);for(let i=0;i<5;i++)round(group(cooker,-.43+i*.215,.77,-.37,0),0,0,0,.035,.04,nickel).rotation.x=Math.PI/2;
 // Hood is a separate upper piece, retained because it identifies the existing kitchen.
 box(g,-1.1,1.75,.05,1.18,.18,.59,m.sage);box(g,-1.1,1.93,.14,.7,.55,.38,m.sage);
 // Glossy olive zellige up to the hood, open shelves beside it (D546F362).
 box(g,-1.1,.94,.29,2.4,.81,.02,zellige);for(const y of [1.42,1.78])box(g,.75,y,.17,1.4,.04,.26,m.oak);
 // Tall units either side of the pantry door, which stays clear.
 cabinets(place(ground,917,450),1.8,2.2,m.sage,false);cabinets(place(ground,841,450),.55,2.2,m.sage,false);
 g=place(ground,872,238);table(g,1.6,.87);bench(g,0,-.81,2.05,Math.PI);bench(g,-1.04,-.28,1.5,-Math.PI/2);chair(g,.35,.8);chair(g,1.12,0,Math.PI/2);
 // Long outdoor table on the kitchen terrace, with room to pass the sliding leaf.
 g=place(ground,747,345,Math.PI/2);g.name='kitchen-terrace-table';table(g,2.85,.88,.75,m.outdoorWood);for(const z of [-.78,.78]){box(g,0,.4,z,2.7,.05,.34,m.outdoorWood);for(const x of [-1.15,1.15])box(g,x,0,z,.06,.4,.28,m.outdoorWood);}
 rod(g,[0,0,0],[0,2.3,0],.045,m.white);mesh(g,new T.ConeGeometry(1.4,.38,16),m.cream,0,2.2,0);
 for(const o of ground.children.slice(kitchenStart))o.userData.replacedBy='kitchen';
 // Four-poster bedroom and twin-basin bathroom.
 bed(place(ground,1124,236),1.85,true);rug(place(ground,1124,330),2.5,1.15,m.cream,true);
 // Linen-panelled pine wardrobes against the kitchen wall, either side of a service shaft (800A78C1).
 cabinets(place(ground,980,245,-Math.PI/2),2.68,2.05,m.pine,false);cabinets(place(ground,980,346,-Math.PI/2),2,2.05,m.pine,false);box(place(ground,980,301.5),0,0,0,.6,2.6,.42,m.white);
 tub(place(ground,1190,464));vanity(place(ground,1128,455,-Math.PI/2),1.85);g=place(ground,1086,487);box(g,0,0,0,.42,.43,.63,m.white,true);box(g,0,.43,-.22,.43,.5,.14,m.white,true);
 // Small hallway WC behind the stair: fixtures and doorway traced from the ground plan.
 g=place(ground,870,531,-Math.PI/2);g.name='hall-wc-toilet';box(g,0,.02,0,.39,.34,.57,m.white,true);box(g,0,.35,0,.42,.07,.6,m.white,true);box(g,0,.06,.26,.43,.75,.12,m.white,true);
 g=place(ground,881,578,-Math.PI/2);g.name='hall-wc-basin';box(g,0,.74,.02,.7,.05,.42,m.pine);box(g,0,.3,.02,.7,.03,.4,m.pine);mesh(g,ball,m.white,0,.86,0,.21,.08,.15);rod(g,[0,1.06,.23],[0,1.06,.07],.018,m.brass);box(g,0,.77,.235,.8,.9,.012,tile);
 // Dining alcove: U-shaped timber banquette, three white chairs on the open side.
 g=place(ground,1132,578);table(g,2.65,1.02);bench(g,0,-1.14,3.7,Math.PI);bench(g,-1.6,-.23,1.6,-Math.PI/2);bench(g,1.6,-.23,1.6,Math.PI/2);for(const x of [-.9,0,.9])chair(g,x,.98);
 // Living: two facing sofas, transparent coffee table and woven chair by the garden.
 g=place(ground,1020,784);sofa(g,-2.05,0,2.9,-Math.PI/2);sofa(g,2.05,0,2.9,Math.PI/2).userData.replacedBy='east';table(group(g,0,0,0),1.45,1.05,.42,clear);
 const cane=place(ground,1190,827,-.5);chair(cane,0,0,0,m.oak);box(cane,0,.47,0,.5,.13,.48,m.cream,true);plant(place(ground,1194,700));g=place(ground,920,841);round(g,0,0,0,.22,.025,m.charcoal);rod(g,[0,0,0],[0,1.5,0],.025,m.charcoal);mesh(g,new T.ConeGeometry(.25,.2,20),m.charcoal,.13,1.53,0);
 g=place(ground,614,642);g.name="entry-storage-clear-of-courtyard-door";cabinets(g,4.65,2.35,m.pine,false);plant(place(ground,781,600));g=place(ground,1030,609);table(g,.5,1.65,.85);
 // Garage: keep the bays clear as photographed, with workbench and storage.
 // Charcoal base units with a pale worktop, sink and floating oak shelf (4DBC069B), on the south wall clear of both door positions.
 g=place(ground,415,645);cabinets(g,2.2,.87,m.charcoal,false);box(g,0,.87,0,2.24,.04,.65,m.white);sink(g,-.55,0,.88);box(g,0,1.5,.17,2.1,.035,.28,m.oak);rug(place(ground,270,580),4.1,.7,m.rust);
 // Guest yoga room, rust lounge modules and glazed sauna.
 g=place(ground,256,865,-.093);rug(g,.72,1.8,m.grey);round(g,.05,.04,-.63,.17,.55,m.rust).rotation.x=Math.PI/2;
 g=place(ground,245,1117,-.093);sofa(g,0,1.28,2.1,0,m.rust);sofa(g,.86,-.15,1.75,Math.PI/2,m.rust,false);table(group(g,-.24,0,-.24),.73,.73,.31,m.charcoal);
 // Full corner sauna: timber lining, stepped L benches, glazed front and stone heater.
 // Clay-plastered walls inside; timber only on the benches and the spruce front frame (IMG_1582).
 g=place(ground,127,1143,-.093);g.name='guest-corner-sauna';
 box(g,0,0,0,2.72,.06,3.03,m.pine);box(g,-1.3,0,0,.12,1.05,3.03,clay);box(g,0,0,1.46,2.72,1.05,.1,clay);box(g,0,0,-1.46,2.72,1.05,.1,clay);
 box(g,1.32,0,0,.03,1.05,3,clear);for(const z of [-1.46,-.3,.5,1.46])box(g,1.34,0,z,.05,1.05,.045,m.pine);box(g,1.34,1.05,0,.05,.05,3,m.pine);box(g,1.37,.75,.4,.045,.28,.045,m.oak);
 box(g,-.94,0,0,.65,.42,2.8,m.pine);box(g,-.64,0,1.08,1.94,.75,.69,m.pine);box(g,-.95,0,.1,.62,.75,2.63,m.pine);
 for(let i=0;i<12;i++)box(g,-.64,.755,.77+i*.054,1.93,.018,.025,m.oak);
 for(let i=0;i<11;i++)box(g,-1.25+i*.054,.755,.1,.026,.018,2.63,m.oak);
 box(g,.81,0,-1,.4,.66,.45,m.charcoal);for(let i=0;i<9;i++)mesh(g,ball,m.grey,.7+(i%3)*.1,.68,-1.1+Math.floor(i/3)*.1,.066,.05,.06);

 // Guest WC: wall-hung toilet under the west window and a long green-marble trough on the south wall (IMG_1588).
 g=place(ground,98,960,-Math.PI/2-.093);g.name='guest-wc-toilet';box(g,0,.25,-.02,.37,.15,.52,m.white,true);box(g,0,.4,-.02,.4,.05,.55,m.white,true);box(g,0,.1,.27,.45,.9,.08,m.white,true);
 g=place(ground,140,982,-.093);g.name='guest-wc-trough';box(g,0,.72,0,2.3,.16,.42,m.marble);box(g,0,.86,-.02,2,.012,.3,m.charcoal);for(const x of [-.5,.5]){rod(g,[x,.88,.2],[x,1.1,.2],.018,m.brass);rod(g,[x,1.1,.2],[x,1.1,.06],.018,m.brass);}
 // Shower room beside the WC.
 g=place(ground,114,1038,-.093);g.name='guest-shower';box(g,0,.015,0,1.45,.04,1.95,m.white,true);rod(g,[-.68,.08,0],[-.68,2,0],.023,m.charcoal);rod(g,[-.68,2,0],[-.4,2,0],.023,m.charcoal);box(g,-.4,1.97,0,.22,.03,.22,m.charcoal);
 // Wellness fireplace: black firebox in a spruce surround on the yoga partition's south face (IMG_1583).
 g=place(ground,280,970,-.093);g.name='wellness-fireplace';box(g,0,0,0,2.3,.4,.9,m.charcoal);box(g,0,.4,-.05,2.3,1.45,.8,m.pine);box(g,0,.55,.36,1.1,.7,.02,m.charcoal);box(g,0,1.85,0,2.36,.06,.92,m.pine);
 const courtyardStart=ground.children.length;
 // Existing covered courtyard has a long built-in lounge, rather than the proposed dining layout.
 g=place(ground,620,693);sofa(g,0,0,4.8,Math.PI,m.grey,false);for(const x of [-.5,.5])round(g,x,0,1.25,.2,.42,m.oak);
 // Guest-side loggia: rattan bench along the yoga glazing, two armchairs and a small side table (FDE39D63).
 g=place(ground,361,880,-Math.PI/2-.093);g.name='loggia-rattan-seating';box(g,0,0,0,1.9,.4,.46,m.oak,true);box(g,0,.4,0,1.85,.09,.44,m.cream,true);
 for(const x of [-.62,.62]){const c=group(g,x,0,-1.05,Math.PI);box(c,0,0,0,.72,.42,.7,m.oak,true);box(c,0,.42,.27,.72,.4,.16,m.oak,true);for(const side of [-.33,.33])box(c,side,.42,0,.08,.2,.66,m.oak,true);box(c,0,.42,-.04,.56,.09,.52,m.cream,true);}
 round(g,0,0,-1.05,.24,.45,m.oak);
 for(const o of ground.children.slice(courtyardStart))o.userData.replacedBy='courtyard';
 // The owner confirms the two mirrored north bedrooms; the east bed has its head against the dividing wall.
 g=place(upper,1020,225,-Math.PI/2);g.name='northwest-bed-against-divider';bed(g,1.6,true,false,[1]);desk(place(upper,925,337,-Math.PI/2),2.55);
 bed(place(upper,1108,225,Math.PI/2),1.6,true,false,[-1]);desk(place(upper,1203,337,Math.PI/2),2.55);
 g=place(upper,1128,766);rug(g,4,4.4,m.pink);bed(place(upper,1082,760),1.8,false,true,[]);g=place(upper,1201,768,Math.PI/2);box(g,0,.72,0,1.15,.66,.055,m.charcoal);rod(g,[0,.72,0],[0,.22,0],.04,m.charcoal);box(g,0,.18,0,.75,.025,.42,m.charcoal);
 tub(place(upper,930,770));vanity(place(upper,1020,770,Math.PI/2),1.75);g=place(upper,1179,576,Math.PI/2);cabinets(g,4.8,2,m.pine,false);
 // South bathroom: a separate WC and shower occupy the strip beside the atrium.
 g=place(upper,939,697,-Math.PI/2);g.name='upper-south-wc';box(g,0,.02,0,.39,.34,.57,m.white,true);box(g,0,.35,0,.42,.07,.6,m.white,true);box(g,0,.06,.26,.43,.75,.12,m.white,true);
 g=place(upper,1007,697);g.name='upper-south-shower';box(g,0,.015,0,62*12/434,.045,44*12/434,m.white,true);
 box(g,.48,.065,.65,.65,1.04,.025,clear);box(g,.48,1.105,.65,.65,.025,.026,m.charcoal);
 rod(g,[0,.08,-.58],[0,1.12,-.58],.023,m.charcoal);rod(g,[0,1.12,-.58],[0,1.12,-.26],.023,m.charcoal);box(g,0,1.09,-.26,.22,.035,.22,m.charcoal);
 // The south screen leaves a clear walk-in opening beside the vanity.
 // The small east-side room off the gallery contains a WC and a single basin.
 g=place(upper,1184,472);g.name='upper-gallery-wc';box(g,0,.02,0,.39,.34,.57,m.white,true);box(g,0,.35,0,.42,.07,.6,m.white,true);box(g,0,.06,.26,.43,.75,.12,m.white,true);
 g=place(upper,1183,421,Math.PI);g.name='upper-gallery-basin';vanity(g,.62,false);
 // Owner-annotated north bathroom: two bedroom entrances and vanities,
 // a central privacy partition, and one continuous shower across the north side.
 g=place(upper,1064,345);g.name='north-shared-bathroom';
 box(g,0,.005,0,122*12/434,.015,119*12/434,m.grey);
 for(const x of [1032,1096]){const unit=place(upper,x,393);unit.name='north-bath-vanity-'+x;vanity(unit,1.12,false);}
 const shower=place(upper,1064,313);shower.name='north-bath-shared-shower';
 box(shower,0,.025,0,118*12/434,.045,49*12/434,m.white,true);
 box(shower,0,.073,-.53,2.6,.007,.035,m.charcoal);
 // One shower zone: screens stop short of both side entrances, with no middle wall.
 for(const [x,w] of [[1008,8],[1064,40],[1120,8]]){const screen=place(upper,x,340);box(screen,0,.05,0,w*12/434,1.1,.025,clear);box(screen,0,1.15,0,w*12/434,.022,.026,m.charcoal);}
 rod(shower,[0,.08,-.67],[0,1.12,-.67],.023,m.charcoal);rod(shower,[0,1.12,-.67],[0,1.12,-.34],.023,m.charcoal);box(shower,0,1.095,-.34,.22,.035,.22,m.charcoal);
 for(const [x,side] of [[1000,1],[1128,-1]]){const door=place(upper,x,379);door.name='north-bath-bedroom-door-'+x;box(door,side*.46,.015,0,.92,1.03,.045,m.pine);box(door,side*.78,.77,-.047,.12,.023,.03,m.charcoal);passable(door);}
 // Guest upper study: daybed under the west slope, worktop opposite; no invented double bed.
 g=place(upper,225,657,-Math.PI/2-.093);g.name='guest-study-daybed-against-wall';bench(g,0,0,4.5);desk(place(upper,369,661,Math.PI/2-.093),3.6);g=place(upper,311,664,-.093);rug(g,1.75,3.2,m.cream,true);
 // Gallery kitchenette and small red bistro table beside the staircase.
 g=place(upper,342,878,Math.PI/2-.093);cabinets(g,2.8,.86,m.white);sink(g,-.63,0,.92);box(g,.73,.925,0,.47,.023,.44,m.charcoal);g=place(upper,290,865);round(g,0,.7,0,.48,.045,m.rust);round(g,0,0,0,.25,.035,m.rust);round(g,0,.035,0,.035,.665,m.rust);rug(place(upper,309,914,-.093),.7,1.4,m.pink);
 g=place(upper,236,1086,-.093);g.name='guest-bedroom-corner-bed';bed(g,1.8);
 g=place(upper,343,977,Math.PI/2-.093);g.name='guest-bedroom-corner-vanity';vanity(g,.75,false);
 g=place(upper,217,958,Math.PI-.093);g.name='guest-upper-bath-toilet';box(g,0,.02,0,.4,.36,.58,m.white,true);box(g,0,.38,0,.43,.065,.61,m.white,true);box(g,0,.03,.25,.43,.74,.13,m.white,true);
 g=place(upper,223,1018,-.093);g.name='guest-upper-bath-shower';box(g,0,.015,0,1.72,.045,.91,m.white,true);box(g,-.5,.06,-.49,.64,1.07,.025,clear);box(g,-.5,1.13,-.49,.64,.022,.025,m.charcoal);rod(g,[0,.08,.43],[0,1.12,.43],.025,m.charcoal);rod(g,[0,1.12,.43],[0,1.12,.12],.025,m.charcoal);box(g,0,1.1,.12,.22,.03,.22,m.charcoal);
 g=place(upper,263,980,-.093);g.name='guest-upper-bath-open-door';box(g,-.4,.015,0,.8,1.03,.045,m.pine);box(g,-.69,.78,-.04,.11,.024,.035,m.charcoal);passable(g);
 // Long low bookshelf along the gallery knee wall (562560DE).
 g=place(upper,914,565,-Math.PI/2);g.name='gallery-bookshelf';box(g,0,0,0,5.2,.06,.34,m.oak);for(const y of [.36,.72])box(g,0,y,0,5.2,.03,.34,m.oak);for(let x=-2.6;x<=2.61;x+=.65)box(g,x,0,0,.03,.75,.34,m.oak);
 for(let i=0;i<24;i++){const x=-2.5+(i%12)*.43,y=i<12?.06:.39;box(g,x,y,.02,.3,.26+(i*7%5)*.02,.24,[m.rust,m.navy,m.cream,m.sage][i%4]);}
 // Basement: laundry matches the labelled HWR, wine racks the narrow Wein room.
 g=place(basement,1140,480,Math.PI);cabinets(g,3.8,.88,m.navy);for(let i=0;i<4;i++){const x=-1.02+i*.66;box(g,x,.03,-.03,.6,.81,.6,m.white);const drum=mesh(g,new T.TorusGeometry(.19,.036,8,24),m.charcoal,x,.46,-.345);drum.rotation.set(0,0,0);mesh(g,new T.CircleGeometry(.15,24),m.grey,x,.46,-.349);}box(g,0,.89,0,3.85,.05,.65,m.oak);
 g=place(basement,871,558,-Math.PI/2);for(const x of [-1.85,-.93,0,.93,1.85]){const rack=group(g,x,0,0);box(rack,0,0,.23,.9,1.85,.07,m.oak);for(const side of [-.43,.43])box(rack,side,0,0,.055,1.85,.5,m.oak);for(let y=.05;y<1.8;y+=.3){box(rack,0,y,0,.87,.04,.5,m.oak);for(let k=0;k<4;k++){const bottle=round(group(rack,-.3+k*.2,y+.11,0),0,0,0,.055,.3,m.marble);bottle.rotation.x=Math.PI/2;}}}
 g=place(basement,945,790);table(g,2,.95);for(const x of [-.6,.6])chair(g,x,.85,0,m.charcoal);g=place(basement,862,763,-Math.PI/2);cabinets(g,3.7,.88,m.pine);rug(place(basement,1130,782),.7,1.8,m.grey);
 cabinets(place(basement,902,219,Math.PI),2.3,1.7,m.white,false);
 // Heating room: network rack and a small wall-mounted gas vessel (78D1A634, 0AAC2C54).
 g=place(basement,969,300,-Math.PI/2);box(g,0,0,0,.6,1.2,.6,m.charcoal);round(place(basement,950,207),0,1.05,0,.18,.55,m.white);
 cabinets(place(basement,1142,401,Math.PI),3.5,2.1,m.pink,false);cabinets(place(basement,1199,763,Math.PI/2),3.7,2,m.white,false);
}
