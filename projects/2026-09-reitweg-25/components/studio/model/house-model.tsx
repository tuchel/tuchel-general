'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Box,Camera,Layers,MoreHorizontal,Sun,Building2,X} from 'lucide-react';
import {Dialog} from 'radix-ui';
import RenovationControls from './renovation-controls';
import {ViewsPanel,FloorPanel,LightPanel,MorePanel,floors,type ViewKey} from './model-panels';
import {renovations,renovationState,type RenovationState,type RenovationId} from '@/lib/house-model/renovation-data';
import {places,initialCapture,type Place,type CaptureState} from '@/lib/house-model/experience-data';
import {viewpoints,regions,sourceNotes,photoChecks,planPoint,UPPER_PLAN_X_OFFSET,BASEMENT_PLAN_X_OFFSET,type Level,type Region,type Viewpoint} from '@/lib/house-model/site-data';
import {interiorRooms} from '@/lib/house-model/interior-data';
import {clockLabel,sunStudyReading} from '@/lib/house-model/sun-position';
import {detectQuality,qualityFromParam,tiers,type Quality} from '@/lib/house-model/device-tier';
import type {HouseViewer} from '@/lib/house-model/viewer';

type Panel='views'|'floor'|'changes'|'light'|'more';
const panelTitles:Record<Panel,string>={views:'Views',floor:'Floor',changes:'Renovations',light:'Light',more:'More'};
/** A June afternoon: long, warm light across the east lawn and courtyard. */
const START={day:172,minutes:17*60};

