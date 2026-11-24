import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {entranceRoute,entranceWidth} from './entrance-garden';
import {poolOpening} from './pool';
import {passable} from './walk';

/** Low path lights for the evening: dark bollards with a warm band under a cap, along the entrance walk and beside the
 * pool, each with a pool of light on the ground around it. They are not in the exposé or the owner's photographs: a
 * proposal, placed where a path is walked after dark. No light source is added to the scene (every one would cost each
 * material's shader at every hour): the bands glow with the house's lamps (`userData.lamp`) and the pools are drawn
 * over the ground like the lamplight outside the glazing (`userData.lampSpill`), both from lighting.ts. */
export const GARDEN_LIGHTS={height:.55,radius:.042,spacing:3.4,/** From the walk's edge, and from the pool's coping (m). */aside:.32,poolAside:1.25,
 /** The pool of light: its reach (m), its height over the ground, and its brightness against the lamplight's. */
 reach:2.4,lift:.03,radiance:.05,band:'#4d3b25'};
/** Where they stand, [x, z]: either side of the entrance walk in turn, from the gate end to the last bend before the
 * door, and three along each long side of the pool, staggered. */
export function gardenLightPoints(){
 const out:[number,number][]=[],route=entranceRoute.slice(0,3);let carried=GARDEN_LIGHTS.spacing/2,side=1;
 for(let i=0;i+1<route.length;i++){
  const [ax,az]=route[i],[bx,bz]=route[i+1],len=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/len,uz=(bz-az)/len,off=entranceWidth/2+GARDEN_LIGHTS.aside;
  for(let d=carried;d<len;d+=GARDEN_LIGHTS.spacing){out.push([ax+ux*d-uz*off*side,az+uz*d+ux*off*side]);side=-side;carried=d+GARDEN_LIGHTS.spacing-len;}
 }
 const {x,z,width,depth}=poolOpening,far=depth/2+GARDEN_LIGHTS.poolAside;
 for(const [s,xs] of [[1,[-width/3,0,width/3]],[-1,[-width/6,width/6,width/2]]] as const)for(const dx of xs)out.push([x+dx,z+s*far]);
 return out;
}
export function buildGardenLights(){
 const group=new T.Group();group.name='garden-path-lights';
 const dark=new T.MeshStandardMaterial({color:'#1d1f20',roughness:.55,metalness:.4});
 const band=new T.MeshStandardMaterial({color:'#ffdb9b',emissive:GARDEN_LIGHTS.band,emissiveIntensity:0});band.userData.lamp=true;
 const spill=new T.MeshBasicMaterial({color:new T.Color('#ffd9a8').multiplyScalar(GARDEN_LIGHTS.radiance),vertexColors:true,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,fog:false});spill.userData.lampSpill=true;
 const {height:h,radius:r,reach}=GARDEN_LIGHTS,posts:T.BufferGeometry[]=[],bands:T.BufferGeometry[]=[],pools:T.BufferGeometry[]=[];
 // A disc brightest at the post, fading to nothing at its rim.
 const disc=new T.RingGeometry(.02,reach,28,6).rotateX(-Math.PI/2);
 {const p=disc.attributes.position,c:number[]=[];for(let i=0;i<p.count;i++){const k=(1-Math.min(1,Math.hypot(p.getX(i),p.getZ(i))/reach))**2;c.push(k,k,k);}
  disc.setAttribute('color',new T.Float32BufferAttribute(c,3));}
 for(const [x,z] of gardenLightPoints()){
  posts.push(new T.CylinderGeometry(r,r,h-.09,12).translate(x,(h-.09)/2,z),new T.CylinderGeometry(r*1.5,r*1.5,.02,12).translate(x,h-.01,z));
  bands.push(new T.CylinderGeometry(r*.8,r*.8,.07,12,1,true).translate(x,h-.055,z));
  pools.push(disc.clone().translate(x,GARDEN_LIGHTS.lift,z));
 }
 const post=new T.Mesh(mergeGeometries(posts),dark);post.name='garden-light-posts';post.castShadow=post.receiveShadow=true;
 const glow=new T.Mesh(mergeGeometries(bands),band);glow.name='garden-light-bands';
 const pool=new T.Mesh(mergeGeometries(pools),spill);pool.name='garden-light-pools';pool.userData.skipPhotographic=pool.userData.dynamic=true;pool.renderOrder=1;
 for(const g of [...posts,...bands,...pools,disc])g.dispose();
 passable(post);passable(glow);
 group.add(post,glow,pool);
 return group;
}
