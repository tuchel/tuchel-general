import * as T from 'three';
import {plotOutline,sitePoint as s,NORTH_TREES,EAST_TREES,GABLE_HEDGE} from './site-data';
import {alpineTerrain} from './alpine-terrain';
import {buildTrees,buildHedge,foliageMaterials,type TreeSpec} from './foliage';

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
 const traced=(list:typeof NORTH_TREES,name:string,seed:number)=>{const group=new T.Group();group.name=name;vegetation.add(group);
  group.add(buildTrees(list.map(([x,z,height,r,kind],i)=>({x,z,r,height,kind,seed:seed+i*577,base:-5*T.MathUtils.smoothstep(x,55,140),far:Math.hypot(x,z)>60})),foliage,name));};
 traced(NORTH_TREES,'north-neighbor-trees',23011);traced(EAST_TREES,'east-trees',31013);
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
 // The lawn terminates in the low hedge visible from the upstairs window; a tall hedge runs along the main house's north
 // gable (GABLE_HEDGE).
 const runs=[[plotOutline[0],plotOutline[1]],[plotOutline[1],plotOutline[2]],[plotOutline[2],plotOutline[3]]].map(([a,b])=>[{x:a[0],y:a[1]},{x:b[0],y:b[1]}] as [T.Vector2Like,T.Vector2Like]);
 const group=new T.Group(),{from,to,z,height,width}=GABLE_HEDGE;group.name='garden-hedges';
 group.add(buildHedge(runs,{width:1.25,height:1.35,inset:.62},foliage),buildHedge([[{x:from,y:z},{x:to,y:z}]],{width,height,inset:0},foliage));
 return group;
}
