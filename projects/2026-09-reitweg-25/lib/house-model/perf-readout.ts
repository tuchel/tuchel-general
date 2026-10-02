import * as T from 'three';

/** A performance readout for `?debug=perf`: graphics-card time per render pass (where the browser offers WebGL's timer
 * queries), processor time per drawn frame, what is drawn, and how a resting path trace progresses. Nothing here runs
 * unless the readout is asked for. */

/** Mean of the last `size` values. */
export function rolling(size=60){
 const values:number[]=[];
 return {
  add(v:number){values.push(v);if(values.length>size)values.shift();},
  get mean(){return values.length?values.reduce((a,b)=>a+b,0)/values.length:NaN;},
 };
}

/** A resting path trace, timed from the moment the view rests: its scene ready, first image, first denoised image and
 * finish, and samples per second between the first image and the latest. */
export function traceClock(){
 let start=NaN,ready=NaN,first=NaN,denoised=NaN,done=NaN,stage=0;
 let from:{t:number;samples:number}|undefined,latest:{t:number;samples:number}|undefined;
 return {
  rest(t:number){start=t;ready=first=denoised=done=NaN;stage=0;from=latest=undefined;},
  ready(t:number){if(Number.isFinite(start)&&Number.isNaN(ready))ready=t-start;},
  step(t:number,result:{samples:number;denoised:number}|undefined,finished:boolean){
   if(!Number.isFinite(start))return;
   if(result){
    if(Number.isNaN(first)){first=t-start;from={t,samples:result.samples};}
    latest={t,samples:result.samples};
    if(result.denoised){stage=result.denoised;if(Number.isNaN(denoised))denoised=t-start;}
   }
   if(finished&&Number.isNaN(done))done=t-start;
  },
  get sceneReady(){return ready;},get firstImage(){return first;},get firstDenoised(){return denoised;},get finished(){return done;},
  get stage(){return stage;},
  get samplesPerSecond(){return from&&latest&&latest.t>from.t?(latest.samples-from.samples)/(latest.t-from.t)*1000:NaN;},
 };
}
export type TraceClock=ReturnType<typeof traceClock>;

export type ReadoutState={
 quality:string;pixelRatio:number;motionScale:number;moving:boolean;fps:number;cpu:number;
 gpu:Map<string,number>;gpuAvailable:boolean;draws:number;triangles:number;programs:number;
 trace?:{phase:string;clock:TraceClock};
};
const n=(v:number,digits=1)=>Number.isFinite(v)?v.toFixed(digits):'–';
const s=(ms:number)=>Number.isFinite(ms)?`${(ms/1000).toFixed(1)} s`:'–';
export function readoutText(r:ReadoutState){
 const lines=[`${r.quality} · ${r.pixelRatio}× pixels${r.motionScale<1?`, ${r.motionScale}× while moving`:''} · ${Math.round(r.fps)} fps · ${n(r.cpu)} ms processor a frame${r.moving?' · moving':''}`];
 if(!r.gpuAvailable)lines.push('graphics-card timers unavailable in this browser');
 else{
  // Four passes a line, in the order they run, under the total.
  let total=0;const parts:string[]=[];for(const [label,ms] of r.gpu){parts.push(`${label} ${n(ms)}`);total+=ms;}
  lines.push(`graphics card ms${parts.length?` · total ${n(total)}`:''}`);
  for(let i=0;i<parts.length;i+=4)lines.push('  '+parts.slice(i,i+4).join(' · '));
 }
 lines.push(`${r.draws} draws · ${(r.triangles/1e6).toFixed(2)} M triangles · ${r.programs} programs`);
 if(r.trace){
  const c=r.trace.clock;
  lines.push(`trace ${r.trace.phase} · scene ${s(c.sceneReady)} · first image ${s(c.firstImage)} · denoised ${c.stage?`${c.stage} at ${s(c.firstDenoised)}`:'–'} · finished ${s(c.finished)} · ${n(c.samplesPerSecond,0)} samples/s`);
 }
 return lines.join('\n');
}

type Timed={render:(...args:never[])=>void};
/** The readout over the viewer (`host`). `time` measures a stretch of drawing on the graphics card and `baked` a bake
 * that did some work; `watch` times each pass of a chain; `begin` and `end` bracket a frame; `rest` and `trace` follow
 * the path trace. */
