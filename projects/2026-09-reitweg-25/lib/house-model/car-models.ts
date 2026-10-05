import * as T from 'three';

/** Modelled cars for the photographic presets (Detailed and Extreme), in place of the traced-profile ones
 * (garage-cars.ts), in the colours they were modelled in. Each glTF file in public/assets/models is credited in
 * CREDITS.md and compressed (meshopt, quantized, WebP textures); it is scaled to its car's published length:
 * 4,796 mm for the Model Y Performance, 4,291 mm for the 1975 911 Turbo (930). */
export const CAR_MODELS={
 modelY:{url:'/assets/models/tesla-model-y-performance.glb',name:'Tesla Model Y Performance',length:4.796},
 porsche:{url:'/assets/models/porsche-911-turbo-1975.glb',name:'Porsche 911 Turbo (930, 1975)',length:4.291},
} as const;
type CarModel=(typeof CAR_MODELS)[keyof typeof CAR_MODELS];
export type CarModels={modelY?:T.Object3D;porsche?:T.Object3D};

/** Plain float attributes in place of quantized ones: the batching and the path tracer read floats. */
function floats(geometry:T.BufferGeometry){
 for(const [name,a] of Object.entries(geometry.attributes)){
  if(a.array instanceof Float32Array&&!(a as T.InterleavedBufferAttribute).isInterleavedBufferAttribute&&!a.normalized)continue;
  const out=new Float32Array(a.count*a.itemSize);
  for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)out[i*a.itemSize+k]=a.getComponent(i,k);
  geometry.setAttribute(name,new T.BufferAttribute(out,a.itemSize));
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
}

/** `model`, a glTF scene with its nose along +z and y up, turned for the garage (nose along +x, as the traced cars),
 * centred on its footprint with its wheels on y = 0 and scaled to `spec.length`. Flat props on the ground (a baked
 * shadow, a name plate beside the car) are left out; lamp lenses are see-through without the transmission pass. */
export function fitCar(model:T.Object3D,spec:CarModel){
 model.updateMatrixWorld(true);
 const meshes:T.Mesh[]=[];model.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
 for(const m of meshes)floats(m.geometry);
 const boxes=new Map(meshes.map(m=>[m,new T.Box3().setFromObject(m,true)]));
 const floor=Math.min(...[...boxes.values()].map(b=>b.min.y));
 for(const [m,b] of boxes)if(b.max.y-b.min.y<.02&&b.max.y<floor+.2){m.removeFromParent();boxes.delete(m);}
 const box=new T.Box3();for(const b of boxes.values())box.union(b);
 const size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());
 const shift=new T.Group();shift.position.set(-centre.x,-box.min.y,-centre.z);shift.add(model);
 const turn=new T.Group();turn.rotation.y=Math.PI/2;turn.scale.setScalar(spec.length/size.z);turn.add(shift);
 const car=new T.Group();car.name=spec.name;car.add(turn);
 for(const m of boxes.keys()){
  m.castShadow=m.receiveShadow=true;
  for(const material of [m.material].flat())if(material instanceof T.MeshPhysicalMaterial&&material.transmission>0){material.transmission=0;material.transparent=true;material.depthWrite=false;}
 }
 return car;
}

/** Both cars, loaded and fitted; a car whose file fails to load is left out, and the garage keeps its traced one. */
export async function loadCarModels():Promise<CarModels>{
 const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const [modelY,porsche]=await Promise.allSettled([CAR_MODELS.modelY,CAR_MODELS.porsche].map(async spec=>fitCar((await loader.loadAsync(spec.url)).scene,spec)));
 for(const r of [modelY,porsche])if(r.status==='rejected')console.warn('Car model unavailable',r.reason);
 return {modelY:modelY.status==='fulfilled'?modelY.value:undefined,porsche:porsche.status==='fulfilled'?porsche.value:undefined};
}
