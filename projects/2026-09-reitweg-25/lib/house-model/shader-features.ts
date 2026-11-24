import * as T from 'three';

/** Several modules extend the same standard materials (surfaces, wind, glass, sky light).
 * Features compose in the order they were added and share one program cache key; one marked `last` composes after
 * every other, whenever they are added (snow.ts reads what the sky light declares). */
export type ShaderFeature={key:string;last?:boolean;compile:(shader:T.WebGLProgramParametersWithUniforms)=>void;
 /** The same feature for the WebGPU renderer, which takes no shader text: it sets or builds on the material's `slots`. */
 nodes?:(slots:NodeSlots)=>void};
/* eslint-disable @typescript-eslint/no-explicit-any */
/** What a material's features hand on to one another and, at the end, to the material, as nodes of `tsl` (three/tsl):
 * its colour, roughness, world normal and how much indirect light its hollows keep. */
export type NodeSlots={tsl:any;colour?:any;roughness?:any;normal?:any;cavity?:any};
let tsl:any;
/** Features also build nodes from here on, with this `three/tsl`; none, for the WebGL renderer. */
export const drawWithNodes=(kit?:unknown)=>{tsl=kit;};
function composeNodes(material:T.Material,list:ShaderFeature[]){
 const slots:NodeSlots={tsl};for(const f of list)f.nodes?.(slots);
 Object.assign(material as any,{colorNode:slots.colour??null,roughnessNode:slots.roughness??null,normalNode:slots.normal?tsl.transformNormalToView(slots.normal):null,aoNode:slots.cavity??null});
}
/* eslint-enable @typescript-eslint/no-explicit-any */
export function addShaderFeature(material:T.Material,feature:ShaderFeature){
 const list:ShaderFeature[]=material.userData.shaderFeatures??=[];
 if(list.some(f=>f.key===feature.key))return;
 list.push(feature);list.sort((a,b)=>+!!a.last-+!!b.last);
 if(tsl)composeNodes(material,list);
 material.onBeforeCompile=shader=>{for(const f of list)f.compile(shader);};
 // Nodes hold a material's own textures and values, so no two materials share a program there.
 material.customProgramCacheKey=()=>list.map(f=>f.key).join('|')+(tsl?'|'+material.uuid:'');
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
