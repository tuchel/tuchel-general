import type {TreeStyle} from './foliage';

/** Rendering presets. "extreme" is the photographic scene at full Retina resolution, path-traced whenever the camera
 * rests; "detailed" is the full photographic scene, "balanced" keeps the same scene at phone-friendly cost, "model" is
 * the plain architectural model. */
export type Quality='extreme'|'detailed'|'balanced'|'model';
export type TierSettings={
 quality:Quality;pixelRatio:number;samples:number;shadowSize:number;ao:boolean;bloom:boolean;
 /** Sunlight bounces traced indoors (sun-bounce.ts); the rest are extrapolated from the last two. */
 bounces:number;
 /** Trees the house hides are not drawn, counted by the graphics card (tree-occlusion.ts). */
 treeOcclusion:boolean;
 /** Moving frames at the largest scale that holds 60 frames a second, from `motionScale` (motion-resolution.ts). */
 steerMotion:boolean;
 /** The main rooms reflect themselves rather than the sky (room-probes.ts). */
 roomProbes:boolean;
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
 /** Outdoor surfaces show weather (surface-materials.ts), and things cast short shadows where they touch
  * (contact-shadows.ts). */
 weathered:boolean;
 /** Wet ground mirrors the scene while it rains (wet-reflections.ts). */
 wetMirror:boolean;
 /** Moving frames build on the image the view has gathered, instead of starting over (temporal.ts). */
 temporal:boolean;
 /** Lamps hang halos in thick air, and mist lies unevenly (mist.ts, AIR_GLOW). */
 lampGlow:boolean;
 /** Scanned surfaces have depth seen at an angle (surface-materials.ts, RELIEF). */
 relief:boolean;
 /** Modelled leaves seen close have veins, faces and a sheen (foliage.ts, LEAF_DETAIL). */
 leafDetail:boolean;
 /** Leaves, grass and water stir while the camera moves (atmosphere.ts, STIR). */
 living:boolean;
 /** A traced view's light stays on its surfaces while the camera moves (carry.ts, LIGHT_CARRY). */
 lightCarry:boolean;
 /** The sun's shadows soften with distance (soft-shadows.ts). */
 softShadows:boolean;
 /** Light above white on a screen that shows it (hdr.ts). */
 hdr:boolean;
 /** Resolution of moving frames relative to still ones (1: the same). */
 motionScale:number;
 /** The garage's cars: modelled (car-models.ts) or none. A modelled car whose file fails keeps its traced stand-in
  * (garage-cars.ts). */
 cars:'modelled'|'none';
};
export const tiers:Record<Quality,TierSettings>={
 extreme:{quality:'extreme',bounces:4,treeOcclusion:true,steerMotion:true,roomProbes:true,pixelRatio:3,samples:4,shadowSize:4096,ao:true,bloom:true,refineFrames:32,textureSize:1024,farWoodland:1,grass:true,skyBake:true,photographic:true,sunBounce:32,trees:'leaves',liveTrace:true,lens:true,clouds:true,poolMirror:true,scanned:true,weathered:true,wetMirror:true,temporal:true,lampGlow:true,relief:true,leafDetail:true,living:true,lightCarry:true,softShadows:true,hdr:true,motionScale:.7,cars:'modelled'},
 detailed:{quality:'detailed',bounces:4,treeOcclusion:false,steerMotion:false,roomProbes:false,pixelRatio:2,samples:4,shadowSize:4096,ao:true,bloom:true,refineFrames:24,textureSize:1024,farWoodland:1,grass:true,skyBake:true,photographic:true,sunBounce:32,trees:'leaves',liveTrace:false,lens:false,clouds:false,poolMirror:false,scanned:false,weathered:false,wetMirror:false,temporal:false,lampGlow:false,relief:false,leafDetail:false,living:false,lightCarry:false,softShadows:false,hdr:false,motionScale:.7,cars:'modelled'},
 balanced:{quality:'balanced',bounces:4,treeOcclusion:false,steerMotion:false,roomProbes:false,pixelRatio:1.5,samples:2,shadowSize:2048,ao:true,bloom:false,refineFrames:8,textureSize:512,farWoodland:.45,grass:false,skyBake:true,photographic:false,sunBounce:24,trees:'hybrid',liveTrace:false,lens:false,clouds:false,poolMirror:false,scanned:false,weathered:false,wetMirror:false,temporal:false,lampGlow:false,relief:false,leafDetail:false,living:false,lightCarry:false,softShadows:false,hdr:false,motionScale:1,cars:'none'},
 model:{quality:'model',bounces:1,treeOcclusion:false,steerMotion:false,roomProbes:false,pixelRatio:1.75,samples:4,shadowSize:2048,ao:false,bloom:false,refineFrames:0,textureSize:512,farWoodland:0,grass:false,skyBake:false,photographic:false,sunBounce:0,trees:'hybrid',liveTrace:false,lens:false,clouds:false,poolMirror:false,scanned:false,weathered:false,wetMirror:false,temporal:false,lampGlow:false,relief:false,leafDetail:false,living:false,lightCarry:false,softShadows:false,hdr:false,motionScale:1,cars:'none'},
};
/** Extreme on a phone, for someone who asked for it past the menu's warning: Extreme's scene, lens, weather and
 * surfaces, at what a phone's graphics memory holds. No path tracing, room reflections or mirroring wet ground, twice the screen's points at
 * most, Detailed-on-a-phone's shadow map and multisampling, and half the refining frames. */
export const PHONE_EXTREME={pixelRatio:2,shadowSize:2048,samples:2,refineFrames:16,liveTrace:false,roomProbes:false,wetMirror:false,temporal:false,lampGlow:false,relief:false,leafDetail:false,living:false,lightCarry:false,softShadows:false,hdr:false,motionScale:.6} as const;
/** The settings a viewer runs with. Detailed on a phone keeps the scene, materials and light, but fits a phone
 * browser's graphics memory: a 2048 shadow map and 2× multisampling need about 160 MB less at phone size. Extreme is
 * for a computer's graphics card; a phone given it runs Detailed, unless its user chose it past the warning
 * (`extremeOnPhone`, PHONE_EXTREME). */
/** Extreme's parts that the WebGPU renderer does not draw yet. With `?renderer=webgpu` they are left off, so Extreme is
 * Detailed at Extreme's resolution plus what has been ported; `&try=treeOcclusion` turns named parts on there, to test
 * one on a real graphics card before it comes off this list, and `&without=softShadows,roomProbes` turns named on-off
 * parts off on either renderer, to find what one costs or adds. */
export const WEBGPU_PENDING=['treeOcclusion'] as const;
/** `tier` with the named on-off parts off (`&without=`, on either renderer). */
export const lacking=(tier:TierSettings,without:string[]=[]):TierSettings=>({...tier,...Object.fromEntries(without.filter(k=>typeof (tier as unknown as Record<string,unknown>)[k]==='boolean').map(k=>[k,false]))});
export const forWebGPU=(tier:TierSettings,tried:string[]=[],without:string[]=[]):TierSettings=>lacking({...tier,...Object.fromEntries(WEBGPU_PENDING.filter(k=>!tried.includes(k)).map(k=>[k,false]))},without);
export function tierFor(quality:Quality,phone=isPhone(),extremeOnPhone=false):TierSettings{
 if(phone&&quality==='extreme'&&extremeOnPhone)return {...tiers.extreme,...PHONE_EXTREME};
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
