import type {TreeStyle} from './foliage';

/** Rendering presets. "detailed" is the full photographic scene, "balanced" keeps
 * the same scene at phone-friendly cost, "model" is the plain architectural model. */
export type Quality='detailed'|'balanced'|'model';
export type TierSettings={
 quality:Quality;pixelRatio:number;samples:number;shadowSize:number;ao:boolean;bloom:boolean;
 refineFrames:number;textureSize:512|1024;farWoodland:number;grass:boolean;skyBake:boolean;photographic:boolean;
 /** Rays per grid point for sunlight bounced indoors; 0 turns it off. */
 sunBounce:number;trees:TreeStyle;
};
export const tiers:Record<Quality,TierSettings>={
 detailed:{quality:'detailed',pixelRatio:2,samples:4,shadowSize:4096,ao:true,bloom:true,refineFrames:24,textureSize:1024,farWoodland:1,grass:true,skyBake:true,photographic:true,sunBounce:0,trees:'leaves'},
 balanced:{quality:'balanced',pixelRatio:1.5,samples:2,shadowSize:2048,ao:true,bloom:false,refineFrames:8,textureSize:512,farWoodland:.45,grass:false,skyBake:true,photographic:false,sunBounce:0,trees:'hybrid'},
 model:{quality:'model',pixelRatio:1.75,samples:4,shadowSize:2048,ao:false,bloom:false,refineFrames:0,textureSize:512,farWoodland:0,grass:false,skyBake:false,photographic:false,sunBounce:0,trees:'hybrid'},
};
/** The settings a viewer runs with. Detailed on a phone keeps the scene, materials and light, but fits a phone
 * browser's graphics memory: a 2048 shadow map and 2× multisampling need about 160 MB less at phone size. */
export function tierFor(quality:Quality,phone=isPhone()):TierSettings{
 return quality==='detailed'&&phone?{...tiers.detailed,shadowSize:2048,samples:2}:tiers[quality];
}
const weakGPU=/SwiftShader|llvmpipe|softpipe|Microsoft Basic Render|Mali-(4|T[678])|Adreno \(TM\) [345]\d\d|PowerVR SGX|Intel\(R\) (HD|UHD) Graphics( [2-6]\d\d)?\b/i;
export function isPhone(){
 if(typeof window==='undefined')return false;
 const coarse=window.matchMedia('(pointer: coarse)').matches,small=Math.min(screen.width,screen.height)<820;
 return coarse&&small||/iPhone|Android.+Mobile/i.test(navigator.userAgent);
}
/** Picks a preset from the device class and GPU; a URL or menu choice always wins. */
export function detectQuality():Quality{
 if(typeof window==='undefined')return 'model';
 let renderer='';
 try{const gl=document.createElement('canvas').getContext('webgl2');const info=gl?.getExtension('WEBGL_debug_renderer_info');renderer=info&&gl?String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)):'';gl?.getExtension('WEBGL_lose_context')?.loseContext();if(!gl)return 'model';}catch{return 'model';}
 if(weakGPU.test(renderer))return 'model';
 const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory;
 if(isPhone()||(memory!==undefined&&memory<8)||navigator.hardwareConcurrency<6)return 'balanced';
 return 'detailed';
}
export function qualityFromParam(value:string|null):Quality|undefined{
 if(value==='detailed'||value==='realism')return 'detailed';
 if(value==='balanced')return 'balanced';
 if(value==='model'||value==='natural')return 'model';
}
