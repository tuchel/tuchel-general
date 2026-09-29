import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {addShaderFeature} from './shader-features';

/** Trees as instanced archetypes: a bark skeleton plus a crown. Computers draw modelled
 * leaves; phones draw a solid shaded core under a shell of leaf cards cut from the
 * generated leaf atlas, which distant woodland uses everywhere. Every tree of one
 * archetype is a single draw. */
export type TreeKind='broadleaf'|'maple'|'pine';
export type TreeSpec={x:number;z:number;r:number;height:number;seed:number;kind:TreeKind;far?:boolean;base?:number};
const cells:Record<TreeKind|'hedge',[number,number]>={broadleaf:[0,1],maple:[1,1],pine:[0,0],hedge:[1,0]};
const REF_H=10,REF_R=3.5;
/** Crown style: modelled leaves shared per archetype (leaves) or a solid shaded core under a leaf-card shell (hybrid). */
export type TreeStyle='leaves'|'hybrid';
function random(seed:number){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

/** Materials start untextured so model code stays loadable in Node; textures arrive in finishFoliage. */
export function foliageMaterials(style:TreeStyle='leaves'){
 // Leaves are darker and less glossy than the lawn beneath them; the tint deepens the atlas greens.
 const leaves=new T.MeshStandardMaterial({color:'#c9d8b6',roughness:.82,envMapIntensity:.75,side:T.DoubleSide,alphaTest:.42,alphaToCoverage:true,vertexColors:true});
 leaves.userData.foliage='leaves';
 // Backlit leaves glow: sunlight passing through toward the viewer adds a warm green transmission.
 const translucency={key:'leaf-translucency',compile:(shader:T.WebGLProgramParametersWithUniforms)=>{
  const lights=T.ShaderChunk.lights_fragment_begin.replace(/RE_Direct\( directLight,/g,'reflectedLight.directDiffuse+=directLight.color*material.diffuseColor*vec3(.75,.95,.45)*(.42*pow(saturate(dot(-geometryViewDir,directLight.direction)),2.0)+.12*saturate(-dot(geometryNormal,directLight.direction)));\nRE_Direct( directLight,');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',lights);
 }};
 addShaderFeature(leaves,translucency);
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,alphaTest:.42,side:T.DoubleSide});
 const bark=new T.MeshStandardMaterial({color:'#ffffff',roughness:.95});bark.userData.foliage='bark';
 // Solid crown core (hybrid) and modelled leaves: colour lives in the vertices.
 const core=new T.MeshStandardMaterial({color:'#ffffff',roughness:.95,vertexColors:true});core.userData.photo='foliage';
 const solid=new T.MeshStandardMaterial({color:'#ffffff',roughness:.78,envMapIntensity:.8,side:T.DoubleSide,vertexColors:true});solid.userData.photo='foliage';addShaderFeature(solid,translucency);
 return {leaves,depth,bark,core,solid,style};
}
export type FoliageMaterials=ReturnType<typeof foliageMaterials>;

