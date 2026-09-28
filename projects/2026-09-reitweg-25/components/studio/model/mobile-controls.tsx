'use client';
import RenovationControls from './renovation-controls';
import type {RenovationState,RenovationId} from '@/lib/house-model/renovation-data';
import {useState} from 'react';
import {Dialog} from 'radix-ui';
import {ArrowLeft,Check,Minus,Plus,RotateCcw,SlidersHorizontal,X} from 'lucide-react';
import {interiorRooms,type InteriorRoom} from '@/lib/house-model/interior-data';
import {viewpoints,sourceNotes,type Level,type Viewpoint} from '@/lib/house-model/site-data';

const floors:{id:Level;label:string}[]=[{id:'exterior',label:'Outside'},{id:'ground',label:'Ground floor'},{id:'upper',label:'Upper floor'},{id:'basement',label:'Basement'}];
type Props={presenceLabel?:string;onSave:()=>void;quality:string;onQuality:(value:string)=>void;textures:string;level:Level;changes:RenovationState;onChanges:(v:RenovationState)=>void;onRenovationFocus:(id:RenovationId)=>void;roomId:string;room?:InteriorRoom;view:Viewpoint;trees:boolean;rotating:boolean;ready:boolean;interacted:boolean;onBack:()=>void;onLevel:(v:string)=>void;onRoom:(v:string)=>void;onView:(v:Viewpoint)=>void;onTrees:()=>void;onRotate:()=>void;onZoom:(n:number)=>void;onReset:()=>void};
export default function MobileModelControls(p:Props){
 const [open,setOpen]=useState(false),[tab,setTab]=useState<'explore'|'renovations'|'about'>('explore');
 const activeCount=Object.values(p.changes).filter(Boolean).length;
 const closeAfter=(action:()=>void)=>{action();setOpen(false);};
 return <>
  <button className="model-mobile-back" aria-label="Back to design studio" onClick={p.onBack}><ArrowLeft size={21}/></button>
  {!p.interacted&&p.ready&&<div className="model-touch-hint">Drag to orbit · pinch to zoom</div>}
  <Dialog.Root open={open} onOpenChange={setOpen}>
   <div className="model-mobile-dock">
    <Dialog.Trigger className="model-mobile-explore"><SlidersHorizontal size={20}/><span><strong>Explore the house</strong><small>{activeCount?`${activeCount} renovation${activeCount===1?'':'s'} · `:''}{p.presenceLabel||p.room?.label||floors.find(f=>f.id===p.level)?.label}</small></span></Dialog.Trigger>
    <button className="model-mobile-reset" aria-label="Reset camera" disabled={!p.ready} onClick={p.onReset}><RotateCcw size={20}/></button>
   </div>
   <Dialog.Portal>
    <Dialog.Overlay className="model-mobile-scrim"/>
    <Dialog.Content className="model-mobile-sheet">
     <div className="model-sheet-handle"/>
     <div className="model-sheet-heading"><Dialog.Title>Make yourself at home.</Dialog.Title><Dialog.Close className="model-sheet-close" aria-label="Close controls"><X size={21}/></Dialog.Close></div>
     <Dialog.Description className="sr-only">Choose a floor or room, combine renovations, or explore the reference photos. Close this panel to return to the full-screen model.</Dialog.Description>
     <div className="model-sheet-tabs" aria-label="Control sections">{(['explore','renovations','about'] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='explore'?'Explore':t==='renovations'?'Renovations':'Details'}</button>)}</div>
     <div className="model-sheet-scroll">
      {tab==='explore'&&<>
       <span className="model-sheet-label">VISUAL DETAIL</span><div className="model-floor-grid">{[{id:'natural',label:'Natural materials'},{id:'realism',label:'Detailed realism'}].map(q=><button key={q.id} aria-pressed={p.quality===q.id} onClick={()=>closeAfter(()=>p.onQuality(q.id))}>{q.label}{p.quality===q.id&&<Check size={16}/>}</button>)}</div>
       <span className="model-sheet-label">CHOOSE A FLOOR</span><div className="model-floor-grid">{floors.map(f=><button key={f.id} disabled={!p.ready} aria-pressed={p.level===f.id} onClick={()=>p.onLevel(f.id)}>{f.label}{p.level===f.id&&<Check size={16}/>}</button>)}</div>
       {p.level!=='exterior'&&<label className="model-room-field">Move into a room<select aria-label="Explore a room" value={p.roomId} disabled={!p.ready} onChange={e=>closeAfter(()=>p.onRoom(e.target.value))}><option value="overview">Whole floor</option>{interiorRooms.filter(r=>r.level===p.level).map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
       <span className="model-sheet-label">A DIFFERENT PERSPECTIVE</span><div className="model-camera-grid">{Object.entries(viewpoints).filter(([id])=>p.quality==='realism'||!['garden','poolside'].includes(id)).filter(([id])=>p.level==='exterior'||['courtyard','east','top'].includes(id)).map(([id,v])=><button key={id} disabled={!p.ready} aria-pressed={!p.room&&p.view===id} onClick={()=>closeAfter(()=>p.onView(id as Viewpoint))}>{v.label}</button>)}</div>
       <button className="renovation-done" disabled={!p.ready} onClick={()=>closeAfter(p.onSave)}>Save this view as a 4K image</button><div className="model-touch-guide"><p>One finger to orbit. Pinch to zoom.<br/>Move with two fingers.</p><div><button aria-label="Zoom out" disabled={!p.ready} onClick={()=>p.onZoom(.83)}><Minus size={20}/></button><button aria-label="Zoom in" disabled={!p.ready} onClick={()=>p.onZoom(1.2)}><Plus size={20}/></button></div></div>
       <div className="model-toggle-grid"><button aria-pressed={p.trees} disabled={p.level!=='exterior'} onClick={p.onTrees}>{p.trees?'Hide trees':'Show trees'}</button><button aria-pressed={p.rotating} disabled={!p.ready} onClick={p.onRotate}>{p.rotating?'Pause rotation':'Gentle rotation'}</button></div>
      </>}
      {tab==='renovations'&&<RenovationControls value={p.changes} onChange={p.onChanges} onFocus={id=>closeAfter(()=>p.onRenovationFocus(id))} level={p.level} ready={p.ready}/>}
      {tab==='about'&&<div className="model-mobile-details"><h3>{p.room?.label||'The house & its possibilities'}</h3><p>{p.room?.detail||'Explore the original house, then combine the renovation concepts. Detailed realism uses photo-derived materials, individual tiles and leaves, and natural lighting. Dimensions and unobserved details remain approximate.'}</p>{p.room?.note&&<p>{p.room.note}</p>}{p.room&&<div className="model-mobile-references">{p.room.photos.map((src,i)=><a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Original reference ${i+1}`} loading="lazy"/><span>Reference {i+1} ↗</span></a>)}</div>}<a href={'/assets/'+(p.level==='upper'?'upper-floor.png':p.level==='basement'?'basement.png':p.level==='exterior'?'grounds.png':'ground-floor.png')} target="_blank" rel="noreferrer">Open the source plan ↗</a><details><summary>About this model</summary>{sourceNotes.map(n=><p key={n}>{n}</p>)}</details></div>}
     </div>
     <Dialog.Close className="model-sheet-done">Back to the house</Dialog.Close>
    </Dialog.Content>
   </Dialog.Portal>
  </Dialog.Root>
 </>;
}
