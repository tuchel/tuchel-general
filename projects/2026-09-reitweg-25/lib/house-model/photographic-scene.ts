import * as T from 'three';
import {hasShaderFeature,materialsOf} from './shader-features';

/** A standalone copy of what the camera sees, with ordinary UVs and PBR maps, for the
 * path tracer and GLB export. World-projected surfaces become baked UVs; the texture sets
 * are converted once to standard colour, roughness and normal maps. */
type Standard={map:T.Texture;roughness:T.Texture;normal:T.Texture;metres:T.Vector2;slope:boolean};
function pixels(texture:T.Texture){
 const image=texture.image as CanvasImageSource&{width:number;height:number};
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);
 return ctx.getImageData(0,0,canvas.width,canvas.height);
}
function standardMaps(color:T.Texture,normal:T.Texture):Omit<Standard,'metres'|'slope'>{
 const c=pixels(color),n=pixels(normal),w=c.width,h=c.height,size=w*h;
 const rgb=new Uint8Array(size*4),rough=new Uint8Array(size*4),nrm=new Uint8Array(size*4);
 for(let i=0;i<size;i++){
  rgb.set([c.data[i*4],c.data[i*4+1],c.data[i*4+2],255],i*4);
  const r=c.data[i*4+3];rough.set([r,r,r,255],i*4);
  const x=n.data[i*4]/127.5-1,y=n.data[i*4+1]/127.5-1,z=Math.sqrt(Math.max(0,1-x*x-y*y));
  nrm.set([n.data[i*4],n.data[i*4+1],Math.round((z*.5+.5)*255),255],i*4);
 }
 // Canvas pixel rows run top-down, as the loaded images do; keep three's default flip.
 const make=(data:Uint8Array,srgb:boolean)=>{const t=new T.DataTexture(data,w,h);t.flipY=true;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;if(srgb)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;};
 return {map:make(rgb,true),roughness:make(rough,false),normal:make(nrm,false)};
}

/** The sun and the lit lamps, in world space, as the path tracer reads them; replaces the lights `target` had.
 * `sunScale` dims the sun, for clouds over the house (clouds.ts). */
export function copyLights(source:T.Scene,target:T.Scene,sunScale=1){
 for(const o of target.children.filter(c=>c.userData.copiedLight))o.removeFromParent();
 source.updateMatrixWorld(true);
 source.traverseVisible(o=>{
  if(!o.layers.isEnabled(0)||o.userData.skipPhotographic)return;
  if(!(o instanceof T.DirectionalLight||(o instanceof T.SpotLight&&o.intensity>0)))return;
  const light=o.clone();o.getWorldPosition(light.position);light.target=new T.Object3D();o.target.getWorldPosition(light.target.position);
  if(light instanceof T.DirectionalLight)light.intensity*=sunScale;
  light.userData.copiedLight=light.target.userData.copiedLight=true;target.add(light.target,light);
 });
}
/** `instances`: instanced meshes without a projected surface stay instanced (the WebGPU tracer traces instances; the
 * WebGL tracer and GLB export need them flattened). */