function card(center:T.Vector3,normal:T.Vector3,size:number,spin:number,cell:[number,number],flip:boolean,crown:T.Vector3,tint:T.Color,out:{p:number[];n:number[];uv:number[];c:number[]}){
 const up=Math.abs(normal.y)>.95?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
 const u=new T.Vector3().crossVectors(up,normal).normalize(),v=new T.Vector3().crossVectors(normal,u).normalize();
 u.applyAxisAngle(normal,spin);v.applyAxisAngle(normal,spin);
 // Radial normals light the crown as a soft volume instead of flat cards.
 const radial=center.clone().sub(crown).normalize(),shade=radial.clone().multiplyScalar(.75).addScaledVector(normal,.25).normalize();
 const corners=[[-1,-1],[1,-1],[1,1],[-1,1]],uv0=cell[0]*.5,v0=cell[1]*.5;
 const verts=corners.map(([a,b])=>center.clone().addScaledVector(u,a*size/2).addScaledVector(v,b*size/2));
 for(const i of [0,1,2,0,2,3]){
  const [a,b]=corners[i];out.p.push(...verts[i].toArray());out.n.push(...shade.toArray());
  out.uv.push(uv0+(flip?1-(a+1)/2:(a+1)/2)*.5,v0+(b+1)/2*.5);out.c.push(tint.r,tint.g,tint.b);
 }
}
function limb(a:T.Vector3,b:T.Vector3,r0:number,r1:number,segments:number){
 const g=new T.CylinderGeometry(r1,r0,a.distanceTo(b),segments,1,true);
 const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
 g.applyMatrix4(new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),q,new T.Vector3(1,1,1)));
 // Bark tiles every 0.6 m around and along the limb.
 const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.max(1,Math.round(r0*2*Math.PI/.6)),uv.getY(i)*a.distanceTo(b)/.6);
 return g;
}
/** One archetype at reference size (10 m tall, 3.5 m crown radius); instances scale it. */
function archetype(kind:TreeKind,far:boolean,seed:number,style:TreeStyle,context=false){
 const r=random(seed),H=REF_H,R=REF_R,crown=new T.Vector3(0,H-R*.95,0);
 const flat=kind==='pine'?.55:1,clusters:T.Vector3[]=[],wood:T.BufferGeometry[]=[];
 const trunkTop=new T.Vector3((r()-.5)*.3,H*.45,(r()-.5)*.3);
 wood.push(limb(new T.Vector3(0,-.3,0),trunkTop,.26,.19,far?6:9));
 const limbs=far?5:9;
 for(let i=0;i<limbs;i++){
  const a=i/limbs*Math.PI*2+r()*.6,up=.25+r()*.75;
  const tip=new T.Vector3(Math.cos(a)*R*(.55+r()*.35),crown.y+(up-.5)*R*1.2*flat,Math.sin(a)*R*(.55+r()*.35));
  const mid=trunkTop.clone().lerp(tip,.55).add(new T.Vector3(0,.4,0));
  wood.push(limb(trunkTop,mid,.13,.08,far?4:6),limb(mid,tip,.08,.03,far?3:5));
  clusters.push(tip,mid.clone().lerp(tip,.4));
 }
 for(let i=0;i<(far?8:26);i++){const th=r()*Math.PI*2,y=r()*1.8-.9,rad=Math.sqrt(1-y*y)*(.45+r()*.5);clusters.push(new T.Vector3(Math.cos(th)*rad*R,crown.y+y*R*.85*flat,Math.sin(th)*rad*R));}
 const out={p:[] as number[],n:[] as number[],uv:[] as number[],c:[] as number[]},cell=cells[kind];
 let core:T.BufferGeometry|undefined,solid:T.BufferGeometry|undefined;
 if(style==='hybrid'||far)core=hybridCrown(kind,far,r,clusters,crown,flat,cell,out);
 else solid=modelledLeaves(kind,context,r,clusters,crown,flat);
 let leaves:T.BufferGeometry|undefined;
 if(out.p.length){leaves=new T.BufferGeometry();
  leaves.setAttribute('position',new T.Float32BufferAttribute(out.p,3));leaves.setAttribute('normal',new T.Float32BufferAttribute(out.n,3));
  leaves.setAttribute('uv',new T.Float32BufferAttribute(out.uv,2));leaves.setAttribute('color',new T.Float32BufferAttribute(out.c,3));}
 const bark=mergeGeometries(wood.map(g=>g.toNonIndexed()));wood.forEach(g=>g.dispose());
 return {leaves,bark:bark!,core,solid};
}
const clamp01=(v:number)=>T.MathUtils.clamp(v,0,1);
/** Hybrid crown: overlapping lumpy blobs, shaded darker toward the underside and centre, carry the
 * crown's mass; leaf cards cover only their exposed outer surface for a leafy silhouette. */
