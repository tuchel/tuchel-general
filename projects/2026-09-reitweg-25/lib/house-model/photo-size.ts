export function photoSize(viewWidth:number,viewHeight:number,pixelRatio:number,maximum:boolean,panorama:boolean){
 if(panorama){const width=maximum?4096:2048;return {width,height:width/2};}
 const longest=Math.max(1,viewWidth,viewHeight);
 const limit=maximum?3840:Math.min(1920,Math.round(longest*pixelRatio));
 const scale=limit/longest;
 return {width:Math.max(1,Math.round(viewWidth*scale)),height:Math.max(1,Math.round(viewHeight*scale))};
}
