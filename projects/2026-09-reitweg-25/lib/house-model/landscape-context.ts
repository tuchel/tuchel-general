import * as T from 'three';
import {plotOutline,sitePoint as s} from './site-data';
import {alpineTerrain} from './alpine-terrain';
import {detailedTree} from './realism-details';

/** Photo-led context, not surveyed terrain or a geographic mountain model.
 * Near vegetation has real depth; compressed distant ridges reproduce the quiet
 * apparent scale of the owner's east-window photographs. No lake surface is inferred. */
export function landscapeContext(){
 const group=new T.Group();group.name='photo-led-landscape-setting';
 const vegetation=new T.Group();vegetation.name='setting-trees-and-hedges';group.add(vegetation);
 let seed=7142;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const bark=new T.MeshStandardMaterial({color:'#5c5948',roughness:1});
 const dummy=new T.Object3D(),color=new T.Color();
 const branch=(parent:T.Group,a:T.Vector3,b:T.Vector3,r:number)=>{const mesh=new T.Mesh(new T.CylinderGeometry(r*.6,r,a.distanceTo(b),8),bark);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.castShadow=true;parent.add(mesh);};
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
  branch(avenue,new T.Vector3(q.x,0,q.y),new T.Vector3(q.x-side*.55,h*.63,q.y),.34+random()*.12);
  for(let k=0;k<3;k++)branch(avenue,new T.Vector3(q.x,h*.32,q.y),new T.Vector3(q.x-side*(1.3+k*.7),h*(.64+k*.07),q.y+(k-1)*2),.17);
  detailedTree(avenue,q.x-side*.6,q.y,r,h,11003+i*359,{count:4200,scale:2.3});
 }
 // Park-edge woodland is dense at the sides, opening toward the distant view.
 const trees:{x:number;z:number;h:number;r:number;base:number;conifer:boolean}[]=[];
 for(let i=0;i<88;i++){
  const x=65+random()*70,z=-80+random()*150;
  if(z>-17&&z<24&&random()<.79)continue;
  const central=z>-17&&z<24;
  trees.push({x,z,h:central?5+random()*5:9+random()*8,r:central?1.5+random():2.5+random()*2,base:-Math.min(5,(x-55)*.065),conifer:random()<.3});
 }
 // A layered tree belt beyond the hedge, with a narrow gap for the distant outlook.
 for(let i=0;i<54;i++){const z=-52+i*2.2;if(z>3&&z<12)continue;const x=79+random()*15;trees.push({x,z,h:8+random()*6,r:2.9+random()*1.9,base:-2,conifer:false});if(i%2===0)trees.push({x:x-3,z:z+1,h:4.5+random()*2,r:2.5+random(),base:-1.3,conifer:false});}
 // A looser wooded edge outside the west/north garden, never a uniform circular ring.
 for(let i=0;i<38;i++){const along=-63+random()*126,q=roadCenter.clone().addScaledVector(axis,along).addScaledVector(normal,-(11+random()*17));trees.push({x:q.x,z:q.y,h:8+random()*9,r:2.5+random()*2.5,base:0,conifer:false});}
 // Continue the wooded lane into depth so its setting does not end at the lot.
 for(let i=0;i<65;i++){const along=76+random()*92,side=i%2?-1:1,q=roadCenter.clone().addScaledVector(axis,along).addScaledVector(normal,side*(5+random()*22));trees.push({x:q.x,z:q.y,h:10+random()*10,r:3+random()*3,base:0,conifer:false});}
 const woodland=new T.Group();woodland.name='layered-park-woodland';vegetation.add(woodland);
 trees.forEach((tree,i)=>{const g=new T.Group();g.position.y=tree.base;woodland.add(g);branch(g,new T.Vector3(tree.x,0,tree.z),new T.Vector3(tree.x,tree.h*.75,tree.z),.15);detailedTree(g,tree.x,tree.z,tree.r,tree.h,17013+i*31,{count:1500,scale:2.5});});
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
export function boundaryHedge(){
 let seed=386;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const unit=new T.IcosahedronGeometry(1,2),crownMat=new T.MeshStandardMaterial({color:'#526a3c',roughness:1}),dummy=new T.Object3D(),color=new T.Color();
 crownMat.userData.photo='foliage';
 // The lawn terminates in the low hedge visible from the upstairs window.
 const hedgeRuns=[[plotOutline[0],plotOutline[1]],[plotOutline[1],plotOutline[2]],[plotOutline[2],plotOutline[3]]];
 const hedgePositions: T.Vector3[]=[];
 for(const [a,b] of hedgeRuns){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length/.24);const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;for(let i=0;i<=count;i++){const t=i/count;hedgePositions.push(new T.Vector3(T.MathUtils.lerp(a[0],b[0],t)-dz*.62,.67,T.MathUtils.lerp(a[1],b[1],t)+dx*.62));}}
 const hedge=new T.InstancedMesh(unit,crownMat,hedgePositions.length);hedge.name='three-sided-garden-boundary-hedge';hedge.castShadow=true;hedge.receiveShadow=true;
 hedgePositions.forEach((q,i)=>{dummy.position.copy(q);dummy.position.x+=(random()-.5)*.25;dummy.position.z+=(random()-.5)*.25;dummy.scale.set(.55+random()*.17,.62+random()*.18,.53+random()*.18);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();hedge.setMatrixAt(i,dummy.matrix);const shade=.78+random()*.3;hedge.setColorAt(i,color.setRGB(shade,shade,shade*.92));});return hedge;
}