function hybridCrown(kind:TreeKind,far:boolean,r:()=>number,clusters:T.Vector3[],crown:T.Vector3,flat:number,cell:[number,number],out:{p:number[];n:number[];uv:number[];c:number[]}){
 const R=REF_R,blobs=clusters.map(c=>({c,rad:R*(far?.36:.26)*(.8+r()*.4)})),parts:T.BufferGeometry[]=[];
 const green=new T.Color(kind==='pine'?'#34502a':kind==='maple'?'#56703a':'#4a6a2e');
 const shadeAt=(v:T.Vector3)=>(.5+.5*clamp01((v.y-(crown.y-R*.9*flat))/(R*1.8*flat)))*(.7+.3*clamp01(v.distanceTo(crown)/R));
 for(const b of blobs){
  const g=new T.IcosahedronGeometry(1,far?1:2),p=g.attributes.position,n=g.attributes.normal,colors:number[]=[],v=new T.Vector3(),u=new T.Vector3();
  for(let i=0;i<p.count;i++){
   u.fromBufferAttribute(p,i);const bump=1+.22*Math.sin(u.x*5+b.c.y*2)*Math.sin(u.y*4+b.c.x*2)*Math.sin(u.z*6+b.c.z*2);
   v.copy(u).multiplyScalar(b.rad*bump);v.y*=flat;v.add(b.c);p.setXYZ(i,v.x,v.y,v.z);
   const radial=v.clone().sub(crown).normalize(),normal=u.clone().multiplyScalar(.45).addScaledVector(radial,.55).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
   const c=green.clone().multiplyScalar(shadeAt(v));colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.deleteAttribute('uv');parts.push(g);
 }
 const count=far?480:kind==='pine'?2600:3200;
 for(let placed=0,guard=0;placed<count&&guard<count*30;guard++){
  const b=blobs[Math.floor(r()*blobs.length)],dir=new T.Vector3(r()*2-1,r()*2-1,r()*2-1);if(dir.lengthSq()<.02||dir.lengthSq()>1)continue;dir.normalize();
  const center=b.c.clone().addScaledVector(dir,b.rad*(.95+r()*.45));center.y=b.c.y+(center.y-b.c.y)*flat;
  // Cards buried inside a neighbouring blob would never be seen.
  if(blobs.some(o=>o!==b&&o.c.distanceTo(center)<o.rad*.82))continue;
  const outward=center.clone().sub(crown).normalize(),normal=dir.clone().multiplyScalar(.5).addScaledVector(outward,.25).add(new T.Vector3(r()-.5,r()-.5,r()-.5).multiplyScalar(.7)).normalize();
  const shade=(.7+r()*.35)*(.55+.45*shadeAt(center)),tint=new T.Color(shade,shade*(.96+r()*.08),shade*(.84+r()*.12));
  card(center,normal,(far?1.9:.6)*(.8+r()*.45),r()*Math.PI*2,cell,r()<.5,crown,tint,out);placed++;
 }
 const merged=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return merged;
}
/** Modelled leaves: a folded four-triangle blade repeated around branch-tip clusters, one geometry per archetype. */
function modelledLeaves(kind:TreeKind,context:boolean,r:()=>number,clusters:T.Vector3[],crown:T.Vector3,flat:number){
 const R=REF_R,blade=[[0,0,0],[-.34,.05,.42],[0,.1,.5],[0,0,1],[.34,.05,.42]],tris=[0,1,2,1,3,2,0,2,4,2,3,4];
 const count=context?(kind==='pine'?11000:10000):(kind==='pine'?16000:14000),scale=context?1.45:1;
 const pos=new Float32Array(count*36),nor=new Float32Array(count*36),col=new Float32Array(count*36);
 const green=new T.Color(kind==='pine'?'#435a3d':kind==='maple'?'#7a8742':'#718144');
 const m=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),up=new T.Vector3(0,1,0),spin=new T.Quaternion();
 for(let i=0;i<count;i++){
  const c=clusters[i%clusters.length],spread=R*.34,th=r()*Math.PI*2,y=r()*2-1,rad=Math.sqrt(1-y*y)*Math.cbrt(r());
  const center=new T.Vector3(c.x+Math.cos(th)*rad*spread,c.y+y*spread*.9*flat,c.z+Math.sin(th)*rad*spread);
  const outward=center.clone().sub(crown).normalize(),normal=outward.clone().multiplyScalar(.6).add(new T.Vector3(r()-.5,r()-.5,r()-.5).multiplyScalar(.9)).normalize();
  q.setFromUnitVectors(up,normal);spin.setFromAxisAngle(normal,r()*Math.PI*2);q.premultiply(spin);
  const size=(.1+r()*.1)*scale;m.compose(center,q,kind==='pine'?new T.Vector3(size*.3,size,size*1.7):new T.Vector3(size,size,size));
  const shade=(.62+r()*.5)*(.35+.65*clamp01((center.y-(crown.y-R*.9*flat))/(R*1.8*flat)))*(.6+.4*clamp01(center.distanceTo(crown)/R));
  const tint=green.clone().multiplyScalar(shade);tint.g*=.97+r()*.08;tint.b*=.8+r()*.2;
  const shading=normal.clone().multiplyScalar(.5).addScaledVector(outward,.5).normalize();
  tris.forEach((k,j)=>{v.fromArray(blade[k]).applyMatrix4(m);const o=i*36+j*3;pos[o]=v.x;pos[o+1]=v.y;pos[o+2]=v.z;nor[o]=shading.x;nor[o+1]=shading.y;nor[o+2]=shading.z;col[o]=tint.r;col[o+1]=tint.g;col[o+2]=tint.b;});
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('normal',new T.BufferAttribute(nor,3));g.setAttribute('color',new T.BufferAttribute(col,3));return g;
}

/** Instances trees by archetype. Returns a group with one leaf and one bark draw per archetype. */
export function buildTrees(specs:TreeSpec[],materials:FoliageMaterials,name:string){
 const group=new T.Group();group.name=name;
 const context=name!=='garden-trees';
 const byKey=new Map<string,TreeSpec[]>();
 for(const s of specs){const key=`${s.kind}-${s.far?'far':'near'}-${s.seed%3}`;(byKey.get(key)??byKey.set(key,[]).get(key)!).push(s);}
 const m=new T.Matrix4(),q=new T.Quaternion(),color=new T.Color();
 for(const [key,list] of byKey){
  const [kind,detail,variant]=key.split('-') as [TreeKind,string,string];
  const arch=archetype(kind,detail==='far',9173+Number(variant)*7919+kind.length*31,materials.style,context);
  const bark=new T.InstancedMesh(arch.bark,materials.bark,list.length);bark.name='tree-bark';
  const crowns:T.InstancedMesh[]=[];
  if(arch.leaves){const leaves=new T.InstancedMesh(arch.leaves,materials.leaves,list.length);leaves.name='tree-leaf-cards';leaves.customDepthMaterial=materials.depth;crowns.push(leaves);}
  if(arch.core){const core=new T.InstancedMesh(arch.core,materials.core,list.length);core.name='tree-crown-core';crowns.push(core);}
  if(arch.solid){const solid=new T.InstancedMesh(arch.solid,materials.solid,list.length);solid.name='tree-leaves';crowns.push(solid);}
  for(const c of crowns)c.userData.sway='leaf';
  list.forEach((s,i)=>{
   const r=random(s.seed);
   q.setFromAxisAngle(new T.Vector3(0,1,0),r()*Math.PI*2);
   m.compose(new T.Vector3(s.x,s.base??0,s.z),q,new T.Vector3(s.r/REF_R,s.height/REF_H,s.r/REF_R));
   bark.setMatrixAt(i,m);
   const hue=kind==='pine'?.9:.85+r()*.3;color.setRGB(hue,hue*(.97+r()*.06),hue*(.85+r()*.2));
   for(const c of crowns){c.setMatrixAt(i,m);c.setColorAt(i,color);}
  });
  for(const mesh of [...crowns,bark]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);}
 }
 return group;
}

