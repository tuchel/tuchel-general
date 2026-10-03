import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
// "1 MB PNG" saves the photograph, or the still image (Save image), as the largest PNG that fits in 1 MB (1,000,000 bytes, under a mebibyte too): the
// full image when it fits, otherwise the image scaled down, in full colour, to the largest size whose PNG fits. The
// size is found by encoding: a first guess from the bytes a pixel takes at full size, then halving the bracket.
await build({entryPoints:['lib/house-model/photo-size.ts'],outdir:'tmp/photo-limit-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {largestFitting,PHOTO_LIMIT}=await import('../tmp/photo-limit-check/photo-size.mjs');
assert.equal(PHOTO_LIMIT,1_000_000,'1 MB');

// An encoder whose PNG takes `perPixel` bytes a pixel plus a header, with `wobble` of content-dependent scatter.
const encoder=(width,height,perPixel,wobble=0)=>{const calls=[];return {calls,encode:async scale=>{calls.push(scale);
 const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),scatter=1+wobble*Math.sin(w*12.9898+h*78.233);
 return {size:Math.round((w*h*perPixel+2000)*scatter),width:w,height:h};}};};

// A photograph that already fits is saved as it is, from one encoding.
{const e=encoder(800,500,2),r=await largestFitting(PHOTO_LIMIT,e.encode);assert.equal(r.scale,1);assert.equal(e.calls.length,1,'one encoding');}
// A 1920 × 1200 photograph at 2.2 bytes a pixel (5.07 MB) is scaled to within 1% of the largest size that fits.
for(const [w,h,perPixel,wobble] of [[1920,1200,2.2,0],[3840,2400,2.6,.03],[2048,1024,1.4,.05],[1920,1200,9,0]]){
 const e=encoder(w,h,perPixel,wobble),r=await largestFitting(PHOTO_LIMIT,e.encode),ideal=Math.sqrt((PHOTO_LIMIT/(1+wobble)-2000)/(w*h*perPixel));
 assert(r.result.size<=PHOTO_LIMIT,`${w} × ${h}: never over 1 MB (${r.result.size} bytes)`);
 assert(r.scale>=ideal*.99,`${w} × ${h} at ${perPixel} bytes a pixel: ${r.result.width} × ${r.result.height} is within 1% of the largest that fits (scale ${r.scale.toFixed(3)} against ${ideal.toFixed(3)})`);
 assert(e.calls.length<=10,`${w} × ${h}: ${e.calls.length} encodings`);
}

// The wiring: the image is copied before the encodings (the live canvas keeps drawing), scaled with smoothing, without
// an alpha channel. The photograph's status bar offers it beside Save PNG; More offers it under Save image.
{const read=f=>fs.readFileSync(f,'utf8'),size=read('lib/house-model/photo-size.ts'),experience=read('lib/house-model/experience.ts'),viewer=read('lib/house-model/viewer.ts');
 const page=read('components/studio/model/house-model.tsx'),panels=read('components/studio/model/model-panels.tsx');
 assert(/export async function fitPng\(source:HTMLCanvasElement,limit:number\)/.test(size)&&/largestFitting\(limit,/.test(size),'one size-limited encoder');
 assert(/snapshot\.getContext\('2d'[^)]*\)!?\.drawImage\(source,0,0\);\n[^]*await/.test(size),'the image is copied before the first wait');
 assert(/imageSmoothingQuality='high'/.test(size)&&/alpha:false/.test(size),'scaled with smoothing, no alpha channel');
 assert(/savePhoto:async\(limit\?:number\)=>/.test(experience)&&/fitPng\(canvas,limit\)/.test(experience),'the photograph within a limit');
 assert(/const saveImage=async\(limit\?:number\)=>/.test(viewer)&&/fitPng\(canvas,limit\)/.test(viewer),'the still image within a limit');
 assert(/savePhoto\(PHOTO_LIMIT\)\}>1 MB PNG<\/button>/.test(page),'a 1 MB PNG button beside Save PNG');
 assert(/onClick=\{\(\)=>p\.onSave\(PHOTO_LIMIT\)\}>Save image<small>1 MB PNG<\/small><\/button>/.test(panels)&&/onSave=\{limit=>\{setPanel\(null\);void api\.current\?\.saveImage\(limit\);\}\}/.test(page),'a 1 MB Save image row in More');}
console.log('Passed: an image that fits is saved as it is; one that does not is scaled to within 1% of the largest size whose PNG fits in 1,000,000 bytes, never over, in at most 10 encodings.');
