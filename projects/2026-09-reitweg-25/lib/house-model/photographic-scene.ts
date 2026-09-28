import * as T from 'three';
import {photoSurfaces,type PhotoSurface} from './photo-sources';
import type {Mood} from './experience-data';

/** Rectify source quads into ordinary PBR maps so ray tracing and GLB export
 * use the same photographs as the live shader, without depending on shader injection. */
async function photoMaps(){
 const maps=new Map<PhotoSurface,{color:T.DataTexture;rough:T.DataTexture;normal:T.DataTexture}>();
 await Promise.all(Object.entries(photoSurfaces).map(async([key,s])=>{
  const image=await new T.ImageLoader().loadAsync('/assets/'+s.file);
  const canvas=document.createElement('canvas');canvas.width=s.size[0];canvas.height=s.size[1];const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const src=ctx.getImageData(0,0,canvas.width,canvas.height).data,n=256,colour=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4);const means=[0,0,0];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const u=x/(n-1),v=1-y/(n-1),top=s.quad[0].map((a,i)=>a+(s.quad[1][i]-a)*u),bottom=s.quad[3].map((a,i)=>a+(s.quad[2][i]-a)*u),sx=Math.round(top[0]+(bottom[0]-top[0])*v),sy=Math.round(top[1]+(bottom[1]-top[1])*v),i=(y*n+x)*4,j=(Math.min(canvas.height-1,sy)*canvas.width+Math.min(canvas.width-1,sx))*4;
   for(let c=0;c<3;c++){colour[i+c]=src[j+c];means[c]+=src[j+c];}colour[i+3]=255;
  }
  for(let i=0;i<n*n;i++){const luminance=(colour[i*4]+colour[i*4+1]+colour[i*4+2])/3;for(let c=0;c<3;c++){const relative=colour[i*4+c]/Math.max(1,means[c]/(n*n));colour[i*4+c]=Math.round(255*Math.min(1,Math.max(.4,.76+(relative-1)*.3)));rough[i*4+c]=Math.round(210+luminance*.12);}rough[i*4+3]=255;}
  const tex=new T.DataTexture(colour,n,n);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.MirroredRepeatWrapping;tex.magFilter=tex.minFilter=T.LinearFilter;tex.needsUpdate=true;
  const r=new T.DataTexture(rough,n,n);r.wrapS=r.wrapT=T.MirroredRepeatWrapping;r.magFilter=r.minFilter=T.LinearFilter;r.needsUpdate=true;const normalData=new Uint8Array(n*n*4),height=(x:number,y:number)=>{const i=((y+n)%n*n+(x+n)%n)*4;return (colour[i]+colour[i+1]+colour[i+2])/(3*255);};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const nx=(height(x-1,y)-height(x+1,y))*s.bump*n/s.metres[0],ny=(height(x,y-1)-height(x,y+1))*s.bump*n/s.metres[1],vector=new T.Vector3(nx,ny,1).normalize(),i=(y*n+x)*4;normalData[i]=Math.round((vector.x*.5+.5)*255);normalData[i+1]=Math.round((vector.y*.5+.5)*255);normalData[i+2]=Math.round((vector.z*.5+.5)*255);normalData[i+3]=255;}
  const normal=new T.DataTexture(normalData,n,n);normal.wrapS=normal.wrapT=T.MirroredRepeatWrapping;normal.minFilter=normal.magFilter=T.LinearFilter;normal.needsUpdate=true;maps.set(key as PhotoSurface,{color:tex,rough:r,normal});
 }));return maps;
}
export async function photographicScene(source:T.Scene,camera:T.Camera,mood:Mood,signal:AbortSignal,progress:(text:string)=>void){
 const maps=await photoMaps();const scene=new T.Scene(),geometries:T.BufferGeometry[]=[],materials=new Map<T.Material,T.Material>();
 const waterData=new Uint8Array(128*128*4);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const u=x/128*Math.PI*8,v=y/128*Math.PI*8,n=new T.Vector3(Math.cos(u+v*.5)*.12,Math.cos(v*2-u)*.09,1).normalize(),i=(y*128+x)*4;waterData[i]=(n.x*.5+.5)*255;waterData[i+1]=(n.y*.5+.5)*255;waterData[i+2]=(n.z*.5+.5)*255;waterData[i+3]=255;}const waterNormal=new T.DataTexture(waterData,128,128);waterNormal.wrapS=waterNormal.wrapT=T.RepeatWrapping;waterNormal.repeat.set(12,4);waterNormal.needsUpdate=true;
 const cleanup=()=>{waterNormal.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(m=>{m.color.dispose();m.rough.dispose();m.normal.dispose();});environment.dispose();};
 const environment=new T.DataTexture(new Float32Array(256*128*4),256,128,T.RGBAFormat,T.FloatType);
 const pixels=environment.image.data as Float32Array;const top=new T.Color(mood==='evening'?'#50658a':mood==='overcast'?'#c8d0d3':'#8cb9dd'),horizon=new T.Color(mood==='evening'?'#ebbb91':'#e1e3dc'),ground=new T.Color('#69745b');
 for(let y=0;y<128;y++)for(let x=0;x<256;x++){const t=y/127,c=t>.5?horizon.clone().lerp(top,(t-.5)*2):ground.clone().lerp(horizon,t*2),i=(y*256+x)*4;pixels[i]=c.r;pixels[i+1]=c.g;pixels[i+2]=c.b;pixels[i+3]=1;}
 environment.mapping=T.EquirectangularReflectionMapping;environment.needsUpdate=true;scene.environment=environment;scene.background=environment;scene.environmentIntensity=mood==='evening'?.35:.8;scene.backgroundIntensity=1;
 const material=(m:T.Material)=>{if(materials.has(m))return materials.get(m)!;const c=m.clone();c.onBeforeCompile=()=>{};c.customProgramCacheKey=()=>'';if(c instanceof T.MeshStandardMaterial){const map=maps.get(m.userData.photo);if(map){c.map=map.color;c.roughnessMap=map.rough;c.normalMap=map.normal;c.normalScale.set(.65,.65);}if(m.userData.water){c.normalMap=waterNormal;c.roughness=.12;c.metalness=.15;}if(c instanceof T.MeshPhysicalMaterial&&c.transmission>0){c.side=T.DoubleSide;c.thickness=.028;c.transmission=.98;c.roughness=.015;(c as T.MeshPhysicalMaterial & {castShadow:boolean}).castShadow=false;}}materials.set(m,c);return c;};
 source.updateMatrixWorld(true);const meshes:T.Mesh[]=[];source.traverseVisible(o=>{if(o instanceof T.Mesh&&!o.userData.skipPhotographic)meshes.push(o);else if(o instanceof T.Light&&!(o instanceof T.HemisphereLight)){const light=o.clone();o.getWorldPosition(light.position);scene.add(light);}});
 let counter=0;
 try{for(const mesh of meshes){
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const original=mesh.geometry,base=original.index?original.toNonIndexed():original,positions=base.attributes.position,normals=base.attributes.normal,baseUV=base.attributes.uv; if(!positions)continue;
  const materialList=Array.isArray(mesh.material)?mesh.material:[mesh.material],kind=materialList[0].userData.photo as PhotoSurface,surface=photoSurfaces[kind];
  const instanced=mesh instanceof T.InstancedMesh,count=instanced?mesh.count:1;
  // Distant fine foliage uses a stable LOD; building, glass, furniture and panels retain full geometry.
  const stride=instanced&&mesh.name==='individual-tree-leaves'?2:1,valid:number[]=[];const matrix=new T.Matrix4(),instance=new T.Matrix4();
  for(let j=0;j<count;j+=stride){if(instanced){mesh.getMatrixAt(j,instance);if(Math.abs(instance.determinant())<1e-12)continue;}valid.push(j);}
  const size=positions.count*valid.length,out=new Float32Array(size*3),normal=new Float32Array(size*3),uv=new Float32Array(size*2),colors=new Float32Array(size*4),v=new T.Vector3(),n=new T.Vector3(),nm=new T.Matrix3(),color=new T.Color();
  for(let a=0;a<valid.length;a++){const j=valid[a];matrix.copy(mesh.matrixWorld);color.set(0xffffff);if(instanced){mesh.getMatrixAt(j,instance);matrix.multiply(instance);if(mesh.instanceColor)mesh.getColorAt(j,color);}nm.getNormalMatrix(matrix);
   for(let i=0;i<positions.count;i++){const k=a*positions.count+i;v.fromBufferAttribute(positions,i).applyMatrix4(matrix);n.set(0,1,0);if(normals)n.fromBufferAttribute(normals,i).applyNormalMatrix(nm);out.set(v.toArray(),k*3);normal.set(n.toArray(),k*3);const vertexColor=base.attributes.color;colors.set([color.r*(vertexColor?vertexColor.getX(i):1),color.g*(vertexColor?vertexColor.getY(i):1),color.b*(vertexColor?vertexColor.getZ(i):1),1],k*4);
    if(surface){const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);uv[k*2]=(ay>Math.max(ax,az)?v.x:ax>az?v.z:v.x)/surface.metres[0];uv[k*2+1]=(ay>Math.max(ax,az)?v.z:v.y)/surface.metres[1];if(surface.axis){const ridge=new T.Vector3().crossVectors(new T.Vector3(0,1,0),n);if(ridge.lengthSq()>.00001){ridge.normalize();const slope=new T.Vector3().crossVectors(n,ridge).normalize();uv[k*2]=v.dot(ridge)/surface.metres[0];uv[k*2+1]=v.dot(slope)/surface.metres[1];}}}else if(baseUV){uv[k*2]=baseUV.getX(i);uv[k*2+1]=baseUV.getY(i);}
   }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(out,3));geo.setAttribute('normal',new T.BufferAttribute(normal,3));geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setAttribute('color',new T.BufferAttribute(colors,4));if(materialList.length>1)for(let a=0;a<valid.length;a++)for(const g of base.groups)geo.addGroup(a*positions.count+g.start,g.count,g.materialIndex);geometries.push(geo);const mats=materialList.map(material);mats.forEach(m=>{if(m instanceof T.MeshStandardMaterial)m.vertexColors=true;});// The pinned tracer merges one material per mesh. Split multi-material faces
  // explicitly so frame, glazing and wall materials cannot shift subsequent indices.
  const emit=(geometry:T.BufferGeometry,mat:T.Material)=>{const baked=new T.Mesh(geometry,mat);baked.name=mesh.name;baked.castShadow=true;baked.receiveShadow=true;scene.add(baked);};
  if(mats.length>1){for(const group of geo.groups){const part=new T.BufferGeometry();for(const [name,attribute] of Object.entries(geo.attributes)){part.setAttribute(name,new T.BufferAttribute(attribute.array.slice(group.start*attribute.itemSize,(group.start+group.count)*attribute.itemSize),attribute.itemSize));}geometries.push(part);emit(part,mats[group.materialIndex||0]);}}else emit(geo,mats[0]);
  if(base!==original)base.dispose();
  if(++counter%60===0){progress('Preparing geometry · '+Math.round(counter/meshes.length*100)+'%');await new Promise(r=>setTimeout(r,0));}
 }}catch(error){cleanup();throw error;}
 return {scene,dispose:cleanup};
}
