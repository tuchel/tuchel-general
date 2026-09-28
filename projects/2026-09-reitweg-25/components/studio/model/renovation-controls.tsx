'use client';
import {ArrowUpRight} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {renovations,renovationState,renovationVisibleOn,type RenovationId,type RenovationState} from '@/lib/house-model/renovation-data';
import type {Level} from '@/lib/house-model/site-data';
export type RenovationControlsProps={value:RenovationState;onChange:(value:RenovationState)=>void;onFocus:(id:RenovationId)=>void;level:Level;ready:boolean};
export default function RenovationControls({value,onChange,onFocus,level,ready}:RenovationControlsProps){
 const count=Object.values(value).filter(Boolean).length;
 return <div className="renovation-controls">
  <div className="renovation-intro"><p>Imagine what comes next.</p><span>Layer the selected designs onto the house. Mix any combination.</span></div>
  <div className="renovation-actions"><button disabled={!ready||count===renovations.length} onClick={()=>onChange(renovationState(true))}>All on</button><button disabled={!ready||count===0} onClick={()=>onChange(renovationState())}>Original house</button><span aria-live="polite">{count} of {renovations.length} on</span></div>
  {!renovationVisibleOn(level)&&<p className="renovation-floor-note">These changes are on the ground floor and outside. Use “Look closer” to see them; your selection stays on.</p>}
  <div className="renovation-list">{renovations.map(r=><div key={r.id} className={'renovation-item'+(value[r.id]?' is-on':'')}>
   <div className="renovation-item-heading"><label htmlFor={'renovation-'+r.id}>{r.title}</label><Switch id={'renovation-'+r.id} className="renovation-switch" checked={value[r.id]} disabled={!ready} onCheckedChange={enabled=>onChange({...value,[r.id]:enabled})}/></div>
   <p>{r.detail}</p><button className="renovation-focus" disabled={!ready} onClick={()=>onFocus(r.id)}>Look closer <ArrowUpRight size={14}/></button>
  </div>)}</div>
  <p className="renovation-note">Spatial concepts from your selected designs. Roofs, supports and dimensions still need a measured architectural design.</p>
 </div>;
}