export async function photographicScene(source:T.Scene,environment:T.Texture,signal:AbortSignal,progress:(text:string)=>void,options:{maxDistance?:number;origin?:T.Vector3;sunScale?:number;instances?:boolean}={}){
 const scene=new T.Scene(),geometries:T.BufferGeometry[]=[],materials=new Map<T.Material,T.Material>(),converted=new Map<T.Texture,ReturnType<typeof standardMaps>>(),textures:T.Texture[]=[];
 scene.environment=environment;scene.background=environment;
 const cleanup=()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
 const surfaceOf=(m:T.Material):Standard|undefined=>{
  if(!hasShaderFeature(m,'surface-v1'))return;
  const u=(m.userData.surfaceUniforms||{}) as Record<string,{value:unknown}>;
  const color=u.uSurfaceColor?.value as T.Texture|undefined,normal=u.uSurfaceNormal?.value as T.Texture|undefined;
  if(!color?.image||!normal?.image)return;
  let maps=converted.get(color);if(!maps){maps=standardMaps(color,normal);converted.set(color,maps);textures.push(maps.map,maps.roughness,maps.normal);}
  return {...maps,metres:u.uSurfaceMetres.value as T.Vector2,slope:(u.uSurfaceSlope.value as number)>.5};
 };
 const material=(m:T.Material)=>{
  if(materials.has(m))return materials.get(m)!;
  const c=m.clone() as T.MeshPhysicalMaterial;c.onBeforeCompile=()=>{};c.customProgramCacheKey=()=>'';c.userData={};
  const surface=surfaceOf(m);
  if(surface&&c instanceof T.MeshStandardMaterial){
   c.map=surface.map;c.roughnessMap=surface.roughness;c.normalMap=surface.normal;c.roughness=1;
   const tint=(m.userData.surfaceUniforms.uSurfaceTint.value as T.Color);c.color.copy(tint);
  }
  if(hasShaderFeature(m,'fresnel-glass')){Object.assign(c,{transparent:false,opacity:1,transmission:1,ior:1.5,thickness:.02,roughness:.01,side:T.DoubleSide});c.color.set('#ffffff');}
  if(hasShaderFeature(m,'pool-water')){Object.assign(c,{transparent:false,opacity:1,transmission:.9,ior:1.33,thickness:1.4,roughness:.03});c.color.set('#7fc6c9');}
  if(c instanceof T.MeshStandardMaterial&&(c.map||hasShaderFeature(m,'surface-v1')))c.vertexColors=!!(m as T.MeshStandardMaterial).vertexColors||!!m.userData.instanceTint;
  materials.set(m,c);return c;
 };
 source.updateMatrixWorld(true);
 const meshes:T.Mesh[]=[];
 source.traverseVisible(o=>{if(o.layers.isEnabled(0)&&!o.userData.skipPhotographic&&o instanceof T.Mesh)meshes.push(o);});
 copyLights(source,scene,options.sunScale);
 const v=new T.Vector3(),n=new T.Vector3(),nm=new T.Matrix3(),color=new T.Color(),matrix=new T.Matrix4(),instance=new T.Matrix4(),tu=new T.Vector3(),tv=new T.Vector3(),up=new T.Vector3(0,1,0);
 const e1=new T.Vector3(),e2=new T.Vector3(),t=new T.Vector3(),b=new T.Vector3(),a0=new T.Vector3(),a1=new T.Vector3(),a2=new T.Vector3();
 // The page's thread is handed back every 8 ms, so a click is never held up for longer than about one frame.
 let slice=performance.now(),counter=0;
 const pause=async()=>{
  if(performance.now()-slice<8)return;
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  await new Promise(r=>setTimeout(r,0));slice=performance.now();
 };
 /** Tangents along the texture's u direction, square to each vertex normal: the tracers read them for normal maps.
  * A face without texture coordinates gets none (zero), which both tracers take as no normal map. */
 const faceTangents=(position:Float32Array,normal:Float32Array,uv:Float32Array,tangent:Float32Array,from:number,to:number)=>{
  for(let f=from;f<to;f+=3){
   a0.fromArray(position,f*3);a1.fromArray(position,f*3+3);a2.fromArray(position,f*3+6);e1.subVectors(a1,a0);e2.subVectors(a2,a0);
   const du1=uv[f*2+2]-uv[f*2],dv1=uv[f*2+3]-uv[f*2+1],du2=uv[f*2+4]-uv[f*2],dv2=uv[f*2+5]-uv[f*2+1],det=du1*dv2-du2*dv1;
   if(Math.abs(det)<1e-12)continue;
   t.copy(e1).multiplyScalar(dv2).addScaledVector(e2,-dv1).divideScalar(det);b.copy(e2).multiplyScalar(du1).addScaledVector(e1,-du2).divideScalar(det);
   for(let k=f;k<f+3;k++){
    n.fromArray(normal,k*3);tu.copy(t).addScaledVector(n,-n.dot(t));if(tu.lengthSq()<1e-20)continue;tu.normalize();
    tangent[k*4]=tu.x;tangent[k*4+1]=tu.y;tangent[k*4+2]=tu.z;tangent[k*4+3]=tv.crossVectors(n,tu).dot(b)<0?-1:1;
   }
  }
 };
 const geometry=(count:number)=>{
  const g={position:new Float32Array(count*3),normal:new Float32Array(count*3),uv:new Float32Array(count*2),color:new Float32Array(count*4),tangent:new Float32Array(count*4)};
  const made=new T.BufferGeometry();
  made.setAttribute('position',new T.BufferAttribute(g.position,3));made.setAttribute('normal',new T.BufferAttribute(g.normal,3));made.setAttribute('uv',new T.BufferAttribute(g.uv,2));
  made.setAttribute('color',new T.BufferAttribute(g.color,4));made.setAttribute('tangent',new T.BufferAttribute(g.tangent,4));geometries.push(made);
  return {...g,made};
 };
 // Instanced geometry kept as instances (options.instances) is converted once per source geometry.
 const archetypes=new Map<T.BufferGeometry,T.BufferGeometry>();
 try{
  for(const mesh of meshes){
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   const base=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,pos=base.attributes.position,nor=base.attributes.normal,uv0=base.attributes.uv,vc=base.attributes.color;
   if(!pos){if(base!==mesh.geometry)base.dispose();continue;}
   const mats=materialsOf(mesh),instanced=mesh instanceof T.InstancedMesh,surface=surfaceOf(mats[0]);
   // Trees draw only what the view sees (drawTrees); the tracer takes every one.
   const count=instanced?(mesh.userData.instances as number|undefined)??mesh.count:1;
   const valid:number[]=[];
   for(let j=0;j<count;j++){
    if(instanced){mesh.getMatrixAt(j,instance);if(Math.abs(instance.determinant())<1e-12)continue;}
    matrix.copy(mesh.matrixWorld);if(instanced)matrix.multiply(instance);
    // Distant instanced trees add little to a photograph near the house but a lot to its memory.
    if(instanced&&options.maxDistance&&options.origin){v.setFromMatrixPosition(matrix);if(v.distanceTo(options.origin)>options.maxDistance)continue;}
    valid.push(j);
   }
   if(!valid.length){if(base!==mesh.geometry)base.dispose();continue;}
   let baked:T.Mesh;
   if(instanced&&!surface&&options.instances){
    // Trees and planting stay instances of one converted archetype: the WebGPU tracer traces instances directly.
    let shared=archetypes.get(mesh.geometry);
    if(!shared){
     const g=geometry(pos.count);
     for(let i=0;i<pos.count;i++){
      g.position[i*3]=pos.getX(i);g.position[i*3+1]=pos.getY(i);g.position[i*3+2]=pos.getZ(i);
      if(nor){g.normal[i*3]=nor.getX(i);g.normal[i*3+1]=nor.getY(i);g.normal[i*3+2]=nor.getZ(i);}else g.normal[i*3+1]=1;
      g.color[i*4]=vc?vc.getX(i):1;g.color[i*4+1]=vc?vc.getY(i):1;g.color[i*4+2]=vc?vc.getZ(i):1;g.color[i*4+3]=1;
      if(uv0){g.uv[i*2]=uv0.getX(i);g.uv[i*2+1]=uv0.getY(i);}
      if(i%4096===4095)await pause();
     }
     if(uv0)faceTangents(g.position,g.normal,g.uv,g.tangent,0,pos.count);
     shared=g.made;archetypes.set(mesh.geometry,shared);
    }
    const copy=new T.InstancedMesh(shared,material(mats[0]),valid.length);
    for(let k=0;k<valid.length;k++){
     mesh.getMatrixAt(valid[k],instance);copy.setMatrixAt(k,matrix.multiplyMatrices(mesh.matrixWorld,instance));if(mesh.instanceColor){mesh.getColorAt(valid[k],color);copy.setColorAt(k,color);}
     if(k%2048===2047)await pause();
    }
    baked=copy;
   }else{
    const g=geometry(pos.count*valid.length);
    for(let a=0;a<valid.length;a++){
     const j=valid[a];matrix.copy(mesh.matrixWorld);color.set(0xffffff);
     if(instanced){mesh.getMatrixAt(j,instance);matrix.multiply(instance);if(mesh.instanceColor)mesh.getColorAt(j,color);}
     nm.getNormalMatrix(matrix);
     for(let i=0;i<pos.count;i++){
      const k=a*pos.count+i;v.fromBufferAttribute(pos,i).applyMatrix4(matrix);n.set(0,1,0);if(nor)n.fromBufferAttribute(nor,i).applyNormalMatrix(nm);
      g.position[k*3]=v.x;g.position[k*3+1]=v.y;g.position[k*3+2]=v.z;g.normal[k*3]=n.x;g.normal[k*3+1]=n.y;g.normal[k*3+2]=n.z;
      g.color[k*4]=color.r*(vc?vc.getX(i):1);g.color[k*4+1]=color.g*(vc?vc.getY(i):1);g.color[k*4+2]=color.b*(vc?vc.getZ(i):1);g.color[k*4+3]=1;
      if(surface){
       // Same projection as the live shader (surface-materials.ts); the texture's u runs along tu, its v along tv = n × tu.
       const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
       if(surface.slope&&ay<.97&&ay>.08){tu.crossVectors(up,n).normalize();tv.crossVectors(n,tu).normalize();}
       else if(ay>=ax&&ay>=az){tu.set(1,0,0);tv.set(0,0,-1);}
       else if(ax>=az){tu.set(0,0,-Math.sign(n.x));tv.set(0,1,0);}
       else{tu.set(Math.sign(n.z),0,0);tv.set(0,1,0);}
       g.uv[k*2]=v.dot(tu)/surface.metres.x;g.uv[k*2+1]=v.dot(tv)/surface.metres.y;
       t.copy(tu).addScaledVector(n,-n.dot(tu)).normalize();g.tangent[k*4]=t.x;g.tangent[k*4+1]=t.y;g.tangent[k*4+2]=t.z;g.tangent[k*4+3]=b.crossVectors(n,t).dot(tv)<0?-1:1;
      }else if(uv0){g.uv[k*2]=uv0.getX(i);g.uv[k*2+1]=uv0.getY(i);}
      if(k%4096===4095)await pause();
     }
     if(!surface&&uv0)faceTangents(g.position,g.normal,g.uv,g.tangent,a*pos.count,(a+1)*pos.count);
    }
    baked=new T.Mesh(g.made,material(mats[0]));
   }
   baked.name=mesh.name;baked.castShadow=mesh.castShadow;baked.receiveShadow=true;
   if(baked.material instanceof T.MeshStandardMaterial)baked.material.vertexColors=true;
   scene.add(baked);
   if(base!==mesh.geometry)base.dispose();
   if(++counter%40===0)progress('Preparing geometry · '+Math.round(counter/meshes.length*100)+'%');
   await pause();
  }
 }catch(error){cleanup();throw error;}
 return {scene,dispose:cleanup};
}
