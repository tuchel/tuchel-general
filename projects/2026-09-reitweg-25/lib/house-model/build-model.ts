import * as T from 'three';
import {roofSlopeWithOpenings} from './roof-openings';
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
import {furnishHouse} from './interiors';
import {roofSkylights} from './solar-layout';
import {buildRenovations} from './renovations';
import {renovationState,type RenovationId,type RenovationState} from './renovation-data';
import {planPoint as p,sitePoint as s,plotOutline,treePositions,guestRoofFrame,UPPER_PLAN_X_OFFSET,type Level,type Region} from './site-data';

export function buildHouseModel(realistic=false,setting?:T.Object3D,foliageIn?:ReturnType<typeof foliageMaterials>){
 const root=new T.Group(),ground=new T.Group(),upper=new T.Group(),basement=new T.Group(),roofs=new T.Group(),site=new T.Group(),trees=new T.Group();
 root.add(site,trees,ground,upper,basement,roofs);
 ground.name='ground-floor';upper.name='upper-floor';basement.name='basement';
 const originals:Partial<Record<RenovationId,T.Object3D[]>>={};
 const capture=(id:RenovationId,parent:T.Group,build:()=>void)=>{const start=parent.children.length;build();const objects=parent.children.slice(start);const group=new T.Group();group.name='original-'+id;parent.add(group);for(const o of objects)group.add(o);(originals[id]??=[]).push(group);};
 upper.position.x=UPPER_PLAN_X_OFFSET;
 const garden=buildGarden(realistic);site.add(garden.group);
 const pickables:T.Object3D[]=[];const materials:T.MeshStandardMaterial[]=[];const edges:T.LineSegments[]=[];const cutWalls:T.Mesh[]=[];
 const material=(model:string,timber=model,roughness=.8)=>{const m=new T.MeshStandardMaterial({color:model,roughness});m.userData={model,timber};materials.push(m);return m;};
 const m={garage:material('#a6a397','#493c31'),wall:material('#e4e0d5','#6e5946'),plaster:material('#f0eee6','#e9e4d9'),roof:material('#c3c4bc','#4d5453'),edge:material('#999d92','#3c443f'),floor:material('#dfd7c6','#c6aa80'),stone:material('#d6d3c9','#b1afa4'),paving:material('#e4e0d6','#cfccc0'),soil:material('#c9c6b7','#a5a78b'),lawn:material('#acb89a','#a0b18d'),leaf:material('#899975','#798f68'),trunk:material('#b9b09b','#95836b'),wood:material('#c5b79e','#ad8d62'),fabric:material('#ece8dc','#e7e0cc'),dark:material('#707770','#4a514b'),water:material('#a8c8c7','#76abae',.14)};
 for(const [key,surface] of Object.entries({garage:'cladding',wall:'cladding',roof:'roof',floor:'oak',stone:'stone',paving:'stone',lawn:'lawn',leaf:'foliage',wood:'oak',fabric:'linen'}))m[key as keyof typeof m].userData.photo=surface;
 const glass=new T.MeshPhysicalMaterial({color:'#bdcfcd',transparent:true,opacity:.38,roughness:.14,metalness:.12,depthWrite:false,side:T.DoubleSide});
 const lineMat=new T.LineBasicMaterial({color:'#7f897e',transparent:true,opacity:.28});
 const boxGeo=new T.BoxGeometry(1,1,1);const sphereGeo=new T.IcosahedronGeometry(1,2);const cylinderGeo=new T.CylinderGeometry(1,1,1,9);
 const add=(geo:T.BufferGeometry,mat:T.Material,parent:T.Group,region?:Region)=>{const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);if(region){mesh.userData.region=region;pickables.push(mesh)}return mesh;};
 const box=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,region?:Region)=>{const mesh=add(boxGeo,mat,parent,region);mesh.position.set(x,y+h/2,z);mesh.scale.set(w,h,d);return mesh;};
 const segment=(parent:T.Group,a:number[],b:number[],width:number,mat:T.Material,region?:Region)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),len=start.distanceTo(end);const mesh=box(parent,0,0,0,width,len,width,mat,region);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(new T.Vector3(...a)).normalize());return mesh;};
 const poly=(points:[number,number][],height:number,y:number,mat:T.Material,parent:T.Group,region?:Region)=>{const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));if(mat===m.soil||mat===m.lawn)shape.holes.push(poolHole());const geo=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=add(geo,mat,parent,region);mesh.position.y=y;return mesh;};
 const outline=(mesh:T.Mesh)=>{const edge=new T.LineSegments(new T.EdgesGeometry(mesh.geometry,24),lineMat);mesh.add(edge);edges.push(edge);};
 const planBox=(parent:T.Group,x1:number,z1:number,x2:number,z2:number,h:number,y:number,mat:T.Material,region?:Region)=>{const a=p(x1,z1),b=p(x2,z2);return box(parent,(a[0]+b[0])/2,y,(a[1]+b[1])/2,b[0]-a[0],h,b[1]-a[1],mat,region)};
 const wall=(parent:T.Group,x1:number,z1:number,x2:number,z2:number,height=2.67,y=.12,mat:T.Material=m.plaster)=>{const a=p(x1,z1),b=p(x2,z2);const w=segment(parent,[a[0],y,a[1]],[b[0],y,b[1]],.18,mat);const len=Math.hypot(b[0]-a[0],b[1]-a[1]);w.scale.set(len,height,.18);w.rotation.set(0,-Math.atan2(b[1]-a[1],b[0]-a[0]),0);w.position.set((a[0]+b[0])/2,y+height/2,(a[1]+b[1])/2);w.userData.base=y;w.userData.height=height;cutWalls.push(w);return w;};
 const stairs=(parent:T.Group,x:number,z:number,w:number,depth:number,y=0,rise=2.9)=>{for(let i=0;i<16;i++)box(parent,x,y+i*rise/16,z+depth/2-i*depth/16,w,rise/16,depth/16,m.floor);segment(parent,[x+w/2,y+1,z+depth/2],[x+w/2,y+rise+1,z-depth/2],.035,m.dark);};
 // Open timber treads and slender steelwork, visible from the hall and gallery.
 const mainStair=(parent:T.Group,xOffset=0)=>{
  const g=new T.Group();g.name='main-open-timber-stair';parent.add(g);
  const [x,z]=p(927+xOffset,533.5),width=1.12,depth=151*12/434,rise=2.95,base=.12,count=16;
  for(let i=0;i<count;i++)box(g,x,base+(i+1)*rise/count-.055,z+depth/2-(i+.5)*depth/count,width,.055,depth/count+.035,m.wood);
  for(const side of [-1,1]){
   const sx=x+side*(width/2-.04);
   segment(g,[sx,base+.09,z+depth/2],[sx,base+rise-.06,z-depth/2],.075,m.dark);
   segment(g,[sx,base+1.04,z+depth/2],[sx,base+rise+.97,z-depth/2],.032,m.dark);
   for(let i=0;i<=count;i++)box(g,sx,base+i*rise/count,z+depth/2-i*depth/count,.022,1.01,.022,m.dark);
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
 capture('front',site,()=>site.add(buildFrontWall(material)));
 const fountain=s(340,765);const basin=add(new T.CylinderGeometry(1.3,1.3,.25,36),m.stone,site);basin.position.set(fountain[0],.15,fountain[1]);const fwater=add(new T.CylinderGeometry(1.07,1.07,.035,36),m.water,site);fwater.position.set(fountain[0],.29,fountain[1]);box(site,fountain[0],.3,fountain[1],.22,.55,.22,m.stone);
 // Photo-confirmed flush timber surround, recessed water and pale narrow rim.
 const pool=buildPool();site.add(pool);pool.traverse(o=>{if(o instanceof T.Mesh)pickables.push(o);});
 // Main ground floor, ~12 x 19.3 m.
 rectFloor(ground,795,182,1229,877,0);
 for(const bounds of [[795,182,970,464],[814,464,1050,669],[1037,388,1229,669]])planBox(ground,...bounds as [number,number,number,number],.02,.122,m.stone);
 function facade(parent:T.Group,a:[number,number],b:[number,number],openings:{from:number;to:number;sill:number;head:number;kind?:'garage'|'sliding'|'passage'}[],region:Region){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
  const part=(lo:number,hi:number,y:number,h:number,mat:T.Material)=>{if(hi<=lo||h<=0)return;const x=a[0]+dx*(lo+hi)/2,z=a[1]+dz*(lo+hi)/2;const obj=box(parent,x,y,z,hi-lo,h,.21,mat,region);obj.rotation.y=-Math.atan2(dz,dx);if(realistic&&mat===m.wall){const center=region==='guest'?p(230,870):region==='courtyard'?p(625,620):[0,0];const interior=(-dz)*(center[0]-x)+dx*(center[1]-z);const faces:T.Material[]=Array(6).fill(m.wall);faces[interior>0?4:5]=m.plaster;(obj as T.Mesh).material=faces;}if(mat===glass)obj.scale.z=.028;if(mat===m.wall||mat===m.garage){obj.userData.base=y;obj.userData.height=h;cutWalls.push(obj)}return obj;};
  let cursor=0;for(const o of openings){part(cursor,o.from,.12,2.67,m.wall);part(o.from,o.to,.12,o.sill,m.wall);part(o.from,o.to,.12+o.head,2.67-o.head,m.wall);if(o.kind!=='sliding'&&o.kind!=='passage')part(o.from,o.to,.12+o.sill,o.head-o.sill,o.kind==='garage'?m.garage:glass);if(o.kind==='garage'){for(let t=o.from+.12;t<o.to;t+=.15)part(t,t+.014,.12,2.2,m.edge);}for(const t of [o.from,o.to])part(t-.035,t+.035,.12+o.sill,o.head-o.sill,m.dark);for(const y of [o.sill,o.head])part(o.from,o.to,.12+y,.045,m.dark);if(o.kind==='sliding'){const middle=(o.from+o.to)/2;const pane=part(middle,o.to,.12+o.sill,o.head-o.sill,glass);if(pane)pane.name='kitchen-fixed-glass';const moving=part(middle-.22,o.to-.22,.12+o.sill,o.head-o.sill,glass);if(moving){moving.position.x+=dz*.07;moving.position.z-=dx*.07;moving.name='kitchen-sliding-leaf';}for(const t of [middle-.22,o.to-.22])part(t-.026,t+.026,.12,2.3,m.dark);part(o.from,o.to,.125,.025,m.edge);part(middle-.18,middle-.14,.96,.28,m.dark);}if(!o.kind&&o.to-o.from>2)part((o.from+o.to)/2-.025,(o.from+o.to)/2+.025,.12+o.sill,o.head-o.sill,m.dark);if(realistic&&o.kind!=='garage'&&o.kind!=='passage'){for(const t of [o.from-.067,o.to+.067])part(t-.025,t+.025,.12+o.sill,o.head-o.sill,m.wood);part(o.from,o.to,.12+o.sill-.035,.035,m.stone);part(o.to-.13,o.to-.11,1.07,.16,m.edge);}cursor=o.to;}part(cursor,len,.12,2.67,m.wall);
 }
 const N=-9.61,S=9.61,W=-6,E=6;
 capture('east',ground,()=>facade(ground,[E,N],[E,S],[{from:1.9,to:4.6,sill:.1,head:2.2},{from:5.8,to:8.15,sill:1,head:2.2},{from:10.3,to:12.9,sill:.1,head:2.2},{from:14.6,to:18.4,sill:.1,head:2.25}],'main'));
 const kitchenSouth=p(795,464)[1],kitchenEast=p(970,182)[0],westSplit=kitchenSouth-N,northSplit=kitchenEast-W;
 capture('kitchen',ground,()=>facade(ground,[W,N],[W,kitchenSouth],[{from:2.5,to:6.4,sill:0,head:2.3,kind:'sliding'}],'kitchen'));
 facade(ground,[W,kitchenSouth],[W,S],[{from:8.95-westSplit,to:9.95-westSplit,sill:.8,head:2.1},{from:11.86-westSplit,to:12.96-westSplit,sill:0,head:2.3,kind:'passage'},{from:14.5-westSplit,to:16.5-westSplit,sill:0,head:2.3}],'main');
 capture('kitchen',ground,()=>facade(ground,[W,N],[kitchenEast,N],[{from:1.8,to:3,sill:.7,head:2.15}],'kitchen'));
 facade(ground,[kitchenEast,N],[E,N],[{from:5.5-northSplit,to:6.7-northSplit,sill:0,head:2.2},{from:8.2-northSplit,to:9.4-northSplit,sill:.7,head:2.15}],'main');
 capture('east',ground,()=>facade(ground,[W,S],[E,S],[{from:1.6,to:4.2,sill:.9,head:2.2},{from:7.2,to:10.1,sill:.9,head:2.2}],'main'));
 for(const [a,b,c,d] of [[970,194,970,382],[970,402,970,458],[814,464,850,464],[877,464,970,464],[1043,388,1126,388],[1050,388,1050,454],[1126,388,1126,454],[1050,454,1126,454],[1050,470,1050,613],[1050,524,1215,524],[1037,669,1066,669],[814,669,959,669],[893,464,893,609],[893,652,893,669],[829,507,893,507],[869,559,893,559],[869,559,869,598],[869,598,893,598],[829,598,833,598]])wall(ground,a,b,c,d);
 // The dining alcove opens into the sitting room between the retained pier and east return.
 wall(ground,1202,669,1215,669);
 const at=(x:number,z:number)=>p(x,z);let q:[number,number];
 mainStair(ground);
 // Hall WC: the south doorway opens from the Diele; the east partition ends before the hall passage.
 const bathroomDoor=wall(ground,833,598,833,566,2.1,.14,m.wood);bathroomDoor.name='hall-wc-open-door';
 q=at(1010,877);box(ground,q[0],.1,q[1],1.65,2.9,.8,m.plaster);box(ground,q[0],.15,q[1]-.44,1.05,1.1,.1,m.dark);
 // Entrance link and the angled garage / guest wing traced in source coordinates.
 const guestOutline=[[116,535],[475,573],[461,668],[367,671],[316,1228],[49,1208]].map(([x,z])=>p(x,z));poly(guestOutline,.16,0,m.floor,ground,'guest');
 poly([[116,535],[475,573],[461,668],[367,671],[350,790],[106,766]].map(([x,z])=>p(x,z)),.02,.165,m.plaster,ground);
 const linkOutline=[[459,574],[811,574],[811,672],[367,671],[370,647],[449,646]].map(([x,z])=>p(x,z));poly(linkOutline,.16,0,m.stone,ground,'courtyard');
 facade(ground,p(478,574),p(811,574),[{from:.05,to:1.45,sill:0,head:2.3},{from:1.55,to:8.7,sill:0,head:2.3}],'courtyard');
 facade(ground,p(464,667),p(811,667),[{from:6.9,to:8.9,sill:0,head:2.3}],'courtyard');
 facade(ground,p(93,766),p(49,1208),[{from:3.05,to:4.2,sill:0,head:2.2},{from:5.1,to:5.8,sill:1.4,head:2.15},{from:9,to:10.1,sill:.9,head:2.15}],'guest');
 facade(ground,p(367,671),p(316,1228),[{from:4.45,to:7.15,sill:0,head:2.3},{from:10.1,to:12.9,sill:0,head:2.3}],'guest');
 facade(ground,p(49,1208),p(316,1228),[],'guest');
 facade(ground,p(116,535),p(475,573),[{from:5,to:5.85,sill:1.05,head:2.1},{from:6.15,to:7,sill:1.05,head:2.1},{from:7.3,to:8.15,sill:1.05,head:2.1}],'guest');
 facade(ground,p(475,573),p(466,647),[{from:.15,to:1.2,sill:0,head:2.2,kind:'passage'}],'guest');
 q=at(472,580);const garageDoor=box(ground,q[0]-.5,.16,q[1],1,1.05,.05,m.wood);garageDoor.name='garage-corridor-door';garageDoor.rotation.y=-.1;
 // Two opaque boarded garage doors on the west façade.
 facade(ground,p(116,535),p(93,766),[{from:.35,to:2.95,sill:0,head:2.2,kind:'garage'},{from:3.4,to:6,sill:0,head:2.2,kind:'garage'}],'guest');
 for(const a of [[106,766,350,790],[210,781,198,893],[92,929,193,940],[236,945,338,956],[80,987,183,997],[183,997,166,1198]])wall(ground,...a as [number,number,number,number]);
 // Open timber door between the yoga room and wellness area.
 q=at(194,940);const yogaDoor=box(ground,q[0],.16,q[1]+.5,.07,2.12,1.04,m.wood);yogaDoor.name='yoga-wellness-door';yogaDoor.rotation.y=-.09;
 ground.add(guestStair(m.wood,m.dark));
 // Loggia slabs, existing posts and fireplace; roof remains part of the connection.
 const terrace=[[393,676],[810,676],[810,846],[446,846],[408,1235],[318,1224]].map(([x,z])=>p(x,z));poly(terrace,.09,.045,m.paving,ground,'courtyard');
 for(const [x,z] of [[447,761],[574,761],[690,761],[435,873],[422,987],[413,1102]]){q=at(x,z);box(ground,q[0],.13,q[1],.14,2.67,.14,m.wood,'courtyard');}
 q=at(393,771);box(ground,q[0],.13,q[1],.55,1.1,1.9,m.stone,'courtyard');box(ground,q[0]+.3,.4,q[1]-.4,.04,.6,.7,m.dark);
 // Upper-floor cutaway: layout under the roof, at an inferred 2.95 m floor level.
 // Open stairwell in the slab, rather than an opaque dark patch.
 const slabShape=new T.Shape([[900,183],[1227,183],[1227,875],[900,875]].map(([x,z])=>{const a=p(x,z);return new T.Vector2(a[0],-a[1])}));
 const voidPath=new T.Path([[958,458],[1000,458],[1000,466],[1096,466],[1096,668],[958,668]].map(([x,z])=>{const a=p(x,z);return new T.Vector2(a[0],-a[1])}));slabShape.holes.push(voidPath);const slabGeo=new T.ExtrudeGeometry(slabShape,{depth:.15,bevelEnabled:false});slabGeo.rotateX(-Math.PI/2);const slab=add(slabGeo,m.floor,upper);slab.position.y=2.92;slab.name='main-floor-with-atrium';
 const upperWalls=[[903,407,966,407],[1064,196,1064,279],[1000,282,1128,282],[1000,282,1000,345],[1000,379,1000,407],[1128,282,1128,345],[1128,379,1128,407],[1064,341,1064,407],[1000,407,1128,407],[903,668,1100,668],[1150,668,1222,668],[1042,669,1042,824],[1042,860,1042,875],[925,674,925,721],[925,721,938,721],[974,674,974,721],[1164,409,1218,409],[1164,409,1164,425],[1164,449,1164,487],[1164,487,1218,487],[1218,409,1218,487]];
 for(const a of upperWalls)wall(upper,...a as [number,number,number,number],1.25,3.07);
 // Full double-height Luftraum from the upper plan, with galleries on both sides.
 for(const rail of [[958,458,958,668],[1000,466,1096,466],[1096,466,1096,668]])galleryRail(upper,...rail as [number,number,number,number]);
 // Retain the lower hall through the void; registration shifts the upper plan 52 px east.
 rectFloor(upper,946,464,1100,669,0,m.stone);
 wall(upper,945,464,945,609,2.8,.12);
 wall(upper,1102,470,1102,613,2.8,.12);
 wall(upper,1022,402,1022,458,2.8,.12);
 mainStair(upper,52);
 // The guest gallery has a real open stair atrium along its west side.
 const guestUpper=[[222,544],[397,563],[332,1221],[163,1209],[188,934],[254,932],[267,802],[200,796]].map(([x,z])=>p(x,z));
 const guestSlabShape=new T.Shape(guestUpper.map(([x,z])=>new T.Vector2(x,-z)));
 const guestAtrium=[[212,796],[267,802],[254,932],[198,926]].map(([x,z])=>p(x,z));
 // The stair opening meets the west edge; a notch avoids floor crossing the turning flight.
 const guestSlabGeo=new T.ExtrudeGeometry(guestSlabShape,{depth:.15,bevelEnabled:false});guestSlabGeo.rotateX(-Math.PI/2);const guestSlab=add(guestSlabGeo,m.floor,upper,'guest');guestSlab.position.y=2.95;guestSlab.name='guest-floor-with-atrium';
 for(const a of [[207,780,292,789],[324,793,371,798],[193,934,267,942],[305,946,356,951],[186,1035,257,1043],[193,934,186,1035],[267,942,263,980],[260,1012,257,1043]])wall(upper,...a as [number,number,number,number],1.25,3.07);
 // A lower floor and staircase remain visible through the actual opening in the slab.
 poly([[116,535],[475,573],[461,668],[367,671],[338,956],[80,929]].map(([x,z])=>p(x+52,z)),.1,.035,m.floor,upper);
 wall(upper,207,780,371,798,2.83,.12);
 upper.add(guestStair(m.wood,m.dark,true));
 const guestLanding=poly([[227,794],[267,802],[263,839],[223,833]].map(([x,z])=>p(x,z)),.15,2.95,m.floor,upper);guestLanding.name='guest-stair-turning-landing';
 for(const [a,b] of [[p(263,839),guestAtrium[2]],[guestAtrium[2],guestAtrium[3]]] as [number[],number[]][]){
  for(const y of [3.28,3.52,3.76,4.02])segment(upper,[a[0],y,a[1]],[b[0],y,b[1]],.025,m.dark);
  for(let t=0;t<=1.01;t+=.25)box(upper,a[0]+(b[0]-a[0])*t,3.1,a[1]+(b[1]-a[1])*t,.045,.96,.045,m.dark);
 }


 // Basement is displayed as its own cutaway; surrounding land hides it in exterior views.
 rectFloor(basement,835,189,1227,868,-2.45,m.stone);
 for(const a of [[841,195,1220,195],[841,195,841,861],[1220,195,1220,861],[841,861,1220,861],[983,199,983,287],[1065,199,1065,322],[841,344,984,344],[984,344,984,456],[1065,352,1065,669],[1065,387,1220,387],[841,460,995,460],[914,463,914,664],[841,669,1220,669]])wall(basement,...a as [number,number,number,number],1.3,-2.3);
 q=at(946,538);stairs(basement,q[0],q[1],1.1,3.8,-2.3,2.43);
 poly([[110,930],[353,955],[326,1226],[79,1205]].map(([x,z])=>p(x,z)),.15,-2.45,m.stone,basement,'guest');
 furnishHouse(ground,upper,basement,material);
 ground.add(garageCars(material));
 // Pitched roofs from the photographs. Heights are explicit model assumptions.
 function pitchedRoof(cx:number,cz:number,width:number,length:number,eave:number,ridge:number,rotation=0,kind:'main'|'guest'|'link'='main',footprint?:[number,number][]){
  const g=new T.Group();g.position.set(cx,0,cz);g.rotation.y=rotation;roofs.add(g);const rise=ridge-eave,half=width/2,slope=Math.atan2(rise,half),span=Math.hypot(half,rise);
  const windows=kind==='link'?[]:roofSkylights(kind);
  for(const side of [-1,1]){const mesh=realistic?add(roofSlopeWithOpenings(half,length,eave,ridge,side,windows),m.roof,g,'main'):box(g,side*half/2,(eave+ridge)/2-.075,0,span,.15,length,m.roof,'main');if(!realistic)mesh.rotation.z=-side*slope;mesh.name=kind+'-roof-slope-'+side;outline(mesh);box(g,side*half,eave-.06,0,.14,.18,length,m.edge);}
  if(realistic)roofTrim(g,half,length,eave);
  // Close the whole upper envelope on the actual wall planes. Roof eaves
  // overhang these walls; gable faces must never be placed at the roof ends.
  const outlinePoints=footprint??[[W,N],[E,N],[E,S],[W,S]];
  const local=outlinePoints.map(([x,z])=>{const dx=x-cx,dz=z-cz;return [dx*Math.cos(rotation)-dz*Math.sin(rotation),dx*Math.sin(rotation)+dz*Math.cos(rotation)];});
  const underside=(x:number)=>ridge-rise*Math.abs(x)/half-.045;
  for(let index=0;index<local.length;index++){
   const a=local[index],b=local[(index+1)%local.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   const profile=[new T.Vector2(0,2.74),new T.Vector2(len,2.74),new T.Vector2(len,underside(b[0]))];
   const cross=-a[0]/dx;if(Number.isFinite(cross)&&cross>0&&cross<1)profile.push(new T.Vector2(cross*len,ridge-.045));
   profile.push(new T.Vector2(0,underside(a[0])));const shape=new T.Shape(profile);
   const windows=kind==='main'&&index===2?[[-2.6,3.15,1.05,2.1],[2.6,3.15,1.05,2.1]]:kind==='main'&&index===0?[[-2.2,3.1,1.05,1.4],[2.4,3.1,1.05,1.4]]:kind==='guest'&&index===0?[[0,3.15,2.3,1.8]]:kind==='guest'&&index===4?[[0,3.05,2.4,2.25]]:[];
   const face=new T.Group();face.position.set(a[0],0,a[1]);face.rotation.y=-Math.atan2(dz,dx);g.add(face);
   for(const [x,y,w,h] of windows){const u=(x-a[0])/dx*len;const hole=new T.Path();hole.moveTo(u-w/2,y);hole.lineTo(u-w/2,y+h);hole.lineTo(u+w/2,y+h);hole.lineTo(u+w/2,y);hole.closePath();shape.holes.push(hole);box(face,u,y,0,w,h,.05,glass);for(const offset of [-w/2,w/2])box(face,u+offset,y,0,.05,h,.25,m.dark);for(const dy of [0,h])box(face,u,y+dy,0,w,.05,.25,m.dark);}
   const wallGeometry=new T.ExtrudeGeometry(shape,{depth:.21,bevelEnabled:false});wallGeometry.translate(0,0,-.105);const mesh=add(wallGeometry,m.wall,face,kind==='guest'?'guest':'main');mesh.name=kind+'-roof-wall-'+index;
   // Rooms under the roof are plastered: line the inner face so the cladding never shows between wall head and ceiling.
   // The room side is whichever side of the face's midpoint lies inside the footprint (the guest wing is not convex).
   const probe=[(a[0]+b[0])/2-dz/len*.3,(a[1]+b[1])/2+dx/len*.3];let inside=false;
   for(let i=0,j=local.length-1;i<local.length;j=i++){const [xi,zi]=local[i],[xj,zj]=local[j];if((zi>probe[1])!==(zj>probe[1])&&probe[0]<(xj-xi)*(probe[1]-zi)/(zj-zi)+xi)inside=!inside;}
   const inward=inside?1:-1,lining=new T.ShapeGeometry(shape);
   if(inward<0){const idx=lining.index!;for(let t=0;t<idx.count;t+=3){const k=idx.getX(t+1);idx.setX(t+1,idx.getX(t+2));idx.setX(t+2,k);}const n=lining.attributes.normal;for(let v=0;v<n.count;v++)n.setZ(v,-1);}
   lining.translate(0,0,inward*.107);const inner=add(lining,m.plaster,face);inner.castShadow=false;inner.name=kind+'-roof-wall-lining-'+index;
  }
  // The east roof has three groups and one high window; the photos rule out an even row.
  const skylights=kind==='link'?[]:roofSkylights(kind);
  for(const {side,z,fraction} of skylights){const x=side*half*fraction,y=ridge-rise*fraction+.12;if(realistic){const frame=new T.Group();frame.position.set(x,y,z);frame.rotation.z=-side*slope;frame.name='open-roof-window';g.add(frame);for(const a of [-.54,.54])box(frame,a,0,0,.09,.12,1.4,m.dark);for(const a of [-.66,.66])box(frame,0,0,a,1.15,.12,.09,m.dark);box(frame,0,.035,0,1.02,.028,1.23,glass);}else{const win=box(g,x,y,z,1.15,.11,1.4,m.dark);win.rotation.z=-side*slope;const pane=box(g,x,y+.06,z,1.01,.04,1.22,glass);pane.rotation.z=-side*slope;}}

  box(g,0,ridge-.01,0,.15,.12,length,m.edge);
 }
 pitchedRoof(0,0,13.1,20.2,2.94,7.6);
 const guest=guestRoofFrame;pitchedRoof(guest.center[0],guest.center[1],guest.width+.18,guest.length+.18,2.94,6.75,guest.rotation,'guest',guestOutline);
 // The entrance roof runs east–west and covers the north courtyard loggia.
 const connector=p(625,663);pitchedRoof(connector[0],connector[1],5.6,12.5,2.85,4.75,Math.PI/2,'link',linkOutline);
 q=at(1010,885);box(roofs,q[0],.15,q[1],.8,7.65,.75,m.plaster,'main');
 // Fine cladding rhythm, deliberately restrained in the pale model finish.
 const slats=new T.Group();ground.add(slats);for(let z=N;z<S;z+=.23){for(const x of [W-.025,E+.025]){const bar=box(slats,x,2.4,z,.035,.38,.025,m.wood);bar.castShadow=false;if(x>0)(originals.east??=[]).push(bar);else if(z<kitchenSouth)(originals.kitchen??=[]).push(bar);}}
 // Low-poly crowns, open trunks and gentle variation, fixed to the source planting plan.
 // Detailed trees: instanced leaf-card archetypes. Pines and the Japanese maples follow the owner photos.
 const foliage=realistic?(foliageIn??foliageMaterials()):undefined;
 if(foliage)trees.add(buildTrees(treePositions.map(([px,pz,r],i)=>{const [x,z]=s(px,pz),seed=171+i*927;return {x,z,r,height:r*1.35+1.7,seed,kind:[171,1098,2025,4806,5733].includes(seed)?'pine':i%5===3?'maple':'broadleaf'} as TreeSpec;}),foliage,'garden-trees'));
 treePositions.forEach(([px,pz,r],i)=>{if(realistic)return;const [x,z]=s(px,pz),height=r*1.35+1.7;const trunk=add(cylinderGeo,m.trunk,trees);trunk.scale.set(.1,height*.68,.1);trunk.position.set(x,height*.34,z);
  for(let k=0;k<5;k++){const angle=k*2.4+i,dx=Math.cos(angle)*r*.52,dz=Math.sin(angle)*r*.52;segment(trees,[x,height*.43,z],[x+dx,height-r*.2,z+dz],.06,m.trunk);}
  // Seeded, overlapping lobes give each crown an irregular, airy silhouette.
  let seed=171+i*927;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const foliage=new T.InstancedMesh(sphereGeo,m.leaf,65);foliage.castShadow=true;foliage.receiveShadow=true;const dummy=new T.Object3D();
  for(let k=0;k<65;k++){const angle=random()*Math.PI*2,vertical=random()*2-1,radial=Math.sqrt(1-vertical*vertical)*Math.sqrt(random());dummy.position.set(x+Math.cos(angle)*radial*r*.76,height-r*.35+vertical*r*.62,z+Math.sin(angle)*radial*r*.71);const size=r*(.16+random()*.18);dummy.scale.set(size*(.8+random()*.5),size*(.75+random()*.55),size);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();foliage.setMatrixAt(k,dummy.matrix);foliage.setColorAt(k,new T.Color().setRGB(.88+random()*.12,.9+random()*.1,.86+random()*.14));}trees.add(foliage);
 });

 trees.add(boundaryHedge(foliage));
 const renovation=buildRenovations(ground,roofs,site,material);
 facade(renovation.groups.east,[W,S],[.82,S],[{from:1.6,to:4.2,sill:.9,head:2.2}],'main');
 ground.traverse(o=>{const id=o.userData.replacedBy as RenovationId|undefined;if(id)(originals[id]??=[]).push(o);});
 const detail=realistic?architecturalDetails(ground,upper):undefined;
 // Roofs-on views still contain the real upper-floor furnishings and gallery.
 // Omit the cutaway's duplicated lower hall and stairs; the ground model supplies those.
 if(realistic){upper.updateMatrixWorld(true);upper.traverse(o=>{if(!(o instanceof T.Mesh))return;let parent:T.Object3D|null=o;while(parent&&parent!==upper){if(parent.name.includes('stair'))return;parent=parent.parent;}if(new T.Box3().setFromObject(o).min.y>=2.85)o.userData.alsoExterior=true;});}
 if(setting){setting.name||='surrounding-setting';root.add(setting);}

 let active=renovationState(),currentLevel:Level='exterior';
 const applyRenovations=()=>{for(const id of Object.keys(originals) as RenovationId[])for(const o of originals[id]!)o.visible=!active[id];renovation.set(active,currentLevel);garden.setRenovations(active);};
 const setRenovations=(next:RenovationState)=>{active={...next};applyRenovations();};
 // One consistent natural-material palette across the original house and all proposals.
 for(const mat of materials)mat.color.set(mat.userData.timber);garden.setFinish('timber');lineMat.opacity=.2;
 const setLevel=(level:Level)=>{currentLevel=level;if(setting)setting.visible=level==='exterior';if(detail)detail.ceilings.visible=level==='exterior';slats.visible=level==='exterior';site.visible=level!=='basement';trees.visible=level==='exterior';roofs.visible=level==='exterior';ground.visible=level==='exterior'||level==='ground';upper.visible=level==='upper';basement.visible=level==='basement';for(const mesh of cutWalls){const h=mesh.userData.height as number,y=mesh.userData.base as number;const cap=mesh.parent===upper?4.12:mesh.parent===basement?-1:1.17;const shown=level==='exterior'?h:Math.max(0,Math.min(h,cap-y));mesh.visible=shown>0;mesh.scale.y=Math.max(.001,shown);mesh.position.y=y+shown/2;}applyRenovations();};
 const dispose=()=>{const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(a=>ms.add(a));}});gs.forEach(g=>g.dispose());ms.forEach(m=>{if(m instanceof T.MeshStandardMaterial)m.map?.dispose();m.dispose();});};
 // Every floor × renovation combination, for static batching: state = floor*64 + renovation bits.
 const renovationIds=Object.keys(renovationState()) as RenovationId[];
 const stateOf=(level:Level,state:RenovationState)=>levels.indexOf(level)*64+renovationIds.reduce((bits,id,i)=>bits|(state[id]?1<<i:0),0);
 const applyState=(index:number)=>{setLevel(levels[index>>6]);setRenovations(Object.fromEntries(renovationIds.map((id,i)=>[id,!!(index&(1<<i))])) as RenovationState);};
 // Upper-floor rooms stay visible behind the roofs in the whole-house view.
 const rendered=(mesh:T.Object3D)=>{for(let o:T.Object3D|null=mesh;o;o=o.parent){if(o.visible)continue;if(o===upper&&currentLevel==='exterior'&&mesh.userData.alsoExterior)continue;return false;}return true;};
 return {root,site,trees,upper,pickables,detail,setRenovations,setLevel,dispose,stateCount:levels.length*64,stateOf,applyState,rendered};
}
export const levels:Level[]=['exterior','ground','upper','basement'];
