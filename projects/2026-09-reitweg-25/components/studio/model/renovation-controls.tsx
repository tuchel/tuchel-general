'use client';
import {ArrowUpRight,Check} from 'lucide-react';
import {offered,offeredState,renovationState,renovationVisibleOn,type RenovationId,type RenovationState} from '@/lib/house-model/renovation-data';
import type {Level} from '@/lib/house-model/site-data';
export type RenovationControlsProps={value:RenovationState;onChange:(value:RenovationState)=>void;onFocus:(id:RenovationId)=>void;level:Level;ready:boolean};
export default function RenovationControls({value,onChange,onFocus,level,ready}:RenovationControlsProps){
 const count=offered.filter(r=>value[r.id]).length;
 return <div className="renovation-controls">
  <div className="renovation-actions"><button disabled={!ready||count===offered.length} onClick={()=>onChange(offeredState())}>All on</button><button disabled={!ready||count===0} onClick={()=>onChange(renovationState())}>Original house</button><span aria-live="polite">{count} of {offered.length} on</span></div>
  {!renovationVisibleOn(level)&&<p className="renovation-floor-note">These changes are on the ground floor and outside. Use the arrow to see one; your selection stays on.</p>}
  {/* One tile per design: the name switches it on or off; the arrow flies to it. Both keep a full touch target. */}
  <div className="renovation-grid">{offered.map(r=><div key={r.id} className={'renovation-tile'+(value[r.id]?' is-on':'')}>
   <button className="renovation-toggle" aria-pressed={value[r.id]} title={r.detail} disabled={!ready} onClick={()=>onChange({...value,[r.id]:!value[r.id]})}><i aria-hidden>{value[r.id]&&<Check size={13} strokeWidth={3}/>}</i><span>{r.title}</span></button>
   <button className="renovation-look" aria-label={`Look closer: ${r.title}`} title="Look closer" disabled={!ready} onClick={()=>onFocus(r.id)}><ArrowUpRight size={17}/></button>
  </div>)}</div>
  <p className="renovation-note">Spatial concepts from your selected designs. Roofs, supports and dimensions still need a measured architectural design.</p>
 </div>;
}
