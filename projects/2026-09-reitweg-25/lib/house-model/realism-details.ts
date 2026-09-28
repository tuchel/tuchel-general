import * as T from 'three';
import type {Skylight} from './roof-openings';

/** Detail remains subordinate to the plan-derived envelope: no room or opening changes. */
export function tiledRoof(parent:T.Group,half:number,length:number,eave:number,ridge:number,base:T.MeshStandardMaterial,windows:Skylight[]=[]){
 const rise=ridge-eave,span=Math.hypot(half,rise),angle=Math.atan2(rise,half);
 const rows=Math.ceil(span/.29),columns=Math.ceil(length/.25),step=span/rows,pitch=length/columns;
 const geometry=new T.BoxGeometry(step+.014,.017,pitch-.004),material=base.clone();
 material.roughness=.67;material.userData={...base.userData};
 const tiles=new T.InstancedMesh(geometry,material,rows*columns*2),dummy=new T.Object3D(),colour=new T.Color();
 tiles.name='individual-roof-tiles';tiles.castShadow=true;tiles.receiveShadow=true;
 let k=0;
 for(const side of [-1,1])for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const distance=(row+.5)*step,z=-length/2+(col+.5)*pitch;if(windows.some(w=>w.side===side&&Math.abs(distance-w.fraction*span)<.575+step/2&&Math.abs(z-w.z)<.7+pitch/2))continue;
  dummy.position.set(side*distance*Math.cos(angle),ridge-distance*Math.sin(angle)+.088,-length/2+(col+.5)*pitch);
  dummy.rotation.set(0,0,-side*angle);dummy.updateMatrix();tiles.setMatrixAt(k,dummy.matrix);
  const shade=.87+((row*37+col*19)%23)/100;colour.setRGB(shade,shade,shade);tiles.setColorAt(k++,colour);
 }
 tiles.count=k;parent.add(tiles);
 // Half-round gutters follow the existing eaves. Small brackets retain their rhythm.
 const metal=new T.MeshStandardMaterial({color:'#454b4b',metalness:.65,roughness:.43});
 for(const side of [-1,1]){
  const gutter=new T.Mesh(new T.CylinderGeometry(.09,.09,length,12,1,true,0,Math.PI),metal);
  gutter.rotation.x=Math.PI/2;gutter.position.set(side*(half+.025),eave-.09,0);gutter.castShadow=true;parent.add(gutter);
 }
 // Downpipes and their clips, aligned to the same eave coordinates.
 for(const side of [-1,1])for(const z of [-length/2+.24,length/2-.24]){
  const pipe=new T.Mesh(new T.CylinderGeometry(.042,.042,eave-.2,12),metal);pipe.position.set(side*(half-.1),(eave-.2)/2+.12,z);pipe.castShadow=true;parent.add(pipe);
  for(const y of [.55,1.7,2.5]){const clip=new T.Mesh(new T.TorusGeometry(.05,.012,5,12),metal);clip.rotation.x=Math.PI/2;clip.position.set(side*(half-.1),y,z);parent.add(clip);}
 }
 return material;
}

/** Individual folded leaves, deterministic branching and open silhouettes; no billboard crowns. */
export function detailedTree(parent:T.Group,x:number,z:number,r:number,height:number,seed:number,detail?:{count:number;scale:number}){
 let state=seed;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 const pine=[171,1098,2025,4806,5733].includes(seed);
 const vertices:number[]=[],uv:number[]=[];
 const shape=[[0,0,0],[-.3,.04,.2],[-.46,.075,.48],[-.3,.055,.78],[0,0,1],[.3,.055,.78],[.46,.075,.48],[.3,.04,.2]];
 for(let i=0;i<8;i++){for(const point of [[0,.11,.5],shape[i],shape[(i+1)%8]]){vertices.push(...point);uv.push(point[0]+.5,point[2]);}}
 const leafGeo=new T.BufferGeometry();leafGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));leafGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));leafGeo.computeVertexNormals();
 const leafMat=new T.MeshStandardMaterial({color:pine?'#435a3d':'#718144',roughness:.83,side:T.DoubleSide});
 const count=detail?.count??Math.round(4500*r),leaves=new T.InstancedMesh(leafGeo,leafMat,count),dummy=new T.Object3D();
 leaves.name='individual-tree-leaves';leaves.castShadow=true;leaves.receiveShadow=true;
 const branches=new T.InstancedMesh(new T.CylinderGeometry(1,1.6,1,7),new T.MeshStandardMaterial({color:'#655b48',roughness:1}),80);
 branches.castShadow=true;branches.receiveShadow=true;branches.name='tree-branch-network';
 const clusters:T.Vector3[]=[];
 for(let i=0;i<40;i++){
  const theta=random()*Math.PI*2,v=random()*1.8-1,radial=Math.sqrt(1-v*v)*(.45+random()*.45);
  const tip=new T.Vector3(x+Math.cos(theta)*radial*r,height-r*.28+v*r*(pine?.22:.65),z+Math.sin(theta)*radial*r*.9);
  const start=new T.Vector3(x,height*.48,z),fork=start.clone().lerp(tip,.66);clusters.push(tip);
  for(const [j,a,b] of [[i*2,start,fork],[i*2+1,fork,tip]] as [number,T.Vector3,T.Vector3][]){
   dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());dummy.scale.set(j%2?.015:.029,a.distanceTo(b),j%2?.015:.029);dummy.updateMatrix();branches.setMatrixAt(j,dummy.matrix);
  }
 }
 for(let i=0;i<count;i++){
  const center=clusters[i%clusters.length],a=random()*Math.PI*2,v=random()*2-1,radial=Math.sqrt(1-v*v)*Math.cbrt(random()),spread=r*.34;
  dummy.position.set(center.x+Math.cos(a)*radial*spread,center.y+v*spread*.9,center.z+Math.sin(a)*radial*spread);
  const size=(.09+random()*.09)*(detail?.scale??1);dummy.scale.set(pine?size*.35:size,size,pine?size*1.8:size);dummy.rotation.set(random()*Math.PI,random()*Math.PI*2,random()*Math.PI);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  const shade=.65+random()*.55;leaves.setColorAt(i,new T.Color().setRGB(shade,shade*(.97+random()*.1),shade*(.75+random()*.15)));
 }
 parent.add(branches,leaves);
}

