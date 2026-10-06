import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {plotOutline,sitePoint as s,NORTH_TREES,EAST_TREES,TALL_HEDGE} from './site-data';
import {alpineTerrain} from './alpine-terrain';
import {buildTrees,buildHedge,foliageMaterials,type TreeSpec} from './foliage';
import {NEIGHBORS} from './neighbors';
import {distantWoods} from './forests';

/** Photo-led context, not surveyed terrain or a geographic mountain model.
 * Near vegetation has real depth; compressed distant ridges reproduce the quiet
 * apparent scale of the owner's east-window photographs. No lake surface is inferred. */
export function landscapeContext(options:{foliage?:ReturnType<typeof foliageMaterials>;density?:number}={}){
 const foliage=options.foliage??foliageMaterials(),density=options.density??1,specs:TreeSpec[]=[];
 const group=new T.Group();group.name='photo-led-landscape-setting';
 const vegetation=new T.Group();vegetation.name='setting-trees-and-hedges';group.add(vegetation);
 let seed=7142;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const dummy=new T.Object3D(),color=new T.Color();
 // Mature broadleaf avenue: irregular spacing and leaning limbs over the lane.
 const roadStart=new T.Vector2(...s(392,203)),roadEnd=new T.Vector2(...s(155,845));
 const axis=roadEnd.clone().sub(roadStart).normalize(),normal=new T.Vector2(axis.y,-axis.x),roadCenter=roadStart.clone().lerp(roadEnd,.5);
 const avenue=new T.Group();avenue.name='mature-roadside-avenue';vegetation.add(avenue);
 for(let i=0;i<24;i++){
  const along=-70+i*6.3+(random()-.5)*2,side=i%2?-1:1;
  const q=roadCenter.clone().addScaledVector(axis,along).addScaledVector(normal,side*(4.25+random()*.6));
  // Keep the recessed gates and their approach clear on the house side.
  if(side===1&&q.y>-10&&q.y<10)continue;
  const h=13+random()*4,r=4.8+random()*1.4;
  random();// keeps the seeded sequence, so woodland positions stay as before
  specs.push({x:q.x-side*.6,z:q.y,r,height:h,seed:11003+i*359,kind:'broadleaf'});
 }
 avenue.add(buildTrees(specs.splice(0),foliage,'avenue-trees'));
 // A park-edge woodland and a tree belt east of the lot stood here; the trees traced from the aerial photograph
 // (EAST_TREES) replace them, and they stay in the list, marked, only so the wooded edges below keep their places and seeds.
 const trees:{x:number;z:number;h:number;r:number;base:number;conifer:boolean;replaced?:boolean}[]=[];
 for(let i=0;i<88;i++){
  const x=65+random()*70,z=-80+random()*150;
  if(z>-17&&z<24&&random()<.79)continue;
  const central=z>-17&&z<24;
  trees.push({x,z,h:central?5+random()*5:9+random()*8,r:central?1.5+random():2.5+random()*2,base:-Math.min(5,(x-55)*.065),conifer:random()<.3,replaced:true});
 }
 for(let i=0;i<54;i++){const z=-52+i*2.2;if(z>3&&z<12)continue;const x=79+random()*15;trees.push({x,z,h:8+random()*6,r:2.9+random()*1.9,base:-2,conifer:false,replaced:true});if(i%2===0)trees.push({x:x-3,z:z+1,h:4.5+random()*2,r:2.5+random(),base:-1.3,conifer:false,replaced:true});}
 // A looser wooded edge outside the west/north garden, never a uniform circular ring.
 for(let i=0;i<38;i++){const along=-63+random()*126,q=roadCenter.clone().addScaledVector(axis,along).addScaledVector(normal,-(11+random()*17));trees.push({x:q.x,z:q.y,h:8+random()*9,r:2.5+random()*2.5,base:0,conifer:false});}
 // Continue the wooded lane into depth so its setting does not end at the lot.
 for(let i=0;i<65;i++){const along=76+random()*92,side=i%2?-1:1,q=roadCenter.clone().addScaledVector(axis,along).addScaledVector(normal,side*(5+random()*22));trees.push({x:q.x,z:q.y,h:10+random()*10,r:3+random()*3,base:0,conifer:false});}
 const woodland=new T.Group();woodland.name='layered-park-woodland';vegetation.add(woodland);
 // Distant woodland uses large, sparse cards; lighter presets keep a deterministic share.
 trees.forEach((tree,i)=>{if(tree.replaced||((i*2654435761)>>>0)/4294967296>=density)return;specs.push({x:tree.x,z:tree.z,r:tree.r,height:tree.h,base:tree.base,seed:17013+i*31,kind:tree.conifer?'pine':'broadleaf',far:true});});
 woodland.add(buildTrees(specs.splice(0),foliage,'woodland-trees'));
 // Trees traced from the aerial photograph: north of the boundary round Nos. 21 and 23, and east of the lot, each on
 // the ground as it falls away east (the surrounding ground's slope, viewer.ts).
 const ground=(x:number)=>-5*T.MathUtils.smoothstep(x,55,140);
 const traced=(list:typeof NORTH_TREES,name:string,seed:number)=>{const group=new T.Group();group.name=name;vegetation.add(group);
  group.add(buildTrees(list.map(([x,z,height,r,kind],i)=>({x,z,r,height,kind,seed:seed+i*577,base:ground(x),far:Math.hypot(x,z)>60})),foliage,name));};
 traced(NORTH_TREES,'north-neighbor-trees',23011);traced(EAST_TREES,'east-trees',31013);
 // The woods' lower storeys, not traced one by one: shrubs and young trees under the traced crowns of each stand (trees
 // whose crowns come within 4 m of another's) and smaller trees between them, so the woods close down to the ground as
 // photographed; clear of the garden and the neighbours' houses. Lighter settings draw a deterministic share.
 const all=[...NORTH_TREES,...EAST_TREES],stand=all.filter(([x,z,,r],i)=>all.some(([x2,z2,,r2],j)=>j!==i&&Math.hypot(x-x2,z-z2)<r+r2+4));
 const houses=NEIGHBORS.buildings.map(b=>Array.from({length:b.footprint.length/2},(_,i):[number,number]=>[b.footprint[i*2],b.footprint[i*2+1]]));
 let lower=90217,placed=0;const next=()=>{lower=(lower*1664525+1013904223)>>>0;return lower/4294967296;};
 for(let gx=-45;gx<=140;gx+=4.5)for(let gz=-100;gz<=100;gz+=4.5){
  const x=gx+(next()-.5)*3,z=gz+(next()-.5)*3,roll=next(),size=next(),shade=next();
  const near=stand.filter(([tx,tz,,r])=>Math.hypot(x-tx,z-tz)<r+3);if(!near.length)continue;
  const under=near.some(([tx,tz,,r])=>Math.hypot(x-tx,z-tz)<r*.7);if(roll>.88)continue;
  const shrub=roll<(under?.5:.3),height=shrub?3+size*3:under?8+size*5:10+size*6,r=shrub?2+shade*1.5:3+shade*2;
  if(inside([x,z],plotOutline)||edgeDistance([x,z],plotOutline)<r+.5)continue;
  if(houses.some(poly=>inside([x,z],poly)||edgeDistance([x,z],poly)<r+1.5))continue;
  if(((placed++*2654435761)>>>0)/4294967296>=density)continue;
  specs.push({x,z,r,height,seed:41017+Math.round(gx*7+gz*13),kind:'woodland',far:true,base:ground(x)});
 }
 const understory=new T.Group();understory.name='woodland-understory';vegetation.add(understory);
 understory.add(buildTrees(specs.splice(0),foliage,'woodland-understory-trees'));
 // The woodland floor in the canopy's shade, not mown lawn: darkest under the middle of each crown, and sunk out of
 // sight where a crown reaches over the garden.
 const floor=mergeGeometries(stand.map(([x,z,,r])=>{const disc=new T.RingGeometry(0,r+1,24,6).rotateX(-Math.PI/2).translate(x,0,z),p=disc.attributes.position,colors:number[]=[];
  for(let i=0;i<p.count;i++){const at:[number,number]=[p.getX(i),p.getZ(i)],garden=inside(at,plotOutline)||edgeDistance(at,plotOutline)<.7;
   p.setY(i,ground(at[0])-(garden?.5:.012));const t=Math.hypot(at[0]-x,at[1]-z)/(r+1);colors.push(...new T.Color('#1d2615').lerp(new T.Color('#33401f'),t).toArray());}
  disc.setAttribute('color',new T.Float32BufferAttribute(colors,3));disc.deleteAttribute('uv');return disc;}))!;
 floor.computeVertexNormals();
 const shade=new T.Mesh(floor,new T.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));shade.name='woodland-floor';shade.receiveShadow=true;understory.add(shade);
 // The woods further out, from their mapped outlines.
 vegetation.add(distantWoods(ground));
 // Distant terrain has sloping faces and atmospheric depth, not silhouette cards.
 group.add(alpineTerrain());
 // Meadow verges run beside the lane, clear of the cobbled inset and gates.
 const grassGeometry=new T.BufferGeometry();grassGeometry.setAttribute('position',new T.Float32BufferAttribute([-.028,0,0,.028,0,0,.014,.36,.08,-.028,0,0,.014,.36,.08,-.014,.36,.08,-.014,.36,.08,.014,.36,.08,0,.56,.19],3));grassGeometry.computeVertexNormals();
 const grassMat=new T.MeshStandardMaterial({color:'#778743',roughness:1,side:T.DoubleSide});const vergePoints:T.Vector2[]=[];
 for(let i=0;i<7500;i++){const side=i%2?-1:1,q=roadCenter.clone().addScaledVector(axis,-74+random()*150).addScaledVector(normal,side*(2.4+random()*1.65));if(side===1&&q.y>-11&&q.y<10)continue;vergePoints.push(q);}
 const verge=new T.InstancedMesh(grassGeometry,grassMat,vergePoints.length);verge.name='meadow-grass';verge.receiveShadow=true;
 vergePoints.forEach((q,i)=>{dummy.position.set(q.x,.006,q.y);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(1,.35+random()*.55,1);dummy.updateMatrix();verge.setMatrixAt(i,dummy.matrix);const shade=.75+random()*.4;verge.setColorAt(i,color.setRGB(shade,shade,shade*.85));});vegetation.add(verge);
 // Slender curved-neck lamps from the street references.
 const iron=new T.MeshStandardMaterial({color:'#394640',metalness:.45,roughness:.68});
 for(const along of [-28,13,47]){const q=roadCenter.clone().addScaledVector(axis,along).addScaledVector(normal,-2.65);const curve=new T.CatmullRomCurve3([new T.Vector3(q.x,0,q.y),new T.Vector3(q.x,3.5,q.y),new T.Vector3(q.x+.08,4.1,q.y),new T.Vector3(q.x+.58,4.28,q.y),new T.Vector3(q.x+.9,4.04,q.y)]);const pole=new T.Mesh(new T.TubeGeometry(curve,24,.035,7,false),iron);pole.castShadow=true;group.add(pole);const shade=new T.Mesh(new T.ConeGeometry(.24,.22,16,1,true),iron);shade.position.set(q.x+.9,3.94,q.y);group.add(shade);}
 return {group,vegetation};
}

