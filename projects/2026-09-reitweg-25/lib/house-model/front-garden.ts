import * as T from 'three';
import {buildHedge,type FoliageMaterials} from './foliage';
import {sitePoint as s} from './site-data';

/** The garden between the parking bays and the granite well. Positions follow the grounds plan; hedge heights,
 * planting and the trough are read from the owner's photographs, and species are not surveyed.
 * Site coordinates, as elsewhere: 181 px per 12 m on the overview sheet. */
const v=(x:number,z:number)=>{const [a,b]=s(x,z);return {x:a,y:b};};
// A clipped yew hedge closes the parking's south and west edges; its east end leaves a path beside the guest wing.
const PARKING_HEDGE:[[number,number],[number,number]][]=[[[341,640],[339,711]],[[339,711],[462,722]]];
// A lower clipped hedge beyond the trough, west of the well.
const BACK_HEDGE:[[number,number],[number,number]][]=[[[257,732],[259,800]]];
// Gravel path: from the guest wing's garden door, through the gap, to the well's brick circle.
const PATH:[number,number][]=[[478,688],[471,735],[378,758]];
/** Small fruit trees and leafy shrubs around the well, as [x, z, crown radius, height?] in site coordinates;
 * the garden trees are built with the rest (build-model.ts). */
export const FRUIT_TREES:[number,number,number][]=[[398,740,1.5],[300,722,1.4],[300,812,1.6],[396,804,1.3]];
export const SHRUBS:[number,number,number,number][]=[[445,752,.55,1.1],[420,772,.5,1],[362,732,.6,1.2],[300,745,.7,1.3],[300,786,.6,1.1],[362,812,.55,1.1],[398,782,.5,1],[455,774,.45,.9]];

export function buildFrontGarden(foliage?:FoliageMaterials){
 const ground=new T.Group();ground.name='front-garden-ground';
 const planting=new T.Group();planting.name='front-garden-planting';
 const hedge=(runs:[[number,number],[number,number]][],width:number,height:number,name:string)=>{const g=buildHedge(runs.map(([a,b])=>[v(...a),v(...b)]),{width,height,inset:0},foliage);g.name=name;planting.add(g);};
 hedge(PARKING_HEDGE,.9,1.8,'parking-yew-hedge');
 hedge(BACK_HEDGE,.75,1.35,'well-garden-back-hedge');
 // Gravel path, 1.1 m wide, just above the lawn.
 const gravel=new T.MeshStandardMaterial({color:'#b8ae99',roughness:1});
 for(let i=1;i<PATH.length;i++){
  const [ax,az]=s(...PATH[i-1]),[bx,bz]=s(...PATH[i]),len=Math.hypot(bx-ax,bz-az);
  const strip=new T.Mesh(new T.BoxGeometry(len+1.1,.03,1.1),gravel);strip.position.set((ax+bx)/2,.015,(az+bz)/2);strip.rotation.y=-Math.atan2(bz-az,bx-ax);strip.receiveShadow=true;strip.name='well-garden-gravel-path';ground.add(strip);
 }
 // Perennials along both edges of the path: grey-lilac catmint and yellow-green lady's mantle clumps.
 // A lumpy, leafy mound rather than a ball: each vertex pushed in or out by a fixed hash of its direction.
 const clump=new T.IcosahedronGeometry(1,2),colours=['#7f809c','#939f5c','#c9c5b6'],dummy=new T.Object3D(),tint=new T.Color();
 {const p=clump.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),h=Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453,k=.78+.34*(h-Math.floor(h));p.setXYZ(i,x*k,Math.max(y,-.2)*k,z*k);}clump.computeVertexNormals();}
 let seed=911;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const places:[number,number,number][]=[];
 for(let i=1;i<PATH.length;i++){
  const [ax,az]=s(...PATH[i-1]),[bx,bz]=s(...PATH[i]),len=Math.hypot(bx-ax,bz-az),tx=(bx-ax)/len,tz=(bz-az)/len;
  for(let d=.2;d<len;d+=.32)for(const side of [-1,1]){const off=.72+random()*.35;places.push([ax+tx*(d+random()*.2)-tz*side*off,az+tz*(d+random()*.2)+tx*side*off,.1+random()*.1]);}
 }
 colours.forEach((colour,k)=>{
  const mine=places.filter((_,i)=>(i%5<2?0:i%5<4?1:2)===k),mesh=new T.InstancedMesh(clump,new T.MeshStandardMaterial({color:colour,roughness:.95}),mine.length);
  mine.forEach(([x,z,r],i)=>{dummy.position.set(x,r*.35,z);dummy.scale.set(r*1.4,r*.8,r*1.4);dummy.rotation.set(0,random()*Math.PI,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);const v=.85+random()*.25;mesh.setColorAt(i,tint.setRGB(v,v,v));});
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='well-garden-perennials';planting.add(mesh);
 });
 // Timber vegetable trough beyond the well, boarded like the ring of beds around it.
 const [tx,tz]=s(286,766),trough=new T.Group();trough.position.set(tx,0,tz);trough.rotation.y=Math.PI/2;trough.name='well-garden-timber-trough';ground.add(trough);
 const timber=new T.MeshStandardMaterial({color:'#8d7a62',roughness:.9});timber.userData.photo='oak';
 const soil=new T.MeshStandardMaterial({color:'#5f4b3a',roughness:1});
 const board=(x:number,z:number,w:number,d:number)=>{const b=new T.Mesh(new T.BoxGeometry(w,.7,d),timber);b.position.set(x,.35,z);b.castShadow=true;b.receiveShadow=true;trough.add(b);};
 board(0,-.55,2.4,.06);board(0,.55,2.4,.06);board(-1.17,0,.06,1.1);board(1.17,0,.06,1.1);
 const bed=new T.Mesh(new T.BoxGeometry(2.28,.04,1.04),soil);bed.position.y=.64;bed.receiveShadow=true;trough.add(bed);
 return {ground,planting};
}
