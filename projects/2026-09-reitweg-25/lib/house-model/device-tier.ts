import type {TreeStyle} from './foliage';

/** Rendering presets. "extreme" is the photographic scene at full Retina resolution, path-traced whenever the camera
 * rests; "detailed" is the full photographic scene, "balanced" keeps the same scene at phone-friendly cost, "model" is
 * the plain architectural model. */
export type Quality='extreme'|'detailed'|'balanced'|'model';
export type TierSettings={
 quality:Quality;pixelRatio:number;samples:number;shadowSize:number;ao:boolean;bloom:boolean;
 refineFrames:number;textureSize:512|1024;farWoodland:number;grass:boolean;skyBake:boolean;photographic:boolean;
 /** Rays per grid point for sunlight bounced indoors, traced on the processor; 0 turns it off. */
 sunBounce:number;trees:TreeStyle;
 /** Path-traces the viewport while the camera rests. */
 liveTrace:boolean;
 /** A camera's behaviour: metered exposure, depth of field at eye level, sun shafts and film grain (lens.ts). */
 lens:boolean;
 /** Ray-marched cumulus with shadows on the ground (clouds.ts). */
 clouds:boolean;
 /** The pool mirrors the scene (pool-reflection.ts). */
 poolMirror:boolean;
 /** Photo-scanned CC0 surface sets in place of the generated ones (surface-materials.ts). */
 scanned:boolean;
};
export const tiers:Record<Quality,TierSettings>={
 extreme:{quality:'extreme',pixelRatio:3,samples:4,shadowSize:4096,ao:true,bloom:true,refineFrames:32,textureSize:1024,farWoodland:1,grass:true,skyBake:true,photographic:true,sunBounce:32,trees:'leaves',liveTrace:true,lens:true,clouds:true,poolMirror:true,scanned:true},
 detailed:{quality:'detailed',pixelRatio:2,samples:4,shadowSize:4096,ao:true,bloom:true,refineFrames:24,textureSize:1024,farWoodland:1,grass:true,skyBake:true,photographic:true,sunBounce:32,trees:'leaves',liveTrace:false,lens:false,clouds:false,poolMirror:false,scanned:false},
 balanced:{quality:'balanced',pixelRatio:1.5,samples:2,shadowSize:2048,ao:true,bloom:false,refineFrames:8,textureSize:512,farWoodland:.45,grass:false,skyBake:true,photographic:false,sunBounce:24,trees:'hybrid',liveTrace:false,lens:false,clouds:false,poolMirror:false,scanned:false},
 model:{quality:'model',pixelRatio:1.75,samples:4,shadowSize:2048,ao:false,bloom:false,refineFrames:0,textureSize:512,farWoodland:0,grass:false,skyBake:false,photographic:false,sunBounce:0,trees:'hybrid',liveTrace:false,lens:false,clouds:false,poolMirror:false,scanned:false},
};
/** The settings a viewer runs with. Detailed on a phone keeps the scene, materials and light, but fits a phone
 * browser's graphics memory: a 2048 shadow map and 2× multisampling need about 160 MB less at phone size. Extreme is
 * for a computer's graphics card; a phone given it runs Detailed. */
export function tierFor(quality:Quality,phone=isPhone()):TierSettings{
 if(phone&&(quality==='detailed'||quality==='extreme'))return {...tiers.detailed,shadowSize:2048,samples:2};
 return tiers[quality];
}
export function isPhone(){
 if(typeof window==='undefined')return false;
 const coarse=window.matchMedia('(pointer: coarse)').matches,small=Math.min(screen.width,screen.height)<820;
 return coarse&&small||/iPhone|Android.+Mobile/i.test(navigator.userAgent);
}
/** Computers start in Detailed and phones in Balanced, since Detailed stutters every few seconds on a phone (Detailed
 * stays in the menu, with a lighter shadow map and multisampling, tierFor); a URL or menu choice wins. A browser without
 * WebGL2 gets the plain model; if Detailed cannot run, the viewer drops to Balanced and says so. */
export function detectQuality():Quality{
 if(typeof window==='undefined')return 'model';
 try{const gl=document.createElement('canvas').getContext('webgl2');gl?.getExtension('WEBGL_lose_context')?.loseContext();if(!gl)return 'model';}catch{return 'model';}
 return isPhone()?'balanced':'detailed';
}
export function qualityFromParam(value:string|null):Quality|undefined{
 if(value==='extreme')return 'extreme';
 if(value==='detailed'||value==='realism')return 'detailed';
 if(value==='balanced')return 'balanced';
 if(value==='model'||value==='natural')return 'model';
}
