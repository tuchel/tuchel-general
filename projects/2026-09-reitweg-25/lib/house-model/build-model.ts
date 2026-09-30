import * as T from 'three';
import {roofSlopeWithOpenings,roofLining} from './roof-openings';
import {architecturalDetails} from './architectural-details';
import {roofTrim} from './realism-details';
import {garageCars} from './garage-cars';
import {guestStair} from './guest-stair';
import {buildGarden} from './garden';
import {buildEntranceGarden} from './entrance-garden';
import {buildPool,poolHole} from './pool';
import {boundaryHedge} from './landscape-context';
import {buildTrees,foliageMaterials,type TreeSpec} from './foliage';
import {buildFrontWall} from './front-wall';
import {buildFrontGarden,FRUIT_TREES,SHRUBS} from './front-garden';
import {furnishHouse} from './interiors';
import {roofSkylights} from './solar-layout';
import {buildRenovations} from './renovations';
import {renovationState,type RenovationId,type RenovationState} from './renovation-data';
import {planPoint as p,sitePoint as s,plotOutline,treePositions,guestRoofFrame,UPPER_PLAN_X_OFFSET,BASEMENT_PLAN_X_OFFSET,PLAN_SCALE,type Level,type Region} from './site-data';
import {basementStairWell,buildBasementStair,buildLightWells,BASEMENT_WINDOWS} from './site-openings';
import {passable} from './walk';

