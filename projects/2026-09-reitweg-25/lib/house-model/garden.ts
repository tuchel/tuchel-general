import * as T from 'three';
import type {RenovationState} from './renovation-data';
import {plotOutline} from './site-data';
import {meadowClear} from './east-garden';

/** Photo-led planting masses. Boundaries are indicative, not surveyed beds. */
export function buildGarden(realistic=false){
 const group=new T.Group();
 const mats:T.MeshStandardMaterial[]=[];
 const mat=(color:string)=>{const m=new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide});mats.push(m);return m;};
 const grassMat=mat('#b2b793'),baseMat=mat('#bbc19e'),whiteMat=mat('#eee7cc'),goldMat=mat('#cab96e'),pinkMat=mat('#b398ac'),fountainMat=mat('#b2b793'),plumeMat=mat('#9a8e86');
 let seed=257;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const inside=(x:number,z:number,points:number[][])=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 // A six-blade tuft, with bending tips, reused across the meadow and the beds.
 const vertices:number[]=[];for(let i=0;i<6;i++){const a=i*Math.PI/3,c=Math.cos(a),s=Math.sin(a),w=.045,bend=.17;const points=[[-w,0,0],[w,0,0],[w*.35,.55,bend*.35],[-w*.35,.55,bend*.35],[0,1,bend]];for(const index of [0,1,2,0,2,3,3,2,4]){const [x,y,z]=points[index];vertices.push(x*c+z*s,y,-x*s+z*c);}}
 const tuftGeo=new T.BufferGeometry();tuftGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));tuftGeo.computeVertexNormals();
 // Fountain grass: sixteen fine blades rising and arching out, the outer ones furthest; its plumes stand just above.
 const fine:number[]=[],plumeTips:T.Vector3[]=[];
 for(let i=0;i<16;i++){const a=i*2.4,c=Math.cos(a),s=Math.sin(a),w=.012,lean=.12+(i%4)*.11;
  const points=[[-w,0,0],[w,0,0],[w*.8,.55,lean*.35],[-w*.8,.55,lean*.35],[w*.5,.88,lean*.8],[-w*.5,.88,lean*.8],[0,.96,lean*1.45]];
  for(const index of [0,1,2,0,2,3,3,2,4,3,4,5,5,4,6]){const [x,y,z]=points[index];fine.push(x*c+z*s,y,-x*s+z*c);}
  if(i%8===3)plumeTips.push(new T.Vector3(s*lean*.9,1.02,c*lean*.9));}
 const fountainGeo=new T.BufferGeometry();fountainGeo.setAttribute('position',new T.Float32BufferAttribute(fine,3));fountainGeo.computeVertexNormals();
 const plumeGeo=new T.CylinderGeometry(.005,.009,.1,5).translate(0,.05,0);
 let bedId=0;const bedBases:T.Mesh[]=[];
 const positions:{x:number;z:number;h:number;flower:boolean;bed:number;tint?:T.Color;fountain?:boolean}[]=[];
 // Keeps the part of a polygon where (p − at)·normal ≥ 0.
 const clip=(points:number[][],[at,normal]:number[][])=>{const side=(q:number[])=>(q[0]-at[0])*normal[0]+(q[1]-at[1])*normal[1],out:number[][]=[];
  points.forEach((q,i)=>{const n=points[(i+1)%points.length],a=side(q),b=side(n);if(a>=0)out.push(q);if((a>=0)!==(b>=0)){const t=a/(a-b);out.push([q[0]+(n[0]-q[0])*t,q[1]+(n[1]-q[1])*t]);}});return out;};
 function bed(cx:number,cz:number,rx:number,rz:number,density:number,height:number,flowers:boolean,{rectangular=false,tint,fountain,keep=[]}:{rectangular?:boolean;tint?:T.Color;fountain?:boolean;keep?:number[][][]}={}){
  const currentBed=bedId++;let points:number[][]=[];if(rectangular)points.push([cx-rx,cz-rz],[cx+rx,cz-rz],[cx+rx,cz+rz],[cx-rx,cz+rz]);else for(let i=0;i<64;i++){const a=i/64*Math.PI*2,r=1+.04*Math.sin(a*3+.8)+.035*Math.cos(a*5);points.push([cx+Math.cos(a)*rx*r,cz+Math.sin(a)*rz*r]);}
  for(const half of keep)points=clip(points,half);
  const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));const mesh=new T.Mesh(new T.ShapeGeometry(shape),baseMat);mesh.rotation.x=-Math.PI/2;mesh.position.y=.035;mesh.receiveShadow=true;group.add(mesh);bedBases.push(mesh);
  for(let i=0;i<rx*rz*Math.PI*density*(realistic?1.7:1);i++){const x=cx+(rand()*2-1)*rx*1.08,z=cz+(rand()*2-1)*rz*1.08;if(inside(x,z,points)&&inside(x,z,plotOutline)&&!(x>-18.5&&x<-12&&z>-.7&&z<1.6)&&!meadowClear(x,z))positions.push({x,z,h:height*(.65+rand()*.7),flower:flowers&&rand()<.16,bed:currentBed,tint,fountain});}
  return currentBed;
 }
 // Tall meadow beyond the close-cut eastern lawn; a mown route separates islands. A mown path about 1.5 m wide runs
 // through the northern one from its east end to the lawn by the mugo pine, which stands in mown lawn (owner's photograph
 // from the east meadow, camera fitted to the house): the meadow south of it stops 2.5 m short of the pine.
 const path=[[23.7,4.3],[37.4,6.6]],[ux,uz]=[path[1][0]-path[0][0],path[1][1]-path[0][1]].map((d,_,v)=>d/Math.hypot(...v)),edge=(d:number)=>[path[0][0]-uz*d,path[0][1]+ux*d];
 bed(32,1.1,17,9.8,20,.56,true,{keep:[[edge(-.75),[uz,-ux]],[[23.8,3.5],[8.5,-5.1]]]});bed(32,1.1,17,9.8,20,.56,true,{keep:[[edge(.75),[-uz,ux]],[[23.7,0],[1,0]]]});
 bed(32,21,13.8,5.3,20,.6,true);
 // Fountain grass between the east terrace's yew hedge and the wall (east-garden.ts), a drift of it beyond the terrace,
 // and the arrival path.
 const terraceBeds=[bed(7.6,-.65,.9,2.35,26,.85,false,{rectangular:true,fountain:true}),bed(9.75,6.7,1.6,1.7,26,.85,false,{fountain:true})];
 const kitchenBed=bed(-10,-5.8,1.7,3.4,35,.48,false);
 // A golden clump of it past the yew hedge's end; orange sedge either side of the boulder by the north hedge.
 bed(10.1,-1.2,.9,1.1,26,.85,false,{fountain:true,tint:new T.Color(1.12,1.02,.75)});
 const sedge=new T.Color(1.55,.95,.55);bed(10.5,-11.4,.55,.5,45,.45,false,{tint:sedge});bed(13.5,-10.6,.5,.45,45,.45,false,{tint:sedge});
 // Entrance grasses are modeled separately around the narrow cobbled path.
 const meadow=positions.filter(p=>!p.fountain),fountains=positions.filter(p=>p.fountain);
 const tufts=new T.InstancedMesh(tuftGeo,grassMat,meadow.length);tufts.name='meadow-grass';const dummy=new T.Object3D();
 const fountainTufts=new T.InstancedMesh(fountainGeo,fountainMat,fountains.length);fountainTufts.name='fountain-grass';
 const plumes=new T.InstancedMesh(plumeGeo,plumeMat,fountains.length*plumeTips.length);plumes.name='fountain-grass-plumes';const plumeBeds:number[]=[];
 const flowerPositions=positions.filter(p=>p.flower);const flowerGeo=new T.IcosahedronGeometry(1,0);
 const flowers=[whiteMat,goldMat,pinkMat].map(m=>new T.InstancedMesh(flowerGeo,m,flowerPositions.length));const flowerCounts=[0,0,0];
 meadow.forEach((p,i)=>{dummy.position.set(p.x,.045,p.z);dummy.scale.set(.6+rand()*.9,p.h,.6+rand()*.9);dummy.rotation.set(0,rand()*Math.PI*2,0);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);const c=new T.Color().setRGB(.9+rand()*.1,.94+rand()*.06,.86+rand()*.14);tufts.setColorAt(i,p.tint?c.multiply(p.tint):c);});
 const tip=new T.Vector3(),plume=new T.Object3D();
 fountains.forEach((p,i)=>{const spread=.9+rand()*.5;dummy.position.set(p.x,.045,p.z);dummy.scale.set(spread,p.h,spread);dummy.rotation.set(0,rand()*Math.PI*2,0);dummy.updateMatrix();fountainTufts.setMatrixAt(i,dummy.matrix);
  const c=new T.Color().setRGB(.92+rand()*.1,.92+rand()*.08,.75+rand()*.2);fountainTufts.setColorAt(i,p.tint?c.multiply(p.tint):c);
  plumeTips.forEach((t,k)=>{tip.copy(t).applyMatrix4(dummy.matrix);plume.position.copy(tip);plume.rotation.set((rand()-.5)*.9,0,(rand()-.5)*.9);plume.scale.setScalar(.85+rand()*.4);plume.updateMatrix();plumes.setMatrixAt(i*plumeTips.length+k,plume.matrix);plumeBeds.push(p.bed);});});
 const flowerBeds:number[][]=[[],[],[]];
 flowerPositions.forEach(p=>{const kind=rand()<.65?0:rand()<.8?1:2;dummy.position.set(p.x,p.h*.93,p.z);dummy.scale.set(.055+rand()*.025,.035,.055+rand()*.025);dummy.updateMatrix();flowerBeds[kind].push(p.bed);flowers[kind].setMatrixAt(flowerCounts[kind]++,dummy.matrix);});
 tufts.receiveShadow=true;group.add(tufts);flowers.forEach((mesh,i)=>{mesh.name='meadow-flowers';mesh.count=flowerCounts[i];group.add(mesh);});
 fountainTufts.receiveShadow=true;fountainTufts.castShadow=true;for(const mesh of [fountainTufts,plumes])mesh.userData.sway='grass';group.add(fountainTufts,plumes);
 // Each instanced draw with the bed of each of its instances, for hiding a bed a renovation replaces.
 const draws:[T.InstancedMesh,number[]][]=[[tufts,meadow.map(p=>p.bed)],...flowers.map((mesh,k):[T.InstancedMesh,number[]]=>[mesh,flowerBeds[k]]),[fountainTufts,fountains.map(p=>p.bed)],[plumes,plumeBeds]];
 const originals=draws.map(([mesh])=>mesh.instanceMatrix.array.slice());
 const setRenovations=(state:RenovationState)=>{const hidden=new Set<number>([...(state.kitchen?[kitchenBed]:[]),...(state.terrace?terraceBeds:[])]);bedBases.forEach((base,i)=>base.visible=!hidden.has(i));draws.forEach(([mesh,beds],k)=>{mesh.instanceMatrix.array.set(originals[k]);beds.forEach((bed,i)=>{if(hidden.has(bed)){dummy.matrix.makeScale(0,0,0);mesh.setMatrixAt(i,dummy.matrix);}});mesh.instanceMatrix.needsUpdate=true;});};
 return {group,setRenovations,setFinish:(finish:string)=>{group.visible=finish!=='lines';grassMat.color.set(realistic?'#78884b':(finish==='timber'||finish==='photo')?'#a5af7a':'#b2b793');fountainMat.color.set(realistic?'#8a9150':(finish==='timber'||finish==='photo')?'#b0b07a':'#b8b996');plumeMat.color.set(realistic?'#85766f':'#9a8e86');baseMat.color.set(realistic?'#829051':(finish==='timber'||finish==='photo')?'#a8b583':'#bbc19e');}};
}
