import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/clouds.ts','lib/house-model/device-tier.ts','lib/house-model/sun-position.ts'],outdir:'tmp/clouds-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {CLOUDS,coverageThreshold}=await import('../tmp/clouds-check/clouds.mjs');
const {tiers}=await import('../tmp/clouds-check/device-tier.mjs');
const {sunDirection,sunStudyReading,initialSunStudy}=await import('../tmp/clouds-check/sun-position.mjs');

// The cloud field of clouds.ts (its GLSL, without the fine erosion), in JavaScript.
const fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t,smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
const hash3=(x,y,z)=>{x=fract(x*.3183099+.1)*17;y=fract(y*.3183099+.1)*17;z=fract(z*.3183099+.1)*17;return fract(x*y*z*(x+y+z));};
const noise3=(x,y,z)=>{const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),h=(a,b,c)=>hash3(ix+a,iy+b,iz+c);let fx=x-ix,fy=y-iy,fz=z-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
 return mix(mix(mix(h(0,0,0),h(1,0,0),fx),mix(h(0,1,0),h(1,1,0),fx),fy),mix(mix(h(0,0,1),h(1,0,1),fx),mix(h(0,1,1),h(1,1,1),fx),fy),fz);};
const fbm3=(x,y,z,o)=>{let s=0,a=.5;for(let i=0;i<o;i++){s+=a*noise3(x,y,z);x=x*2.03+17.1;y=y*2.03+3.7;z=z*2.03+9.3;a*=.5;}return s;};
const density=(x,y,z,wind=CLOUDS.start)=>{
 const h=(y-CLOUDS.base)/(CLOUDS.top-CLOUDS.base);if(h<0||h>1)return 0;
 const qx=x+wind[0],qz=z+wind[1],groups=(fbm3(qx/9000,qz/9000,1.7,3)-.438)/.091,cells=(fbm3(qx/2400,y/2400,qz/2400,3)-.438)/.091;
 const excess=cells-(coverageThreshold(CLOUDS.coverage)-groups*.35);if(excess<=0)return 0;
 const top=.25+.75*Math.min(1,excess/1.6);return Math.min(1,excess/.8)*smooth(0,.05,h)*(1-smooth(top*.55,top,h));
};
const shade=(x,z,sun,wind)=>{const t0=CLOUDS.base/sun[1],t1=CLOUDS.top/sun[1],st=(t1-t0)/16;let tau=0;for(let i=0;i<16;i++){const t=t0+st*(i+.5);tau+=density(x+sun[0]*t,sun[1]*t,z+sun[2]*t,wind)*st;}return Math.exp(-tau*CLOUDS.extinction);};

