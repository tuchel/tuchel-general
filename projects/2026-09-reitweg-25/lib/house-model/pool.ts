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
 const rimWidth=.115,outerX=8+rimWidth,outerZ=2+rimWidth,deckWidth=.48;
 for(const side of [-1,1]){
  box('pool-pale-edge',0,-.035,side*(2+rimWidth/2),16,.05,rimWidth,rim);
  box('pool-pale-edge',side*(8+rimWidth/2),-.035,0,rimWidth,.05,4+rimWidth*2,rim);
 }
 // Boards run outwards from the water; separate joints remain visible in every view.
 let seed=25;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const boards=new T.InstancedMesh(geo,wood,2*Math.ceil((outerX+deckWidth)*2/.145)+2*Math.ceil(outerZ*2/.145));
 boards.name='weathered-grey-pool-deck-boards';boards.castShadow=true;boards.receiveShadow=true;boards.userData.region='pool';
 const dummy=new T.Object3D();let k=0;
 function board(x:number,z:number,w:number,d:number){dummy.position.set(x,-.008,z);dummy.scale.set(w,.04,d);dummy.updateMatrix();boards.setMatrixAt(k,dummy.matrix);const tint=.83+random()*.3;boards.setColorAt(k++,new T.Color().setRGB(tint,tint,tint));}
 const count=Math.ceil((outerX+deckWidth)*2/.145),pitch=(outerX+deckWidth)*2/count;
 for(const side of [-1,1])for(let i=0;i<count;i++)board(-outerX-deckWidth+(i+.5)*pitch,side*(outerZ+deckWidth/2),pitch-.006,deckWidth);
 const endCount=Math.ceil(outerZ*2/.145),endPitch=outerZ*2/endCount;
 for(const side of [-1,1])for(let i=0;i<endCount;i++)board(side*(outerX+deckWidth/2),-outerZ+(i+.5)*endPitch,deckWidth,endPitch-.006);
 boards.count=k;g.add(boards);
 box('pool-floor',0,-1.48,0,16,.08,4,liner);
 for(const side of [-1,1]){
  box('pool-liner-long-wall',0,-1.4,side*2.025,16,1.415,.05,liner);
  box('pool-liner-end-wall',side*8.025,-1.4,0,.05,1.415,4.1,liner);
 }
 for(let i=0;i<4;i++)box('submerged-pool-step',-7.82+i*.18,-.3-i*.25,-1.82+i*.18,.36+i*.36,.1,.36+i*.36,liner);
 const surface=box('pool-water',0,-.085,0,16,.006,4,water);surface.castShadow=false;surface.renderOrder=2;
 return g;
}

/** The surrounding terrain also needs an opening; otherwise it fills the sunken pool. */
export function terrainWithPoolOpening(){
 const {x,z,width:w,depth:d}=poolOpening,positions:number[]=[];
 const xs=[...Array.from({length:81},(_,i)=>-600+i*15),x-w/2,x+w/2].sort((a,b)=>a-b);
 function rect(a:number,b:number,c:number,e:number){positions.push(a,0,c,a,0,e,b,0,c,b,0,c,a,0,e,b,0,e);}
 for(let i=0;i<xs.length-1;i++){
  const a=xs[i],b=xs[i+1];if(a>=x-w/2&&b<=x+w/2){rect(a,b,-600,z-d/2);rect(a,b,z+d/2,600);}else rect(a,b,-600,600);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return geo;
}
