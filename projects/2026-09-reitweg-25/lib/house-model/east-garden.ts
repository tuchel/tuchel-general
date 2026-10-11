import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildHedge,type FoliageMaterials,type TreeKind} from './foliage';

/** The garden by the main house's east terrace and in front of the north hedge, from the owner's photographs from the
 * east meadow, the terrace and the lawn, placed on the aerial photograph (cameras fitted to the house; crossed bearings
 * from two photographs, to about 1 m). World metres. */
// A low clipped yew hedge along the terrace's east edge, from the north-east corner to the middle of the fountain grass.
const YEW_HEDGE:[T.Vector2Like,T.Vector2Like]=[{x:9,y:-11},{x:9,y:-1.5}];
// A pale granite boulder in front of the north hedge, about 2.4 × 1.5 m and 1.15 m high.
const BOULDER={x:12,z:-11,length:2.4,width:1.5,height:1.15,turn:.25};
/** A second, smaller mugo pine beside the boulder, in site-plan units as treePositions: [x, z, radius, height, kind]. */
export const EAST_GARDEN_TREES:readonly (readonly [number,number,number,number,TreeKind])[]=[[1083.5,347.5,1.2,1.8,'mugo']];

export function buildEastGarden(foliage?:FoliageMaterials){
 const planting=new T.Group();planting.name='east-garden-planting';
 const hedge=buildHedge([YEW_HEDGE],{width:.9,height:.7,inset:0,needles:true},foliage);hedge.name='east-terrace-yew-hedge';planting.add(hedge);
 // A rounded block: each vertex pushed in or out by a fixed hash of its direction, then flattened onto the lawn.
 let geometry:T.BufferGeometry=new T.IcosahedronGeometry(1,3);const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),h=Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453,k=.94+.1*(h-Math.floor(h))+.04*Math.sin(x*3+z*2);
  p.setXYZ(i,x*k*BOULDER.length/2,(Math.max(y,-.25)+.25)*k*BOULDER.height/1.25,z*k*BOULDER.width/2);}
 geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');geometry=mergeVertices(geometry);geometry.computeVertexNormals();
 const boulder=new T.Mesh(geometry,new T.MeshStandardMaterial({color:'#b7b6ae',roughness:.9}));boulder.name='garden-boulder';
 boulder.position.set(BOULDER.x,0,BOULDER.z);boulder.rotation.y=BOULDER.turn;boulder.castShadow=true;boulder.receiveShadow=true;planting.add(boulder);
 return planting;
}
