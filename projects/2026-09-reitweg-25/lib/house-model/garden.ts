import * as T from 'three';
import type {RenovationState} from './renovation-data';
import {plotOutline} from './site-data';

/** Photo-led planting masses. Boundaries are indicative, not surveyed beds. */
export function buildGarden(realistic=false){
 const group=new T.Group();
 const mats:T.MeshStandardMaterial[]=[];
 const mat=(color:string)=>{const m=new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide});mats.push(m);return m;};
 const grassMat=mat('#b2b793'),baseMat=mat('#bbc19e'),whiteMat=mat('#eee7cc'),goldMat=mat('#cab96e'),pinkMat=mat('#b398ac');
 let seed=257;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const inside=(x:number,z:number,points:number[][])=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 // A six-blade tuft, with bending tips, reused across all the planting.
 const vertices:number[]=[];for(let i=0;i<6;i++){const a=i*Math.PI/3,c=Math.cos(a),s=Math.sin(a),w=.045,bend=.17;const points=[[-w,0,0],[w,0,0],[w*.35,.55,bend*.35],[-w*.35,.55,bend*.35],[0,1,bend]];for(const index of [0,1,2,0,2,3,3,2,4]){const [x,y,z]=points[index];vertices.push(x*c+z*s,y,-x*s+z*c);}}
 const tuftGeo=new T.BufferGeometry();tuftGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));tuftGeo.computeVertexNormals();
 let bedId=0;const bedBases:T.Mesh[]=[];
 const positions:{x:number;z:number;h:number;flower:boolean;bed:number}[]=[];
 function bed(cx:number,cz:number,rx:number,rz:number,density:number,height:number,flowers:boolean,rectangular=false){
  const currentBed=bedId++;const points:number[][]=[];if(rectangular)points.push([cx-rx,cz-rz],[cx+rx,cz-rz],[cx+rx,cz+rz],[cx-rx,cz+rz]);else for(let i=0;i<64;i++){const a=i/64*Math.PI*2,r=1+.04*Math.sin(a*3+.8)+.035*Math.cos(a*5);points.push([cx+Math.cos(a)*rx*r,cz+Math.sin(a)*rz*r]);}
  const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));const mesh=new T.Mesh(new T.ShapeGeometry(shape),baseMat);mesh.rotation.x=-Math.PI/2;mesh.position.y=.035;mesh.receiveShadow=true;group.add(mesh);bedBases.push(mesh);
  for(let i=0;i<rx*rz*Math.PI*density*(realistic?1.7:1);i++){const x=cx+(rand()*2-1)*rx*1.08,z=cz+(rand()*2-1)*rz*1.08;if(inside(x,z,points)&&inside(x,z,plotOutline)&&!(x>-18.5&&x<-12&&z>-.7&&z<1.6))positions.push({x,z,h:height*(.65+rand()*.7),flower:flowers&&rand()<.16,bed:currentBed});}
 }
 // Tall meadow beyond the close-cut eastern lawn; a mown route separates islands.
 bed(32,1.1,17,9.8,20,.56,true);bed(32,21,13.8,5.3,20,.6,true);
 // The rectangular planting bed between the east decks (grounds plan), a drift beyond the terrace, and the arrival path.
 bed(7.08,-2.55,.9,2.5,35,.43,false,true);bed(9.75,6.7,1.6,1.7,35,.4,true);
 bed(-10,-5.8,1.7,3.4,35,.48,false);
 // Entrance grasses are modeled separately around the narrow cobbled path.
 const tufts=new T.InstancedMesh(tuftGeo,grassMat,positions.length);tufts.name='meadow-grass';const dummy=new T.Object3D();
 const flowerPositions=positions.filter(p=>p.flower);const flowerGeo=new T.IcosahedronGeometry(1,0);
 const flowers=[whiteMat,goldMat,pinkMat].map(m=>new T.InstancedMesh(flowerGeo,m,flowerPositions.length));const flowerCounts=[0,0,0];
 positions.forEach((p,i)=>{dummy.position.set(p.x,.045,p.z);dummy.scale.set(.6+rand()*.9,p.h,.6+rand()*.9);dummy.rotation.set(0,rand()*Math.PI*2,0);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);tufts.setColorAt(i,new T.Color().setRGB(.9+rand()*.1,.94+rand()*.06,.86+rand()*.14));});
 const flowerBeds:number[][]=[[],[],[]];
 flowerPositions.forEach(p=>{const kind=rand()<.65?0:rand()<.8?1:2;dummy.position.set(p.x,p.h*.93,p.z);dummy.scale.set(.055+rand()*.025,.035,.055+rand()*.025);dummy.updateMatrix();flowerBeds[kind].push(p.bed);flowers[kind].setMatrixAt(flowerCounts[kind]++,dummy.matrix);});
 tufts.receiveShadow=true;group.add(tufts);flowers.forEach((mesh,i)=>{mesh.name='meadow-flowers';mesh.count=flowerCounts[i];group.add(mesh);});
 const originals=[tufts,...flowers].map(mesh=>mesh.instanceMatrix.array.slice());
 const setRenovations=(state:RenovationState)=>{const hidden=new Set<number>([...(state.kitchen?[4]:[]),...(state.terrace?[2,3]:[])]);bedBases.forEach((base,i)=>base.visible=!hidden.has(i));[tufts,...flowers].forEach((mesh,k)=>{const beds=k===0?positions.map(p=>p.bed):flowerBeds[k-1];mesh.instanceMatrix.array.set(originals[k]);beds.forEach((bed,i)=>{if(hidden.has(bed)){dummy.matrix.makeScale(0,0,0);mesh.setMatrixAt(i,dummy.matrix);}});mesh.instanceMatrix.needsUpdate=true;});};
 return {group,setRenovations,setFinish:(finish:string)=>{group.visible=finish!=='lines';grassMat.color.set(realistic?'#78884b':(finish==='timber'||finish==='photo')?'#a5af7a':'#b2b793');baseMat.color.set(realistic?'#829051':(finish==='timber'||finish==='photo')?'#a8b583':'#bbc19e');}};
}
