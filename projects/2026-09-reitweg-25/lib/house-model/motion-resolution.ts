/** Moving frames' resolution, steered by how long they take (Extreme). `steps`: the scales a moving frame may draw at;
 * `budget`: 60 frames a second; `headroom`: the share of it a frame may fill as measured by the graphics card; `period`:
 * how long a scale is kept, at least, before the next step. */
export const MOTION_RESOLUTION={steps:[.5,.6,.7,.85,1],budget:1000/60,headroom:.85,period:500};
type Timer={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};
type Queries=Pick<WebGL2RenderingContext,'createQuery'|'deleteQuery'|'beginQuery'|'endQuery'|'getQueryParameter'|'getParameter'|'QUERY_RESULT_AVAILABLE'|'QUERY_RESULT'>;

/** Picks the largest step that holds the budget. With the graphics card's timer (`timer`, EXT_disjoint_timer_query_webgl2)
 * each moving frame is timed, and a step's cost is predicted from the current one by its pixels (the scale squared): it
 * steps up when the next scale is predicted to fit with room to spare, and down when the current one does not fit.
 * Without one, the time between moving frames decides: frames dropped at this scale step it down; a run that holds 60
 * frames a second tries the step above, and a try that drops frames is taken back and not made again for a while
 * (twice as long each time). Frames the processor holds up are left alone: fewer pixels would not help them. */
export function createMotionResolution(options:{gl:Queries|undefined;timer:Timer|null;initial:number}){
 const {steps,budget,headroom,period}=MOTION_RESOLUTION,{gl,timer}=options;
 let step=steps.reduce((best,s,i)=>Math.abs(s-options.initial)<Math.abs(steps[best]-options.initial)?i:best,0);
 // Measurements at the current step since it was taken: graphics-card ms, intervals between moving frames, and how many
 // of those the processor filled.
 let since=-1,gpu:number[]=[],intervals:number[]=[],busy=0,lastStart=NaN,started=0,open:WebGLQuery|null=null;
 let tried=-1,blockedUntil=0,block=4000,held=0;
 const pending:{query:WebGLQuery;step:number}[]=[];
 const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
 const take=(next:number,now:number)=>{step=Math.max(0,Math.min(steps.length-1,next));since=now;gpu=[];intervals=[];busy=0;};
 const poll=()=>{
  if(!gl||!timer)return;
  const disjoint=!!gl.getParameter(timer.GPU_DISJOINT_EXT);
  while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
   const {query,step:at}=pending.shift()!;
   if(!disjoint&&at===step)gpu.push((gl.getQueryParameter(query,gl.QUERY_RESULT) as number)/1e6);
   gl.deleteQuery(query);
  }
 };
 const decide=(now:number)=>{
  if(since<0){since=now;return;}
  if(now-since<period)return;
  const scale=steps[step];
  if(gl&&timer){
   if(gpu.length<8)return;
   const t=mean(gpu),fit=budget*headroom,cost=(s:number)=>t*(s/scale)**2;
   if(t>fit&&step>0)take(step-1,now);
   else if(step<steps.length-1&&cost(steps[step+1])<=fit*.9)take(step+1,now);
   else{since=now;gpu=[];}
   return;
  }
  if(intervals.length<8)return;
  const interval=mean(intervals),bound=busy/intervals.length>.5;
  if(interval>budget*1.25&&!bound){
   // A try that dropped frames: back, and not again for a while.
   if(step===tried){blockedUntil=now+block;block*=2;tried=-1;}
   take(step-1,now);held=0;return;
  }
  if(interval<=budget*1.1){held++;if(held>=2&&step<steps.length-1&&now>=blockedUntil){tried=step+1;take(step+1,now);held=0;return;}}
  else held=0;
  since=now;intervals=[];busy=0;
 };
 return {
  get scale(){return steps[step];},
  /** A moving frame starts at `now` (ms); the scale to draw it at. */
  start(now:number){
   poll();
   if(Number.isFinite(lastStart)){intervals.push(now-lastStart);}
   lastStart=now;started=now;
   decide(now);
   if(gl&&timer&&!open){open=gl.createQuery();if(open)gl.beginQuery(timer.TIME_ELAPSED_EXT,open);}
   return steps[step];
  },
  /** That frame's drawing is done at `now`; the processor's share of it counts against lowering the resolution. */
  finish(now:number){
   if(open&&gl&&timer){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push({query:open,step});open=null;}
   const last=intervals.at(-1);if(last!==undefined&&now-started>.8*last)busy++;
  },
  /** The view came to rest: the next moving frame starts a new run, so the pause is not a slow frame. */
  rest(){lastStart=NaN;},
  dispose(){if(gl)for(const {query} of pending)gl.deleteQuery(query);pending.length=0;},
 };
}
export type MotionResolution=ReturnType<typeof createMotionResolution>;
