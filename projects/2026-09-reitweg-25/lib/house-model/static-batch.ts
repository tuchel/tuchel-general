import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Merges static meshes into one draw per material and visibility pattern.
 * Every model state (floor × renovation combination) is enumerated once. Meshes
 * that are shown in exactly the same states, with the same world transform in
 * each, share a batch. Source meshes stay in the graph for logic and checks but
 * leave render layer 0, so neither the camera, the shadow map nor picking sees them. */
export type StaticModel={
 root:T.Object3D;
 states:number;
 apply:(state:number)=>void;
 rendered:(mesh:T.Mesh)=>boolean;
 /** Groups toggled outside the enumerated states; batches are parented to them. */
 externalRoots?:T.Object3D[];
};
export type StaticBatches={meshes:T.Mesh[];sync:(state:number)=>void;sourceCount:number};

const words=(states:number)=>Math.ceil(states/32);
function sameMatrix(a:T.Matrix4,b:T.Matrix4){
 for(let i=0;i<16;i++)if(Math.abs(a.elements[i]-b.elements[i])>1e-6)return false;
 return true;
}
function eligible(o:T.Object3D):o is T.Mesh{
 return o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!o.userData.dynamic&&o.layers.isEnabled(0)&&!!o.geometry.attributes.position;
}
function needsUV(m:T.Material){
 const s=m as T.MeshStandardMaterial;
 return !!(s.map||s.alphaMap||s.normalMap||s.roughnessMap||s.bumpMap||s.aoMap);
}
function prepared(source:T.BufferGeometry,matrix:T.Matrix4,uv:boolean,colors:boolean,group?:{start:number;count:number}){
 let g=source.index?source.toNonIndexed():source.clone();
 if(group){
  const part=new T.BufferGeometry();
  for(const [name,a] of Object.entries(g.attributes))part.setAttribute(name,new T.BufferAttribute((a.array as Float32Array).slice(group.start*a.itemSize,(group.start+group.count)*a.itemSize),a.itemSize,a.normalized));
  g.dispose();g=part;
 }
 for(const name of Object.keys(g.attributes))if(!['position','normal',...(uv?['uv']:[]),...(colors?['color']:[])].includes(name))g.deleteAttribute(name);
 if(!g.attributes.normal)g.computeVertexNormals();
 if(uv&&!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
 if(colors&&!g.attributes.color)g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));
 g.clearGroups();
 g.applyMatrix4(matrix);
 // A mirrored transform flips winding; restore front faces for single-sided materials.
 if(matrix.determinant()<0){const p=g.attributes.position.array as Float32Array;for(let i=0;i<p.length;i+=9)for(let k=0;k<3;k++){const t=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=t;}g.computeVertexNormals();}
 return g;
}

export function batchStatic(model:StaticModel):StaticBatches{
 const {root,states}=model,external=new Set(model.externalRoots||[]);
 const meshes:T.Mesh[]=[];root.traverse(o=>{if(eligible(o))meshes.push(o);});
 const variants=meshes.map(()=>[] as T.Matrix4[]),seen=meshes.map(()=>new Uint8Array(states).fill(255));
 for(let s=0;s<states;s++){
  model.apply(s);root.updateMatrixWorld(true);
  meshes.forEach((mesh,i)=>{
   if(!model.rendered(mesh))return;
   const list=variants[i];let v=list.findIndex(m=>sameMatrix(m,mesh.matrixWorld));
   if(v<0){v=list.length;list.push(mesh.matrixWorld.clone());}
   seen[i][s]=v;
  });
 }
 type Item={geometry:T.BufferGeometry;matrix:T.Matrix4;group?:{start:number;count:number}};
 const buckets=new Map<string,{items:Item[];material:T.Material;signature:Uint32Array;mesh:T.Mesh;parent:T.Object3D}>();
 meshes.forEach((mesh,i)=>{
  let parent:T.Object3D=root;for(let o=mesh.parent;o;o=o.parent)if(external.has(o)){parent=o;break;}
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const parts=Array.isArray(mesh.material)&&mesh.geometry.groups.length?mesh.geometry.groups.map(g=>({material:materials[g.materialIndex??0],group:{start:g.start,count:g.count}})):[{material:materials[0],group:undefined}];
  variants[i].forEach((matrix,v)=>{
   const signature=new Uint32Array(words(states));
   for(let s=0;s<states;s++)if(seen[i][s]===v)signature[s>>5]|=1<<(s&31);
   for(const part of parts){
    if(!part.material)continue;
    const key=[signature.join(','),part.material.uuid,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.userData.region||'',!!mesh.userData.passable,parent.uuid].join('|');
    let bucket=buckets.get(key);
    if(!bucket){bucket={items:[],material:part.material,signature,mesh,parent};buckets.set(key,bucket);}
    // Group ranges count indices (or vertices); after expansion both address the same triangles.
    bucket.items.push({geometry:mesh.geometry,matrix,group:part.group});
   }
  });
 });
 const batches:T.Mesh[]=[];
 for(const {items,material,signature,mesh,parent} of buckets.values()){
  const uv=needsUV(material),colors=!!(material as T.MeshStandardMaterial).vertexColors;
  const geometries=items.map(it=>prepared(it.geometry,it.matrix,uv,colors,it.group));
  const merged=geometries.length===1?geometries[0]:mergeGeometries(geometries,false);
  if(geometries.length>1)geometries.forEach(g=>g.dispose());
  if(!merged)continue;
  merged.computeBoundingSphere();merged.computeBoundingBox();
  const batch=new T.Mesh(merged,material);
  batch.name='batch-'+(mesh.userData.region||'static')+'-'+batches.length;
  batch.castShadow=mesh.castShadow;batch.receiveShadow=mesh.receiveShadow;batch.renderOrder=mesh.renderOrder;
  batch.userData={region:mesh.userData.region,signature,batch:true,passable:!!mesh.userData.passable};
  batch.matrixAutoUpdate=false;
  if(parent!==root){parent.updateMatrixWorld(true);batch.applyMatrix4(parent.matrixWorld.clone().invert());batch.updateMatrix();}
  parent.add(batch);batches.push(batch);
 }
 for(const mesh of meshes)mesh.layers.disableAll();
 const sync=(state:number)=>{for(const b of batches){const sig=b.userData.signature as Uint32Array;b.visible=!!(sig[state>>5]&(1<<(state&31)));}};
 return {meshes:batches,sync,sourceCount:meshes.length};
}
