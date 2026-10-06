import * as T from 'three';
import horizon from './horizon.json';
import {addShaderFeature} from './shader-features';
import {sunDirection} from './sun-position';

/** The land around the house out to 150 km as it is seen from it: the Alps from the Wendelstein (east-southeast) round
 * to the Wetterstein and Ammergau ranges (south-southwest), the hills over the lake and the foreland. Every point keeps
 * its true bearing and elevation angle, with the earth's curvature and refraction (horizon.json, from
 * scripts/build-horizon.mjs); distances are drawn compressed into 1–2.9 km, nearer land always in front of farther.
 * The backdrop stays centred under the camera and lowers by the camera's height over each point's true distance, so
 * the angles hold from any view. */
export const HORIZON=horizon;
const RADIUS:[number,number]=[1000,2900],EARTH=6371000;
const decode=()=>{const bytes=Uint8Array.from(atob(horizon.heights),c=>c.charCodeAt(0));return new Int16Array(bytes.buffer);};
/** True distance (m) of grid row `j`, and the radius it is drawn at. */
export const rowDistance=(j:number)=>horizon.near*(horizon.far/horizon.near)**(j/(horizon.rows-1));
export const rowRadius=(j:number)=>RADIUS[0]+(RADIUS[1]-RADIUS[0])*j/(horizon.rows-1);
/** The height the earth's curvature, less refraction, lowers a point `d` metres away. */
const drop=(d:number)=>d*d*(1-horizon.refraction)/(2*EARTH);

export function alpineTerrain(){
 const group=new T.Group();group.name='atmospheric-alpine-terrain';
 const {columns,rows}=horizon,heights=decode(),count=columns*rows;
 // Height above the house's ground at each grid point (m), and the tangent of its elevation angle.
 const H=(i:number,j:number)=>heights[((i+columns)%columns)*rows+j]/10,tan=(i:number,j:number)=>(H(i,j)-drop(rowDistance(j)))/rowDistance(j);
 const directions=Array.from({length:columns},(_,i)=>new T.Vector3(...sunDirection(i*360/columns,0)));
 const flat=new Float32Array(count*3),lift=new Float32Array(count),colours=new Float32Array(count*3);
 const forest=new T.Color('#5d7062'),stone=new T.Color('#667f8b'),snow=new T.Color('#d3dde2'),water=new T.Color('#8ea9b2'),air=new T.Color('#b0c6cf');
 // Relief lit softly from the south-west and above, in the land's own east-north-up frame.
 const light=new T.Vector3(Math.sin(T.MathUtils.degToRad(220)),.9,Math.cos(T.MathUtils.degToRad(220))).normalize(),c=new T.Color();
 for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){
  const v=i*rows+j,d=rowDistance(j),r=rowRadius(j),dir=directions[i];
  flat[v*3]=dir.x*r;flat[v*3+1]=r*tan(i,j);flat[v*3+2]=dir.z*r;lift[v]=r/d;
  // Slope from the neighbouring points in true metres: across (bearing) and along (distance).
  const jn=Math.min(rows-1,j+1),jp=Math.max(0,j-1),across=d*2*Math.PI/columns*2,alongRun=rowDistance(jn)-rowDistance(jp);
  const n=new T.Vector3(-(H(i+1,j)-H(i-1,j))/across,1,-(H(i,jn)-H(i,jp))/alongRun).normalize();
  const bearing=i*2*Math.PI/columns,east=n.x*Math.cos(bearing)+n.z*Math.sin(bearing),north=-n.x*Math.sin(bearing)+n.z*Math.cos(bearing);
  const altitude=horizon.ground+H(i,j),still=[[1,0],[-1,0],[0,1],[0,-1]].every(([a,b])=>Math.abs(H(i+a,Math.min(rows-1,Math.max(0,j+b)))-H(i,j))<.15);
  c.copy(still&&altitude<900?water:altitude<1300?forest:altitude<2300?forest.clone().lerp(stone,(altitude-1300)/1000):stone.clone().lerp(snow,Math.min(1,(altitude-2300)/400)));
  c.multiplyScalar(.82+.28*Math.max(-.3,east*light.x+n.y*light.y+north*light.z));
  c.lerp(air,Math.min(.9,.3+.5*(1-Math.exp(-d/35000)))).toArray(colours,v*3);
 }
 const indices:number[]=[];
 for(let i=0;i<columns;i++)for(let j=0;j<rows-1;j++){const a=i*rows+j,b=((i+1)%columns)*rows+j;indices.push(a,a+1,b,b,a+1,b+1);}
 const geometry=new T.BufferGeometry();geometry.setIndex(indices);geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.setAttribute('panoramaLift',new T.Float32BufferAttribute(lift,1));
 // Haze is baked into the colour, keeping far land from becoming black under the scene's near-field shadows or
 // disappearing into its short fog range.
 const material=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,fog:false,toneMapped:false}),anchorHeight={value:0};
 addShaderFeature(material,{key:'camera-anchored-panorama',compile:shader=>{
  shader.uniforms.panoramaAnchor=anchorHeight;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float panoramaLift;\nuniform float panoramaAnchor;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.y-=(cameraPosition.y-panoramaAnchor)*panoramaLift;');
 }});
 const mesh=new T.Mesh(geometry,material);mesh.name='alpine-panorama';mesh.frustumCulled=false;
 mesh.userData={scenicBackdrop:true,dynamic:true};group.add(mesh);
 /** Places the backdrop for a camera at `height` (m above the house's ground): the geometry is built for that height,
  * which the path tracer reads, and the live view corrects the rest. A fresh geometry, so a traced scene converts it
  * again. */
 const anchor=(height:number)=>{
  const positions=new Float32Array(flat);for(let v=0;v<count;v++)positions[v*3+1]-=height*lift[v];
  const next=geometry.clone();next.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  if(mesh.geometry!==geometry)mesh.geometry.dispose();mesh.geometry=next;anchorHeight.value=height;
 };
 anchor(0);mesh.userData.anchor=anchor;mesh.userData.anchorHeight=()=>anchorHeight.value;
 return group;
}
