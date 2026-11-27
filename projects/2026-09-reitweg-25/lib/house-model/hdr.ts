/** A screen that shows brighter than white is given it (Extreme). The view is exposed like a photograph, its brightest
 * surfaces near 1, and the finish presses them under white. Here the finished image keeps its look up to light of
 * `knee`; the brightest twentieth or so of a sunlit view (paving and walls in the sun, the sky by the sun, glints on
 * the pool, lamps at night) is shown brighter by its excess over `knee` to the power `curve`, up to `peak` times
 * white (post.ts). A browser draws WebGL only up to white, so the image is drawn into a floating-point canvas and
 * copied, frame by frame and on the graphics card, to a WebGPU canvas over it that the screen shows at its full range. */
export const HDR={knee:.5,curve:1,peak:3};

export type HdrScreen={
 /** The canvas was drawn on: show it. */
 present():void;
 dispose():void;
};
// The parts of WebGPU used here.
type Device={queue:{copyExternalImageToTexture(source:{source:HTMLCanvasElement},to:{texture:unknown;colorSpace:string},size:number[]):void};lost:Promise<unknown>;destroy():void};
type Context={configure(to:Record<string,unknown>):void;getConfiguration():{toneMapping?:{mode?:string}};getCurrentTexture():unknown};
type FloatCanvas=WebGL2RenderingContext&{drawingBufferStorage?:(format:number,width:number,height:number)=>void};

/** Whether to try: the screen shows above white now, and the browser has what the copy needs (`own`: the canvas is
 * WebGPU's own and needs no copy). `?hdr=off` and `?hdr=on` decide for the screen. (A WebGL canvas is given floating point only if its context has alpha; three's always has.) */
export function hdrWanted(own=false){
 const asked=new URLSearchParams(location.search).get('hdr');
 return asked!=='off'&&(asked==='on'||window.matchMedia('(dynamic-range: high)').matches)&&(own||'gpu' in navigator&&'drawingBufferStorage' in WebGL2RenderingContext.prototype);
}

/** Undefined where the graphics card or the browser refuses any step; the canvas is then left as it was. */
export async function createHdrScreen(canvas:HTMLCanvasElement,gl:WebGL2RenderingContext,lost:()=>void):Promise<HdrScreen|undefined>{
 try{
  const adapter=await (navigator as Navigator&{gpu:{requestAdapter():Promise<{requestDevice():Promise<Device>}|null>}}).gpu.requestAdapter(),device=await adapter?.requestDevice();
  if(!device||!canvas.parentElement)return;
  const screen=document.createElement('canvas'),context=screen.getContext('webgpu') as unknown as Context|null;
  if(!context)return;
  // Usage: a render attachment (0x10) that can be copied to (0x02).
  context.configure({device,format:'rgba16float',colorSpace:'display-p3',alphaMode:'opaque',toneMapping:{mode:'extended'},usage:0x10|0x02});
  if(context.getConfiguration().toneMapping?.mode!=='extended')return;
  gl.getExtension('EXT_color_buffer_half_float');
  (gl as FloatCanvas).drawingBufferStorage!(gl.RGBA16F,canvas.width,canvas.height);
  if((gl as WebGL2RenderingContext&{drawingBufferFormat?:number}).drawingBufferFormat!==gl.RGBA16F)return;
  screen.setAttribute('aria-hidden','true');screen.style.cssText='position:absolute;inset:0;pointer-events:none';
  canvas.parentElement.insertBefore(screen,canvas.nextSibling);
  let gone=false;
  const dispose=()=>{gone=true;screen.remove();device.destroy();};
  void device.lost.then(()=>{if(!gone){screen.remove();gone=true;lost();}});
  return {
   present(){
    if(gone||!canvas.width||!canvas.height)return;
    if(screen.width!==canvas.width||screen.height!==canvas.height){screen.width=canvas.width;screen.height=canvas.height;}
    device.queue.copyExternalImageToTexture({source:canvas},{texture:context.getCurrentTexture(),colorSpace:'display-p3'},[canvas.width,canvas.height]);
   },
   dispose,
  };
 }catch{return;}
}