export default function HouseModel({onNavigate}:{onNavigate:(id:string)=>void}){
 const host=useRef<HTMLDivElement>(null),compass=useRef<HTMLSpanElement>(null),api=useRef<HouseViewer|null>(null),saved=useRef<ReturnType<HouseViewer['snapshot']>|null>(null);
 // The model page renders only in the browser, so presets and URL choices are read at mount.
 const [detected]=useState<Quality>(()=>typeof window==='undefined'?'model':detectQuality());
 const [quality,setQuality]=useState<Quality>(()=>typeof window==='undefined'?'model':qualityFromParam(new URLSearchParams(window.location.search).get('quality'))??detected);
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[materials,setMaterials]=useState<'loading'|'ready'>('ready');
 const [level,setLevel]=useState<Level>('exterior'),[view,setView]=useState<ViewKey|null>('courtyard'),levelRef=useRef<Level>('exterior');
 useEffect(()=>{levelRef.current=level;},[level]);
 const [changes,setChanges]=useState<RenovationState>(()=>{
  const state=renovationState(),ids=typeof window==='undefined'?[]:new URLSearchParams(window.location.search).get('renovations')?.split(',')||[];
  return Object.fromEntries(Object.keys(state).map(id=>[id,ids.includes(id)])) as RenovationState;
 });
 const [sun,setSun]=useState(START),[capture,setCapture]=useState<CaptureState>(initialCapture);
 const [panel,setPanel]=useState<Panel|null>(null),[region,setRegion]=useState<Region|null>(null),[about,setAbout]=useState(false);
 const apply=(v:ViewKey,instant=false)=>{
  const viewer=api.current;if(!viewer)return;
  if(v.startsWith('room:')){
   const r=interiorRooms.find(room=>`room:${room.id}`===v);if(!r)return;
   const [x,z]=planPoint(...r.center);viewer.focus(x+(r.level==='upper'?UPPER_PLAN_X_OFFSET:r.level==='basement'?BASEMENT_PLAN_X_OFFSET:0),z,r.level==='upper'?3.4:r.level==='basement'?-2:.4,r.span);return;
  }
  viewer.view(v as Viewpoint|Place,instant);
 };
 // One viewer per detail setting; the camera carries over when the preset changes.
 useEffect(()=>{
  let cancelled=false;
  import('@/lib/house-model/viewer').then(({createHouseViewer})=>{
   if(cancelled||!host.current)return;
   try{
    api.current=createHouseViewer(host.current,{
     quality,onSelect:r=>{setRegion(r);setPanel(null);},onReady:()=>setReady(true),onError:()=>setFailed(true),onCapture:setCapture,onMaterials:setMaterials,
     onHeading:deg=>{if(compass.current)compass.current.style.transform=`rotate(${deg}deg)`;},
     onRequest:()=>{const next=levelRef.current==='exterior'?'courtyard':'top';setView(next);setRegion(null);api.current?.view(next);},
    });
    if(saved.current&&quality!=='model'&&tiers[quality])api.current.restore(saved.current);
   }catch(error){console.warn('3D model',error);setFailed(true);}
  }).catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;api.current?.dispose();api.current=null;};
  // The viewer is rebuilt only for a new preset or an explicit retry.
 },[attempt,quality]);
 // Keep the viewer in step with React state once it is ready (also after a rebuild).
 useEffect(()=>{if(!ready)return;const v=api.current;if(!v)return;v.setLevel(level);v.setRenovations(changes);v.setSun({enabled:true,...sun});if(view)apply(view,true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready]);
 useEffect(()=>{if(ready)api.current?.setRenovations(changes);},[ready,changes]);
 useEffect(()=>{if(ready)api.current?.setSun({enabled:true,...sun});},[ready,sun]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&panel)setPanel(null);};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[panel]);

 const chooseView=(v:ViewKey)=>{
  setRegion(null);
  if(v in places&&level!=='exterior'){setLevel('exterior');api.current?.setLevel('exterior');}
  setView(v);apply(v);
 };
 const chooseLevel=(l:Level)=>{
  setRegion(null);setLevel(l);api.current?.setLevel(l);
  const next:ViewKey=l==='exterior'?'courtyard':'top';setView(next);apply(next);
 };
 const focusRenovation=(id:RenovationId)=>{
  setChanges(previous=>({...previous,[id]:true}));setPanel(null);setRegion(null);
  const r=renovations.find(item=>item.id===id)!;
  if(id==='front'||id==='solar'){chooseLevel('exterior');const v=id==='solar'?'east':'arrival';setView(v);apply(v);return;}
  setLevel('ground');api.current?.setLevel('ground');setView(null);api.current?.focus(r.center[0],r.center[1],.5,r.span);
 };
 const chooseQuality=(q:Quality)=>{
  if(q===quality)return;saved.current=api.current?.snapshot()??null;setCapture(initialCapture);setReady(false);setFailed(false);setQuality(q);
  const url=new URL(window.location.href);if(q===detected)url.searchParams.delete('quality');else url.searchParams.set('quality',q);window.history.replaceState(null,'',url);
 };
 const toggle=(p:Panel)=>setPanel(current=>current===p?null:p);
 const activeCount=Object.values(changes).filter(Boolean).length,realistic=quality!=='model';
 const place=view&&view in places?places[view as Place]:undefined,room=view?.startsWith('room:')?interiorRooms.find(r=>`room:${r.id}`===view):undefined;
 const reading=sunStudyReading({enabled:true,...sun}),selected=region?regions[region]:undefined;
 const caption=place?{title:place.label,detail:place.caption}:room?{title:room.label,detail:room.detail}:view&&view in viewpoints?{title:level==='exterior'?viewpoints[view as Viewpoint].label:view==='top'?floors.find(f=>f.id===level)!.label:viewpoints[view as Viewpoint].label,detail:level==='exterior'?'':'Walls cut at window height'}:undefined;
 const busy=capture.busy||capture.render!=='idle'||capture.recording||!!capture.message;
 return <div className="house-model-page">
  <div className="model-stage">
   <div ref={host} className="model-canvas"/>
   {!ready&&!failed&&<div className="model-loading" role="status"><Box size={30} aria-hidden/><span>{realistic?'Building the house and its setting…':'Assembling the house…'}</span></div>}
   {failed&&<div className="model-error" role="alert"><h3>The 3D view couldn’t start.</h3><p>Reload the model, or open the original plans.</p><button className="btn" onClick={()=>{setFailed(false);setReady(false);setAttempt(attempt+1);}}>Reload model</button><button className="text-btn" onClick={()=>onNavigate('plans')}>Open the plans</button></div>}
   <div className="model-top">
    <button className="model-round model-back" aria-label="Back to the design studio" onClick={()=>onNavigate('studio')}><ArrowLeft size={20}/></button>
    {caption&&!selected&&<div className="model-caption" aria-live="polite"><strong>{caption.title}</strong>{caption.detail&&<span>{caption.detail}</span>}
     {place&&<a href={'/assets/'+place.photo} target="_blank" rel="noreferrer">Reference photograph <ArrowUpRight size={13}/></a>}
     {room&&<div className="model-caption-photos">{room.photos.map((src,i)=><a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`${room.label}, reference ${i+1}`} loading="lazy"/></a>)}</div>}
    </div>}
    {selected&&<div className="model-caption" aria-live="polite"><strong>{selected.title}</strong><span>{selected.detail}</span>
     <div className="model-caption-links"><a href={'/assets/'+selected.source} target="_blank" rel="noreferrer">Source plan <ArrowUpRight size={13}/></a>{selected.renovation&&<button className="model-link" onClick={()=>onNavigate(selected.renovation!)}>The renovation <ArrowUpRight size={13}/></button>}</div>
     <button className="model-caption-close" aria-label="Close" onClick={()=>setRegion(null)}><X size={16}/></button>
    </div>}
    <div className="model-top-right">
     <span className="model-compass" aria-label="Compass; the arrow points north" role="img"><span ref={compass}>N</span></span>
     <button className="model-round" aria-label="More" aria-expanded={panel==='more'} onClick={()=>toggle('more')}><MoreHorizontal size={20}/></button>
    </div>
   </div>
   {busy&&<div className="model-status" role="status"><div><strong>{capture.busy?'Preparing…':capture.render==='panorama'?'360° panorama':capture.render==='refining'?'Photograph':capture.recording?'Recording':'Model'}</strong><small>{capture.message}{capture.samples>0?` · ${capture.samples} samples`:''}</small></div>
    {capture.samples>0&&<button onClick={()=>api.current?.captures?.savePhoto()}>Save PNG</button>}
    <button onClick={()=>capture.recording?api.current?.captures?.film():api.current?.captures?.stop()}>{capture.busy?'Cancel':capture.recording?'Finish':'Close'}</button>
   </div>}
   {panel&&<section className={'model-panel model-panel-'+panel} role="dialog" aria-label={panelTitles[panel]}>
    <header><h2>{panelTitles[panel]}</h2><button className="model-panel-close" aria-label="Close" onClick={()=>setPanel(null)}><X size={18}/></button></header>
    {panel==='views'&&<ViewsPanel level={level} view={view} onView={chooseView}/>}
    {panel==='floor'&&<FloorPanel level={level} onLevel={chooseLevel}/>}
    {panel==='changes'&&<div className="model-panel-body"><RenovationControls value={changes} onChange={setChanges} onFocus={focusRenovation} level={level} ready={ready&&!failed}/></div>}
    {panel==='light'&&<LightPanel day={sun.day} minutes={sun.minutes} onChange={(day,minutes)=>setSun({day,minutes})}/>}
    {panel==='more'&&<MorePanel quality={quality} detected={detected} onQuality={chooseQuality} capture={capture} heavy={tiers[quality].photographic} eyeLevel={!!place}
     onSave={()=>{setPanel(null);void api.current?.saveImage();}} onPhotograph={pano=>{setPanel(null);void api.current?.captures?.photograph(pano);}} onFilm={()=>{setPanel(null);if(place)chooseView('courtyard');api.current?.captures?.film();}}
     onExport={()=>{setPanel(null);void api.current?.captures?.exportModel();}} onBreeze={on=>api.current?.captures?.breeze(on)} onSound={on=>void api.current?.captures?.sound(on)} onAbout={()=>{setPanel(null);setAbout(true);}}/>}
   </section>}
   <nav className="model-dock" aria-label="Model controls">
    <button aria-expanded={panel==='views'} onClick={()=>toggle('views')} disabled={!ready}><Camera size={19} aria-hidden/><span>Views</span></button>
    <button aria-expanded={panel==='floor'} onClick={()=>toggle('floor')} disabled={!ready}><Building2 size={19} aria-hidden/><span>{floors.find(f=>f.id===level)!.short}</span></button>
    <button aria-expanded={panel==='changes'} onClick={()=>toggle('changes')} disabled={!ready}><Layers size={19} aria-hidden/><span>Changes</span>{activeCount>0&&<b aria-label={`${activeCount} on`}>{activeCount}</b>}</button>
    {realistic&&<button aria-expanded={panel==='light'} onClick={()=>toggle('light')} disabled={!ready}><Sun size={19} aria-hidden/><span>{clockLabel(reading.minutes)}</span></button>}
   </nav>
   {ready&&realistic&&materials==='loading'&&<div className="model-hint" role="status">Loading surface detail…</div>}
  </div>
  <Dialog.Root open={about} onOpenChange={setAbout}><Dialog.Portal><Dialog.Overlay className="model-about-scrim"/><Dialog.Content className="model-about">
   <Dialog.Title>About this model</Dialog.Title>
   <Dialog.Description>Plan-based geometry, the owner’s photographs and calculated sunlight. It is not a laser scan or a measured survey.</Dialog.Description>
   <div className="model-about-photos">{photoChecks.map(photo=><a key={photo.file} href={'/assets/'+photo.file} target="_blank" rel="noreferrer"><img loading="lazy" src={'/assets/'+photo.file} alt={photo.label}/><span>{photo.label}</span></a>)}</div>
   <ul>{sourceNotes.map(note=><li key={note}>{note}</li>)}
    <li>Surfaces use tileable textures generated to match the photographed cladding, roof slates, oak, limestone and lawn. Sunlight follows the calculated sun for the address; sky light inside rooms is precomputed from the building’s openings.</li></ul>
   <div className="button-row"><a href="/assets/expose.pdf#page=18" target="_blank" rel="noreferrer">Original exposé ↗</a><a href="/assets/house-model-source-notes.json" target="_blank" rel="noreferrer">Model assumptions ↗</a></div>
   <Dialog.Close className="btn">Back to the house</Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
 </div>;
}
