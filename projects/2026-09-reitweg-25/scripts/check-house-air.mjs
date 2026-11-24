import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts','lib/house-model/mist.ts'],outdir:'tmp/air-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {tiers,tierFor}=await import('../tmp/air-check/device-tier.mjs'),{AIR_GLOW,MIST,glowGlsl,mistGlsl}=await import('../tmp/air-check/mist.mjs');
const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),post=read('post.ts'),viewer=read('viewer.ts');

// Extreme on a computer only.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].lampGlow,false,`${q} has no glow in the air`);
assert.equal(tiers.extreme.lampGlow,true);assert.equal(tierFor('extreme',true,true).lampGlow,false,'not on a phone');
// What a ray gathers from one lamp, as the shader sums it: the angle the lamp sees the ray under, over its distance.
const gathered=(along,h,dist)=>{h=Math.max(h,AIR_GLOW.nearest);return (Math.atan((dist-along)/h)+Math.atan(along/h))/h*Math.exp(-h/AIR_GLOW.reach);};
assert(gathered(5,.5,50)>gathered(5,2,50)&&gathered(5,2,50)>gathered(5,8,50),'fainter the farther the ray passes');
assert(gathered(5,1,4)<gathered(5,1,50)*.5,'a ray that ends at a wall before the lamp gathers less than half of one that passes it');
assert(Math.abs(gathered(5,1,1e6)-Math.PI*Math.exp(-1/AIR_GLOW.reach))<.25,'a long ray passing at 1 m gathers nearly the whole half turn, less what the air between takes');
// The air takes the light on its way to the ray, so a halo stays round its lamp and thirty lamps do not fog the garden.
assert(AIR_GLOW.most*gathered(20,12,1e6)<gathered(5,.5,50)*.05,'every lamp at 12 m together: under a twentieth of one lamp at half a metre');
assert(Number.isFinite(gathered(3,0,10)),'a ray through the lamp stays finite');
const glsl=glowGlsl(6);assert(/for\(int i=0;i<6;i\+\+\)/.test(glsl)&&glsl.includes(`sum+=(atan((dist-along)/h)+atan(along/h))/h*exp(-h/${AIR_GLOW.reach.toFixed(1)});`)&&/if\(glow\.r<=0\.0\)return vec3\(0\.0\);/.test(glsl));
assert(/uniform vec3 glowLamps\[1\]/.test(glowGlsl(0)),'no lamps: still a valid shader');
// The glow stands where lamplight reaches the outdoor air: outside lit glazing and at the path lights, nowhere invented.
assert(/glowLamps:tier\.lampGlow\?lampsOutdoors\(\):undefined/.test(viewer));
// As strong as the lamps are on, in mist, rain or falling snow; a faint part of it on a clear night; none by day.
assert(/outdoors\?r\.dusk\*Math\.max\(lies,snowing\|\|raining\?1:0,AIR_GLOW\.clear\):0/.test(viewer)&&AIR_GLOW.clear>0&&AIR_GLOW.clear<.3);
assert(/mistPass\.enabled=amount>\.002\|\|lit>0;/.test(post),'the pass runs for either');
// The path-traced still has no air of its own and is given the same glow.
assert(/t=mistOver\(t,eye,point,mist\)\+lampGlow\(eye,normalize\(point-eye\),length\(point-eye\)\);/.test(post)&&/new TracedBlend\(options\.glowLamps\)/.test(post));
// Mist lies unevenly near by and evenly far off, round its mean.
assert(MIST.patch[0]<1&&MIST.patch[1]>1&&Math.abs((MIST.patch[0]+MIST.patch[1])/2-1)<.05&&mistGlsl.includes('smoothstep(90.0,150.0,far)'));
console.log(`Passed: in Extreme on a computer, lit windows and the path lights hang a glow in mist, rain and snowfall (${AIR_GLOW.clear*100}% of it on a clear night), in the live view and the traced still; mist lies in pools.`);