export function buildHouseModel(realistic=false,setting?:T.Object3D,foliageIn?:ReturnType<typeof foliageMaterials>){
 const root=new T.Group(),ground=new T.Group(),upper=new T.Group(),basement=new T.Group(),roofs=new T.Group(),site=new T.Group(),trees=new T.Group();
 root.add(site,trees,ground,upper,basement,roofs);
 ground.name='ground-floor';upper.name='upper-floor';basement.name='basement';
 const originals:Partial<Record<RenovationId,T.Object3D[]>>={};
 // Parts built with the house but shown only while a renovation is on (the opened east gable upstairs).
 const additions:Partial<Record<RenovationId,T.Object3D[]>>={};
 const capture=(id:RenovationId,parent:T.Group,build:()=>void)=>{const start=parent.children.length;build();const objects=parent.children.slice(start);const group=new T.Group();group.name='original-'+id;parent.add(group);for(const o of objects)group.add(o);(originals[id]??=[]).push(group);};
 upper.position.x=UPPER_PLAN_X_OFFSET;basement.position.x=BASEMENT_PLAN_X_OFFSET;
 const garden=buildGarden(realistic);site.add(garden.group);
 const pickables:T.Object3D[]=[];const materials:T.MeshStandardMaterial[]=[];const edges:T.LineSegments[]=[];const cutWalls:T.Mesh[]=[];
 const material=(model:string,timber=model,roughness=.8)=>{const m=new T.MeshStandardMaterial({color:model,roughness});m.userData={model,timber};materials.push(m);return m;};
 const m={garage:material('#a6a397','#493c31'),wall:material('#e4e0d5','#6e5946'),plaster:material('#f0eee6','#e9e4d9'),roof:material('#c3c4bc','#4d5453'),edge:material('#999d92','#3c443f'),floor:material('#dfd7c6','#d5bd96'),stone:material('#d6d3c9','#b1afa4'),paving:material('#e4e0d6','#cfccc0'),soil:material('#c9c6b7','#a5a78b'),lawn:material('#acb89a','#a0b18d'),leaf:material('#899975','#798f68'),trunk:material('#b9b09b','#95836b'),wood:material('#c5b79e','#ad8d62'),fabric:material('#ece8dc','#e7e0cc'),dark:material('#707770','#4a514b'),water:material('#a8c8c7','#76abae',.14),
  // Roof timber is pale spruce (IMG_1558); upper walls and ceilings have their own plaster so the section view can cut them.
  spruce:material('#dcc7a4','#d69a5c',.7),
  // Large polished stone tiles in the hall, kitchen, dining room and entrance (owner photos).
  tile:material('#d6d3c9','#b7b0a4',.32),upperPlaster:material('#f0eee6','#ebe6db'),blind:material('#b3aca2','#a39c92'),switch:material('#2a2a2a','#161616',.35)};
 // Spruce takes the honey-orange of the upstairs rafters in the owner's photos (IMG_1502).
 m.spruce.userData.finish='spruce';
 for(const [key,surface] of Object.entries({garage:'cladding',wall:'cladding',roof:'roof',floor:'oak',stone:'stone',paving:'stone',lawn:'lawn',leaf:'foliage',wood:'oak',tile:'stone',fabric:'linen',blind:'linen'}))m[key as keyof typeof m].userData.photo=surface;
 const glass=new T.MeshPhysicalMaterial({color:'#bdcfcd',transparent:true,opacity:.38,roughness:.14,metalness:.12,depthWrite:false,side:T.DoubleSide});
 const lineMat=new T.LineBasicMaterial({color:'#7f897e',transparent:true,opacity:.28});
 const boxGeo=new T.BoxGeometry(1,1,1);const sphereGeo=new T.IcosahedronGeometry(1,2);const cylinderGeo=new T.CylinderGeometry(1,1,1,9);
 const add=(geo:T.BufferGeometry,mat:T.Material,parent:T.Group,region?:Region)=>{const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);if(region){mesh.userData.region=region;pickables.push(mesh)}return mesh;};
 const box=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,region?:Region)=>{const mesh=add(boxGeo,mat,parent,region);mesh.position.set(x,y+h/2,z);mesh.scale.set(w,h,d);return mesh;};
 const segment=(parent:T.Group,a:number[],b:number[],width:number,mat:T.Material,region?:Region)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),len=start.distanceTo(end);const mesh=box(parent,0,0,0,width,len,width,mat,region);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(new T.Vector3(...a)).normalize());return mesh;};
 // The basement stair runs beneath the open stair up, rising north like it (both plans): the hall floor, and the lawn and
 // soil under the house, are open over its flight, all but the top step, where it is entered from the hall.
 const well=[906,478,946,607],wellPath=()=>new T.Path([[well[0],well[1]],[well[2],well[1]],[well[2],well[3]],[well[0],well[3]]].map(([x,z])=>{const a=p(x,z);return new T.Vector2(a[0],-a[1]);}));
 const poly=(points:[number,number][],height:number,y:number,mat:T.Material,parent:T.Group,region?:Region)=>{const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));if(mat===m.soil||mat===m.lawn)shape.holes.push(poolHole(),new T.Path(basementStairWell().map(([x,z])=>new T.Vector2(x,-z))),wellPath());const geo=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=add(geo,mat,parent,region);mesh.position.y=y;return mesh;};
 const outline=(mesh:T.Mesh)=>{const edge=new T.LineSegments(new T.EdgesGeometry(mesh.geometry,24),lineMat);mesh.add(edge);edges.push(edge);};
 const planBox=(parent:T.Group,x1:number,z1:number,x2:number,z2:number,h:number,y:number,mat:T.Material,region?:Region)=>{const a=p(x1,z1),b=p(x2,z2);return box(parent,(a[0]+b[0])/2,y,(a[1]+b[1])/2,b[0]-a[0],h,b[1]-a[1],mat,region)};
 const wall=(parent:T.Group,x1:number,z1:number,x2:number,z2:number,height=2.67,y=.12,mat:T.Material=m.plaster)=>{const a=p(x1,z1),b=p(x2,z2);const w=segment(parent,[a[0],y,a[1]],[b[0],y,b[1]],.18,mat);const len=Math.hypot(b[0]-a[0],b[1]-a[1]);w.scale.set(len,height,.18);w.rotation.set(0,-Math.atan2(b[1]-a[1],b[0]-a[0]),0);w.position.set((a[0]+b[0])/2,y+height/2,(a[1]+b[1])/2);w.userData.base=y;w.userData.height=height;cutWalls.push(w);return w;};
 const stairs=(parent:T.Group,x:number,z:number,w:number,depth:number,y=0,rise=2.9)=>{for(let i=0;i<16;i++)box(parent,x,y+i*rise/16,z+depth/2-i*depth/16,w,rise/16,depth/16,m.floor);segment(parent,[x+w/2,y+1,z+depth/2],[x+w/2,y+rise+1,z-depth/2],.035,m.dark);};
 // Open timber treads and slender steelwork, visible from the hall and gallery.
 const mainStair=(parent:T.Group)=>{
  const g=new T.Group();g.name='main-open-timber-stair';parent.add(g);
  const [x,z]=p(927,533.5),width=1.12,depth=151*12/434,rise=2.95,base=.12,count=16;
  for(let i=0;i<count;i++)box(g,x,base+(i+1)*rise/count-.055,z+depth/2-(i+.5)*depth/count,width,.055,depth/count+.035,m.wood);
  for(const side of [-1,1]){
   const sx=x+side*(width/2-.04);
   segment(g,[sx,base+.09,z+depth/2],[sx,base+rise-.06,z-depth/2],.075,m.dark);
   segment(g,[sx,base+1.04,z+depth/2],[sx,base+rise+.97,z-depth/2],.032,m.dark);
   // The west side runs along the wall: a wall handrail only; balusters on the open east side.
   if(side>0)for(let i=0;i<=count;i++)box(g,sx,base+i*rise/count,z+depth/2-i*depth/count,.022,1.01,.022,m.dark);
  }
  return g;
 };
 const galleryRail=(parent:T.Group,x1:number,z1:number,x2:number,z2:number)=>{
  const a=p(x1,z1),b=p(x2,z2),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  segment(parent,[a[0],4.08,a[1]],[b[0],4.08,b[1]],.035,m.dark);
  const count=Math.ceil(length/.15);for(let i=0;i<=count;i++)box(parent,a[0]+(b[0]-a[0])*i/count,3.07,a[1]+(b[1]-a[1])*i/count,.022,1.01,.022,m.dark);
 };
 const rectFloor=(parent:T.Group,x1:number,z1:number,x2:number,z2:number,y:number,mat=m.floor)=>planBox(parent,x1,z1,x2,z2,.15,y-.03,mat);
 // Lot is registered against the main-house footprint on the grounds overview.
 poly(plotOutline,.48,-.5,m.soil,site,'grounds');poly(plotOutline,.025,-.02,m.lawn,site,'grounds');
 const border=new T.LineLoop(new T.BufferGeometry().setFromPoints(plotOutline.map(([x,z])=>new T.Vector3(x,.02,z))),new T.LineBasicMaterial({color:'#8d9b80'}));site.add(border);
 const traceSite=(points:number[][],y:number,mat:T.Material,region?:Region)=>poly(points.map(([x,z])=>s(x,z)),.045,y,mat,site,region);
 // The cobbled vehicle apron is built with the entrance walk below.
 traceSite([[783,677],[994,677],[994,387],[963,387],[963,662],[783,662]],.045,m.paving);
 traceSite([[606,595],[784,595],[784,662],[638,662],[621,827],[582,823]],.055,m.paving,'courtyard');
 // Narrow cobbled walk, shallow threshold step and planted borders from owner photos.
 site.add(buildEntranceGarden(realistic));
 traceSite([[746,398],[782,398],[782,548],[746,548]],.055,m.paving,'kitchen');
 // Cobbled strip along the guest wing's west wall, from the entrance toward the well.
 traceSite([[455,719],[478,719],[478,803],[455,803]],.045,m.paving);
 // Grey timber decks outside the bedroom and the dining and sitting rooms (Terrasse 2 and 3 on the grounds plan).
 const deck=material('#aaa69c','#8c867b');deck.userData.photo='deck';
 planBox(site,1233,240,1301,345,.05,0,deck);capture('terrace',site,()=>planBox(site,1233,533,1301,877,.05,0,deck));
 // Basement light-well grates and the guest basement's external stair.
 site.add(buildLightWells(m.dark,m.edge,BASEMENT_PLAN_X_OFFSET),buildBasementStair(m.stone,m.dark,m.dark));
 capture('front',site,()=>site.add(buildFrontWall(material)));
 // Round granite well trough with a gooseneck tap, on a brick circle ringed by segmented raised timber beds (202CD83B, C9253C3B).
 {const [fx,fz]=s(340,765),well=new T.Group();well.position.set(fx,0,fz);well.name='granite-well-and-raised-beds';site.add(well);
  const brick=material('#c9a896','#9c6650');add(new T.CylinderGeometry(2.6,2.6,.04,48),brick,well).position.y=.02;
  add(new T.CylinderGeometry(.65,.6,.8,32),m.stone,well,'grounds').position.y=.4;add(new T.CylinderGeometry(.55,.55,.02,32),m.water,well).position.y=.74;
  segment(well,[.52,.78,0],[.52,1.22,0],.045,m.dark);segment(well,[.52,1.22,0],[.3,1.22,0],.04,m.dark);segment(well,[.3,1.22,0],[.27,1.1,0],.035,m.dark);
  const sector=(outer:number,inner:number,start:number,end:number,depth:number)=>{const shape=new T.Shape();shape.absarc(0,0,outer,start,end,false);shape.absarc(0,0,inner,end,start,true);const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10});geo.rotateX(-Math.PI/2);return geo;};
  for(let k=0;k<5;k++){const start=k*Math.PI*2/5+.2,end=start+Math.PI*2/5-.4;add(sector(2.6,1.9,start,end,.6),m.wood,well);add(sector(2.54,1.96,start+.02,end-.02,.02),m.soil,well).position.y=.6;}}
 // Photo-confirmed flush timber surround, recessed water and pale narrow rim.
 const pool=buildPool();site.add(pool);pool.traverse(o=>{if(o instanceof T.Mesh)pickables.push(o);});
 // Main ground floor, ~12 x 19.3 m.
 const around=(x1:number,z1:number,x2:number,z2:number,piece:(x1:number,z1:number,x2:number,z2:number)=>void)=>{
  const [hx1,hz1,hx2,hz2]=well;if(hx1<x1||hx2>x2||hz1<z1||hz2>z2){piece(x1,z1,x2,z2);return;}
  piece(x1,z1,x2,hz1);piece(x1,hz2,x2,z2);piece(x1,hz1,hx1,hz2);piece(hx2,hz1,x2,hz2);};
 around(795,182,1229,877,(x1,z1,x2,z2)=>rectFloor(ground,x1,z1,x2,z2,0));
 for(const [x1,z1,x2,z2] of [[795,182,970,464],[814,464,1050,669],[1037,388,1229,669]])around(x1,z1,x2,z2,(a,b,c,d)=>planBox(ground,a,b,c,d,.02,.122,m.tile));
 {const stairwell=new T.Group();stairwell.name='basement-stairwell';ground.add(stairwell);
  // The basement's own flight (drawn on the basement sheet, 20 px east), seen from the hall; a plastered shaft with the
  // foot of the stair below the floor, and a steel rail along the open hall side, clear of the entry at the top.
  const [fx,fz]=p(946,538);stairs(stairwell,fx+BASEMENT_PLAN_X_OFFSET,fz,1.1,3.8,-2.3,2.43);
  for(const [x1,z1,x2,z2] of [[902,463,906,645],[946,463,950,645],[902,463,950,467],[902,645,950,649]])planBox(stairwell,x1,z1,x2,z2,2.42,-2.45,m.plaster);
  planBox(stairwell,906,467,946,645,.15,-2.45,m.tile);
  const [,gz1]=p(0,492),[,gz2]=p(0,607),[gx]=p(948.5,0),rail=(y:number,h:number)=>box(stairwell,gx,y,(gz1+gz2)/2,.04,h,gz2-gz1,m.dark);
  rail(1.1,.045);rail(.2,.03);for(let z=gz1;z<=gz2+1e-6;z+=(gz2-gz1)/Math.round((gz2-gz1)/.12))box(stairwell,gx,.12,z,.022,1,.022,m.dark);}
 function facade(parent:T.Group,a:[number,number],b:[number,number],openings:{from:number;to:number;sill:number;head:number;kind?:'garage'|'sliding'|'passage'}[],region:Region){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
  // External walls are about 0.45 m thick on the plans: the cladding face stays 0.105 m outside the traced outline and the wall grows inward.
  const center=region==='guest'?p(230,870):region==='courtyard'?p(625,620):[0,0],side=(-dz)*(center[0]-(a[0]+b[0])/2)+dx*(center[1]-(a[1]+b[1])/2)>0?1:-1;
  const part=(lo:number,hi:number,y:number,h:number,mat:T.Material)=>{if(hi<=lo||h<=0)return;const x=a[0]+dx*(lo+hi)/2-dz*side*.12,z=a[1]+dz*(lo+hi)/2+dx*side*.12;const obj=box(parent,x,y,z,hi-lo,h,mat===glass?.028:mat===m.dark?.09:mat===m.wall||mat===m.garage?.45:.47,mat,region);obj.rotation.y=-Math.atan2(dz,dx);if(realistic&&mat===m.wall){const faces:T.Material[]=Array(6).fill(m.wall);faces[side>0?4:5]=m.plaster;(obj as T.Mesh).material=faces;}if(mat===m.wall||mat===m.garage){obj.userData.base=y;obj.userData.height=h;cutWalls.push(obj)}return obj;};
  // Floor-level openings are doors: their glazing, leaves and handles let the walker through; frames stay solid.
  let cursor=0;for(const o of openings){const door=o.sill<=.15&&o.kind!=='passage'&&o.kind!=='sliding',leaf=(obj:T.Object3D|undefined)=>{if(door&&obj)passable(obj);};part(cursor,o.from,.12,2.67,m.wall);part(o.from,o.to,.12,o.sill,m.wall);part(o.from,o.to,.12+o.head,2.67-o.head,m.wall);if(o.kind!=='sliding'&&o.kind!=='passage')leaf(part(o.from,o.to,.12+o.sill,o.head-o.sill,o.kind==='garage'?m.garage:glass));if(o.kind==='garage'){for(let t=o.from+.12;t<o.to;t+=.15)leaf(part(t,t+.014,.12,2.2,m.edge));}for(const t of [o.from,o.to])part(t-.035,t+.035,.12+o.sill,o.head-o.sill,m.dark);for(const y of [o.sill,o.head])part(o.from,o.to,.12+y,.045,m.dark);if(o.kind==='sliding'){const middle=(o.from+o.to)/2;const pane=part(middle,o.to,.12+o.sill,o.head-o.sill,glass);if(pane)pane.name='kitchen-fixed-glass';const moving=part(middle-.22,o.to-.22,.12+o.sill,o.head-o.sill,glass);if(moving){moving.position.x+=dz*.07;moving.position.z-=dx*.07;moving.name='kitchen-sliding-leaf';}for(const t of [middle-.22,o.to-.22])part(t-.026,t+.026,.12,2.3,m.dark);part(o.from,o.to,.125,.025,m.edge);part(middle-.18,middle-.14,.96,.28,m.dark);}if(!o.kind&&o.to-o.from>2)leaf(part((o.from+o.to)/2-.025,(o.from+o.to)/2+.025,.12+o.sill,o.head-o.sill,m.dark));if(realistic&&o.kind!=='garage'&&o.kind!=='passage'){for(const t of [o.from-.067,o.to+.067])part(t-.025,t+.025,.12+o.sill,o.head-o.sill,m.wood);part(o.from,o.to,.12+o.sill-.035,.035,m.stone);leaf(part(o.to-.13,o.to-.11,1.07,.16,m.edge));}cursor=o.to;}part(cursor,len,.12,2.67,m.wall);
 }
 const N=-9.61,S=9.61,W=-6,E=6;
 // Upper rooms have a plastered ceiling this far (vertically) below the roof slab: the insulated build-up.
 const CEILING=realistic?.28:0;
 // The east knee wall is 0.55 m high under a spruce sill, with the lowest roof windows just above it (owner photo of
 // the south-east room); it stands further out than the plan's line, which would make it 1.2 m high.
 const eastKnee=((8-.045-CEILING-3.07-.55)*6.55/5.36-UPPER_PLAN_X_OFFSET)/PLAN_SCALE+1012;
 capture('east',ground,()=>facade(ground,[E,N],[E,S],[{from:1.9,to:4.6,sill:.1,head:2.2},{from:5.8,to:8.15,sill:0,head:2.2},{from:10.3,to:11.15,sill:.45,head:2.2},{from:12,to:13,sill:0,head:2.2},{from:14.86,to:17.05,sill:.1,head:2.25}],'main'));
 const kitchenSouth=p(795,464)[1],kitchenEast=p(970,182)[0],westSplit=kitchenSouth-N,northSplit=kitchenEast-W;
 capture('kitchen',ground,()=>facade(ground,[W,N],[W,kitchenSouth],[{from:2.75,to:5.74,sill:0,head:2.3,kind:'sliding'}],'kitchen'));
 facade(ground,[W,kitchenSouth],[W,S],[{from:8.95-westSplit,to:9.95-westSplit,sill:.8,head:2.1},{from:11.86-westSplit,to:12.96-westSplit,sill:0,head:2.3,kind:'passage'},{from:14.86-westSplit,to:15.94-westSplit,sill:0,head:2.2}],'main');
 capture('kitchen',ground,()=>facade(ground,[W,N],[kitchenEast,N],[{from:1.8,to:3,sill:.7,head:2.15}],'kitchen'));
 facade(ground,[kitchenEast,N],[E,N],[{from:5.5-northSplit,to:6.7-northSplit,sill:0,head:2.2},{from:8.2-northSplit,to:9.4-northSplit,sill:.7,head:2.15}],'main');
 capture('east',ground,()=>facade(ground,[W,S],[E,S],[{from:1.6,to:4.2,sill:.9,head:2.2},{from:7.83,to:10.26,sill:.9,head:2.2}],'main'));
 for(const [a,b,c,d] of [[965,194,965,382],[964,386,1003,386],[1030,388,1043,388],[988,389,988,464],[814,464,850,464],[877,464,952,464],[980,464,1001,464],[1029,464,1043,464],[1043,388,1126,388],[1175,388,1218,388],[1050,388,1050,462],[1114,428,1114,462],[1050,462,1114,462],[1050,470,1050,613],[1050,524,1215,524],[1037,669,1078,669],[814,669,959,669],[893,464,893,609],[893,652,893,669],[829,507,893,507],[869,559,893,559],[869,559,869,598],[869,598,893,598],[829,598,833,598]])wall(ground,a,b,c,d);
 // The dining alcove opens into the sitting room between two piers, as drawn on the plan.
 wall(ground,1166,669,1215,669);
 // Door leaves: thin panels cut with the walls in floor views. Steel-framed glazed leaves follow the photographs.
 const panel=(x1:number,z1:number,x2:number,z2:number,y:number,h:number,t:number,mat:T.Material,door=true)=>{const o=wall(ground,x1,z1,x2,z2,h,y,mat);o.scale.z=t;return door?passable(o):o;};
 // Steel glazed leaves: six panes between slim bars, and a black lever on both faces of doors (owner photos).
 const glazedLeaf=(x1:number,z1:number,x2:number,z2:number,height=2.1,door=true)=>{const at=(t:number):[number,number]=>[x1+(x2-x1)*t,z1+(z2-z1)*t];panel(x1,z1,x2,z2,.14,height,.02,glass,door);for(const [a,b] of [[0,.07],[.93,1]])panel(...at(a),...at(b),.14,height,.05,m.dark,door);for(const [y,h] of [[.14,.14],[.14+height-.06,.06],...[1,2,3,4,5].map(k=>[.28+k*(height-.34)/6-.015,.03])])panel(x1,z1,x2,z2,y,h,.05,m.dark,door);
  if(door){const [ax,az]=p(...at(.86)),[bx,bz]=p(x2,z2),[cx,cz]=p(x1,z1),len=Math.hypot(bx-cx,bz-cz),nx=-(bz-cz)/len,nz=(bx-cx)/len;for(const d of [-1,1]){const lever=passable(box(ground,ax+nx*d*.045,1.04,az+nz*d*.045,.13,.022,.022,m.switch));lever.rotation.y=-Math.atan2(bz-cz,bx-cx);}}};
 // Kitchen to hall: black steel glazed door, open against the Flur wall (CA9A8382).
 glazedLeaf(978,464,978,437);panel(1001,464,1001,437,.14,2.08,.045,m.wood);
 // Bedroom to bath: glazed steel double doors, both leaves open into the bath (IMG_1451).
 glazedLeaf(1128,391,1128,414);glazedLeaf(1174,391,1174,414);
 // Hall to sitting room: steel-framed glazed double doors between fixed side panels (IMG_1461).
 {const screen=[[959,669,978,669],[978,669,998,669],[998,669,1018,669],[1018,669,1037,669]];screen.forEach(([x1,z1,x2,z2],i)=>glazedLeaf(x1,z1,x2,z2,2.3,i===1||i===2));panel(959,669,1037,669,2.44,.35,.18,m.plaster,false);}
 const at=(x:number,z:number)=>p(x,z);let q:[number,number];
 mainStair(ground);
 // Hall WC: the south doorway opens from the Diele; the east partition ends before the hall passage.
 const bathroomDoor=wall(ground,833,598,833,566,2.1,.14,m.wood);bathroomDoor.name='hall-wc-open-door';
 q=at(1010,877);box(ground,q[0],.1,q[1],1.65,2.9,.8,m.plaster);box(ground,q[0],.15,q[1]-.44,1.05,1.1,.1,m.dark);
 // Entrance link and the angled garage / guest wing traced in source coordinates.
 const guestOutline=[[116,535],[475,573],[461,668],[367,671],[316,1228],[49,1208]].map(([x,z])=>p(x,z));poly(guestOutline,.16,0,m.floor,ground,'guest');
 poly([[116,535],[475,573],[461,668],[367,671],[350,790],[106,766]].map(([x,z])=>p(x,z)),.02,.165,m.plaster,ground);
 const linkOutline=[[459,574],[811,574],[811,672],[367,671],[370,647],[449,646]].map(([x,z])=>p(x,z));poly(linkOutline,.16,0,m.tile,ground,'courtyard');
 facade(ground,p(478,574),p(811,574),[{from:.05,to:1.45,sill:0,head:2.3},{from:1.55,to:8.7,sill:0,head:2.3}],'courtyard');
 facade(ground,p(464,667),p(811,667),[{from:6.9,to:8.9,sill:0,head:2.3}],'courtyard');
 facade(ground,p(93,766),p(49,1208),[{from:3.05,to:4.2,sill:0,head:2.2},{from:5.1,to:5.8,sill:1.4,head:2.15},{from:9,to:10.1,sill:.9,head:2.15}],'guest');
 facade(ground,p(367,671),p(316,1228),[{from:4.45,to:7.15,sill:0,head:2.3},{from:10.1,to:12.9,sill:0,head:2.3}],'guest');
 facade(ground,p(49,1208),p(316,1228),[],'guest');
 facade(ground,p(116,535),p(475,573),[{from:5,to:5.85,sill:1.05,head:2.1},{from:6.15,to:7,sill:1.05,head:2.1},{from:7.3,to:8.15,sill:1.05,head:2.1}],'guest');
 facade(ground,p(475,573),p(466,647),[{from:.15,to:1.2,sill:0,head:2.2,kind:'passage'}],'guest');
 // Garage south wall toward the loggia, cladding outside and plaster inside.
 facade(ground,p(367,671),p(464,667),[],'courtyard');
 q=at(472,580);const garageDoor=passable(box(ground,q[0]-.5,.16,q[1],1,1.05,.05,m.wood));garageDoor.name='garage-corridor-door';garageDoor.rotation.y=-.1;
 // Two opaque boarded garage doors on the west façade.
 facade(ground,p(116,535),p(93,766),[{from:.35,to:2.95,sill:0,head:2.2,kind:'garage'},{from:3.4,to:6,sill:0,head:2.2,kind:'garage'}],'guest');
 for(const a of [[106,766,350,790],[210,781,198,893],[92,929,193,940],[236,945,338,956],[80,987,183,997],[189,981,188,1000],[145,1000,143,1052],[80,1078,145,1082]])wall(ground,...a as [number,number,number,number]);
 // Guest WC door on its east wall, open against the WC's north wall.
 panel(188,949,160,951,.16,2.05,.045,m.wood).name='guest-wc-door';
 // The sauna's glass front opens onto the wellness room beside a black steel column (10064ED8).
 {q=at(183,1083);const column=add(cylinderGeo,m.dark,ground);column.scale.set(.07,2.67,.07);column.position.set(q[0],.12+1.335,q[1]);column.name='wellness-steel-column';column.userData.base=.12;column.userData.height=2.67;cutWalls.push(column);}
 ground.add(guestStair(m.wood,m.dark));
 // Loggia slabs, existing posts and fireplace; roof remains part of the connection.
 const terrace=[[393,676],[810,676],[810,846],[446,846],[408,1235],[318,1224]].map(([x,z])=>p(x,z));poly(terrace,.09,.045,m.paving,ground,'courtyard');
 for(const [x,z] of [[447,761],[574,761],[690,761],[435,873],[422,987],[413,1102]]){q=at(x,z);box(ground,q[0],.13,q[1],.14,2.67,.14,m.wall,'courtyard');}
 // Cream mantel-style fireplace at the guest and link corner (FDE39D63).
 q=at(380,772);box(ground,q[0],.13,q[1],.55,1.15,1.1,m.plaster,'courtyard');box(ground,q[0]+.04,1.28,q[1],.66,.07,1.28,m.plaster);box(ground,q[0]+.28,.33,q[1],.02,.55,.62,m.dark);
 // Upper-floor cutaway: layout under the roof, at an inferred 2.95 m floor level.
 // Open stairwell in the slab, rather than an opaque dark patch.
 const slabShape=new T.Shape([[900,183],[eastKnee+3,183],[eastKnee+3,875],[900,875]].map(([x,z])=>{const a=p(x,z);return new T.Vector2(a[0],-a[1])}));
 const voidPath=new T.Path([[958,458],[1000,458],[1000,466],[1096,466],[1096,668],[958,668]].map(([x,z])=>{const a=p(x,z);return new T.Vector2(a[0],-a[1])}));slabShape.holes.push(voidPath);const slabGeo=new T.ExtrudeGeometry(slabShape,{depth:.15,bevelEnabled:false});slabGeo.rotateX(-Math.PI/2);const slab=add(slabGeo,m.floor,upper);slab.position.y=2.92;slab.name='main-floor-with-atrium';
 const upperWalls=[[903,407,966,407],[1064,196,1064,279],[1000,282,1128,282],[1000,282,1000,345],[1000,379,1000,407],[1128,282,1128,345],[1128,379,1128,407],[1064,341,1064,407],[1000,407,1128,407],[903,668,1100,668],[1150,668,eastKnee,668],[1042,669,1042,824],[1042,860,1042,875],[925,674,925,721],[925,721,938,721],[974,674,974,721],[1164,409,eastKnee,409],[1164,409,1164,425],[1164,449,1164,487],[1164,487,eastKnee,487]];
 const partitions:{walls:number[][];floor:number;roof:'main'|'guest'}[]=[{walls:upperWalls,floor:3.07,roof:'main'}];
 // Full double-height Luftraum from the upper plan, with galleries on both sides.
 for(const rail of [[958,458,958,668],[1000,466,1096,466],[1096,466,1096,668]])galleryRail(upper,...rail as [number,number,number,number]);
 // The upper-floor view keeps the real ground floor beneath, seen through the atrium.
 // The guest gallery has a real open stair atrium along its west side.
 const guestUpper=[[222,544],[397,563],[332,1221],[163,1209],[188,934],[254,932],[267,802],[200,796]].map(([x,z])=>p(x,z));
 const guestSlabShape=new T.Shape(guestUpper.map(([x,z])=>new T.Vector2(x,-z)));
 const guestAtrium=[[212,796],[267,802],[254,932],[198,926]].map(([x,z])=>p(x,z));
 // The stair opening meets the west edge; a notch avoids floor crossing the turning flight.
 const guestSlabGeo=new T.ExtrudeGeometry(guestSlabShape,{depth:.15,bevelEnabled:false});guestSlabGeo.rotateX(-Math.PI/2);const guestSlab=add(guestSlabGeo,m.floor,upper,'guest');guestSlab.position.y=2.95;guestSlab.name='guest-floor-with-atrium';
 partitions.push({walls:[[207,780,292,789],[324,793,371,798],[193,934,267,942],[305,946,356,951],[186,1035,257,1043],[193,934,186,1035],[267,942,263,980],[260,1012,257,1043]],floor:3.07,roof:'guest'});
 // Named without "stair": the whole-house view leaves out upper-floor pieces named for stairs (duplicates of the ground ones).
 const guestLanding=poly([[246,797],[267,802],[263,839],[242,836]].map(([x,z])=>p(x,z)),.15,2.95,m.floor,upper);guestLanding.name='guest-upper-landing';
 for(const [a,b] of [[p(263,839),guestAtrium[2]],[guestAtrium[2],guestAtrium[3]]] as [number[],number[]][]){
  for(const y of [3.28,3.52,3.76,4.02])segment(upper,[a[0],y,a[1]],[b[0],y,b[1]],.025,m.dark);
  for(let t=0;t<=1.01;t+=.25)box(upper,a[0]+(b[0]-a[0])*t,3.1,a[1]+(b[1]-a[1])*t,.045,.96,.045,m.dark);
 }


 // Basement is displayed as its own cutaway; surrounding land hides it in exterior views.
 rectFloor(basement,835,189,1227,868,-2.45,m.stone);
  // Outer walls carry the light-well windows as a glazed band at the top of the cutaway.
 for(const [side,x1,z1,x2,z2] of [['north',841,195,1220,195],['south',841,861,1220,861],['west',841,195,841,861],['east',1220,195,1220,861]] as const){
  const along=z1===z2,windows=BASEMENT_WINDOWS.filter(w=>w.wall===side).sort((a,b)=>a.from-b.from);let from:number=along?x1:z1;
  const piece=(a:number,b:number,h:number,y:number,mat:T.Material=m.plaster)=>along?wall(basement,a,z1,b,z2,h,y,mat):wall(basement,x1,a,x2,b,h,y,mat);
  for(const w of windows){piece(from,w.from,1.3,-2.3);piece(w.from,w.to,1,-2.3);piece(w.from,w.to,.3,-1.3,glass).scale.z=.03;from=w.to;}
  piece(from,along?x2:z2,1.3,-2.3);
 }
 // Doors from the Diele into Abstell, HWR, wine room and hobby room; Abstell and HWR are separate rooms.
 for(const a of [[983,199,983,287],[1065,199,1065,322],[841,344,984,344],[984,344,984,456],[1065,352,1065,407],[1065,439,1065,497],[1065,524,1065,669],[1065,387,1220,387],[1065,462,1220,462],[841,460,995,460],[914,463,914,630],[841,669,1011,669],[1051,669,1220,669]])wall(basement,...a as [number,number,number,number],1.3,-2.3);
 q=at(946,538);stairs(basement,q[0],q[1],1.1,3.8,-2.3,2.43);
 const guestBasement=[[110,930],[353,955],[326,1226],[79,1205]];poly(guestBasement.map(([x,z])=>p(x,z)),.15,-2.45,m.stone,basement,'guest');
 guestBasement.forEach((a,i)=>{const b=guestBasement[(i+1)%4];wall(basement,a[0],a[1],b[0],b[1],1.3,-2.3);});
 {q=at(262,1074);const column=add(cylinderGeo,m.plaster,basement);column.scale.set(.15,1.3,.15);column.position.set(q[0],-2.3+.65,q[1]);column.userData.base=-2.3;column.userData.height=1.3;cutWalls.push(column);}
 furnishHouse(ground,upper,basement,material);
 ground.add(garageCars());
 const within=(x:number,z:number,points:number[][])=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,zi]=points[i],[xj,zj]=points[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;};
 const mainFootprint=[[W-.11,N-.11],[E+.11,N-.11],[E+.11,S+.11],[W-.11,S+.11]],indoors=(x:number,z:number)=>within(x,z,mainFootprint)||within(x,z,guestOutline);
 // Pitched roofs: the main pitch follows the upper plan's height lines; other heights are model assumptions.
 function pitchedRoof(cx:number,cz:number,width:number,length:number,eave:number,ridge:number,rotation=0,kind:'main'|'guest'|'link'='main',footprint?:[number,number][],above:((x:number,z:number)=>number)[]=[]){
  const g=new T.Group();g.name=kind+'-roof';g.position.set(cx,0,cz);g.rotation.y=rotation;roofs.add(g);const rise=ridge-eave,half=width/2,slope=Math.atan2(rise,half),span=Math.hypot(half,rise);
  const windows=kind==='link'?[]:roofSkylights(kind);
  for(const side of [-1,1]){const mesh=realistic?add(roofSlopeWithOpenings(half,length,eave,ridge,side,windows),m.roof,g,'main'):box(g,side*half/2,(eave+ridge)/2-.075,0,span,.15,length,m.roof,'main');if(!realistic)mesh.rotation.z=-side*slope;mesh.name=kind+'-roof-slope-'+side;outline(mesh);box(g,side*half,eave-.06,0,.14,.18,length,m.edge).name='roof-eave-fascia';}
  // A downpipe or gutter never stands inside a building: test eave points against the main and guest footprints.
  if(realistic)roofTrim(g,half,length,eave,(side,z)=>{const lx=side*(half-.1),x=cx+lx*Math.cos(rotation)+z*Math.sin(rotation),wz=cz-lx*Math.sin(rotation)+z*Math.cos(rotation);return !indoors(x,wz);});
  // Close the whole upper envelope on the actual wall planes. Roof eaves
  // overhang these walls; gable faces must never be placed at the roof ends.
  const outlinePoints=footprint??[[W,N],[E,N],[E,S],[W,S]];
  const local=outlinePoints.map(([x,z])=>{const dx=x-cx,dz=z-cz;return [dx*Math.cos(rotation)-dz*Math.sin(rotation),dx*Math.sin(rotation)+dz*Math.cos(rotation)];});
  // Wall tops follow the underside at the wall's outer face (0.12 m further out), so they stay inside the roof slab.
  const underside=(x:number)=>ridge-rise*(Math.abs(x)+.12)/half-.045;
  for(let index=0;index<local.length;index++){
   const a=local[index],b=local[(index+1)%local.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   const profile=[new T.Vector2(0,2.74),new T.Vector2(len,2.74),new T.Vector2(len,underside(b[0]))];
   const cross=-a[0]/dx;if(Number.isFinite(cross)&&cross>0&&cross<1)profile.push(new T.Vector2(cross*len,ridge-.045));
   profile.push(new T.Vector2(0,underside(a[0])));const shape=new T.Shape(profile);
   const windows=kind==='main'&&index===2?[[-2.35,3.15,1.05,2.1],[2.35,3.15,1.05,2.1]]:kind==='main'&&index===0?[[-2.27,3.1,1.1,2.1],[1,3.1,1.1,2.1]]:kind==='guest'&&index===0?[[0,3.15,2.3,1.8]]:kind==='guest'&&index===4?[[0,3.05,2.4,2.25]]:[];
   const face=new T.Group();face.position.set(a[0],0,a[1]);face.rotation.y=-Math.atan2(dz,dx);g.add(face);
   // The opened east façade glazes the master bedroom's gable (the main south gable, east of the chimney) instead of its window.
   const eastGable=kind==='main'&&index===2,holes:T.Path[]=[];
   for(const [x,y,w,h] of windows){const u=(x-a[0])/dx*len;const hole=new T.Path();hole.moveTo(u-w/2,y);hole.lineTo(u-w/2,y+h);hole.lineTo(u+w/2,y+h);hole.lineTo(u+w/2,y);hole.closePath();
    const start=face.children.length;box(face,u,y,0,w,h,.05,glass).name='gable-window';for(const offset of [-w/2,w/2])box(face,u+offset,y,0,.05,h,.25,m.dark);for(const dy of [0,h])box(face,u,y+dy,0,w,.05,.25,m.dark);
    if(eastGable&&x>0)(originals.east??=[]).push(...face.children.slice(start));else holes.push(hole);shape.holes.push(hole);}
   // Rooms under the roof are plastered: line the inner face so the cladding never shows between wall head and ceiling.
   // The room side is whichever side of the face's midpoint lies inside the footprint (the guest wing is not convex).
   const probe=[(a[0]+b[0])/2-dz/len*.3,(a[1]+b[1])/2+dx/len*.3];let inside=false;
   for(let i=0,j=local.length-1;i<local.length;j=i++){const [xi,zi]=local[i],[xj,zj]=local[j];if((zi>probe[1])!==(zj>probe[1])&&probe[0]<(xj-xi)*(probe[1]-zi)/(zj-zi)+xi)inside=!inside;}
   const inward=inside?1:-1;
   const skin=(outline:T.Shape,parent:T.Object3D)=>{
    const wallGeometry=new T.ExtrudeGeometry(outline,{depth:.21,bevelEnabled:false});wallGeometry.translate(0,0,-.105);const mesh=add(wallGeometry,m.wall,face,kind==='guest'?'guest':'main');mesh.name=kind+'-roof-wall-'+index;
    const lining=new T.ShapeGeometry(outline);
    if(inward<0){const idx=lining.index!;for(let t=0;t<idx.count;t+=3){const k=idx.getX(t+1);idx.setX(t+1,idx.getX(t+2));idx.setX(t+2,k);}const n=lining.attributes.normal;for(let v=0;v<n.count;v++)n.setZ(v,-1);}
    lining.translate(0,0,inward*.107);const inner=add(lining,m.plaster,face);inner.castShadow=false;inner.name=kind+'-roof-wall-lining-'+index;
    parent.attach(mesh);parent.attach(inner);return [mesh,inner];
   };
   const original=skin(shape,face);
   if(eastGable){
    (originals.east??=[]).push(...original);const opened=new T.Group();opened.name='east-gable-glazing';opened.visible=false;face.add(opened);(additions.east??=[]).push(opened);
    // From 15 cm beside the chimney to the knee wall, 5 cm above the floor to 3 m, and 12 cm under the sloped ceiling.
    const sill=3.15,cap=6.1,west=.5,top=(x:number)=>Math.min(cap,ridge-rise*x/half-.045-CEILING-.12),east=(ridge-.045-CEILING-3.07-.55)*half/rise-.1,knee=(ridge-.045-CEILING-.12-cap)*half/rise;
    const u=(x:number)=>(x-a[0])/dx*len,outline=[[west,sill],[east,sill],[east,top(east)],[knee,cap],[west,cap]].map(([x,y])=>new T.Vector2(u(x),y));
    const glazed=new T.Shape(profile);glazed.holes.push(...holes,new T.Path(outline));skin(glazed,opened);
    const pane=new T.ExtrudeGeometry(new T.Shape(outline),{depth:.03,bevelEnabled:false});pane.translate(0,0,-.015);add(pane,glass,opened).name='east-gable-glass';
    const bar=(x1:number,y1:number,x2:number,y2:number)=>segment(opened,[u(x1),y1,0],[u(x2),y2,0],.07,m.dark);
    outline.forEach((q,i)=>{const r=outline[(i+1)%outline.length];bar(a[0]+q.x*dx/len,q.y,a[0]+r.x*dx/len,r.y);});
    const bays=Math.round((east-west)/1.1);for(let i=1;i<bays;i++){const x=west+(east-west)*i/bays;bar(x,sill,x,top(x));}
   }
  }
  // The east roof has three groups and one high window; the photos rule out an even row.
  const skylights=kind==='link'?[]:roofSkylights(kind);
  for(const {side,z,fraction} of skylights){const x=side*half*fraction,y=ridge-rise*fraction;if(realistic){const frame=new T.Group();frame.position.set(x,y,z);frame.rotation.z=-side*slope;frame.name='open-roof-window';g.add(frame);passable(frame);for(const a of [-.655,.655])box(frame,a,-.03,0,.09,.12,.78,m.dark);for(const a of [-.345,.345])box(frame,0,-.03,a,1.4,.12,.09,m.dark);box(frame,0,.05,0,1.32,.028,.7,glass);}else{const win=box(g,x,y-.03,z,1.4,.11,.78,m.dark);win.rotation.z=-side*slope;const pane=box(g,x,y+.02,z,1.3,.04,.7,glass);pane.rotation.z=-side*slope;}}

  box(g,0,ridge-.01,0,.15,.12,length,m.edge).name='roof-ridge-cap';
  // Inside, a plastered ceiling hangs a build-up below the slab, with plastered reveals and blinds at the roof windows,
  // and pale spruce is exposed: rafters between the windows, a ridge beam, trusses over the main atrium placed clear of
  // the windows (IMG_1558, IMG_1579), and posts with braces in the guest wing (A58F5DA7).
  if(realistic&&kind!=='link'){
   // The main roof overhangs its gables; its ceiling and ridge beam stop at the gable walls' inner faces.
   const ceiling=(x:number)=>ridge-rise*Math.abs(x)/half-.045-CEILING,depth=CEILING*half/span,lined=footprint?length:S-N-.21;
   // Ceilings and reveals never stop a walk: the knee walls do, and a walk back in from a roof window passes under them.
   for(const side of [-1,1]){const lining=passable(add(roofLining(half,lined,eave,ridge,side,skylights,depth,half-.3),m.upperPlaster,g));lining.castShadow=false;lining.name=kind+'-ceiling-'+side;}
   for(const {side,z,fraction} of skylights){
    const reveal=new T.Group();reveal.position.set(side*half*fraction,ridge-rise*fraction,z);reveal.rotation.z=-side*slope;g.add(reveal);const y=-.15-depth;
    for(const d of [-1,1]){box(reveal,0,y,d*.415,1.47,depth,.03,m.upperPlaster).castShadow=false;box(reveal,d*.735,y,0,.03,depth,.86,m.upperPlaster).castShadow=false;}
    // The rolled blind sits up inside the reveal at the window head.
    box(reveal,-side*.63,y+.02,0,.12,.1,.84,m.blind).castShadow=false;
    passable(reveal);
   }
   box(g,0,ceiling(0)-.22,0,.16,.22,Math.min(length-.3,lined),m.spruce);
   // Windows sit at different heights, so one window's flanking rafter can pass another: it stops at that window's reveal.
   const rafter=(side:number,z:number)=>{
    // Reveals run square to the slope, so at the rafters' depth a window's edges sit nearer the ridge than on the roof.
    const reach=.76*half/span,shift=(.125+CEILING)*half*rise/(span*span),cuts=skylights.filter(w=>w.side===side&&Math.abs(w.z-z)<.5).map(w=>[half*w.fraction-shift-reach,half*w.fraction-shift+reach]).sort((a,b)=>a[0]-b[0]);
    let from=.12;for(const [a,b] of [...cuts,[half-.35,Infinity]]){const to=Math.min(a,half-.35);if(to>from+.2)segment(g,[side*from,ceiling(from)-.08,z],[side*to,ceiling(to)-.08,z],.15,m.spruce).name='roof-rafter';from=Math.max(from,b);}
   };
   const clear=(side:number,z:number)=>skylights.every(w=>w.side!==side||Math.abs(w.z-z)>.55);
   // Each roof window sits between two rafters (owner photos); the regular rafters keep clear of them.
   const flanks=skylights.flatMap(w=>[-1,1].map(d=>({side:w.side,z:w.z+d*.52}))).filter(f=>Math.abs(f.z)<length/2-.3);
   const free=(side:number,z:number)=>clear(side,z)&&flanks.every(f=>f.side!==side||Math.abs(f.z-z)>.45);
   const atrium=kind==='main'?[-2.2,4]:[0,0],trusses:number[]=[];
   for(let z=atrium[0];z<atrium[1];z+=.05)if(clear(-1,z)&&clear(1,z)&&(!trusses.length||z-trusses[trusses.length-1]>=1.3))trusses.push(z);
   for(let z=-length/2+.45;z<length/2-.3;z+=.9)for(const side of [-1,1])if(free(side,z)&&!(z>atrium[0]&&z<atrium[1]))rafter(side,z);
   for(const f of flanks)if(!(f.z>atrium[0]&&f.z<atrium[1])&&!trusses.some(t=>Math.abs(t-f.z)<.3))rafter(f.side,f.z);
   for(const z of trusses){
    const y=6.1,reach=(ridge-.045-CEILING-.1-y)*half/rise;
    box(g,0,y-.1,z,reach*2,.2,.14,m.spruce);
    for(const side of [-1,1]){rafter(side,z);segment(g,[side*reach*.3,y,z],[side*reach*.62,ceiling(reach*.62)-.12,z],.12,m.spruce);}
   }
   if(kind==='guest'){const posts=[[260,650],[247,786],[240,1040]].map(([x,z])=>{const [px,pz]=p(x,z),dx=px+UPPER_PLAN_X_OFFSET-cx,dz=pz-cz;return dx*Math.sin(rotation)+dz*Math.cos(rotation);});for(const z of posts){box(g,0,3.1,z,.14,ceiling(0)-.2-3.1,.14,m.spruce);for(const d of [-1,1])segment(g,[0,ceiling(0)-1.1,z],[0,ceiling(0)-.22,z+d*.9],.08,m.spruce);}}
  }
  for(const surface of above)keepAbove(g,surface);
  return (x:number,z:number)=>{const dx=x-cx,dz=z-cz;return ridge-rise*Math.abs(dx*Math.cos(rotation)-dz*Math.sin(rotation))/half-.045;};
 }
 // Cuts away every part of a group below a surface (world heights), splitting triangles where it crosses: a roof that
 // dies into another keeps only what shows above that roof's underside. Exact where the surface is flat over the group.
 function keepAbove(group:T.Object3D,surface:(x:number,z:number)=>number){
  group.updateMatrixWorld(true);const meshes:T.Mesh[]=[];group.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
  for(const mesh of meshes){
   const world=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();world.applyMatrix4(mesh.matrixWorld);
   const pos=world.attributes.position,height=(i:number)=>pos.getY(i)-surface(pos.getX(i),pos.getZ(i));
   let below=0;for(let i=0;i<pos.count;i++)if(height(i)<0)below++;
   if(!below){world.dispose();continue;}
   if(below===pos.count){mesh.removeFromParent();world.dispose();continue;}
   const names=Object.keys(world.attributes),out:Record<string,number[]>=Object.fromEntries(names.map(n=>[n,[]]));
   const vertex=(i:number,j:number,t:number)=>{for(const n of names){const a=world.attributes[n];for(let k=0;k<a.itemSize;k++)out[n].push(a.getComponent(i,k)*(1-t)+a.getComponent(j,k)*t);}};
   for(let t=0;t<pos.count;t+=3){
    const kept:[number,number,number][]=[];
    for(let e=0;e<3;e++){const i=t+e,j=t+(e+1)%3,hi=height(i),hj=height(j);if(hi>=0)kept.push([i,i,0]);if((hi>=0)!==(hj>=0))kept.push([i,j,hi/(hi-hj)]);}
    for(let k=1;k<kept.length-1;k++)for(const v of [kept[0],kept[k],kept[k+1]])vertex(...v);
   }
   const clipped=new T.BufferGeometry();for(const n of names)clipped.setAttribute(n,new T.Float32BufferAttribute(out[n],world.attributes[n].itemSize));
   clipped.applyMatrix4(mesh.matrixWorld.clone().invert());world.dispose();mesh.geometry=clipped;
   for(const child of mesh.children)if(child instanceof T.LineSegments)child.geometry=new T.EdgesGeometry(clipped,24);
  }
 }
 const mainUnder=pitchedRoof(0,0,13.1,20.2,2.64,8);
 const guest=guestRoofFrame;const guestUnder=pitchedRoof(guest.center[0],guest.center[1],guest.width+.18,guest.length+.18,2.94,6.75,guest.rotation,'guest',guestOutline);
 // Knee walls close the low edge of the upper rooms, as drawn on the upper plan.
 const knee=(under:(x:number,z:number)=>number,floor:number,x1:number,z1:number,x2:number,z2:number,sill=false)=>{const top=Math.max(.2,Math.min(...[[x1,z1],[x2,z2]].map(([x,z])=>{const [px,pz]=p(x,z);return under(px+UPPER_PLAN_X_OFFSET,pz);}))-CEILING-floor+.01);const w=wall(upper,x1,z1,x2,z2,top,floor);w.userData.alsoExterior=true;
  if(sill&&realistic){const [ax,az]=p(x1,z1),[bx,bz]=p(x2,z2);segment(upper,[ax,floor+top+.06,az],[bx,floor+top+.06,bz],.13,m.spruce);}};
 knee(mainUnder,3.07,904,185,904,873,true);knee(mainUnder,3.07,eastKnee,185,eastKnee,873,true);
 knee(guestUnder,3.1,222,546,200,794);knee(guestUnder,3.1,188,936,163,1207);knee(guestUnder,3.1,395,565,334,1219);
 // Upper partitions rise to the ceiling. Doorways (gaps of 0.55–1.45 m between wall runs on one line) get a head piece,
 // a pale spruce frame and a black round switch on each side (owner photos).
 const partition=(under:(x:number,z:number)=>number,floor:number,a:[number,number],b:[number,number],from=0)=>{
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,steps=Math.max(2,Math.ceil(len/.1));
  const outline=[new T.Vector2(0,from),new T.Vector2(len,from)];
  for(let i=steps;i>=0;i--){const u=len*i/steps;outline.push(new T.Vector2(u,Math.max(from+.05,under(a[0]+dx*u+UPPER_PLAN_X_OFFSET,a[1]+dz*u)-CEILING+.01-floor)));}
  const geometry=new T.ExtrudeGeometry(new T.Shape(outline),{depth:.18,bevelEnabled:false});geometry.translate(0,0,-.09);
  const mesh=add(geometry,m.upperPlaster,upper);mesh.position.set(a[0],floor,a[1]);mesh.rotation.y=-Math.atan2(dz,dx);mesh.name='upper-partition';return mesh;
 };
 const doorways=(walls:number[][])=>{const found:[[number,number],[number,number]][]=[];
  for(const w1 of walls)for(const w2 of walls){
   const d1=[w1[2]-w1[0],w1[3]-w1[1]],d2=[w2[2]-w2[0],w2[3]-w2[1]],g=[w2[0]-w1[2],w2[1]-w1[3]],l1=Math.hypot(d1[0],d1[1]),l2=Math.hypot(d2[0],d2[1]),gap=Math.hypot(g[0],g[1]);
   if(w1===w2||gap*PLAN_SCALE<.55||gap*PLAN_SCALE>1.45)continue;
   if(Math.abs(d1[0]*d2[1]-d1[1]*d2[0])/(l1*l2)>.05||Math.abs(g[0]*d1[1]-g[1]*d1[0])/(gap*l1)>.08||g[0]*d1[0]+g[1]*d1[1]<=0)continue;
   found.push([p(w1[2],w1[3]),p(w2[0],w2[1])]);
  }
  return found;};
 const doorFrame=(floor:number,a:[number,number],b:[number,number])=>{
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),frame=new T.Group();frame.position.set(a[0],floor,a[1]);frame.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);frame.name='upper-door-frame';upper.add(frame);
  for(const u of [0,len])box(frame,u,0,0,.08,2.05,.25,m.spruce);box(frame,len/2,2.05,0,len+.16,.08,.25,m.spruce);
  for(const [u,face] of [[-.22,1],[len+.22,-1]]){const plate=add(cylinderGeo,m.switch,frame);plate.scale.set(.04,.018,.04);plate.rotation.x=Math.PI/2;plate.position.set(u,1.05,face*.1);}
 };
 const unders={main:mainUnder,guest:guestUnder};
 for(const {walls,floor,roof} of partitions){
  for(const [x1,z1,x2,z2] of walls)partition(unders[roof],floor,p(x1,z1),p(x2,z2));
  for(const [a,b] of doorways(walls)){passable(partition(unders[roof],floor,a,b,2.05));if(realistic)doorFrame(floor,a,b);}
 }
 // The entrance roof runs east–west and covers the north courtyard loggia.
 // The entrance roof's ridge dies into the guest and main roof slopes; its ends sit just inside them.
 const connector=p(625,663),linkRidge=4.75,meets=(under:(x:number,z:number)=>number,from:number,to:number)=>{let a=from,b=to;for(let i=0;i<40;i++){const mid=(a+b)/2;if((under(mid,connector[1])+.045>linkRidge)===(under(a,connector[1])+.045>linkRidge))a=mid;else b=mid;}return (a+b)/2;};
 const linkWest=meets(guestUnder,connector[0]-12,connector[0])-.15,linkEast=meets(mainUnder,connector[0],0)+.15;
 pitchedRoof((linkWest+linkEast)/2,connector[1],5.6,linkEast-linkWest,2.85,linkRidge,Math.PI/2,'link',linkOutline,[mainUnder,guestUnder]);
 q=at(1010,885);box(roofs,q[0],.15,q[1],.8,9.15,.75,m.plaster,'main').name='chimney';
 // Fine cladding rhythm, deliberately restrained in the pale model finish.
 const slats=new T.Group();ground.add(slats);for(let z=N;z<S;z+=.23){for(const x of [W-.025,E+.025]){const bar=box(slats,x,2.4,z,.035,.38,.025,m.wood);bar.castShadow=false;if(x>0)(originals.east??=[]).push(bar);else if(z<kitchenSouth)(originals.kitchen??=[]).push(bar);}}
 // Low-poly crowns, open trunks and gentle variation, fixed to the source planting plan.
 // Detailed trees: instanced leaf-card archetypes. Pines and the Japanese maples follow the owner photos.
 const foliage=realistic?(foliageIn??foliageMaterials()):undefined;
 // The small fruit trees and shrubs around the well follow the owner photos (front-garden.ts); shrubs carry their own height.
 const gardenTrees:(readonly number[])[]=[...treePositions,...FRUIT_TREES,...SHRUBS],treeHeight=(t:readonly number[])=>t[3]??t[2]*1.35+1.7;
 if(foliage)trees.add(buildTrees(gardenTrees.map((t,i)=>{const [px,pz,r]=t,[x,z]=s(px,pz),seed=171+i*927;return {x,z,r,height:treeHeight(t),seed,kind:[171,1098,2025,4806,5733].includes(seed)?'pine':i%5===3&&i<treePositions.length?'maple':'broadleaf'} as TreeSpec;}),foliage,'garden-trees'));
 gardenTrees.forEach((t,i)=>{if(realistic)return;const [px,pz,r]=t,[x,z]=s(px,pz),height=treeHeight(t);const trunk=add(cylinderGeo,m.trunk,trees);trunk.scale.set(.1,height*.68,.1);trunk.position.set(x,height*.34,z);
  for(let k=0;k<5;k++){const angle=k*2.4+i,dx=Math.cos(angle)*r*.52,dz=Math.sin(angle)*r*.52;segment(trees,[x,height*.43,z],[x+dx,height-r*.2,z+dz],.06,m.trunk);}
  // Seeded, overlapping lobes give each crown an irregular, airy silhouette.
  let seed=171+i*927;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const foliage=new T.InstancedMesh(sphereGeo,m.leaf,65);foliage.castShadow=true;foliage.receiveShadow=true;const dummy=new T.Object3D();
  for(let k=0;k<65;k++){const angle=random()*Math.PI*2,vertical=random()*2-1,radial=Math.sqrt(1-vertical*vertical)*Math.sqrt(random());dummy.position.set(x+Math.cos(angle)*radial*r*.76,height-r*.35+vertical*r*.62,z+Math.sin(angle)*radial*r*.71);const size=r*(.16+random()*.18);dummy.scale.set(size*(.8+random()*.5),size*(.75+random()*.55),size);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();foliage.setMatrixAt(k,dummy.matrix);foliage.setColorAt(k,new T.Color().setRGB(.88+random()*.12,.9+random()*.1,.86+random()*.14));}trees.add(foliage);
 });

 trees.add(boundaryHedge(foliage));
 const frontGarden=buildFrontGarden(foliage);trees.add(frontGarden.planting);site.add(frontGarden.ground);
 const renovation=buildRenovations(ground,roofs,site,material);
 // The retained fireplace and a pier either side of it, between the two runs of south glazing (renovations.ts).
 facade(renovation.groups.east,[-.93,S],[.82,S],[],'main');
 ground.traverse(o=>{const id=o.userData.replacedBy as RenovationId|undefined;if(id)(originals[id]??=[]).push(o);});
 // Ground-floor ceilings over the whole footprint, open above the two stairs. They close the ground floor
 // under the upper floor in the whole-house and upper-floor views, and lift off for the ground-floor cutaway.
 const ceilings=new T.Group();ceilings.name='interior-ceilings';ground.add(ceilings);
 // The sauna's ceiling hides with the room ceilings in the ground-floor view.
 {const sauna=ground.getObjectByName('guest-sauna-ceiling');if(sauna){ground.updateMatrixWorld(true);ceilings.attach(sauna);}}
 const ceiling=(outline:number[][],opening:number[][])=>{const plan=(points:number[][])=>points.map(([x,z])=>{const a=p(x,z);return new T.Vector2(a[0],-a[1]);});const shape=new T.Shape(plan(outline));shape.holes.push(new T.Path(plan(opening)));const geo=new T.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=add(geo,m.plaster,ceilings);mesh.position.y=2.79;return mesh;};
 ceiling([[795,182],[1229,182],[1229,877],[795,877]],[[906,458],[948,458],[948,466],[1044,466],[1044,668],[906,668]]).name='main-ground-ceiling';
 ceiling([[116,535],[475,573],[461,668],[367,671],[316,1228],[49,1208]],[[96,782],[215,792],[202,932],[92,927]]).name='guest-ground-ceiling';
 const detail=realistic?architecturalDetails(ground,ceilings):undefined;
 // Details added after the renovations were collected, such as the family-room curtains, join them here.
 ground.getObjectByName('photo-led-interior-details')?.traverse(o=>{const id=o.userData.replacedBy as RenovationId|undefined;if(id)(originals[id]??=[]).push(o);});
 // Roofs-on views still contain the real upper-floor furnishings and gallery.
 // Omit the cutaway's duplicated lower hall and stairs; the ground model supplies those.
 if(realistic){upper.updateMatrixWorld(true);upper.traverse(o=>{if(!(o instanceof T.Mesh))return;let parent:T.Object3D|null=o;while(parent&&parent!==upper){if(parent.name.includes('stair'))return;parent=parent.parent;}if(new T.Box3().setFromObject(o).min.y>=2.85)o.userData.alsoExterior=true;});}
 if(setting){setting.name||='surrounding-setting';root.add(setting);}

 // The upper-floor view is a section: roofs, gables and roof windows stay, cut at the same height as the walls,
 // so the envelope rises from the ground-floor cladding in both wings.
 const sectionCut=new T.Plane(new T.Vector3(0,-1,0),4.12),roofMaterials=new Set<T.Material>();
 roofs.traverse(o=>{if(o instanceof T.Mesh)for(const mat of [o.material].flat())roofMaterials.add(mat);});roofMaterials.add(m.upperPlaster);roofMaterials.add(m.spruce);
 let active=renovationState(),currentLevel:Level='exterior';
 const applyRenovations=()=>{for(const id of Object.keys(originals) as RenovationId[])for(const o of originals[id]!)o.visible=!active[id];for(const id of Object.keys(additions) as RenovationId[])for(const o of additions[id]!)o.visible=active[id];renovation.set(active,currentLevel);garden.setRenovations(active);};
 const setRenovations=(next:RenovationState)=>{active={...next};applyRenovations();};
 // One consistent natural-material palette across the original house and all proposals.
 for(const mat of materials)mat.color.set(mat.userData.timber);garden.setFinish('timber');lineMat.opacity=.2;
 const setLevel=(level:Level)=>{currentLevel=level;if(setting)setting.visible=level==='exterior';ceilings.visible=level==='exterior'||level==='upper';slats.visible=level==='exterior'||level==='upper';site.visible=level!=='basement';trees.visible=level==='exterior';roofs.visible=level==='exterior'||level==='upper';for(const mat of roofMaterials){mat.clippingPlanes=level==='upper'?[sectionCut]:null;mat.clipShadows=true;}ground.visible=level!=='basement';upper.visible=level==='upper';basement.visible=level==='basement';for(const mesh of cutWalls){const h=mesh.userData.height as number,y=mesh.userData.base as number;const cap=mesh.parent===upper?4.12:mesh.parent===basement?-1:1.17;const full=level==='exterior'||(level==='upper'&&mesh.parent!==upper),shown=full?h:Math.max(0,Math.min(h,cap-y));mesh.visible=shown>0;mesh.scale.y=Math.max(.001,shown);mesh.position.y=y+shown/2;}applyRenovations();};
 const dispose=()=>{const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(a=>ms.add(a));}});gs.forEach(g=>g.dispose());ms.forEach(m=>{if(m instanceof T.MeshStandardMaterial)m.map?.dispose();m.dispose();});};
 // Every floor × renovation combination, for static batching: state = floor*combinations + renovation bits.
 // A renovation whose parts all sit in its own group, and whose originals sit in one group, toggles outside the states:
 // both groups stay shown while states are enumerated, and the batches parented to them follow their visibility.
 const renovationIds=Object.keys(renovationState()) as RenovationId[],grouped=new Set<RenovationId>(['nook']);
 const stateIds=renovationIds.filter(id=>!grouped.has(id)),combinations=1<<stateIds.length;
 const toggled=[...grouped].flatMap(id=>[renovation.groups[id],...(originals[id]??[])]);
 const stateOf=(level:Level,state:RenovationState)=>levels.indexOf(level)*combinations+stateIds.reduce((bits,id,i)=>bits|(state[id]?1<<i:0),0);
 const applyState=(index:number)=>{setLevel(levels[Math.floor(index/combinations)]);setRenovations({...renovationState(),...Object.fromEntries(stateIds.map((id,i)=>[id,!!(index&(1<<i))]))});for(const o of toggled)o.visible=true;};
 // Upper-floor rooms stay visible behind the roofs in the whole-house view.
 const rendered=(mesh:T.Object3D)=>{for(let o:T.Object3D|null=mesh;o;o=o.parent){if(o.visible)continue;if(o===upper&&currentLevel==='exterior'&&mesh.userData.alsoExterior)continue;return false;}return true;};
 return {root,site,trees,upper,ceilings,pickables,detail,setRenovations,setLevel,dispose,stateCount:levels.length*combinations,stateOf,applyState,rendered,toggled};
}
export const levels:Level[]=['exterior','ground','upper','basement'];
