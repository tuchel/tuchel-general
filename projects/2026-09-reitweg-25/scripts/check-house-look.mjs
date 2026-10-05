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
const bounce=fs.readFileSync('lib/house-model/sun-bounce-core.ts','utf8'),reflectance=+(/REFLECTANCE=([\d.]+)/.exec(bounce)?.[1]??0),gain=1/(1-reflectance);assert(gain>1.4&&gain<2.2,`bounced sunlight stands in for further bounces (gain ${gain})`);
// Extreme on a wide-gamut display draws in Display P3. three's output pass applies only the transfer curve, so the finish
// converts the graded linear sRGB to linear P3 itself, before clamping: colours the grade saturates past sRGB stay
// saturated instead of clipping, and white stays white.
{const {DisplayP3ColorSpaceImpl}=await import('three/addons/math/ColorSpaces.js');
 const toXYZ=new T.Matrix3().set(0.4124564,0.3575761,0.1804375,0.2126729,0.7151522,0.0721750,0.0193339,0.1191920,0.9503041);
 const expected=new T.Matrix3().multiplyMatrices(DisplayP3ColorSpaceImpl.fromXYZ,toXYZ).elements;
 const found=/const mat3 P3_FROM_SRGB=mat3\(([^)]*)\)/.exec(post)?.[1].split(',').map(Number);
 assert(found&&found.every((v,i)=>Math.abs(v-expected[i])<1e-6),'the sRGB-to-P3 matrix (column by column)');
 const m=new T.Matrix3().fromArray(found),white=new T.Vector3(1,1,1).applyMatrix3(m),green=new T.Vector3(-.08,.9,-.04).applyMatrix3(m);
 assert(Math.abs(white.x-1)<1e-3&&Math.abs(white.y-1)<1e-3&&Math.abs(white.z-1)<1e-3,'white stays white');
 assert(green.x>0&&green.y>0&&green.z>0,'a green past sRGB lies inside P3');
 assert(/vec3 g=l\+uLook\.y\*\(c-l\);if\(uP3>0\.5\)g=P3_FROM_SRGB\*g;gl_FragColor\.rgb=max\(vec3\(0\.0\),g\);/.test(post),'converted before the clamp');
 assert(/output\.uniforms\.uP3\.value=renderer\.outputColorSpace===DisplayP3ColorSpace\?1:0/.test(post),'when the canvas is P3');
 const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');
 assert(/const wide=tier\.quality==='extreme'&&window\.matchMedia\('\(color-gamut: p3\)'\)\.matches/.test(viewer),'Extreme on a P3 display only');
 assert(/ColorManagement\.define\(\{\[DisplayP3ColorSpace\]:DisplayP3ColorSpaceImpl\}\)/.test(viewer)&&/renderer\.outputColorSpace=wide\?DisplayP3ColorSpace:T\.SRGBColorSpace/.test(viewer),'the canvas draws in P3');
 // Photographs, recordings and saved images leave the canvas as files and video: they draw in sRGB.
 assert(/const space=wide&&!captures\?\.active&&!captures\?\.recording\?DisplayP3ColorSpace:T\.SRGBColorSpace;[^\n]*\n[^\n]*if\(captures\?\.tick\(now\)\)return;/.test(viewer),'captures draw in sRGB');
 assert(/const saveImage=async\([^)]*\)=>\{[^]*?renderer\.outputColorSpace=T\.SRGBColorSpace;/.test(viewer),'a saved image draws in sRGB');
 assert((post.match(/output\.uniforms\.uP3\.value=renderer\.outputColorSpace===DisplayP3ColorSpace\?1:0/g)??[]).length===2,'the live and the traced image alike');}
// Timber and rug take the photographed hue and saturation (IMG_1502): honey-orange spruce, a pink rug.
const {buildHouseModel}=await import('../tmp/look-check/build-model.mjs');const model=buildHouseModel(true),hsl=c=>c.getHSL({h:0,s:0,l:0},T.SRGBColorSpace);
const colour=name=>{let found;model.root.traverse(o=>{if(!found&&o.isMesh&&[o.material].flat().some(m=>m.userData?.finish===name))found=[o.material].flat().find(m=>m.userData.finish===name);});assert(found,`${name} material`);return found.color;};
const spruce=hsl(colour('spruce')),rug=hsl(colour('rug'));
assert(spruce.h*360>24&&spruce.h*360<38&&spruce.s>.5,`spruce is honey-orange (hue ${(spruce.h*360).toFixed(0)}°, saturation ${spruce.s.toFixed(2)})`);
assert((rug.h*360>335||rug.h*360<5)&&rug.s>.45,`the rug is pink (hue ${(rug.h*360).toFixed(0)}°, saturation ${rug.s.toFixed(2)})`);
console.log(`Passed: indoor white balance ×(${inside.balance.map(v=>v.toFixed(2)).join(', ')}), S-curve ${out.contrast.toFixed(2)}→${inside.contrast.toFixed(2)}, saturation ${out.saturation.toFixed(2)}→${inside.saturation.toFixed(2)}, corner shading ${out.occlusion.toFixed(2)}→${inside.occlusion.toFixed(2)}, bounce gain ${gain}; spruce ${(spruce.h*360).toFixed(0)}°, rug ${(rug.h*360).toFixed(0)}°.`);
