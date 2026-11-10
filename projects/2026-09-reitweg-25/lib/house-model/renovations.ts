import * as T from 'three';
import {buildSolar} from './solar';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import kitchenLayout from '../../public/assets/kitchen-refined-layout-v4.json';
import {planPoint as p,PLAN_SCALE,type Level} from './site-data';
import {buildFrontWall} from './front-wall';
import {buildFrontGarage} from './front-garage';
import {loungeChair} from './lounge-chair';
import {renovationState,type RenovationId,type RenovationState} from './renovation-data';

// Register the permit inset to the original ground plan with ONE uniform scale.
// The northwest pier (310,275) maps to (794,182); kitchen south wall to z465.
// Do not rotate, mirror, or independently stretch A and B.
export const kitchenPoint=(x:number,z:number)=>p(807+(x-334)*.53,182+(z-275)*.53);
const K=.53*12/434;
// The Winter Garden as approved (Landratsamt Weilheim-Schongau, Az. 2021-1378, plan EP01 stamped 19.08.2021), set
// out from the main house's outer wall faces (cladding 0.105 m outside the facade lines W -6 and N -9.61): its west
// glass 3.40 m out from the west wall, its north glass 2.26 m out from the north gable, 7.70 m east–west along the north
// face and 8.81 m north–south along the west face.
export const HOUSE_WEST=-6.105,HOUSE_NORTH=-9.715;
export const WG_WEST=HOUSE_WEST-3.4,WG_NORTH=HOUSE_NORTH-2.26,WG_EAST=WG_WEST+7.7,WG_SOUTH=WG_NORTH+8.81;
// The Winter Garden's roof, in plan: the new room around the main house's north-west corner.
export const winterGardenOutline:[number,number][]=[[WG_WEST,WG_NORTH],[WG_EAST,WG_NORTH],[WG_EAST,HOUSE_NORTH],[HOUSE_WEST,HOUSE_NORTH],[HOUSE_WEST,WG_SOUTH],[WG_WEST,WG_SOUTH]];
// Its floor is the kitchen's, ±0.00 (625.06 m above sea level): the top of the kitchen's tiles. The frames are 2.50 m high and the
// roof's edge stands 2.65 m above the floor, the glass roof falling 3° to the garden from the house.
const FLOOR=.142,FRAME=2.5,EDGE=2.65,FALL=Math.tan(3*Math.PI/180);
/** The roof's top at a point: rising from the outer edges, the two arms meeting at a hip over the corner. */
const roofTop=(x:number,z:number)=>FLOOR+EDGE+FALL*Math.min(x-WG_WEST,z-WG_NORTH);
type MaterialFactory=(pale:string,natural?:string,roughness?:number)=>T.MeshStandardMaterial;
export function buildRenovations(ground:T.Group,roofs:T.Group,site:T.Group,material:MaterialFactory){
 const groups={} as Record<RenovationId,T.Group>;
 for(const id of Object.keys(renovationState()) as RenovationId[]){const g=new T.Group();g.name='renovation-'+id;g.visible=false;(id==='front'||id==='garage'?site:ground).add(g);groups[id]=g;}
 const kitchenRoof=new T.Group();kitchenRoof.name='renovation-kitchen-roof';roofs.add(kitchenRoof);kitchenRoof.visible=false;
 const m={oak:material('#b49772'),stone:material('#dbd4c4'),sage:material('#939d89'),metal:material('#46524b'),linen:material('#e8e1cf'),clay:material('#ba8770'),leaf:material('#788866'),white:material('#eee9de')};
 const timber=material('#8a6d57','#3d3129',.7);
 m.oak.userData.photo='oak';m.stone.userData.photo='stone';m.linen.userData.photo='linen';
 const clear=new T.MeshPhysicalMaterial({color:'#c3d7ce',transparent:true,opacity:.22,roughness:.13,metalness:.1,depthWrite:false,side:T.DoubleSide});
 const privacy=new T.MeshPhysicalMaterial({color:'#d9dfd4',transparent:true,opacity:.78,roughness:.85,depthWrite:false,side:T.DoubleSide});
 const unit=new T.BoxGeometry(1,1,1),soft=new RoundedBoxGeometry(1,1,1,2,.065),cyl=new T.CylinderGeometry(1,1,1,20);
 const box=(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,rounded=false)=>{const o=new T.Mesh(rounded?soft:unit,mat);o.position.set(x,y+h/2,z);o.scale.set(w,h,d);o.castShadow=mat!==clear&&mat!==privacy;o.receiveShadow=true;g.add(o);return o;};
 const place=(g:T.Group,x:number,z:number,angle=0,y=.16)=>{const o=new T.Group();o.position.set(x,y,z);o.rotation.y=angle;g.add(o);return o;};
 const poly=(g:T.Group,points:number[][],y:number,h:number,mat:T.Material)=>{const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));const geo=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=new T.Mesh(geo,mat);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 function chair(g:T.Group,x:number,z:number,angle=0,stool=false){const c=place(g,x,z,angle,0),height=stool?.64:.43;box(c,0,height,0,.46,.08,.45,m.linen,true);for(const dx of [-.18,.18])for(const dz of [-.18,.18])box(c,dx,0,dz,.04,height,.04,m.oak);if(!stool){box(c,0,.51,.2,.47,.31,.06,m.oak,true);box(c,0,.54,.155,.39,.23,.04,m.linen,true);}else box(c,0,.27,.18,.4,.025,.025,m.metal);return c;}
 function table(g:T.Group,w:number,d:number){box(g,0,.7,0,w,.07,d,m.oak,true);for(const x of [-w/2+.15,w/2-.15])for(const z of [-d/2+.15,d/2-.15])box(g,x,0,z,.065,.7,.065,m.oak);}
 function dining(g:T.Group,x:number,z:number,w:number,d:number,angle=0){const t=place(g,x,z,angle);table(t,w,d);for(const dx of [-w/3,0,w/3]){chair(t,dx,d/2+.36);chair(t,dx,-d/2-.36,Math.PI);}chair(t,-w/2-.35,0,-Math.PI/2);chair(t,w/2+.35,0,Math.PI/2);return t;}
 function planter(g:T.Group,x:number,z:number){box(g,x,.16,z,.6,.55,.6,m.stone,true);const leaves=new T.Mesh(new T.IcosahedronGeometry(.45,1),m.leaf);leaves.position.set(x,.9,z);leaves.scale.y=1.25;g.add(leaves);}
 // Full-height glazing is preserved in a cutaway so its indoor/outdoor relationship remains legible. It stands on the
 // floor at `base` and its head stays at 2.71 m: the winter garden's floor is 0.16 m, the house's slab 0.12 m.
 function glazing(g:T.Group,a:number[],b:number[],privateBand=false,base=.16){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),bay=place(g,a[0],a[1],-Math.atan2(b[1]-a[1],b[0]-a[0]),base);const n=Math.ceil(len/1.65),h=2.71-base;for(let i=0;i<n;i++){const x=(i+.5)*len/n;box(bay,x,0,0,len/n-.055,privateBand?1.25:h,.026,privateBand?privacy:clear);if(privateBand)box(bay,x,1.25,0,len/n-.055,h-1.25,.026,clear);}for(let i=0;i<=n;i++)box(bay,i*len/n,0,0,.055,h,.09,m.metal);for(const y of [0,h])box(bay,len/2,y,0,len,.065,.12,m.metal);return bay;}
 const east=groups.east,SLAB=.12;
 // Bedroom / bathroom / living divisions keep their original alignment; the dining alcove between them keeps its wall
 // (Office Nook Window Expansion opens it, build-model.ts).
 for(const [from,to,privateBand] of [[182,388,0],[388,524,1],[669,877,0]])glazing(east,p(1229,from),p(1229,to),!!privateBand,SLAB);
 // The south wall is glazed on both sides of the retained fireplace; build-model keeps the piers beside it solid.
 for(const [from,to] of [[-6,-.93],[.82,6]])glazing(east,[from,9.61],[to,9.61],false,SLAB);
 // Layout Updates sets a dining table where the east sofa stood (interiors.ts), centred between the room's north wall and
 // the fireplace wall, outside its own group as its other living-room pieces are; the east façade changes no furniture.
 {const table=dining(ground,...p(1132,768.5),2.7,1.02,Math.PI/2);table.name='living-dining-table';table.userData.addedBy='nook';}
 // A frame lines the opened façade, as in the portal render: a head along the top of the glass, under the ceiling,
 // and a post wherever the glass meets a wall, the fireplace or the other glass wall at the south-east corner. Each
 // piece is split at the glass: light oak inside, the house's cladding outside.
 const skin=material('#8a6d57','#6e5946');skin.userData.photo='cladding';
 const head=(a:number[],b:number[],inside:number)=>{const g=place(east,(a[0]+b[0])/2,(a[1]+b[1])/2,-Math.atan2(b[1]-a[1],b[0]-a[0]),2.63),len=Math.hypot(b[0]-a[0],b[1]-a[1])+.24;box(g,0,0,.06*inside,len,.16,.12,m.oak);box(g,0,0,-.06*inside,len,.16,.12,skin);};
 // The east run's inside lies to the west (its local +z); the south runs' inside lies to the north (local -z).
 head(p(1229,182),p(1229,524),1);head(p(1229,669),p(1229,877),1);for(const [from,to] of [[-6,-.93],[.82,6]])head([from,9.61],[to,9.61],-1);
 for(const z of [182,388,524,669]){const [x,pz]=p(1229,z);box(east,x-.06,SLAB,pz,.12,2.63-SLAB,.14,m.oak);box(east,x+.06,SLAB,pz,.12,2.63-SLAB,.14,skin);}
 for(const x of [-6,-.93,.82]){box(east,x,SLAB,9.55,.14,2.63-SLAB,.12,m.oak);box(east,x,SLAB,9.67,.14,2.63-SLAB,.12,skin);}
 box(east,5.94,SLAB,9.55,.12,2.63-SLAB,.12,m.oak);box(east,6.06,SLAB,9.61,.12,2.63-SLAB,.24,skin);box(east,5.94,SLAB,9.67,.12,2.63-SLAB,.12,skin);
 // Kitchen: the Winter Garden and the original kitchen (C) as one floor.
 const kitchen=groups.kitchen,[kitchenEast,kitchenSouth]=kitchenPoint(639,809);
 poly(kitchen,[[WG_WEST,WG_NORTH],[WG_EAST,WG_NORTH],[WG_EAST,HOUSE_NORTH],[kitchenEast,HOUSE_NORTH],[kitchenEast,kitchenSouth],[HOUSE_WEST,kitchenSouth],[HOUSE_WEST,WG_SOUTH],[WG_WEST,WG_SOUTH]],FLOOR-.015,.018,m.stone).name='confirmed-abc-kitchen-floor';
 // The glass faces: north, west, south (to the house) and the north arm's east end. Each has its approved bay count.
 const runs=[[[WG_WEST,WG_NORTH],[WG_EAST,WG_NORTH]],[[WG_WEST,WG_NORTH],[WG_WEST,WG_SOUTH]],[[WG_WEST,WG_SOUTH],[HOUSE_WEST,WG_SOUTH]],[[WG_EAST,WG_NORTH],[WG_EAST,HOUSE_NORTH]]] as [number,number][][];
 // A member from p to q with a w × h section.
 const V=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
 const member=(parent:T.Object3D,p0:T.Vector3,p1:T.Vector3,w:number,h:number,mat:T.Material)=>{const o=new T.Mesh(unit,mat);o.position.copy(p0).add(p1).multiplyScalar(.5);o.scale.set(w,h,p0.distanceTo(p1));o.lookAt(p1);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 // A vertical band along a→b, between heights that may differ at its two ends, 0.1 m deep.
 const band=(parent:T.Object3D,a:number[],b:number[],lowA:number,lowB:number,highA:number,highB:number,mat:T.Material)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const geometry=new T.ExtrudeGeometry(new T.Shape([[0,lowA],[len,lowB],[len,highB],[0,highA]].map(([u,y])=>new T.Vector2(u,y))),{depth:.1,bevelEnabled:false});geometry.translate(0,0,-.05);
  const o=new T.Mesh(geometry,mat);o.position.set(a[0],0,a[1]);o.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 /** Black aluminium glazing along each run: posts between `bays[i]` equal bays, a sill and a head rail at 2.50 m, and
  * horizontal transoms at the heights given (above the floor). */
 function curtainWall(g:T.Group,bays:number[],transoms:number[]){runs.forEach(([a,b],i)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]),bay=place(g,a[0],a[1],-Math.atan2(b[1]-a[1],b[0]-a[0]),FLOOR),n=bays[i],w=len/n;
  for(let k=0;k<n;k++)box(bay,(k+.5)*w,0,0,w-.04,FRAME,.026,clear).name='winter-garden-pane';
  for(let k=0;k<=n;k++)box(bay,k*w,0,0,.06,FRAME,.12,m.metal).name='winter-garden-post';
  for(const y of [0,FRAME-.07,...transoms.map(t=>t-.025)])box(bay,len/2,y,0,len,y===0?.06:y===FRAME-.07?.07:.05,.1,m.metal).name='winter-garden-rail';});}
 // The roof: glass on bars that run from the outer edges up to the house or to the hip, which the bars meet.
 const roofPlane=(parent:T.Object3D,polygon:number[][])=>{const tri=T.ShapeUtils.triangulateShape(polygon.map(([x,z])=>new T.Vector2(x,z)),[]),P:T.Vector3[]=[];
  const top=(i:number)=>V(polygon[i][0],roofTop(polygon[i][0],polygon[i][1]),polygon[i][1]),bottom=(i:number)=>top(i).setY(top(i).y-.03);
  for(const [a,b,c] of tri){const up=new T.Vector3().crossVectors(top(b).sub(top(a)),top(c).sub(top(a))).y>0,[q,r]=up?[b,c]:[c,b];P.push(top(a),top(q),top(r),bottom(a),bottom(r),bottom(q));}
  const geometry=new T.BufferGeometry().setFromPoints(P);geometry.computeVertexNormals();const o=new T.Mesh(geometry,clear);o.name='winter-garden-roof-glass';parent.add(o);return o;};
 const hipEnd=[HOUSE_WEST,WG_NORTH+(HOUSE_WEST-WG_WEST)];
 function roofBars(parent:T.Object3D,westBays:number,northBays:number){const bar=(x0:number,z0:number,x1:number,z1:number)=>member(parent,V(x0,roofTop(x0,z0)-.07,z0),V(x1,roofTop(x1,z1)-.07,z1),.06,.12,m.metal).name='winter-garden-roof-bar';
  for(let i=1;i<westBays;i++){const z=WG_NORTH+i*(WG_SOUTH-WG_NORTH)/westBays;bar(WG_WEST,z,Math.min(HOUSE_WEST,WG_WEST+z-WG_NORTH),z);}
  for(let i=1;i<northBays;i++){const x=WG_WEST+i*(WG_EAST-WG_WEST)/northBays;bar(x,WG_NORTH,x,Math.min(HOUSE_NORTH,WG_NORTH+x-WG_WEST));}
  bar(WG_WEST,WG_NORTH,hipEnd[0],hipEnd[1]);}
 /** A piece of the old house wall kept (or a new pier), on the ground floor, cut low in the floor views. Where its
  * outer face is outside the Winter Garden, `clad` gives it the house's cladding there. */
 const retained=(g:T.Group,x0:number,x1:number,z0:number,z1:number,clad?:'west'|'north')=>{
  const piece=(a:number,b:number,c:number,d:number,mat:T.Material)=>{box(g,(a+b)/2,FLOOR,(c+d)/2,b-a,1,d-c,mat).name='kitchen-retained-pier';};
  if(clad==='west'){piece(x0,x0+.15,z0,z1,skin);piece(x0+.15,x1,z0,z1,m.white);}else if(clad==='north'){piece(x0,x1,z0,z0+.15,skin);piece(x0,x1,z0+.15,z1,m.white);}else piece(x0,x1,z0,z1,m.white);};
 // The wall over an opening, from its head to the ceiling.
 const WALL_TOP=2.79,lintel=(g:T.Group,x0:number,x1:number,z0:number,z1:number,head:number)=>{box(g,(x0+x1)/2,head,(z0+z1)/2,x1-x0,WALL_TOP-head,z1-z0,m.white).name='kitchen-lintel';};
 const westInner=HOUSE_WEST+.45,northInner=HOUSE_NORTH+.45;
 // As permitted: the walls and roof the Large Panes version replaces. The Zinc Roof (set aside) replaces them too.
 const asPermitted=new T.Group();asPermitted.name='winter-garden-as-permitted';asPermitted.userData.replacedBy='catslide';kitchen.add(asPermitted);
 const permitWalls=new T.Group();permitWalls.name='winter-garden-permit-glazing';permitWalls.userData.replacedBy='wideGlass';asPermitted.add(permitWalls);
 // Posts on a 1.10 m grid (7 bays north, 8 west, 3 south, 2 at the east end), transoms at 0.65 m and 2.10 m.
 curtainWall(permitWalls,[7,8,3,2],[.65,2.1]);
 // The old north-west corner stays as a T of wall: 1.72 m of the north wall, standing 0.54 m out past the west wall,
 // and 2.35 m of the west wall. South of it the west wall opens onto the garden dining under a lintel, to 4.10 m short
 // of the kitchen's south wall; the north wall has a 1.27 m door to the breakfast end and is kept beyond it.
 {const g=permitWalls,teeEast=HOUSE_WEST+1.18,stemSouth=HOUSE_NORTH+2.35,westOpenSouth=-4.1,doorEast=-3.66;
  retained(g,HOUSE_WEST-.54,teeEast,HOUSE_NORTH,northInner);retained(g,HOUSE_WEST,westInner,northInner,stemSouth);
  lintel(g,HOUSE_WEST,westInner,stemSouth,westOpenSouth,FLOOR+2.2);
  retained(g,HOUSE_WEST,westInner,westOpenSouth,WG_SOUTH);retained(g,HOUSE_WEST,westInner,WG_SOUTH,kitchenSouth,'west');
  lintel(g,teeEast,doorEast,HOUSE_NORTH,northInner,FLOOR+2.2);
  retained(g,doorEast,WG_EAST,HOUSE_NORTH,northInner);retained(g,WG_EAST,kitchenEast,HOUSE_NORTH,northInner,'north');}
 // Large Panes: the same outline and roof, glazed in full-height panes up to 2.6 m wide (3 north, 4 west, 2 south, 1 at
 // the east end) with no transoms. The old corner becomes a slim T-shaped pier, 0.2 m thick, its flange 0.75 m along
 // the north wall line and its stem 0.5 m down the west, carrying a downstand beam each way; a short return of wall
 // meets the glass at the west arm's south end and at the north arm's east end.
 {const g=groups.wideGlass;curtainWall(g,[3,4,2,1],[]);
  const flangeZ=[HOUSE_NORTH+.12,HOUSE_NORTH+.32],stemX=[HOUSE_WEST+.12,HOUSE_WEST+.32];
  retained(g,HOUSE_WEST-.15,HOUSE_WEST+.6,flangeZ[0],flangeZ[1]);retained(g,stemX[0],stemX[1],flangeZ[1],flangeZ[1]+.5);
  const beamHead=FLOOR+2.35;
  lintel(g,stemX[0],stemX[1],flangeZ[1]+.5,WG_SOUTH-.3,beamHead);lintel(g,HOUSE_WEST+.6,WG_EAST,flangeZ[0],flangeZ[1],beamHead);
  retained(g,HOUSE_WEST,westInner,WG_SOUTH-.3,WG_SOUTH);retained(g,HOUSE_WEST,westInner,WG_SOUTH,kitchenSouth,'west');
  retained(g,WG_EAST,kitchenEast,HOUSE_NORTH,northInner,'north');}
 // The roof, the same in both: glass falling 3° from the house to a black fascia over the frames' head, round the edge.
 const glassRoof=new T.Group();glassRoof.name='winter-garden-glass-roof';glassRoof.userData.replacedBy='catslide';kitchenRoof.add(glassRoof);
 roofPlane(glassRoof,[[WG_WEST,WG_NORTH],[hipEnd[0],hipEnd[1]],[HOUSE_WEST,WG_SOUTH],[WG_WEST,WG_SOUTH]]);
 roofPlane(glassRoof,[[WG_WEST,WG_NORTH],[WG_EAST,WG_NORTH],[WG_EAST,HOUSE_NORTH],[HOUSE_WEST,HOUSE_NORTH],[hipEnd[0],hipEnd[1]]]);
 for(const [a,b] of runs)band(glassRoof,a,b,FLOOR+FRAME,FLOOR+FRAME,roofTop(a[0],a[1]),roofTop(b[0],b[1]),m.metal).name='winter-garden-fascia';
 const permitBars=new T.Group();permitBars.name='winter-garden-permit-roof-bars';permitBars.userData.replacedBy='wideGlass';glassRoof.add(permitBars);roofBars(permitBars,8,7);
 const wideRoof=new T.Group();wideRoof.name='winter-garden-wide-roof-bars';wideRoof.visible=false;kitchenRoof.add(wideRoof);roofBars(wideRoof,4,3);
 // Winter Garden · Zinc Roof: the main roof's west slope carries on over the west arm on one unbroken line from its eave
 // (x -6.55, 2.95 m), flattened to 10° there, in dark standing-seam zinc; the north arm takes the same pitch off the north
 // gable, the two meeting at a hip over the corner, so one eave line runs all round at 2.51 m. At the house's own 37.6°
 // the eave would land at about 1 m. The glass stops at 2.39 m under a dark timber head board, and the roof is lined in oak.
 const catslideRoof=new T.Group();catslideRoof.name='renovation-catslide-roof';catslideRoof.visible=false;kitchenRoof.add(catslideRoof);
 {const g=groups.catslide,[WW,NZ]=runs[0][0],EX=runs[0][1][0],SZ=runs[1][1][1],SE=runs[2][1][0],GZ=runs[3][1][1];
  const k=Math.tan(10*Math.PI/180),O=.3,X0=WW-O,Z0=NZ-O,ME=-6.55,EAVE=2.95,eo=EAVE-(ME-X0)*k,fw=(x:number)=>eo+(x-X0)*k,fn=(z:number)=>eo+(z-Z0)*k;
  const yW=fw(WW),head=yW-.13,zS=SZ+O,xE=EX+O,hipZ=ME-X0+Z0,zinc=material('#9a9e9a','#3f4548',.45);
  // A roof plane over a plan polygon, lifted to height f, t thick.
  const plane=(polygon:number[][],f:(x:number,z:number)=>number,t:number,mat:T.Material,drop=0)=>{const tri=T.ShapeUtils.triangulateShape(polygon.map(([x,z])=>new T.Vector2(x,z)),[]),P:T.Vector3[]=[];
   const top=(i:number)=>V(polygon[i][0],f(polygon[i][0],polygon[i][1])-drop,polygon[i][1]),bottom=(i:number)=>top(i).setY(top(i).y-t);
   for(const [a,b,c] of tri){const up=new T.Vector3().crossVectors(top(b).sub(top(a)),top(c).sub(top(a))).y>0,[q,r]=up?[b,c]:[c,b];P.push(top(a),top(q),top(r),bottom(a),bottom(r),bottom(q));}
   polygon.forEach((_,i)=>{const j=(i+1)%polygon.length;P.push(top(i),bottom(i),bottom(j),top(i),bottom(j),top(j));});
   const geometry=new T.BufferGeometry().setFromPoints(P);geometry.computeVertexNormals();const o=new T.Mesh(geometry,mat);o.castShadow=o.receiveShadow=true;catslideRoof.add(o);return o;};
  // A vertical infill along a→b, its outline in (distance along, height).
  const infill=(a:number[],b:number[],outline:number[][],mat:T.Material)=>{const geometry=new T.ExtrudeGeometry(new T.Shape(outline.map(([u,y])=>new T.Vector2(u,y))),{depth:.1,bevelEnabled:false});geometry.translate(0,0,-.05);const o=new T.Mesh(geometry,mat);o.position.set(a[0],0,a[1]);o.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
  const west=[[X0,Z0],[ME,hipZ],[ME,zS],[X0,zS]],north=[[X0,Z0],[xE,Z0],[xE,GZ],[ME,GZ],[ME,hipZ]];
  plane(west,x=>fw(x),.14,zinc).name='catslide-zinc';plane(north,(_,z)=>fn(z),.14,zinc).name='catslide-zinc';
  plane(west,x=>fw(x),.02,m.oak,.17).name='catslide-lining';plane(north,(_,z)=>fn(z),.02,m.oak,.17).name='catslide-lining';
  // Standing seams every half metre, the hip capped, and a capping where the zinc meets the main roof's slate.
  for(let z=Z0+.25;z<zS;z+=.5){const x1=z<hipZ?z-Z0+X0:ME;member(catslideRoof,V(X0,fw(X0)+.02,z),V(x1,fw(x1)+.02,z),.025,.04,zinc);}
  for(let x=X0+.25;x<xE;x+=.5){const z1=x<ME?x-X0+Z0:GZ;member(catslideRoof,V(x,fn(Z0)+.02,Z0),V(x,fn(z1)+.02,z1),.025,.04,zinc);}
  member(catslideRoof,V(X0,eo+.03,Z0),V(ME,EAVE+.03,hipZ),.1,.06,zinc);member(catslideRoof,V(ME,EAVE+.03,hipZ),V(ME,EAVE+.03,zS),.24,.06,zinc);
  // A dark timber fascia along the eave and the verges.
  const fascia=(p0:T.Vector3,p1:T.Vector3)=>member(catslideRoof,p0,p1,.04,.22,timber);
  fascia(V(X0,eo-.1,Z0),V(X0,eo-.1,zS));fascia(V(X0,eo-.1,Z0),V(xE,eo-.1,Z0));fascia(V(X0,eo-.1,zS),V(ME,EAVE-.1,zS));fascia(V(xE,eo-.1,Z0),V(xE,fn(GZ)-.1,GZ));
  // One pane to each face, under a dark timber head board.
  for(const [a,b] of runs){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),bay=place(g,a[0],a[1],-Math.atan2(b[1]-a[1],b[0]-a[0]),FLOOR);
   box(bay,len/2,0,0,len-.01,head-FLOOR,.026,clear).name='winter-garden-pane';box(bay,len/2,head-FLOOR,0,len+.12,.2,.16,timber);}
  // Above the glass, the ends of the two arms are clad in the house's dark boarding up to the roof.
  const southRoof=(x:number)=>x<ME?fw(x):EAVE+(x-ME)*5.05/6.55;
  infill([WW,SZ],[SE,SZ],[[0,head],[SE-WW,head],[SE-WW,southRoof(SE)-.14],[ME-WW,EAVE-.14],[0,yW-.14]],skin).name='catslide-cladding';
  infill([EX,NZ],[EX,GZ],[[0,head],[GZ-NZ,head],[GZ-NZ,fn(GZ)-.14],[0,yW-.14]],skin).name='catslide-cladding';}
 // The island is 2.08 m, not the layout's 2.78 m, and has no stools at its end: the way between its end and the retained
 // pier stays 0.85 m wide. It takes the cabinets' sage.
 // The dining set (table and its chairs) sits centred in the glazed west arm, between its glass and the west wall.
 const objects=kitchenLayout.layouts[0].objects,diningSet=objects.filter(o=>o.kind==='table'||o.kind==='chair'&&o.x<300);
 const middle=(lo:number[],hi:number[])=>(Math.min(...lo)+Math.max(...hi))/2,K_PX=(x:number,z:number)=>[334+(x/PLAN_SCALE+1012-807)/.53,275+(z/PLAN_SCALE+529.5-182)/.53];
 const armMiddle=K_PX((WG_WEST+HOUSE_WEST)/2,(WG_NORTH+WG_SOUTH)/2);
 const shift=[armMiddle[0]-middle(diningSet.map(o=>o.x),diningSet.map(o=>o.x+o.w)),armMiddle[1]-middle(diningSet.map(o=>o.y),diningSet.map(o=>o.y+o.d))];
 for(const item of objects){
  if(item.kind==='chair'&&item.x>300&&item.y>600)continue;
  // The two breakfast stools stand where the approved plan keeps the north wall: only the Large Panes version opens it.
  const breakfast=item.kind==='chair'&&item.x>300&&item.y<333;
  const o=item.kind==='island'?{...item,d:142}:diningSet.includes(item)?{...item,x:item.x+shift[0],y:item.y+shift[1]}:item;
  const [x,z]=kitchenPoint(o.x+o.w/2,o.y+o.d/2),g=place(breakfast?groups.wideGlass:kitchen,x,z,0,FLOOR),w=o.w*K,d=o.d*K;g.name='garden-kitchen-'+o.kind.replaceAll(' ','-');
  if(o.kind==='table'){table(g,w,d);continue;}
  if(o.kind==='chair'){const stool=item.x>300;chair(g,0,0,stool?(item.y<333?Math.PI:0):item.x<155?-Math.PI/2:item.x>225?Math.PI/2:item.y<320?Math.PI:0,stool);continue;}
  const h=o.kind==='pantry'?2.25:.9;box(g,0,0,0,w,h,d,o.kind==='pantry'?m.oak:o.kind==='cooker'||o.kind==='second oven'?m.metal:m.sage);
  if(o.kind==='pantry'){for(let i=1;i<3;i++)box(g,-w/2-.009,1.15,(i/3-.5)*d,.02,.38,.02,m.metal);continue;}
  box(g,0,h,0,w+.045,.065,d+.055,m.stone);
  // Quiet, irregular mineral lines in the stone; these are illustrative, not a photo finish.
  for(let i=0;i<3;i++){const pts=[new T.Vector3(-w*.48,.968,d*(i/3-.35)),new T.Vector3(-w*.1,.968,d*(i/3-.25)),new T.Vector3(w*.48,.968,d*(i/3-.32))];const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#b7ad99',transparent:true,opacity:.45}));g.add(line);}
  if(o.kind==='cooker'||o.kind==='second oven'){const eastWall=o.kind==='cooker';const oven=place(g,eastWall?-w/2-.014:0,eastWall?0:d/2+.014,eastWall?Math.PI/2:0,0);box(oven,0,.2,0,eastWall?d*.82:w*.83,.46,.025,m.metal);box(oven,0,.23,.017,eastWall?d*.7:w*.7,.33,.009,clear);box(oven,0,.66,.038,eastWall?d*.6:w*.65,.028,.035,m.oak);if(eastWall){for(const dx of [-w*.23,w*.23])for(const dz of [-d*.29,0,d*.29]){const disc=new T.Mesh(cyl,m.metal);disc.position.set(dx,.974,dz);disc.scale.set(.085,.015,.085);g.add(disc);}}}
  if(o.kind==='island'){box(g,0,.968,-d*.22,w*.62,.018,.46,m.metal,true);box(g,0,.98,-d*.22,w*.52,.014,.36,m.white,true);box(g,w*.27,.99,-d*.22,.025,.28,.025,m.metal);box(g,w*.15,1.25,-d*.22,w*.26,.025,.025,m.metal);}
 }
 // Along the south wall, either side of the walk-in pantry's door (plan): a tall-unit run and an integrated fridge in the
 // cabinets' sage, the fridge with a freezer drawer below and long bar handles.
 {const run=place(kitchen,...p(917,450),0,FLOOR),fridge=place(kitchen,...p(841,450),0,FLOOR);fridge.name='garden-kitchen-fridge';
  box(run,0,0,0,1.8,2.2,.6,m.sage);for(const x of [-.6,0,.6]){box(run,x,.04,-.307,.58,2.12,.015,m.sage);box(run,x+.22,.9,-.33,.018,.5,.025,m.metal);}
  box(fridge,0,0,0,.55,2.2,.6,m.sage);for(const [y,h] of [[.04,.72],[.8,1.36]])box(fridge,0,y,-.307,.53,h,.015,m.sage);box(fridge,.2,.36,-.33,.018,.34,.025,m.metal);box(fridge,.2,.86,-.33,.018,.5,.025,m.metal);}
 // Existing terrace geometry is extended out into the east lawn.
 const terrace=groups.terrace;poly(terrace,[[6,0],[11.2,0],[11.2,10.45],[6,10.45]],.06,.11,m.stone);
 box(terrace,11.38,.015,5.2,.38,.07,9.6,m.stone);dining(terrace,8.7,5.5,3.3,1.08,Math.PI/2);
 const umbrella=place(terrace,10.5,2.3,0,.17);box(umbrella,0,0,0,.055,2.55,.055,m.metal);const shade=new T.Mesh(new T.ConeGeometry(1.7,.35,8),m.linen);shade.position.y=2.55;umbrella.add(shade);planter(terrace,10.65,.55);planter(terrace,10.65,9.9);
 // Selected courtyard: long table stays in the north bay; lounge stays by the west fireplace.
 // On the loggia paving, 0.14 m below the link floor.
 const courtyard=groups.courtyard;courtyard.position.y=-.14;dining(courtyard,...p(624,728),3.5,1.04);
 const counter=place(courtyard,...p(620,687));box(counter,0,0,0,4.5,.86,.6,m.oak);box(counter,0,.86,0,4.56,.065,.65,m.stone);for(let x=-2;x<2.2;x+=.65)box(counter,x,.09,-.308,.012,.69,.013,m.metal);
 const lounge=place(courtyard,...p(416,891),-.093);box(lounge,0,.01,0,1.6,.015,2.8,m.linen);
 const sofa=(x:number,z:number,angle:number,w=2.1)=>{const g=place(lounge,x,z,angle,0);box(g,0,.06,0,w,.27,.81,m.oak,true);box(g,0,.33,0,w-.08,.16,.75,m.linen,true);box(g,0,.48,.33,w,.35,.15,m.linen,true);for(const dx of [-w/2+.07,w/2-.07])box(g,dx,.3,0,.11,.25,.86,m.oak,true);for(const dx of [-w*.3,w*.3])box(g,dx,.55,.2,.3,.3,.15,m.clay,true);};
 sofa(-.53,.18,-Math.PI/2);sofa(.33,1.85,0,1);const coffee=place(lounge,.35,.15,0,0);box(coffee,0,.25,0,.67,.09,1.2,m.stone,true);box(coffee,0,.02,0,.43,.23,.85,m.oak);planter(courtyard,...p(746,697));
 // Layout Updates: the dining alcove (4.5 × 3.8 m between the hall wall and the east façade) becomes a library: a book
 // wall to the north, a desk against the hall wall, and a lounge chair with its ottoman at the east window under an arc
 // lamp. Plan points.
 const nook=groups.nook,ink=material('#3e4a59'),ochre=material('#c39a53'),rust=material('#9d5b41');
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
 // The desk against the hall wall, facing it, with its lamp, laptop and a few books; the pouf and rug in the middle.
 {const desk=place(nook,...p(1067.5,581),Math.PI);desk.name='nook-desk';box(desk,0,.72,0,.75,.04,1.7,m.oak);for(const x of [-.32,.32])for(const z of [-.8,.8])box(desk,x,0,z,.035,.72,.035,m.metal);
  solid(desk,cyl,m.metal,.24,.77,-.6,.08,.02,.08);box(desk,.24,.76,-.6,.018,.4,.018,m.metal);box(desk,.16,1.12,-.6,.2,.04,.07,m.metal);
  box(desk,-.08,.76,.05,.24,.015,.33,m.metal);box(desk,.05,.775,.05,.012,.22,.33,ink);box(desk,.2,.76,.55,.22,.06,.3,rust);box(desk,.2,.82,.55,.2,.04,.28,m.sage);
  chair(desk,-.72,0,-Math.PI/2).name='nook-desk-chair';
 }
 solid(place(nook,...p(1125,583)),cyl,rust,0,.2,0,.3,.4,.3);box(place(nook,...p(1106,591)),0,0,0,2.2,.012,2.4,m.clay);
 // Where the desk stood, a lounge chair and ottoman of the Eames kind face into the room, under the arc lamp.
 {const walnut=material('#8a6a4f','#5e4130',.5),leather=material('#3b3532','#26201d',.42),{chair:lounge,ottoman}=loungeChair({walnut,leather,metal:m.metal});
  const seat=place(nook,...p(1194.3,596),Math.PI/2);seat.name='nook-lounge-chair';seat.add(lounge);
  const rest=place(nook,...p(1164.6,596),Math.PI/2);rest.name='nook-ottoman';rest.add(ottoman);
  const lamp=place(nook,...p(1203,565.7));solid(lamp,cyl,m.metal,0,.01,0,.14,.02,.14);box(lamp,0,0,0,.028,1.75,.028,m.metal);box(lamp,0,1.72,.36,.022,.022,.72,m.metal);solid(lamp,cyl,m.linen,0,1.6,.72,.18,.22,.18);}
 // A leafy plant in the corner: broad leaves spiralling up out of a stone pot.
 {const plant=place(nook,...p(1203,552)),leaf=new T.IcosahedronGeometry(1,1);solid(plant,cyl,m.stone,0,.21,0,.19,.42,.19);
  for(let i=0;i<11;i++){const a=i*2.4,r=.06+.012*i;const o=solid(plant,leaf,m.leaf,Math.cos(a)*r,.55+i*.06,Math.sin(a)*r,.07,.2,.15);o.rotation.set(0,-a,.55);}}
 groups.front.add(buildFrontWall(material,true));
 // The front garage stands on the site; its roof goes with the roofs, so the ground-floor cutaway looks into it.
 const garage=buildFrontGarage(material);groups.garage.add(garage.group);roofs.add(garage.roof);garage.roof.visible=false;
 const solarRoof=buildSolar(roofs,groups.solar);
 const cut=[kitchen,groups.wideGlass].flatMap(g=>{const found:T.Object3D[]=[];g.traverse(o=>{if(o.name==='kitchen-retained-pier'||o.name==='kitchen-lintel')found.push(o);});return found;});
 const set=(state:RenovationState,level:Level)=>{for(const id of Object.keys(groups) as RenovationId[])groups[id].visible=state[id];kitchenRoof.visible=state.kitchen;catslideRoof.visible=state.catslide;wideRoof.visible=state.wideGlass;solarRoof.visible=state.solar;
  for(const o of cut){if(o.name==='kitchen-lintel'){o.visible=level==='exterior';continue;}o.scale.y=level==='exterior'?WALL_TOP-FLOOR:1.01;o.position.y=FLOOR+o.scale.y/2;}};
 return {groups,kitchenRoof,catslideRoof,wideRoof,garageRoof:garage.roof,set};
}
