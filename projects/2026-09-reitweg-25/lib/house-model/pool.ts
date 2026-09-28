import * as T from 'three';
import {sitePoint} from './site-data';

export const poolCenter=sitePoint(845,788);
// Labelled 16 × 4 m water footprint. Surround widths and depth are photo estimates.
export const poolOpening={x:poolCenter[0],z:poolCenter[1],width:16,depth:4};
export function poolHole(){
 const {x,z,width:w,depth:d}=poolOpening;
 return new T.Path([[x-w/2,-z-d/2],[x+w/2,-z-d/2],[x+w/2,-z+d/2],[x-w/2,-z+d/2]].map(([a,b])=>new T.Vector2(a,b)));
}

export function buildPool(){
 const g=new T.Group();g.name='flush-in-ground-pool';g.position.set(...[poolCenter[0],0,poolCenter[1]] as [number,number,number]);
 const wood=new T.MeshStandardMaterial({color:'#8c867b',roughness:.87});wood.userData.photo='deck';
 const rim=new T.MeshStandardMaterial({color:'#d3d3cc',roughness:.61});
 const liner=new T.MeshStandardMaterial({color:'#83bdc8',roughness:.48});
 const water=new T.MeshStandardMaterial({color:'#76abae',roughness:.14,transparent:true,opacity:.82,depthWrite:false});water.userData.water=true;
 const geo=new T.BoxGeometry(1,1,1);
 function box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material){
  const mesh=new T.Mesh(geo,mat);mesh.name=name;mesh.position.set(x,y+h/2,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.region='pool';g.add(mesh);return mesh;
 }
 // Tops meet the lawn (y=.005), with millimetres of relief rather than a plinth.
 // Pale stone coping about 0.32 m wide; grey deck boards run parallel to the water (IMG_1574, 9C75DDCD).
 const rimWidth=.32,outerX=8+rimWidth,outerZ=2+rimWidth,deckWidth=.48;
 for(const side of [-1,1]){
  box('pool-pale-edge',0,-.035,side*(2+rimWidth/2),16,.05,rimWidth,rim);
  box('pool-pale-edge',side*(8+rimWidth/2),-.035,0,rimWidth,.05,4+rimWidth*2,rim);
 }
 // Boards about 3.6 m long with staggered joints, parallel to each edge.
 let seed=25;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const boards=new T.InstancedMesh(geo,wood,400);
 boards.name='weathered-grey-pool-deck-boards';boards.castShadow=true;boards.receiveShadow=true;boards.userData.region='pool';
 const dummy=new T.Object3D();let k=0;
 function board(x:number,z:number,w:number,d:number){dummy.position.set(x,-.008,z);dummy.scale.set(w,.04,d);dummy.updateMatrix();boards.setMatrixAt(k,dummy.matrix);const tint=.83+random()*.3;boards.setColorAt(k++,new T.Color().setRGB(tint,tint,tint));}
 const rows=Math.round(deckWidth/.145),row=deckWidth/rows;
 // Runs from a to b split into staggered boards; along x for the long sides, along z for the ends.
 const run=(a:number,b:number,offset:number,place:(mid:number,len:number)=>void)=>{for(let t=a-offset;t<b;t+=3.6){const lo=Math.max(a,t),hi=Math.min(b,t+3.6);if(hi-lo>.05)place((lo+hi)/2,hi-lo-.006);}};
 for(const side of [-1,1])for(let r=0;r<rows;r++){const z=side*(outerZ+(r+.5)*row);run(-outerX-deckWidth,outerX+deckWidth,(r*1.3)%3.6,(mid,len)=>board(mid,z,len,row-.006));}
 for(const side of [-1,1])for(let r=0;r<rows;r++){const x=side*(outerX+(r+.5)*row);run(-outerZ,outerZ,(r*1.1)%3.6,(mid,len)=>board(x,mid,row-.006,len));}
 boards.count=k;g.add(boards);
 box('pool-floor',0,-1.48,0,16,.08,4,liner);
 for(const side of [-1,1]){
  box('pool-liner-long-wall',0,-1.4,side*2.025,16,1.415,.05,liner);
  box('pool-liner-end-wall',side*8.025,-1.4,0,.05,1.415,4.1,liner);
 }
 // Five nested L-shaped steps in the north-west corner, as drawn on the plan.
 [[2.07,.3],[2.42,.66],[2.77,1.02],[3.1,1.36],[3.43,1.71]].forEach(([along,depth],i)=>{const top=-.25-i*.24;box('submerged-pool-step',-8+along/2,-1.44,-2+depth/2,along,top+1.44,depth,liner);});
 // Submerged ledge along the north side and a stainless grab rail at the waterline.
 box('submerged-pool-ledge',(-8+3.43+8)/2,-1.44,-2+.17,8-(-8+3.43),.99,.34,liner);
 const steel=new T.MeshStandardMaterial({color:'#c9cdcf',metalness:.9,roughness:.25});
 box('pool-grab-rail',(-4.2+7.6)/2,-.16,-2+.07,11.8,.035,.035,steel);for(const x of [-4.2,1.7,7.6])box('pool-grab-rail-bracket',x,-.16,-2+.035,.03,.035,.07,steel);
 const surface=box('pool-water',0,-.085,0,16,.006,4,water);surface.castShadow=false;surface.renderOrder=2;
 return g;
}

/** The surrounding terrain also needs openings; otherwise it fills the sunken pool and the basement stairwell. */
export function terrainWithPoolOpening(extra:[number,number][][]=[]){
 const {x,z,width:w,depth:d}=poolOpening,positions:number[]=[];
 const holes=[{x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2},...extra.map(points=>({x0:Math.min(...points.map(q=>q[0])),x1:Math.max(...points.map(q=>q[0])),z0:Math.min(...points.map(q=>q[1])),z1:Math.max(...points.map(q=>q[1]))}))];
 const xs=[...Array.from({length:81},(_,i)=>-600+i*15),...holes.flatMap(h=>[h.x0,h.x1])].sort((a,b)=>a-b);
 function rect(a:number,b:number,c:number,e:number){if(e>c)positions.push(a,0,c,a,0,e,b,0,c,b,0,c,a,0,e,b,0,e);}
 for(let i=0;i<xs.length-1;i++){
  const a=xs[i],b=xs[i+1];if(b<=a)continue;let from=-600;
  for(const h of holes.filter(h=>a>=h.x0&&b<=h.x1).sort((p,q)=>p.z0-q.z0)){rect(a,b,from,h.z0);from=h.z1;}
  rect(a,b,from,600);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return geo;
}
