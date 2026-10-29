/** The finish of a photograph of a sunlit room, applied in the output pass (post.ts) and eased in as the camera goes
 * indoors (`indoor` 0 outdoors, 1 in a closed room; lighting.ts, roomExposure):
 * - white balance: indoors, as a phone camera does, the balance moves from daylight towards the warmer light that fills a
 *   room, so the blue of the sky no longer greys white walls; the gain keeps brightness;
 * - contrast: an S-curve on perceptual values that holds black, mid-grey and white, deepening shadows and lifting light
 *   tones without clipping, in the spirit of AgX's Punchy look;
 * - colour: saturation around each pixel's luminance;
 * - corner shading: ambient occlusion blends in less, since rooms lit by bounced sunlight have soft corners;
 * - shadow lift: indoors, as a phone camera's HDR does, the side of a room the sun misses is raised before the S-curve. A
 *   sunlit wall takes 20 to 50 times the light of the shaded one, which the eye takes in at once and a single exposure
 *   cannot; black and the sunlit tones stay where they were (shadowLift). */
const WARM=[1.089,.99,.832];
export function finish(indoor:number){
 const t=Math.min(1,Math.max(0,indoor));
 return {balance:WARM.map(g=>1+(g-1)*t),contrast:1.1+.1*t,saturation:1.1+.15*t,occlusion:.85-.35*t,lift:LIFT*t};
}
/** How far the shadow lift raises dark tones indoors (at most about 0.12 on the perceptual scale, around 0.2). */
const LIFT=1.5;
/** The shadow lift on a perceptual luminance, as the output shader applies it: m + lift·m·(1 − m)⁴. */
export const shadowLift=(m:number,lift:number)=>m+lift*m*(1-m)**4;
/** The S-curve on linear display values, as the output shader applies it: 0, 0.5 on the perceptual scale and 1 stay. */
export function sCurve(x:number,contrast:number){
 const e=Math.min(1,Math.max(0,x))**(1/2.2),p=e**contrast,q=(1-e)**contrast;
 return (p/Math.max(p+q,1e-5))**2.2;
}
