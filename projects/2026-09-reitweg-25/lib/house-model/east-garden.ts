import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildHedge,type FoliageMaterials,type TreeKind} from './foliage';

/** The garden by the main house's east terrace and in front of the north hedge, and by the loggia's south end, from the
 * owner's photographs from the east meadow, the terrace, the lawn and the pool, placed on the aerial photograph (cameras
 * fitted to the house; crossed bearings from two photographs, to about 1 m by the house). World metres. */
// A low clipped yew hedge along the terrace's east edge, from the north-east corner to the middle of the fountain grass.
const YEW_HEDGE:[T.Vector2Like,T.Vector2Like]=[{x:9,y:-11},{x:9,y:-1.5}];
// Pale granite boulders: one in front of the north hedge, about 2.4 × 1.5 m and 1.15 m high; a smaller one by the loggia's
// south end, beside a red Japanese maple (bearings from the east meadow and the pool, to about 2 m); one in the southern
// meadow island in front of its pine, about 2.3 × 1.5 m and 0.95 m high (photograph from the meadow's north end, placed
// on the aerial photograph).
const BOULDERS=[{name:'garden-boulder',x:12,z:-11,length:2.4,width:1.5,height:1.15,turn:.25},{name:'loggia-boulder',x:-14.1,z:21.3,length:1.4,width:.9,height:.7,turn:-.4},{name:'meadow-boulder',x:43.4,z:18.4,length:2.3,width:1.5,height:.95,turn:.3}];
// A low deck of weathered grey boards beside the meadow boulder, about 3 × 2.4 m (the same photograph; its pale square on
// the aerial photograph).
const DECK={x:43.6,z:21,length:3,width:2.4,height:.12,turn:-.37};
/** Ground the meadow leaves clear: under the deck and the meadow boulder. */
export function meadowClear(x:number,z:number){
 for(const b of [{...DECK,length:DECK.length+.3,width:DECK.width+.3},BOULDERS[2]]){const dx=x-b.x,dz=z-b.z,c=Math.cos(b.turn),s=Math.sin(b.turn),u=dx*c-dz*s,v=dx*s+dz*c;if(Math.abs(u)<b.length/2&&Math.abs(v)<b.width/2)return true;}
 return false;
}
/** A second, smaller mugo pine beside the north boulder, and the red Japanese maple, a dwarf, by the loggia, in site-plan
 * units as treePositions: [x, z, radius, height, kind, tint]. */
export const EAST_GARDEN_TREES:readonly (readonly [number,number,number,number,TreeKind,(readonly [number,number,number])?])[]=[[1083.5,347.5,1.2,1.8,'mugo'],[647.8,848.3,1.3,1.3,'maple',[1.45,.42,.4]]];

export function buildEastGarden(foliage?:FoliageMaterials){
 const planting=new T.Group();planting.name='east-garden-planting';
 const hedge=buildHedge([YEW_HEDGE],{width:.9,height:.7,inset:0,needles:true},foliage);hedge.name='east-terrace-yew-hedge';planting.add(hedge);
 // A rounded block: each vertex pushed in or out by a fixed hash of its direction, then flattened onto the lawn.
 const stone=new T.MeshStandardMaterial({color:'#b7b6ae',roughness:.9});
 for(const b of BOULDERS){
  let geometry:T.BufferGeometry=new T.IcosahedronGeometry(1,3);const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),h=Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453,k=.94+.1*(h-Math.floor(h))+.04*Math.sin(x*3+z*2);
   p.setXYZ(i,x*k*b.length/2,(Math.max(y,-.25)+.25)*k*b.height/1.25,z*k*b.width/2);}
  geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');geometry=mergeVertices(geometry);geometry.computeVertexNormals();
  const boulder=new T.Mesh(geometry,stone);boulder.name=b.name;
  boulder.position.set(b.x,0,b.z);boulder.rotation.y=b.turn;boulder.castShadow=true;boulder.receiveShadow=true;planting.add(boulder);
 }
 // Boards run the deck's length on two bearers, a finger's gap apart.
 const deck=new T.Group();deck.name='meadow-deck';deck.position.set(DECK.x,0,DECK.z);deck.rotation.y=DECK.turn;planting.add(deck);
 const boards=new T.MeshStandardMaterial({color:'#8f8a80',roughness:.9});boards.userData.photo='deck';
 const plank=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),boards);o.position.set(x,y+h/2,z);o.castShadow=true;o.receiveShadow=true;deck.add(o);};
 for(const v of [-.9,.9])plank(0,0,v,DECK.length-.1,DECK.height-.03,.1);
 for(let n=Math.round(DECK.width/.145),i=0;i<n;i++)plank(0,DECK.height-.03,-DECK.width/2+(i+.5)*DECK.width/n,DECK.length,.03,DECK.width/n-.01);
 return planting;
}
