import * as T from 'three';
import {sitePoint as s,planPoint as p} from './site-data';

// Photo-led dimensions, not a survey. The route joins the existing pedestrian
// gate to the first entrance-link door, leaving soil and grasses beside the gable.
export const entranceRoute=[s(362.3,449),[-25.1,-2.22],[-14.05,-1.05],[-14.05,p(505,574)[1]]] as [number,number][];
export const entranceWidth=1.35;
// The driveway meets the walk at the guest-wing corner. Toward the street,
// its northern edge skirts a planted island rather than filling the whole gap.
export const drivewayFootprint=[s(359,489),[-31.9,-2.50],[-30.2,-1.82],[-28.5,-1.15],[-27.1,-.95],[-26.3,-1.22],[-26.1,-2.59],[-24.95,-2.88],[-24.65,-1.4],p(116,535),s(498,541),s(477,716),s(337,707)] as [number,number][];
export const roadsideInset=[[336,399],[365,422],[346,610],[246,626]].map(([x,z])=>s(x,z));
export const drivewayIsland=[[-33.3,-4.40],[-31.6,-3.75],[-29.3,-2.90],[-27.2,-2.15],[-26.65,-1.7],[-27.1,-1.12],[-28.5,-1.32],[-30.2,-1.99],[-31.9,-2.67],[-33.3,-2.9]];
export function insideEntrancePolygon(x:number,z:number,points:number[][]){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function ribbon(points:[number,number][],width:number){
 const sides=[-1,1].map(side=>points.map((q,i)=>{const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];const normals=[];for(const [a,b] of [[before,q],[q,after]]){const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len)normals.push(new T.Vector2(-(b[1]-a[1])/len,(b[0]-a[0])/len));}const n=normals.reduce((v,n)=>v.add(n),new T.Vector2()).normalize();const reach=width/2/Math.max(.5,n.dot(normals[0]));return [q[0]+side*n.x*reach,q[1]+side*n.y*reach] as [number,number];}));return [...sides[0],...sides[1].reverse()];
}
export const entranceFootprint=ribbon(entranceRoute,entranceWidth);
export function buildEntranceGarden(realistic:boolean){
 const group=new T.Group();group.name='front-door-walkway';
 const stone=new T.MeshStandardMaterial({color:'#8c8879',roughness:.96}),joints=new T.MeshStandardMaterial({color:'#737364',roughness:1}),soil=new T.MeshStandardMaterial({color:'#665a42',roughness:1}),gravel=new T.MeshStandardMaterial({color:'#c2bb9e',roughness:1}),wood=new T.MeshStandardMaterial({color:'#78654a',roughness:.9});
 const poly=(points:number[][],y:number,depth:number,mat:T.Material,name:string)=>{const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.rotateX(-Math.PI/2);const m=new T.Mesh(geo,mat);m.position.y=y;m.name=name;m.receiveShadow=true;group.add(m);return m;};
 poly(entranceFootprint,.014,.03,joints,'narrow-entrance-cobble-base');
 poly(drivewayFootprint,.013,.03,joints,'driveway-cobble-base');
 poly(roadsideInset,.013,.03,joints,'roadside-inset-cobble-base');
 // The last short approach rises one shallow step to the entrance threshold.
 const stepX=-16.0,stepZ=-2.22+(stepX+25.1)*1.17/11.05;
 const landing=ribbon([[stepX,stepZ],entranceRoute[2],entranceRoute[3]],entranceWidth);
 poly(landing,.044,.085,joints,'front-door-shallow-step');
 let seed=821;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const dummy=new T.Object3D(),color=new T.Color(),cobbleGeometry=new T.BoxGeometry(.166,.032,.116),dx=.18,dz=.13;
 const paved=(x:number,z:number)=>insideEntrancePolygon(x,z,entranceFootprint)||insideEntrancePolygon(x,z,drivewayFootprint)||insideEntrancePolygon(x,z,roadsideInset);
 // One world-aligned bond and shared material make the join continuous.
 for(const [points,name,drive] of [[entranceFootprint,'individual-entrance-cobbles',false],[drivewayFootprint,'individual-driveway-cobbles',true],[roadsideInset,'individual-roadside-inset-cobbles',true]] as const){
  const minX=Math.min(...points.map(q=>q[0])),maxX=Math.max(...points.map(q=>q[0])),minZ=Math.min(...points.map(q=>q[1])),maxZ=Math.max(...points.map(q=>q[1]));
  const stones:{x:number;z:number;y:number}[]=[];
  for(let row=Math.floor(minZ/dz);row*dz<maxZ;row++)for(let col=Math.floor(minX/dx);col*dx<maxX;col++){
   const x=col*dx+(row%2)*dx/2,z=row*dz;
   if(!insideEntrancePolygon(x,z,points)||(drive&&insideEntrancePolygon(x,z,entranceFootprint)))continue;
   if([[-.082,-.057],[.082,-.057],[.082,.057],[-.082,.057]].every(([a,b])=>paved(x+a,z+b)))stones.push({x,z,y:insideEntrancePolygon(x,z,landing)?.146:.061});
  }
  const cobbles=new T.InstancedMesh(cobbleGeometry,stone,stones.length);cobbles.name=name;cobbles.receiveShadow=true;cobbles.castShadow=realistic;
  stones.forEach((q,i)=>{dummy.position.set(q.x,q.y+(rand()-.5)*.004,q.z);dummy.rotation.set(0,(rand()-.5)*.025,0);dummy.scale.set(.97+rand()*.05,1,.97+rand()*.05);dummy.updateMatrix();cobbles.setMatrixAt(i,dummy.matrix);const light=.93+rand()*.13;color.setRGB(light,light,.96*light);cobbles.setColorAt(i,color);});group.add(cobbles);
 }
 // A narrow wall-side bed and a deeper, scalloped lawn-side island.
 const wallBed=[[-24.4,-1.37],[-15.02,-.36],[-15.02,.91],[-24.4,-.08]];
 const lawnBed=[[-26,-3.26],[-25.2,-4.7],[-23,-5.4],[-20.1,-5.15],[-17.6,-4.35],[-15.7,-3.05],[-15.9,-2.04],[-18.9,-2.19],[-22.4,-2.55]];
 const gateBed=[[-33.3,-6.7],[-30.6,-6.85],[-27.5,-5.4],[-26.1,-3.7],[-28.2,-4.02],[-31.3,-5.12]];
 const beds=[wallBed,lawnBed,gateBed,drivewayIsland];beds.forEach((bed,i)=>poly(bed,.01,.015,soil,'entrance-planting-bed-'+i));
 // Pale drainage gravel follows the timber wall and stays separate from the walk.
 poly([[-24.7,-.05],[-14.98,.99],[-14.98,1.12],[-24.7,.09]],.015,.025,gravel,'gable-drainage-gravel');
 const blades:number[]=[];for(let k=0;k<11;k++){const t=k/10,y=Math.sin(t*Math.PI*.85)*.58,r=t*t*.63,w=.023*(1-t)+.002;blades.push(r-w,y,0,r+w,y,0);}
 const index:number[]=[];for(let k=0;k<10;k++)index.push(k*2,k*2+1,k*2+2,k*2+1,k*2+3,k*2+2);
 const bladeGeo=new T.BufferGeometry();bladeGeo.setAttribute('position',new T.Float32BufferAttribute(blades,3));bladeGeo.setIndex(index);bladeGeo.computeVertexNormals();const leaf=new T.MeshStandardMaterial({color:'#658342',roughness:.94,side:T.DoubleSide});
 const clumps:[number,number][]=[];
 for(const bed of beds){const xs=bed.map(q=>q[0]),zs=bed.map(q=>q[1]);for(let x=Math.min(...xs)+.15;x<Math.max(...xs);x+=.5)for(let z=Math.min(...zs)+.15;z<Math.max(...zs);z+=.49){const a=x+(rand()-.5)*.25,b=z+(rand()-.5)*.25;if(insideEntrancePolygon(a,b,bed))clumps.push([a,b]);}}
 const count=realistic?48:24,grass=new T.InstancedMesh(bladeGeo,leaf,clumps.length*count);grass.name='entrance-arching-ornamental-grasses';grass.castShadow=realistic;grass.receiveShadow=true;let i=0;
 for(const [x,z] of clumps)for(let j=0;j<count;j++){const scale=.66+rand()*.53;dummy.position.set(x+(rand()-.5)*.12,.036,z+(rand()-.5)*.12);dummy.scale.set(scale,.7+rand()*.45,scale);dummy.rotation.set(0,rand()*Math.PI*2,0);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);const light=.78+rand()*.4;grass.setColorAt(i++,color.setRGB(light,light,.83*light));}group.add(grass);
 const box=(x:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,h/2+.02,z);mesh.castShadow=true;group.add(mesh);};
 // Unlit timber bollards, as photographed along the wall-side planting.
 for(const x of [-23.6,-20.2,-16.8])box(x,-2.22+(x+25.1)*1.17/11.05+.99,.12,.61,.12,wood);
 return group;
}
