import * as T from 'three';

/** The path-traced scene (photographic-scene.ts) as plain data for the tracing worker (live-trace-worker.ts): meshes,
 * their geometries, materials and textures by id, the lights and the sky. A sender includes only what the worker has
 * not had yet; the worker keeps the rest by id, so a rebuild sends only what changed. */
type Array32=Float32Array|Uint32Array|Uint16Array|Uint8Array;
export type AttributeData={array:Array32;itemSize:number;normalized:boolean};
/** `more`: further attributes for the geometry of this id, which arrived just before (pieces). */
export type GeometryData={id:string;attributes:Record<string,AttributeData>;index?:Uint32Array|Uint16Array;more?:boolean};
export type TextureData={id:string;data:Uint8Array|Uint8ClampedArray|Float32Array|Uint16Array;width:number;height:number;type:T.TextureDataType;
 colorSpace:string;wrapS:T.Wrapping;wrapT:T.Wrapping;repeat:[number,number];offset:[number,number];flipY:boolean;mapping:T.AnyMapping;
 minFilter:T.MinificationTextureFilter;magFilter:T.MagnificationTextureFilter;generateMipmaps:boolean};
/** `type`: the material's class (the tracer reads standard, physical, basic, Lambert and Phong materials alike). */
export type MaterialData={id:string;type:string;params:Record<string,unknown>;maps:Record<string,string>};
const KINDS={MeshStandardMaterial:T.MeshStandardMaterial,MeshPhysicalMaterial:T.MeshPhysicalMaterial,MeshBasicMaterial:T.MeshBasicMaterial,MeshLambertMaterial:T.MeshLambertMaterial,MeshPhongMaterial:T.MeshPhongMaterial} as const;
export type MeshData={name:string;geometry:string;material:string;matrix:number[];castShadow:boolean;count?:number;instances?:Float32Array;colors?:Float32Array};
export type LightData={kind:'directional'|'spot';color:number;intensity:number;position:number[];target:number[];angle?:number;penumbra?:number;distance?:number;decay?:number};
export type SceneData={meshes:MeshData[];geometries:GeometryData[];materials:MaterialData[];textures:TextureData[];lights:LightData[];environment?:TextureData};
export type SceneParts=Pick<SceneData,'geometries'|'textures'>;
export type CameraData={matrix:number[];fov:number;aspect:number;near:number;far:number;zoom:number;filmGauge:number;filmOffset:number;focus:number};

const MAPS=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','transmissionMap','thicknessMap'] as const;
const NUMBERS=['roughness','metalness','opacity','alphaTest','side','emissiveIntensity','envMapIntensity','transmission','ior','thickness','attenuationDistance','specularIntensity','clearcoat','clearcoatRoughness','sheen','sheenRoughness','iridescence','dispersion'] as const;
const COLORS=['color','emissive','attenuationColor','specularColor','sheenColor'] as const;
const FLAGS=['transparent','vertexColors','flatShading'] as const;

export function cameraData(camera:T.PerspectiveCamera):CameraData{
 camera.updateMatrixWorld();
 return {matrix:camera.matrixWorld.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,zoom:camera.zoom,filmGauge:camera.filmGauge,filmOffset:camera.filmOffset,focus:camera.focus};
}
export function applyCamera(camera:T.PerspectiveCamera,data:CameraData){
 camera.matrixWorld.fromArray(data.matrix);camera.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);
 Object.assign(camera,{fov:data.fov,aspect:data.aspect,near:data.near,far:data.far,zoom:data.zoom,filmGauge:data.filmGauge,filmOffset:data.filmOffset,focus:data.focus});
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}

/** Pixels of a texture: a data texture's own array, or an image drawn once onto a canvas (rows top down, as the image). */
function pixels(texture:T.Texture):{data:TextureData['data'];width:number;height:number}{
 const image=texture.image as {data?:TextureData['data'];width:number;height:number};
 if(image.data)return {data:image.data,width:image.width,height:image.height};
 const canvas=typeof document!=='undefined'?document.createElement('canvas'):new OffscreenCanvas(image.width,image.height);
 canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d',{willReadFrequently:true}) as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;
 context.drawImage(image as CanvasImageSource,0,0);
 return {data:context.getImageData(0,0,image.width,image.height).data,width:image.width,height:image.height};
}
function textureData(texture:T.Texture,id=texture.uuid):TextureData{
 const {data,width,height}=pixels(texture);
 return {id,data,width,height,type:texture.type,colorSpace:texture.colorSpace,wrapS:texture.wrapS,wrapT:texture.wrapT,repeat:[texture.repeat.x,texture.repeat.y],offset:[texture.offset.x,texture.offset.y],
  flipY:texture.flipY,mapping:texture.mapping,minFilter:texture.minFilter,magFilter:texture.magFilter,generateMipmaps:texture.generateMipmaps};
}
function lightsOf(scene:T.Scene):LightData[]{
 const out:LightData[]=[],p=new T.Vector3(),q=new T.Vector3();
 scene.updateMatrixWorld(true);
 scene.traverse(o=>{
  if(o instanceof T.DirectionalLight||o instanceof T.SpotLight){
   o.getWorldPosition(p);o.target.getWorldPosition(q);
   const base={color:o.color.getHex(),intensity:o.intensity,position:p.toArray(),target:q.toArray()};
   out.push(o instanceof T.SpotLight?{kind:'spot',...base,angle:o.angle,penumbra:o.penumbra,distance:o.distance,decay:o.decay}:{kind:'directional',...base});
  }
 });
 return out;
}

