import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
// Extreme draws moving frames at the largest of a few scales that holds 60 frames a second, by measuring them: the
// graphics card's own timer where the browser has one, otherwise the time between frames. A frame's cost is taken to
// grow with its pixels (the scale squared); the scale moves at most one step every half second, and resting frames stay
// at full resolution.
await build({entryPoints:['lib/house-model/motion-resolution.ts'],outdir:'tmp/motion-resolution-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {createMotionResolution,MOTION_RESOLUTION:M}=await import('../tmp/motion-resolution-check/motion-resolution.mjs');
assert.deepEqual(M.steps,[...M.steps].sort((a,b)=>a-b),'steps rise');assert(M.steps.at(-1)===1&&M.steps[0]>=.5,'from half to full resolution');
assert(Math.abs(M.budget-1000/60)<.01,'a 60-frames-a-second budget');

// A graphics card whose frames cost `cost(scale)` ms, answered a frame later.
const timerGl=cost=>{
 const ext={TIME_ELAPSED_EXT:0x88BF,GPU_DISJOINT_EXT:0x8FBB};let open=null;const done=[];
 const gl={QUERY_RESULT_AVAILABLE:0x8867,QUERY_RESULT:0x8866,scale:1,
  createQuery:()=>({}),deleteQuery(){},beginQuery(t,q){assert.equal(t,ext.TIME_ELAPSED_EXT);assert(!open,'one timer at a time');open=q;},
  endQuery(){open.ms=cost(this.scale);done.push(open);open.ready=false;open=null;},getQueryParameter(q,p){return p===this.QUERY_RESULT_AVAILABLE?!!q.ready:q.ms*1e6;},
  getParameter:p=>p===ext.GPU_DISJOINT_EXT?false:0,settle(){for(const q of done)q.ready=true;}};
 return {gl,ext};
};
/** Runs `seconds` of continuous motion at 60 Hz; returns the scales drawn, frame by frame. */
const move=(steer,seconds,gl,cost)=>{const drawn=[];let now=steer.clock??0;
 for(let i=0;i<seconds*60;i++){const s=steer.start(now);if(gl)gl.scale=s;drawn.push(s);
  // The interval to the next frame: the display's, or the frame's own cost rounded up to whole refreshes.
  const took=cost?cost(s):0,interval=gl?1000/60:Math.ceil(Math.max(took,1)/(1000/60))*(1000/60);
  steer.finish(now+Math.min(took,interval)*.3);gl?.settle();now+=interval;}
 steer.clock=now;return drawn;};

// Measured by the card: a heavy view settles on the largest scale whose predicted cost fits the budget with headroom.
{
 const cost=s=>3+22*s*s,{gl,ext}=timerGl(cost),steer=createMotionResolution({gl,timer:ext,initial:.7});
 const fits=s=>cost(s)<=M.budget*M.headroom,best=Math.max(...M.steps.filter(fits));
 const drawn=move(steer,6,gl);
 assert.equal(drawn.at(-1),best,`settles at ${best} (${cost(best).toFixed(1)} ms a frame)`);
 // At most one step each half second, and none once settled.
 let last=0;drawn.forEach((s,i)=>{if(i&&s!==drawn[i-1]){assert(i-last>=M.period/(1000/60)-1,'one step a half second at most');last=i;}});
 const tail=drawn.slice(-120);assert(tail.every(s=>s===best),'holds once settled');
 // A lighter view climbs to full resolution, one step at a time.
 const light=s=>3+8*s*s,{gl:g2,ext:e2}=timerGl(light),s2=createMotionResolution({gl:g2,timer:e2,initial:.5});
 const up=move(s2,4,g2);assert.equal(up.at(-1),1,'a light view moves at full resolution');
 const seen=[...new Set(up)];assert.deepEqual(seen,M.steps.filter(s=>s>=.5),'climbing through each step');
 // A view that is heavy even at the lowest scale stays there rather than rising.
 const heavy=s=>30+10*s*s,{gl:g3,ext:e3}=timerGl(heavy),s3=createMotionResolution({gl:g3,timer:e3,initial:.7});
 assert.equal(move(s3,4,g3).at(-1),M.steps[0],'the heaviest view moves at the lowest scale');
}
// Without a timer: frame intervals. A view that drops frames steps down; one that holds 60 steps up; a step up that
// drops frames is taken back and not tried again for a while.
{
 const cost=s=>4+16*s*s,steer=createMotionResolution({gl:undefined,timer:null,initial:.7});
 const drawn=move(steer,12,undefined,cost),holds=Math.max(...M.steps.filter(s=>cost(s)<=1000/60));
 assert.equal(drawn.at(-1),holds,`settles at ${holds}, the largest that holds 60 frames a second`);
 const tries=drawn.filter((s,i)=>i&&s>holds&&drawn[i-1]===holds).length;assert(tries<=3,`tries the step above ${tries} times in 12 s`);
 // Processor-bound frames: lowering the resolution would not help, so it does not.
 const cpuBound=createMotionResolution({gl:undefined,timer:null,initial:.85});let now=0;
 for(let i=0;i<300;i++){cpuBound.start(now);cpuBound.finish(now+30);now+=33.3;}
 assert.equal(cpuBound.scale,.85,'frames held up by the processor keep their resolution');
}
// A rest between moves: the interval across it is not a slow frame.
{
 const steer=createMotionResolution({gl:undefined,timer:null,initial:.7});let now=0;
 for(let r=0;r<10;r++){for(let i=0;i<20;i++){steer.start(now);steer.finish(now+2);now+=16.7;}steer.rest();now+=2000;}
 assert(steer.scale>=.7,'rests do not count as slow frames');
}
// The wiring: Extreme steers; moving frames use the steered scale; resting frames full resolution; the readout shows it.
{
 const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),viewer=read('viewer.ts'),tiers=read('device-tier.ts');
 assert(/extreme:\{[^}]*steerMotion:true/.test(tiers)&&/detailed:\{[^}]*steerMotion:false/.test(tiers),'Extreme steers');
 assert(/createMotionResolution\(/.test(viewer)&&/steer\?\.start\(/.test(viewer)&&/steer\?\.finish\(/.test(viewer)&&/steer\?\.rest\(/.test(viewer),'the viewer brackets moving frames');
 assert(/scaleFor=\(moving:boolean\)=>moving\?\(steer\?\.scale\?\?tier\.motionScale\):1/.test(viewer),'moving frames at the steered scale, resting ones at full');
 assert(/get motionScale\(\)/.test(viewer),'the readout shows the scale in use');
}
console.log(`Passed: measured by the graphics card, a heavy view settles at the largest scale that fits ${M.budget.toFixed(1)} ms with ${Math.round((1-M.headroom)*100)}% to spare, a light one climbs to full resolution a step each ${M.period} ms, and the heaviest stays at ${M.steps[0]}; by frame intervals alone, the largest scale that holds 60 frames a second, with failed steps up not retried at once; processor-bound frames and rests change nothing.`);