// Fair-weather cumulus: a layer about a kilometre thick with its base near 1.4 km, a third of the sky covered, drifting
// at a spring breeze's 5–10 m/s.
assert(CLOUDS.base>=1000&&CLOUDS.base<=2000&&CLOUDS.top-CLOUDS.base>=800&&CLOUDS.top-CLOUDS.base<=1500,'cumulus heights');
assert(CLOUDS.coverage>=.25&&CLOUDS.coverage<=.5,'about a third of the sky');
// The coverage setting holds: over a 40 km square, the share of columns with cloud is within five points of it.
let columns=0,clouded=0;for(let x=-20000;x<20000;x+=400)for(let z=-20000;z<20000;z+=400){columns++;let c=0;for(let y=CLOUDS.base+20;y<CLOUDS.top;y+=120)c=Math.max(c,density(x,y,z));if(c>.05)clouded++;}
assert(Math.abs(clouded/columns-CLOUDS.coverage)<.05,`${(clouded/columns*100).toFixed(0)}% of the sky clouded`);
// At the opening hour the house stands in sunshine, with cloud shadows on the fields around it.
const reading=sunStudyReading({...initialSunStudy,enabled:true}),dir=sunDirection(reading.azimuth,reading.apparentElevation),len=Math.hypot(...dir),sun=dir.map(v=>v/len);
for(const [x,z] of [[0,0],[-60,0],[60,0],[0,-60],[0,60]])assert(shade(x,z,sun)>.98,`sunlight reaches the house at ${x},${z}`);
let near=0,nearN=0;for(let x=-450;x<=450;x+=75)for(let z=-450;z<=450;z+=75){if(Math.hypot(x,z)>450)continue;nearN++;if(shade(x,z,sun)<.5)near++;}
assert(near/nearN>.1,`cloud shadows within 450 m (${(near/nearN*100).toFixed(0)}%)`);
const speed=Math.hypot(...CLOUDS.wind);assert(speed>=5&&speed<=10,`wind ${speed.toFixed(1)} m/s`);
assert(CLOUDS.wind[0]>0&&CLOUDS.wind[1]<0,'clouds travel east-north-east');
const clouds=fs.readFileSync('lib/house-model/clouds.ts','utf8');
assert(/wind\.value\.set\(CLOUDS\.start\[0\]-CLOUDS\.wind\[0\]\*seconds/.test(clouds),'the sampling offset moves against the wind, so the clouds move with it');
// The sky texture gives the horizon most of its rows (rows follow the square root of the sine of elevation): the lowest
// 10° get two fifths, and at 5° elevation a row spans under 0.1°.
const row=e=>Math.sqrt(Math.sin(e*Math.PI/180));
assert(row(10)>.4,'the lowest 10° get two fifths of the rows');
const perRow=(row(5.01)-row(5))*CLOUDS.sky.height;assert(1/(perRow/.01)<.1,`${(1/(perRow/.01)).toFixed(3)}° a row at 5°`);
// Cloud shadows cover the lot with room to spare, at a few metres a texel.
const texel=CLOUDS.shadow.span/CLOUDS.shadow.size;assert(CLOUDS.shadow.span>=2000&&texel<=8,`${texel.toFixed(1)} m a shadow texel`);
// Extreme only; the sky and the sky light both read the clouds, which replace the flat layer; every lit surface takes
// their shadow, the breeze moves them and the path tracer's sun is dimmed by what is over the house.
assert.equal(tiers.extreme.clouds,true);for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].clouds,false,`${q} keeps the flat layer`);
// A new sun re-bakes the sky a few bands a frame, round the sky in a few frames, so dragging the time stays smooth.
const bands=CLOUDS.sky.height/CLOUDS.sky.band;assert(CLOUDS.sky.perFrame>=1&&bands/CLOUDS.sky.perFrame<=4,`${CLOUDS.sky.perFrame} of ${bands} bands a frame`);
assert(!/for\(let i=0;i<bands;i\+\+\)drawBand\(\)/.test(clouds),'no frame bakes the whole sky');
// GLSL cannot be compiled here; at least every shader string in clouds.ts balances its braces.
const source=fs.readFileSync('lib/house-model/clouds.ts','utf8');
for(const [,glsl] of source.matchAll(/(?:NOISE=|fragmentShader:)`([^`]*)`/g)){const body=glsl.replace(/\$\{[^}]*\}/g,'0');assert.equal((body.match(/\{/g)||[]).length,(body.match(/\}/g)||[]).length,'balanced braces in a cloud shader');}
const lighting=fs.readFileSync('lib/house-model/lighting.ts','utf8'),viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8'),scene=fs.readFileSync('lib/house-model/photographic-scene.ts','utf8');
assert(/cloudsToward\(direction\)/.test(lighting)&&/cloudCoverage\.value=clouds\?0:SKY\.clouds/.test(lighting),'the sky shows the clouds instead of the flat layer');
assert(/clouds\?\.shade\(\[scene\]\)/.test(viewer),'lit surfaces take cloud shadows');
assert(/lighting\?\.drift\(captures\.waterSeconds\)/.test(viewer),'the breeze moves the clouds');
assert(/intensity\*=sunScale/.test(scene),'the traced sun is dimmed by cloud over the house');
console.log(`Passed: cumulus from ${CLOUDS.base} to ${CLOUDS.top} m covering ${CLOUDS.coverage*100}% of the sky, drifting ${speed.toFixed(1)} m/s with the breeze; ${(row(10)*100).toFixed(0)}% of the sky texture's rows for the lowest 10°; cloud shadows ${CLOUDS.shadow.span/1000} km across at ${texel.toFixed(1)} m a texel.`);