/** Keeps track of what the worker has: `scene` returns the data for a scene, new parts only. The worker lets go of what
 * the latest scene does not use (sceneStore's prune), and so does the sender. */
export function sceneSender(){
 let sent=new Set<string>();
 return {
  scene(scene:T.Scene):SceneData{
   const out:SceneData={meshes:[],geometries:[],materials:[],textures:[],lights:lightsOf(scene)},had=sent;
   sent=new Set();
   const fresh=(id:string)=>{const known=had.has(id)||sent.has(id);sent.add(id);return !known;};
   const env=scene.environment;if(env)out.environment=textureData(env,'environment');
   scene.updateMatrixWorld(true);
   scene.traverse(o=>{
    const mesh=o as T.Mesh;if(!mesh.isMesh)return;
    const geometry=mesh.geometry,material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as T.MeshPhysicalMaterial;
    if(fresh(geometry.uuid)){
     const attributes:Record<string,AttributeData>={};
     for(const [name,a] of Object.entries(geometry.attributes)){const b=a as T.BufferAttribute;attributes[name]={array:b.array as Array32,itemSize:b.itemSize,normalized:b.normalized};}
     out.geometries.push({id:geometry.uuid,attributes,index:geometry.index?.array as Uint32Array|Uint16Array|undefined});
    }
    // A material's maps count as in use whether or not the material itself is new. A map whose image is still loading
    // is left out, and the material sent again next time.
    const maps:Record<string,string>={};let whole=true;
    for(const k of MAPS){
     const t=(material as unknown as Record<string,T.Texture|null>)[k];if(!t)continue;
     if(!(t.image as {width?:number}|null)?.width){whole=false;continue;}
     maps[k]=t.uuid;if(fresh(t.uuid))out.textures.push(textureData(t));
    }
    if(fresh(material.uuid)||!whole){
     const params:Record<string,unknown>={};
     for(const k of NUMBERS)if(k in material)params[k]=(material as unknown as Record<string,unknown>)[k];
     for(const k of FLAGS)if(k in material)params[k]=(material as unknown as Record<string,unknown>)[k];
     for(const k of COLORS){const c=(material as unknown as Record<string,unknown>)[k];if(c instanceof T.Color)params[k]=c.getHex();}
     if(material.normalScale)params.normalScale=[material.normalScale.x,material.normalScale.y];
     out.materials.push({id:material.uuid,type:material.type,params,maps});
     if(!whole)sent.delete(material.uuid);
    }
    const data:MeshData={name:mesh.name,geometry:geometry.uuid,material:material.uuid,matrix:mesh.matrixWorld.toArray(),castShadow:mesh.castShadow};
    const inst=mesh as T.InstancedMesh;
    if(inst.isInstancedMesh){data.count=inst.count;data.instances=inst.instanceMatrix.array.slice(0,inst.count*16) as Float32Array;if(inst.instanceColor)data.colors=inst.instanceColor.array.slice(0,inst.count*3) as Float32Array;}
    out.meshes.push(data);
   });
   return out;
  },
  /** The lights and sky alone, for a new sun. */
  lights(scene:T.Scene):Pick<SceneData,'lights'|'environment'>{
   const env=scene.environment;return {lights:lightsOf(scene),environment:env?textureData(env,'environment'):undefined};
  },
 };
}

/** A scene's geometry and textures in pieces of about `limit` bytes, a large geometry an attribute at a time, so cloning
 * any one into a message holds the page only briefly; `rest` is the scene without them. */
export function pieces(data:SceneData,limit=2e6){
 const parts:SceneParts[]=[];let part:SceneParts={geometries:[],textures:[]},bytes=0;
 const put=(size:number,add:()=>void)=>{if(bytes&&bytes+size>limit){parts.push(part);part={geometries:[],textures:[]};bytes=0;}add();bytes+=size;};
 for(const g of data.geometries){
  const index=g.index?.byteLength??0,entries=Object.entries(g.attributes),size=entries.reduce((s,[,a])=>s+a.array.byteLength,index);
  if(size<=limit){put(size,()=>part.geometries.push(g));continue;}
  entries.forEach(([name,a],i)=>put(a.array.byteLength+(i?0:index),()=>part.geometries.push({id:g.id,attributes:{[name]:a},index:i?undefined:g.index,more:i>0})));
 }
 for(const t of data.textures)put(t.data.byteLength,()=>part.textures.push(t));
 if(bytes)parts.push(part);
 return {parts,rest:{...data,geometries:[],textures:[]} as SceneData};
}

