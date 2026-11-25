import * as T from 'three';

/** Several modules extend the same standard materials (surfaces, wind, glass, sky light).
 * Features compose in the order they were added and share one program cache key; one marked `last` composes after
 * every other, whenever they are added (snow.ts reads what the sky light declares). */
export type ShaderFeature={key:string;last?:boolean;compile:(shader:T.WebGLProgramParametersWithUniforms)=>void;
 /** The same feature for the WebGPU renderer, which takes no shader text: it sets or builds on the material's `slots`. */
 nodes?:(slots:NodeSlots)=>void};
/* eslint-disable @typescript-eslint/no-explicit-any */
/** What a material's features hand on to one another and, at the end, to the material, as nodes of `tsl` (three/tsl):
 * its colour (alpha included), local position, roughness, world normal, how much indirect light its hollows keep, and
 * its opacity. */
export type NodeSlots={tsl:any;colour?:any;position?:any;roughness?:any;metalness?:any;normal?:any;cavity?:any;opacity?:any;
 /** The sky light's grid and what stands over each point of it, for a feature that reads them (snow.ts). */
 sky?:{low:any;grid:any;cell:any;linked:any;reach:any};
 /** Where the surface is drawn at all, in the sun's shadow of it as well (snow-slab.ts). */
 mask?:any;
 /** How much of the surface lying snow hides, 0–1 (snow.ts). */
 covered?:any;
 /** The colour once three has multiplied the vertices' and instances' tints into it, which it does after `colour`. */
 tinted?:(rgb:any)=>any;
 /** The colour light takes on going round the room at this point, at the brightness of `fallback` (sun-bounce.ts). */
 tint?:(fallback:any)=>any;
 /** The finished colour, changed last of all (a haze of the material's own). */
 output?:(colour:any)=>any;
 /** Light added for each lamp or sun after three's own (`light` holds lightDirection, lightColor and reflectedLight). */
 direct:((light:any)=>void)[];
 /** Changes to the light arriving from all round, before three uses it (`context` holds irradiance, iblIrradiance and radiance). */
 indirect:((context:any)=>void)[]};
let tsl:any;
/** Features also build nodes from here on, with this `three/tsl` and three's `PhysicalLightingModel`; none, for the
 * WebGL renderer. */
export const drawWithNodes=(kit?:unknown)=>{tsl=kit;};
function composeNodes(material:T.Material,list:ShaderFeature[]){
 const slots:NodeSlots={tsl,direct:[],indirect:[]};for(const f of list)f.nodes?.(slots);
 // Light is changed in a lighting model of the material's own, three's with the features' additions.
 const m=material as T.MeshPhysicalMaterial,lit=slots.direct.length+slots.indirect.length>0;
 class Lighting extends tsl.PhysicalLightingModel{
  constructor(...layers:boolean[]){super(...layers);}
  direct(light:any,builder:any){super.direct(light,builder);for(const add of slots.direct)add(light);}
  indirect(builder:any){for(const change of slots.indirect)change(builder.context);super.indirect(builder);}
 }
 if(lit)(material as any).setupLightingModel=()=>m.isMeshPhysicalMaterial?new Lighting(m.clearcoat>0,m.sheen>0,m.iridescence>0,m.anisotropy>0,m.transmission>0,m.dispersion>0):new Lighting();
 else delete (material as any).setupLightingModel;
 // What must follow the vertex and instance tints is done as three turns to the material's variants, straight after.
 const tinted=slots.tinted;
 if(tinted)(material as any).setupVariants=function(this:any,builder:any){tsl.diffuseColor.rgb.assign(tinted(tsl.diffuseColor.rgb));return Object.getPrototypeOf(this).setupVariants.call(this,builder);};
 else delete (material as any).setupVariants;
 // three refreshes an object's values each frame only when its material holds a node: one whose light alone is changed
 // gets its plain colour as a node, or the hooks would never see their values change.
 Object.assign(material as any,{colorNode:slots.colour??(lit?tsl.materialColor:null),positionNode:slots.position??null,outputNode:slots.output?slots.output(tsl.output):null,roughnessNode:slots.roughness??null,metalnessNode:slots.metalness??null,normalNode:slots.normal?tsl.transformNormalToView(slots.normal):null,aoNode:slots.cavity??null,opacityNode:slots.opacity??null,maskNode:slots.mask??null});
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
