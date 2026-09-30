import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// Interiors have the finish of a photograph of a sunlit room: a warm white balance indoors, a gentle S-curve and more
// colour, lighter corner shading, more bounced sunlight and the photographed timber and rug colours.
await build({entryPoints:['lib/house-model/look.ts','lib/house-model/build-model.ts'],outdir:'tmp/look-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {finish,sCurve}=await import('../tmp/look-check/look.mjs');
const luma=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
const out=finish(0),inside=finish(1);
assert.deepEqual(out.balance,[1,1,1],'outdoors keeps daylight white balance');
assert(inside.balance[0]>1.05&&inside.balance[2]<.9,`indoors the balance warms (${inside.balance.map(v=>v.toFixed(3))})`);
assert(Math.abs(luma(inside.balance)-1)<.01,'white balance keeps brightness');
for(const f of [out,inside]){for(const x of [0,.5**2.2,1])assert(Math.abs(sCurve(x,f.contrast)-x)<1e-6,`the S-curve holds ${x.toFixed(3)}`);
 assert(sCurve(.1,f.contrast)<.1&&sCurve(.5,f.contrast)>.5,'the S-curve deepens shadows and lifts light tones');assert(f.saturation>1);}
assert(inside.contrast>out.contrast&&inside.saturation>out.saturation,'interiors get more contrast and colour');
assert(inside.occlusion<out.occlusion-.2,`corner shading is lighter indoors (${inside.occlusion} vs ${out.occlusion})`);
const post=fs.readFileSync('lib/house-model/post.ts','utf8');assert(/finish\(/.test(post)&&/uBalance/.test(post)&&/uLook/.test(post),'the output pass applies the finish');
const bounce=fs.readFileSync('lib/house-model/sun-bounce.ts','utf8'),gain=+(/BOUNCE_GAIN=([\d.]+)/.exec(bounce)?.[1]??0);assert(gain>1.4&&gain<2.2,`bounced sunlight stands in for further bounces (gain ${gain})`);
// Timber and rug take the photographed hue and saturation (IMG_1502): honey-orange spruce, a pink rug.
const {buildHouseModel}=await import('../tmp/look-check/build-model.mjs');const model=buildHouseModel(true),hsl=c=>c.getHSL({h:0,s:0,l:0},T.SRGBColorSpace);
const colour=name=>{let found;model.root.traverse(o=>{if(!found&&o.isMesh&&[o.material].flat().some(m=>m.userData?.finish===name))found=[o.material].flat().find(m=>m.userData.finish===name);});assert(found,`${name} material`);return found.color;};
const spruce=hsl(colour('spruce')),rug=hsl(colour('rug'));
assert(spruce.h*360>24&&spruce.h*360<38&&spruce.s>.5,`spruce is honey-orange (hue ${(spruce.h*360).toFixed(0)}°, saturation ${spruce.s.toFixed(2)})`);
assert((rug.h*360>335||rug.h*360<5)&&rug.s>.45,`the rug is pink (hue ${(rug.h*360).toFixed(0)}°, saturation ${rug.s.toFixed(2)})`);
console.log(`Passed: indoor white balance ×(${inside.balance.map(v=>v.toFixed(2)).join(', ')}), S-curve ${out.contrast.toFixed(2)}→${inside.contrast.toFixed(2)}, saturation ${out.saturation.toFixed(2)}→${inside.saturation.toFixed(2)}, corner shading ${out.occlusion.toFixed(2)}→${inside.occlusion.toFixed(2)}, bounce gain ${gain}; spruce ${(spruce.h*360).toFixed(0)}°, rug ${(rug.h*360).toFixed(0)}°.`);