export function createPerfReadout(renderer:T.WebGLRenderer,host:HTMLElement,view:{quality:string;motionScale:number}){
 const gl=renderer.getContext() as WebGL2RenderingContext;
 const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;
 // Draws and triangles over the whole frame, not the last of its renders.
 renderer.info.autoReset=false;
 const pending:{label:string;query:WebGLQuery}[]=[],gpu=new Map<string,ReturnType<typeof rolling>>(),cpu=rolling(60),frames:number[]=[],clock=traceClock();
 let active=false,drew=false,started=0,draws=0,triangles=0,moving=false,phase='',tracing=false;
 const poll=()=>{
  if(!ext)return;
  const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
  while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
   const {label,query}=pending.shift()!;
   if(!disjoint){let r=gpu.get(label);if(!r)gpu.set(label,r=rolling(60));r.add((gl.getQueryParameter(query,gl.QUERY_RESULT) as number)/1e6);}
   gl.deleteQuery(query);
  }
  // A context that stops answering does not grow the queue without end.
  while(pending.length>240)gl.deleteQuery(pending.shift()!.query);
 };
 /** `kept`: whether the measurement counts (a bake that found nothing to do does not). */
 const measure=<R>(label:string,work:()=>R,kept:(result:R)=>boolean):R=>{
  if(!ext||active)return work();
  const query=gl.createQuery();if(!query)return work();
  gl.beginQuery(ext.TIME_ELAPSED_EXT,query);active=true;let result:R|undefined,ok=false;
  try{result=work();ok=true;return result;}
  finally{gl.endQuery(ext.TIME_ELAPSED_EXT);active=false;if(ok&&kept(result as R))pending.push({label,query});else gl.deleteQuery(query);}
 };
 /** A stretch of drawing for the frame on screen. */
 const time=<R>(label:string,work:()=>R):R=>{drew=true;return measure(label,work,()=>true);};
 /** Background work polled every frame (bakes, the sky): kept only when it did something, and not a drawn frame. */
 const baked=(label:string,work:()=>boolean|undefined)=>measure(label,work,done=>!!done);
 const panel=document.createElement('pre');
 panel.className='perf-readout';panel.setAttribute('aria-hidden','true');
 // Below the top bar's buttons, never wider than the view.
 Object.assign(panel.style,{position:'absolute',left:'8px',top:'64px',maxWidth:'calc(100% - 16px)',overflow:'hidden',zIndex:'5',margin:'0',padding:'6px 8px',pointerEvents:'none',font:'11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',color:'#f4f2ea',background:'rgba(20,20,18,.72)',borderRadius:'4px',whiteSpace:'pre'});
 host.appendChild(panel);
 const show=()=>{
  poll();
  const now=performance.now();while(frames.length&&now-frames[0]>1000)frames.shift();
  const means=new Map<string,number>();for(const [label,r] of gpu)means.set(label,r.mean);
  panel.textContent=readoutText({quality:view.quality,pixelRatio:renderer.getPixelRatio(),motionScale:view.motionScale,moving,fps:frames.length,cpu:cpu.mean,gpu:means,gpuAvailable:!!ext,draws,triangles,programs:renderer.info.programs?.length??0,trace:tracing?{phase,clock}:undefined});
 };
 const interval=setInterval(show,250);
 return {
  time,baked,
  watch(passes:[string,Timed][]){for(const [label,pass] of passes){const render=pass.render.bind(pass) as (...args:never[])=>void;pass.render=(...args:never[])=>time(label,()=>render(...args));}},
  begin(){drew=false;started=performance.now();renderer.info.reset();},
  end(isMoving:boolean){
   poll();
   if(!drew)return;
   const now=performance.now();cpu.add(now-started);frames.push(now);moving=isMoving;draws=renderer.info.render.calls;triangles=renderer.info.render.triangles;
  },
  rest(now:number){tracing=true;clock.rest(now);},
  trace(now:number,result:{samples:number;denoised:number}|undefined,state:{ready:boolean;finished:boolean}){
   if(state.ready)clock.ready(now);
   clock.step(now,result,state.finished);
   phase=!state.ready?'preparing':state.finished?'finished':'sampling';
  },
  dispose(){clearInterval(interval);panel.remove();for(const {query} of pending)gl.deleteQuery(query);pending.length=0;renderer.info.autoReset=true;},
 };
}
export type PerfReadout=ReturnType<typeof createPerfReadout>;
