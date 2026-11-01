'use client';
import {ArrowUpRight,Check} from 'lucide-react';
import {offered,offeredState,renovationState,shownOn,toggled,renovationVisibleOn,type RenovationId,type RenovationState} from '@/lib/house-model/renovation-data';
import type {Level} from '@/lib/house-model/site-data';
export type RenovationControlsProps={value:RenovationState;onChange:(value:RenovationState)=>void;onFocus:(id:RenovationId)=>void;level:Level;ready:boolean};
export default function RenovationControls({value,onChange,onFocus,level,ready}:RenovationControlsProps){
 // The two Winter Gardens are one at a time, so "All on" (with the glass one) is all a tile can show.
 const count=offered.filter(r=>shownOn(value,r.id)).length,all=offeredState(),allOn=offered.every(r=>shownOn(value,r.id)===shownOn(all,r.id));
 return <div className="renovation-controls">
  <div className="renovation-actions"><button disabled={!ready||allOn} onClick={()=>onChange(offeredState())}>All on</button><button disabled={!ready||count===0} onClick={()=>onChange(renovationState())}>Original house</button></div>
  {!renovationVisibleOn(level)&&<p className="renovation-floor-note">These are on the ground floor and outside; the arrow shows one.</p>}
  {/* One tile per design: the name switches it on or off; the arrow flies to it. Both keep a full touch target. */}
  <div className="renovation-grid">{offered.map(r=><div key={r.id} className={'renovation-tile'+(shownOn(value,r.id)?' is-on':'')}>
   <button className="renovation-toggle" aria-pressed={shownOn(value,r.id)} title={r.detail} disabled={!ready} onClick={()=>onChange(toggled(value,r.id))}><i aria-hidden>{shownOn(value,r.id)&&<Check size={13} strokeWidth={3}/>}</i><span>{r.title}</span></button>
   <button className="renovation-look" aria-label={`Look closer: ${r.title}`} title="Look closer" disabled={!ready} onClick={()=>onFocus(r.id)}><ArrowUpRight size={17}/></button>
  </div>)}</div>
 </div>;
}
