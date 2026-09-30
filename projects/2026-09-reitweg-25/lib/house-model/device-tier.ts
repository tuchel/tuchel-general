import type {TreeStyle} from './foliage';

/** Rendering presets. "detailed" is the full photographic scene, "balanced" keeps
 * the same scene at phone-friendly cost, "model" is the plain architectural model. */
export type Quality='detailed'|'balanced'|'model';
export type TierSettings={
 quality:Quality;pixelRatio:number;samples:number;shadowSize:number;ao:boolean;bloom:boolean;
 refineFrames:number;textureSize:512|1024;farWoodland:number;grass:boolean;skyBake:boolean;photographic:boolean;
 /** Rays per grid point for sunlight bounced indoors, traced on the processor; 0 turns it off. */
 sunBounce:number;trees:TreeStyle;
};
export const tiers:Record<Quality,TierSettings>={
 detailed:{quality:'detailed',pixelRatio:2,samples:4,shadowSize:4096,ao:true,bloom:true,refineFrames:24,textureSize:1024,farWoodland:1,grass:true,skyBake:true,photographic:true,sunBounce:32,trees:'leaves'},
 balanced:{quality:'balanced',pixelRatio:1.5,samples:2,shadowSize:2048,ao:true,bloom:false,refineFrames:8,textureSize:512,farWoodland:.45,grass:false,skyBake:true,photographic:false,sunBounce:24,trees:'hybrid'},
 model:{quality:'model',pixelRatio:1.75,samples:4,shadowSize:2048,ao:false,bloom:false,refineFrames:0,textureSize:512,farWoodland:0,grass:false,skyBake:false,photographic:false,sunBounce:0,trees:'hybrid'},
};
/** The settings a viewer runs with. Detailed on a phone keeps the scene, materials and light, but fits a phone
 * browser's graphics memory: a 2048 shadow map and 2× multisampling need about 160 MB less at phone size. */
export function tierFor(quality:Quality,phone=isPhone()):TierSettings{
 return quality==='detailed'&&phone?{...tiers.detailed,shadowSize:2048,samples:2}:tiers[quality];
}
export function isPhone(){
 if(typeof window==='undefined')return false;
 const coarse=window.matchMedia('(pointer: coarse)').matches,small=Math.min(screen.width,screen.height)<820;
 return coarse&&small||/iPhone|Android.+Mobile/i.test(navigator.userAgent);
}
/** Every device starts in Detailed (phones with a lighter shadow map and multisampling, tierFor); a URL or menu choice
 * wins. A browser without WebGL2 gets the plain model; if Detailed cannot run, the viewer drops to Balanced and says so. */
export function detectQuality():Quality{
 if(typeof window==='undefined')return 'model';
 try{const gl=document.createElement('canvas').getContext('webgl2');gl?.getExtension('WEBGL_lose_context')?.loseContext();if(!gl)return 'model';}catch{return 'model';}
 return 'detailed';
}
export function qualityFromParam(value:string|null):Quality|undefined{
 if(value==='detailed'||value==='realism')return 'detailed';
 if(value==='balanced')return 'balanced';
 if(value==='model'||value==='natural')return 'model';
}