/** The worker's side: rebuilds scenes from data, keeping geometries, materials and textures by id. */
export function sceneStore(){
 const geometries=new Map<string,T.BufferGeometry>(),materials=new Map<string,T.Material>(),textures=new Map<string,T.Texture>();
 let environment:T.Texture|undefined;
 const texture=(d:TextureData)=>{
  const t=new T.DataTexture(d.data as ArrayBufferView as Uint8Array,d.width,d.height,T.RGBAFormat,d.type);
  Object.assign(t,{colorSpace:d.colorSpace,wrapS:d.wrapS,wrapT:d.wrapT,flipY:d.flipY,mapping:d.mapping,minFilter:d.minFilter,magFilter:d.magFilter,generateMipmaps:d.generateMipmaps});
  t.repeat.set(...d.repeat);t.offset.set(...d.offset);t.needsUpdate=true;return t;
 };
 const lights=(scene:T.Scene,data:Pick<SceneData,'lights'|'environment'>)=>{
  for(const o of scene.children.filter(c=>c.userData.light))o.removeFromParent();
  for(const l of data.lights){
   const light=l.kind==='spot'?new T.SpotLight(l.color,l.intensity,l.distance,l.angle,l.penumbra,l.decay):new T.DirectionalLight(l.color,l.intensity);
   light.position.fromArray(l.position);light.target.position.fromArray(l.target);light.userData.light=light.target.userData.light=true;scene.add(light,light.target);
  }
  if(data.environment){environment?.dispose();environment=texture(data.environment);scene.environment=scene.background=environment;}
  else if(environment)scene.environment=scene.background=environment;
  scene.updateMatrixWorld(true);
 };
 /** Geometry and textures sent ahead of their scene (pieces). */
 const add=(data:SceneParts)=>{
  for(const d of data.textures)textures.set(d.id,texture(d));
  for(const d of data.geometries){
   const g=d.more?geometries.get(d.id)!:new T.BufferGeometry();
   for(const [name,a] of Object.entries(d.attributes))g.setAttribute(name,new T.BufferAttribute(a.array,a.itemSize,a.normalized));
   if(d.index)g.setIndex(new T.BufferAttribute(d.index,1));
   geometries.set(d.id,g);
  }
 };
 return {
  add,
  scene(data:SceneData){
   add(data);
   for(const d of data.materials){
    const Kind=KINDS[d.type as keyof typeof KINDS]??T.MeshStandardMaterial,m=new Kind() as T.MeshPhysicalMaterial;
    const {normalScale,...rest}=d.params as {normalScale?:[number,number]}&Record<string,unknown>;
    for(const [k,v] of Object.entries(rest)){if(!(k in m))continue;const target=(m as unknown as Record<string,unknown>)[k];if(target instanceof T.Color)target.setHex(v as number);else (m as unknown as Record<string,unknown>)[k]=v;}
    if(normalScale&&m.normalScale)m.normalScale.set(...normalScale);
    for(const [k,id] of Object.entries(d.maps))(m as unknown as Record<string,T.Texture|undefined>)[k]=textures.get(id);
    materials.set(d.id,m);
   }
   const scene=new T.Scene();
   for(const d of data.meshes){
    const geometry=geometries.get(d.geometry)!,material=materials.get(d.material)!;
    let mesh:T.Mesh;
    if(d.instances){
     const inst=new T.InstancedMesh(geometry,material,d.count!);inst.instanceMatrix.array.set(d.instances);
     if(d.colors){inst.instanceColor=new T.InstancedBufferAttribute(new Float32Array(d.count!*3),3);inst.instanceColor.array.set(d.colors);}
     mesh=inst;
    }else mesh=new T.Mesh(geometry,material);
    mesh.name=d.name;mesh.castShadow=d.castShadow;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(d.matrix);
    scene.add(mesh);
   }
   lights(scene,data);
   return scene;
  },
  lights,
  /** Lets go of geometries, materials and textures `scene` no longer uses. */
  prune(scene:T.Scene){
   const g=new Set<T.BufferGeometry>(),m=new Set<T.Material>(),t=new Set<T.Texture>();
   scene.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;g.add(mesh.geometry);const mat=mesh.material as T.MeshPhysicalMaterial;m.add(mat);for(const k of MAPS){const x=(mat as unknown as Record<string,T.Texture|null>)[k];if(x)t.add(x);}});
   for(const [id,x] of geometries)if(!g.has(x)){x.dispose();geometries.delete(id);}
   for(const [id,x] of materials)if(!m.has(x)){x.dispose();materials.delete(id);}
   for(const [id,x] of textures)if(!t.has(x)){x.dispose();textures.delete(id);}
  },
 };
}