/** The three garden-side hedges are part of the property in both detail settings. */
export function boundaryHedge(foliage?:ReturnType<typeof foliageMaterials>){
 // The lawn terminates in the low hedge visible from the upstairs window; the north hedge stands taller from the arrival
 // wall to abreast of the main house's north gable (TALL_HEDGE).
 const [a,b,c,d]=plotOutline.map(([x,y])=>({x,y})),t=(TALL_HEDGE.until-a.x)/(b.x-a.x),gable={x:TALL_HEDGE.until,y:a.y+(b.y-a.y)*t};
 const group=new T.Group();group.name='garden-hedges';
 group.add(buildHedge([[a,gable]],{width:1.25,height:TALL_HEDGE.height,inset:.62},foliage),buildHedge([[gable,b],[b,c],[c,d]],{width:1.25,height:1.35,inset:.62},foliage));
 return group;
}

const inside=([x,z]:[number,number],poly:readonly (readonly number[])[])=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
/** Distance from a point to the nearest edge of a polygon. */
const edgeDistance=([x,z]:[number,number],poly:readonly (readonly number[])[])=>{let d=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [ax,az]=poly[j],[bx,bz]=poly[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));d=Math.min(d,Math.hypot(x-ax-t*dx,z-az-t*dz));}return d;};
