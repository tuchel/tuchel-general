import * as T from 'three';
import {addShaderFeature,after,hasShaderFeature,materialsOf} from './shader-features';

/** The live view's surface colours, unlit, at full resolution: what the traced image's light is multiplied by to bring
 * back the texture detail the tracer's fewer pixels lose (Extreme; post.ts, live-trace-webgpu.ts). While the pass draws,
 * every surface material writes its colour after textures, tints and vertex colours instead of its light: one uniform
 * branch, so the lit view's programs serve both. */
export const ALBEDO_KEY='albedo-output';
/** `floor`: the darkest colour, per channel, either pass divides or multiplies by; darker surfaces keep the traced
 * image's own detail. */
export const SHARP={floor:.05};
const pass={value:0};
const SURFACES=new Set(['MeshStandardMaterial','MeshPhysicalMaterial','MeshBasicMaterial','MeshLambertMaterial','MeshPhongMaterial']);
/** Glass, water and other see-through surfaces: both colour passes leave them out, so each shows what lies behind. */
export const seeThrough=(m:T.Material)=>m.transparent||((m as T.MeshPhysicalMaterial).transmission??0)>=.5;
export function addAlbedoOutput(root:T.Object3D){
 root.traverse(o=>{for(const m of materialsOf(o))if(SURFACES.has(m.type)&&!hasShaderFeature(m,ALBEDO_KEY))addShaderFeature(m,{key:ALBEDO_KEY,compile:shader=>{
  shader.uniforms.uAlbedoPass=pass;
  shader.fragmentShader='uniform float uAlbedoPass;\n'+after(shader.fragmentShader,'dithering_fragment','if(uAlbedoPass>0.5)gl_FragColor=vec4(diffuseColor.rgb,1.0);');
 }});});
}
/** Draws the colours into `target` on white (where nothing is drawn, the traced light is kept as it is): only surfaces
 * with the colour output that are not see-through. Everything shown is shown again after. */
export function renderAlbedo(renderer:Pick<T.WebGLRenderer,'getRenderTarget'|'setRenderTarget'|'getClearColor'|'getClearAlpha'|'setClearColor'|'clear'|'render'>,scene:T.Scene,camera:T.Camera,target:T.WebGLRenderTarget){
 const hidden:T.Object3D[]=[];
 scene.traverseVisible(o=>{
  const materials=materialsOf(o);if(!materials.length)return;
  if(materials.some(m=>seeThrough(m)||!hasShaderFeature(m,ALBEDO_KEY)))hidden.push(o);
 });
 for(const o of hidden)o.visible=false;
 const {background}=scene,previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
 scene.background=null;pass.value=1;
 try{renderer.setRenderTarget(target);renderer.setClearColor(0xffffff,1);renderer.clear();renderer.render(scene,camera);}
 finally{
  pass.value=0;scene.background=background;for(const o of hidden)o.visible=true;
  renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);
 }
}