export function finishRealisticMaterials(root:T.Object3D){
 const materials=new Set<T.MeshStandardMaterial>();
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial)materials.add(m);});
 for(const m of materials){
  if(m.userData.photo==='cladding')m.color.set('#67503d');
  if(m.userData.photo==='roof')m.color.set('#454744');
  if(m.userData.photo==='lawn')m.color.set('#7e914d');
  if(m.userData.photo==='stone')m.roughness=.68;
  if(m.userData.photo==='oak')m.roughness=.52;
  if(m instanceof T.MeshPhysicalMaterial&&m.transparent&&m.opacity<.7){m.color.set('#eef5f1');m.opacity=1;m.transmission=.86;m.ior=1.5;m.thickness=.035;m.roughness=.055;m.metalness=0;m.depthWrite=true;m.transparent=false;m.envMapIntensity=1.1;}
 }
 return [...materials];
}

/** Physical-scale material relief complements the photo colour, without baking light into it. */
export function microSurfaces(materials:T.MeshStandardMaterial[],time={value:0}){
 for(const m of materials){
  const kind=m.userData.photo;
  if(!['cladding','oak','linen','lawn','roof'].includes(kind)&&m.color.getHexString()!=='76abae')continue;
  const isWater=m.color.getHexString()==='76abae';
  if(isWater){m.userData.water=true;m.roughness=.2;m.metalness=.22;m.color.set('#478d91');}
  const previous=m.onBeforeCompile,previousKey=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
   previous.call(m,shader,renderer);shader.uniforms.uWaterTime=time;
   shader.vertexShader='varying vec3 vDetailLocal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDetailLocal=position;');
   // Photo shader supplies world coordinates for tiled surfaces; water has a separate varying.
   const coords=isWater?'vDetailLocal.xz*16.0':'surfaceUV()*uPhotoMetres';
   shader.fragmentShader='uniform float uWaterTime;varying vec3 vDetailLocal;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    vec2 detailUV=${coords};
    float relief=0.0;
    ${kind==='cladding'?`float board=fract(detailUV.x/.18);float seam=1.0-smoothstep(.009,.025,min(board,1.0-board));diffuseColor.rgb*=1.0-seam*.5;relief=-seam*.009;roughnessFactor=.72+seam*.2;`:''}
    ${kind==='oak'?`float grain=sin(detailUV.x*380.0+sin(detailUV.y*2.0)*3.0);relief=grain*.0003;roughnessFactor=.47+grain*.035;`:''}
    ${kind==='linen'?`relief=sin(detailUV.x*1800.0)*sin(detailUV.y*1800.0)*.00015;roughnessFactor=.96;`:''}
    ${kind==='lawn'?`float mottling=sin(detailUV.x*2.3)*sin(detailUV.y*1.7);diffuseColor.rgb*=.92+mottling*.09;relief=mottling*.012;`:''}
    ${kind==='roof'?`relief=sin(detailUV.x*520.0)*sin(detailUV.y*500.0)*.00015;`:''}
    ${isWater?`relief=sin(detailUV.x*6.1+detailUV.y*2.7+uWaterTime*.7)*.003+sin(detailUV.y*9.0-detailUV.x*3.7-uWaterTime*.45+sin(detailUV.x*2.0))*.002;`:''}
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 dq0=dFdx(-vViewPosition),dq1=dFdy(-vViewPosition);
    vec3 dr0=cross(dq1,normal),dr1=cross(normal,dq0);
    float dd=dot(dq0,dr0);
    normal=normalize(abs(dd)*normal-sign(dd)*(dFdx(relief)*dr0+dFdy(relief)*dr1));
   `);
  };
  m.customProgramCacheKey=()=>previousKey+'-detail-v1-'+kind+'-'+isWater;
 }
}
