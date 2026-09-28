import * as T from 'three';

/** Several modules extend the same standard materials (surfaces, wind, glass, sky light).
 * Features compose in the order they were added and share one program cache key. */
export type ShaderFeature={key:string;compile:(shader:T.WebGLProgramParametersWithUniforms)=>void};
export function addShaderFeature(material:T.Material,feature:ShaderFeature){
 const list:ShaderFeature[]=material.userData.shaderFeatures??=[];
 if(list.some(f=>f.key===feature.key))return;
 list.push(feature);
 material.onBeforeCompile=shader=>{for(const f of list)f.compile(shader);};
 material.customProgramCacheKey=()=>list.map(f=>f.key).join('|');
 material.needsUpdate=true;
}
export function hasShaderFeature(material:T.Material,key:string){return !!(material.userData.shaderFeatures as ShaderFeature[]|undefined)?.some(f=>f.key===key);}
/** Inserts code after an include, failing loudly if three's chunk names change. */
export function after(source:string,include:string,code:string){
 const tag=`#include <${include}>`;
 if(!source.includes(tag))throw new Error(`Shader chunk ${include} not found`);
 return source.replace(tag,`${tag}\n${code}`);
}
export function before(source:string,include:string,code:string){
 const tag=`#include <${include}>`;
 if(!source.includes(tag))throw new Error(`Shader chunk ${include} not found`);
 return source.replace(tag,`${code}\n${tag}`);
}
export function materialsOf(o:T.Object3D):T.Material[]{
 const m=(o as T.Mesh).material;return m?(Array.isArray(m)?m:[m]):[];
}