/** A clipped garden hedge: a solid, gently lumpy body, with leaf cards in the detailed model. */
export function buildHedge(runs:[T.Vector2Like,T.Vector2Like][],options:{width:number;height:number;inset:number},materials?:FoliageMaterials){
 const group=new T.Group();group.name='three-sided-garden-boundary-hedge';
 const r=random(386),bodies:T.BufferGeometry[]=[],out={p:[] as number[],n:[] as number[],uv:[] as number[],c:[] as number[]};
 const {width:w,height:h,inset}=options,profile:[number,number][]=[];
 for(let i=0;i<=12;i++){const a=i/12*Math.PI;profile.push([Math.cos(a)*w/2*(i===0||i===12?1:1.02),i===0||i===12?0:h-(1-Math.sin(a))*.32]);}
 for(const [a,b] of runs){
  const dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz),tx=dx/len,tz=dz/len,nx=-tz,nz=tx;
  const steps=Math.ceil(len/.45),pos:number[]=[],idx:number[]=[];
  for(let s=0;s<=steps;s++){
   const t=s/steps,cx=a.x+dx*t-tz*inset,cz=a.y+dz*t+tx*inset;
   for(const [px,py] of profile){
    const bulge=1+.06*Math.sin(t*len*1.7+py*3)+.05*Math.sin(t*len*4.1+px*5)*(py>0?1:0);
    pos.push(cx+nx*px*bulge,py*(py>0?1+.03*Math.sin(t*len*2.3):1),cz+nz*px*bulge);
   }
  }
  const k=profile.length;
  for(let s=0;s<steps;s++)for(let i=0;i<k-1;i++){const a0=s*k+i,a1=a0+1,b0=a0+k,b1=b0+1;idx.push(a0,b0,a1,a1,b0,b1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();bodies.push(g.toNonIndexed());g.dispose();
  if(materials){
   const count=Math.round(len*(w+h*2)*4.2);
   for(let i=0;i<count;i++){
    const t=r(),side=r(),[px,py]=profile[Math.min(k-1,Math.floor(side*k))],cx=a.x+dx*t-tz*inset,cz=a.y+dz*t+tx*inset;
    const center=new T.Vector3(cx+nx*px*1.04,Math.max(.2,py*1.01),cz+nz*px*1.04),axis=new T.Vector3(cx,h*.45,cz);
    const normal=center.clone().sub(axis).normalize().add(new T.Vector3(r()-.5,r()-.5,r()-.5).multiplyScalar(.7)).normalize();
    const shade=.62+r()*.3;card(center,normal,.7+r()*.35,r()*Math.PI*2,cells.hedge,r()<.5,axis,new T.Color(shade,shade,shade*.9),out);
   }
  }
 }
 const bodyMaterial=new T.MeshStandardMaterial({color:'#526a3c',roughness:1});bodyMaterial.userData.hedgeBody=true;
 const body=new T.Mesh(mergeGeometries(bodies)!,bodyMaterial);body.name='hedge-body';body.castShadow=true;body.receiveShadow=true;group.add(body);
 bodies.forEach(g=>g.dispose());
 if(materials&&out.p.length){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(out.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(out.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(out.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(out.c,3));
  const shell=new T.Mesh(g,materials.leaves);shell.name='hedge-leaf-cards';shell.castShadow=true;shell.receiveShadow=true;shell.customDepthMaterial=materials.depth;group.add(shell);
  bodyMaterial.color.set('#243a1b');
 }
 return group;
}

/** Applies the leaf atlas and bark set once textures exist. */
export function finishFoliage(root:T.Object3D,leaf:{color:T.Texture;normal:T.Texture},bark:{color:T.Texture;normal:T.Texture}){
 const done=new Set<T.Material>();
 root.traverse(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh)return;
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(done.has(m))continue;done.add(m);
   if(m.userData.foliage==='leaves'&&m instanceof T.MeshStandardMaterial){m.map=leaf.color;m.normalMap=leaf.normal;m.normalScale.set(.6,.6);m.needsUpdate=true;}
   if(m.userData.foliage==='bark'&&m instanceof T.MeshStandardMaterial){m.map=bark.color;m.normalMap=bark.normal;m.needsUpdate=true;}
  }
  if(mesh.customDepthMaterial instanceof T.MeshDepthMaterial&&!done.has(mesh.customDepthMaterial)){done.add(mesh.customDepthMaterial);mesh.customDepthMaterial.map=leaf.color;mesh.customDepthMaterial.needsUpdate=true;}
 });
}
