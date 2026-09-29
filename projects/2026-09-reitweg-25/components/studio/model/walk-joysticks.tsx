'use client';
import {useRef} from 'react';

type Vec={x:number;y:number};
const DEAD=.12;

/** One thumbstick: reports −1…1 on each axis while held, zero on release. */
function Stick({label,onMove}:{label:string;onMove:(v:Vec)=>void}){
 const base=useRef<HTMLDivElement>(null),knob=useRef<HTMLSpanElement>(null),pointer=useRef<number|null>(null);
 const update=(e:React.PointerEvent)=>{
  const r=base.current!.getBoundingClientRect(),R=r.width/2;let x=(e.clientX-r.left-R)/R,y=(e.clientY-r.top-R)/R;const d=Math.hypot(x,y);
  if(d>1){x/=d;y/=d;}
  knob.current!.style.transform=`translate(${x*R*.55}px,${y*R*.55}px)`;
  onMove(d<DEAD?{x:0,y:0}:{x,y});
 };
 const end=(e:React.PointerEvent)=>{if(pointer.current!==e.pointerId)return;pointer.current=null;knob.current!.style.transform='';onMove({x:0,y:0});};
 return <div ref={base} className="model-stick" role="application" aria-label={label}
  onPointerDown={e=>{pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);update(e);}}
  onPointerMove={e=>{if(pointer.current===e.pointerId)update(e);}}
  onPointerUp={end} onPointerCancel={end}><span ref={knob}/></div>;
}

/** Two thumbsticks for eye-level views on touch screens: walk on the left, look on the right. */
export function WalkJoysticks({onChange}:{onChange:(move:Vec,look:Vec)=>void}){
 const move=useRef<Vec>({x:0,y:0}),look=useRef<Vec>({x:0,y:0});
 return <div className="model-sticks">
  <Stick label="Walk" onMove={v=>{move.current=v;onChange(move.current,look.current);}}/>
  <Stick label="Look around" onMove={v=>{look.current=v;onChange(move.current,look.current);}}/>
 </div>;
}
