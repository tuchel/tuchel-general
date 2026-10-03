import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
// "1 MB PNG" saves the photograph as the largest PNG that fits in 1 MB (1,000,000 bytes, under a mebibyte too): the
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

// The wiring: the photograph is copied before the encodings (the live canvas keeps refining), scaled with smoothing,
// without an alpha channel; the status bar offers it beside Save PNG.
{const experience=fs.readFileSync('lib/house-model/experience.ts','utf8'),page=fs.readFileSync('components/studio/model/house-model.tsx','utf8');
 assert(/savePhoto:async\(limit\?:number\)=>/.test(experience)&&/largestFitting\(limit,/.test(experience),'a size-limited save');
 assert(/snapshot\.getContext\('2d'[^)]*\)!?\.drawImage\(canvas,0,0\)/.test(experience),'the photograph is copied before encoding');
 assert(/imageSmoothingQuality='high'/.test(experience)&&/alpha:false/.test(experience),'scaled with smoothing, no alpha channel');
 assert(/savePhoto\(PHOTO_LIMIT\)\}>1 MB PNG<\/button>/.test(page),'a 1 MB PNG button beside Save PNG');}
console.log('Passed: a photograph that fits is saved as it is; one that does not is scaled to within 1% of the largest size whose PNG fits in 1,000,000 bytes, never over, in at most 10 encodings.');
