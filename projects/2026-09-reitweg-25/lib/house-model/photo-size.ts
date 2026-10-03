export function photoSize(viewWidth:number,viewHeight:number,pixelRatio:number,maximum:boolean,panorama:boolean){
 if(panorama){const width=maximum?4096:2048;return {width,height:width/2};}
 const longest=Math.max(1,viewWidth,viewHeight);
 const limit=maximum?3840:Math.min(1920,Math.round(longest*pixelRatio));
 const scale=limit/longest;
 return {width:Math.max(1,Math.round(viewWidth*scale)),height:Math.max(1,Math.round(viewHeight*scale))};
}

/** The size limit of the "1 MB PNG" save: 1,000,000 bytes, under a mebibyte too. */
export const PHOTO_LIMIT=1_000_000;
/** The largest scale (up to 1) of an image whose encoding fits `limit` bytes, with that encoding. `encode(scale)` encodes
 * the image at a scale. The full image when it fits; otherwise a first guess from the bytes a pixel takes at full size,
 * then the bracket between the largest scale that fits and the smallest that does not is halved until it is within
 * 1%, or `tries` encodings have been made. */
export async function largestFitting<E extends {size:number}>(limit:number,encode:(scale:number)=>Promise<E>,tries=10):Promise<{scale:number;result:E}>{
 const full=await encode(1);if(full.size<=limit)return {scale:1,result:full};
 let fits:{scale:number;result:E}|undefined,over=1,guess=Math.sqrt(limit/full.size)*.98;
 for(let made=2;;made++){
  const result=await encode(guess);
  if(result.size<=limit)fits={scale:guess,result};else over=guess;
  if(fits&&(over-fits.scale<=fits.scale*.01||made>=tries))return fits;
  // Until one fits, shrink by the overshoot; then halve the bracket.
  guess=fits?(fits.scale+over)/2:guess*Math.sqrt(limit/result.size)*.97;
 }
}
/** `source` as the largest PNG within `limit` bytes (largestFitting): the full image when it fits, otherwise scaled down
 * in full colour, smoothed, without an alpha channel. It is copied before the first wait, so a WebGL canvas is read
 * before its drawing buffer is cleared and may keep drawing while the encodings run. */
export async function fitPng(source:HTMLCanvasElement,limit:number){
 const snapshot=document.createElement('canvas');snapshot.width=source.width;snapshot.height=source.height;snapshot.getContext('2d',{alpha:false})!.drawImage(source,0,0);
 const encode=(scale:number)=>new Promise<{size:number;blob:Blob;width:number;height:number}>((resolve,reject)=>{
  const width=Math.max(1,Math.round(snapshot.width*scale)),height=Math.max(1,Math.round(snapshot.height*scale)),c=document.createElement('canvas');c.width=width;c.height=height;
  const context=c.getContext('2d',{alpha:false})!;context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(snapshot,0,0,width,height);
  c.toBlob(blob=>blob?resolve({size:blob.size,blob,width,height}):reject(new Error('PNG encoding failed')),'image/png');
 });
 return (await largestFitting(limit,encode)).result;
}
