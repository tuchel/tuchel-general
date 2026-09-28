'use client';
import SunStudyControls from './sun-study';
import {useState} from 'react';
import {Dialog} from 'radix-ui';
import {Aperture,X,ArrowLeft,Sun,CloudSun,Sunset,Check} from 'lucide-react';
import {places,type ExperienceState,type Presence,type Mood} from '@/lib/house-model/experience-data';
import type {HouseViewer} from '@/lib/house-model/viewer';

type Props={api:HouseViewer|null;state:ExperienceState;ready:boolean;realistic:boolean;onEnable:()=>void;onPlace:(p:Presence)=>void};
export default function ExperienceControls({api,state:s,ready,realistic,onEnable,onPlace}:Props){
 const [open,setOpen]=useState(false),[reference,setReference]=useState(false);
 const act=(fn:()=>void)=>{fn();setOpen(false);};
 const place=s.presence==='overview'?undefined:places[s.presence];
 return <>
  {realistic&&<SunStudyControls api={api} state={s} ready={ready}/>}
  <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger className="experience-launch" disabled={!ready}><Aperture size={18}/><span>Be here</span></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="experience-scrim"/><Dialog.Content className="experience-panel">
   <div className="experience-heading"><div><span className="mini-label">A LITTLE CLOSER TO HOME</span><Dialog.Title>Be here.</Dialog.Title></div><Dialog.Close aria-label="Close experience controls"><X size={22}/></Dialog.Close></div><Dialog.Description>Find a seat, choose the light, and let the house settle around you.</Dialog.Description>
   {!realistic?<div className="experience-upgrade"><p>Open the detailed model for eye-level views, changing light and photographic rendering.</p><button className="btn primary" onClick={()=>act(onEnable)}>Enter detailed realism</button></div>:<>
    <span className="model-sheet-label">A PLACE TO PAUSE</span><div className="experience-places">{Object.entries(places).map(([id,p])=><button key={id} aria-pressed={s.presence===id} onClick={()=>act(()=>onPlace(id as Presence))}><span>{p.label}</span><small>{p.caption}</small>{s.presence===id&&<Check size={16}/>}</button>)}</div>{place&&<button className="text-btn" onClick={()=>act(()=>onPlace('overview'))}><ArrowLeft size={15}/>Back to the overview</button>}
    <span className="model-sheet-label">THE LIGHT</span><div className="experience-light">{([{id:'daylight',label:'Daylight',Icon:Sun},{id:'overcast',label:'Soft sky',Icon:CloudSun},{id:'evening',label:'Evening',Icon:Sunset}] as const).map(({id,label,Icon})=><button key={id} aria-pressed={!s.sun.enabled&&s.mood===id} onClick={()=>api?.experience?.mood(id as Mood)}><Icon size={22}/>{label}</button>)}</div>
    <div className="experience-switches"><button aria-pressed={s.breeze} onClick={()=>api?.experience?.breeze(!s.breeze)}><span>Gentle breeze<small>Meadow, leaves & water</small></span><i>{s.breeze?'On':'Off'}</i></button><button aria-pressed={s.sound} onClick={()=>void api?.experience?.sound(!s.sound)}><span>Quiet garden ambience<small>Designed sound · not a site recording</small></span><i>{s.sound?'On':'Off'}</i></button></div>
    <span className="model-sheet-label">MAKE A PHOTOGRAPH</span><p className="experience-note">Light bounces through the actual model and glass. The image refines while the camera stays still. More demanding on your device.</p><label className="experience-quality"><input type="checkbox" checked={s.maximum} onChange={e=>api?.experience?.maximum(e.target.checked)}/><span>Maximum quality<small>4K · 1,024 samples · takes longer</small></span></label><button className="experience-primary" disabled={s.busy||s.recording} onClick={()=>act(()=>void api?.experience?.photograph())}>Refine this view with path tracing</button>
    <div className="experience-captures"><button disabled={s.busy||s.recording} onClick={()=>act(()=>api?.saveImage())}>Save a 4K still<small>Immediate interactive render</small></button><button disabled={!place||s.busy||s.recording} onClick={()=>act(()=>void api?.experience?.photograph(true))}>Make a 360° panorama<small>Choose a place above first</small></button><button disabled={s.busy} onClick={()=>act(()=>api?.experience?.film())}>{s.recording?'Finish recording':'Capture a short film'}<small>20-second exterior orbit</small></button><button disabled={s.busy||s.recording} onClick={()=>act(()=>void api?.experience?.exportModel())}>Export textured 3D model<small>GLB · for an offline renderer</small></button></div>
    {place&&<button className="text-btn" onClick={()=>{setReference(true);setOpen(false);}}>See the original reference photograph ↗</button>}
    <p className="experience-note">The house and setting use the existing plans, your corrections and reference photographs. The terrain, surrounding trees and Alpine contours are interpreted. Studio light presets are artistic; Sun study uses calculated date and time. Fine foliage is simplified in photographic exports.</p>
   </>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  {place&&<div className="experience-place-label"><span>{place.label}<small>Drag to look around · pinch or use ± to zoom</small></span><button aria-label="Return to overview" onClick={()=>onPlace('overview')}><ArrowLeft size={18}/></button></div>}
  {(s.busy||s.render!=='idle'||s.recording||s.message)&&<div className="experience-status" role="status"><div><strong>{s.busy?'Preparing…':s.render==='panorama'?'360° photograph':s.render==='refining'?'Photographic view':s.recording?'Recording':'Studio'}</strong><small>{s.message}{s.samples>0?` · ${s.samples} samples`:''}</small></div>{s.samples>0&&<button onClick={()=>api?.experience?.savePhoto()}>Save PNG</button>}<button onClick={()=>s.recording?api?.experience?.film():api?.experience?.stop()}>{s.busy?'Cancel':s.recording?'Finish':'Explore'}</button></div>}
  <Dialog.Root open={reference} onOpenChange={setReference}><Dialog.Portal><Dialog.Overlay className="experience-scrim"/><Dialog.Content className="experience-reference"><Dialog.Title>Original reference</Dialog.Title><Dialog.Description>A reference for this part of the house or its setting; the model camera is not an exact photo match.</Dialog.Description>{place&&<img src={'/assets/'+place.photo} alt={place.label+' original photograph'}/>}<Dialog.Close className="btn">Return to the model</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
 </>;
}
