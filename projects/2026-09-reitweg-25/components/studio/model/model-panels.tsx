'use client';
import {useMemo,useState,type CSSProperties} from 'react';
import {Sun,Sunrise,Sunset,Moon} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {viewpoints,type Level,type Viewpoint} from '@/lib/house-model/site-data';
import type {Place,CaptureState} from '@/lib/house-model/experience-data';
import {interiorRooms} from '@/lib/house-model/interior-data';
import {sheets,mapMarkers,sheetOf,wholeViews,type Sheet} from '@/lib/house-model/view-map';
import {sunDayEvents,clockLabel,studyDate,SUN_SITE,sunStudyReading} from '@/lib/house-model/sun-position';
import type {Quality} from '@/lib/house-model/device-tier';
import {PHOTO_LIMIT} from '@/lib/house-model/photo-size';

export const floors:{id:Level;label:string;short:string}[]=[{id:'exterior',label:'Whole house',short:'House'},{id:'ground',label:'Ground floor',short:'Ground'},{id:'upper',label:'Upper floor',short:'Upper'},{id:'basement',label:'Basement',short:'Basement'}];
export type ViewKey=Viewpoint|Place|`room:${string}`;
/** Built but hidden for now: the reference photographs in captions and the room and floor shortcuts above the Views
 * map. Set either to true to show it again. */
export const SHOWN={referencePhotos:false,roomShortcuts:false};

export function ViewsPanel({level,view,onView}:{level:Level;view:ViewKey|null;onView:(v:ViewKey)=>void}){
 const rooms=interiorRooms.filter(r=>r.level===level),whole=level==='exterior';
 const [inside,setInside]=useState(()=>{const sheet=view?sheetOf(view):undefined;return sheet==='ground'||sheet==='upper';});
 const chip=(id:ViewKey,label:string)=><button key={id} className="model-chip" aria-pressed={view===id} onClick={()=>onView(id)}>{label}</button>;
 return <div className="model-panel-body">
  {SHOWN.roomShortcuts&&!whole&&<div className="model-chips">{[chip('top','Whole floor'),...rooms.map(r=>chip(`room:${r.id}`,r.label))]}</div>}
  <div className="view-map-tabs" role="tablist" aria-label="Map">
   <button role="tab" aria-selected={!inside} onClick={()=>setInside(false)}>Outside</button>
   <button role="tab" aria-selected={inside} onClick={()=>setInside(true)}>Inside</button>
  </div>
  {inside?<div className="view-map-pair">{(['ground','upper'] as const).map(sheet=><ViewMap key={sheet} sheet={sheet} overviews={false} view={view} onView={onView}/>)}</div>
   :<ViewMap sheet="grounds" overviews={whole} view={view} onView={onView}>{whole&&<div className="view-map-whole">{wholeViews.map(id=>chip(id,viewpoints[id].label))}</div>}</ViewMap>}
 </div>;
}

/** An exposé plan with a dot where each eye-level view stands, its cone the way it looks, and overview arrows on the frame. */
function ViewMap({sheet,overviews,view,onView,children}:{sheet:Sheet;overviews:boolean;view:ViewKey|null;onView:(v:ViewKey)=>void;children?:React.ReactNode}){
 const {src,title,crop}=sheets[sheet];
 return <figure className="view-map" style={{aspectRatio:`${crop[2]} / ${crop[3]}`}}>
  <svg viewBox={crop.join(' ')} aria-hidden><image href={'/assets/'+src} width="2200" height="1556"/></svg>
  {sheet!=='grounds'&&<figcaption>{title}</figcaption>}
  {mapMarkers(sheet,overviews).map(m=><button key={m.id} className="view-map-marker" data-kind={m.kind} data-side={m.side} aria-pressed={view===m.id} onClick={()=>onView(m.id)}
   style={{left:`${m.x*100}%`,top:`${m.y*100}%`,'--heading':`${m.heading}deg`} as CSSProperties}>
   {m.kind==='eye'&&<span className="view-map-cone" aria-hidden/>}<span className="view-map-pin" aria-hidden/><span className="view-map-label">{m.label}<span className="sr-only">{m.kind==='eye'?', eye level':', from above'}</span></span>
  </button>)}
  {children}
 </figure>;
}

export function FloorPanel({level,onLevel}:{level:Level;onLevel:(l:Level)=>void}){
 return <div className="model-panel-body"><div className="model-floors" role="radiogroup" aria-label="Floor">
  {floors.map(f=><button key={f.id} role="radio" aria-checked={level===f.id} title={f.label} onClick={()=>onLevel(f.id)}>{f.short}</button>)}
 </div></div>;
}

const presets=(events:ReturnType<typeof sunDayEvents>)=>[
 {label:'Morning',icon:Sunrise,minutes:Math.round(events.sunrise.minutes+120)},
 {label:'Midday',icon:Sun,minutes:Math.round(events.peak.minutes)},
 {label:'Golden hour',icon:Sunset,minutes:Math.round(events.sunset.minutes-45)},
 {label:'Dusk',icon:Moon,minutes:Math.round(events.sunset.minutes+25)},
];
export function LightPanel({day,minutes,onChange}:{day:number;minutes:number;onChange:(day:number,minutes:number)=>void}){
 const events=useMemo(()=>sunDayEvents(day),[day]),reading=sunStudyReading({enabled:true,day,minutes});
 const date=studyDate(day).toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'long'});
 const direction=['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(reading.azimuth/45)%8];
 // "Now" at the house: the date and clock time in Bernried, whatever the viewer's time zone.
 const now=()=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:SUN_SITE.timeZone,month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const dayOfYear=Math.min(365,Math.round((Date.UTC(SUN_SITE.year,+parts.month-1,+parts.day)-Date.UTC(SUN_SITE.year,0,1))/864e5)+1);
  onChange(dayOfYear,+parts.hour*60+ +parts.minute);
 };
 const sun=reading.apparentElevation< -.833?'Sun below the horizon':`Sun ${reading.apparentElevation.toFixed(0)}°, ${direction}`;
 // The presets sit on the time band where the thumb's centre lands for their time (the thumb is 8 px wide).
 const at=(m:number)=>`calc(${m/1435*100}% + ${(.5-m/1435)*8}px)`;
 return <div className="model-panel-body model-light">
  <div className="model-light-heading"><span>{date}</span><span>{sun}</span><button className="model-link" onClick={now}>Now</button></div>
  <div className="model-light-time" style={{'--sunrise':`${events.sunrise.minutes/1435*100}%`,'--sunset':`${events.sunset.minutes/1435*100}%`} as React.CSSProperties}>
   <Slider aria-label="Time of day" min={0} max={1435} step={5} value={[minutes]} onValueChange={v=>onChange(day,v[0])}/>
   {presets(events).map(p=><button key={p.label} className="model-light-mark" data-night={p.minutes<events.sunrise.minutes||p.minutes>events.sunset.minutes||undefined} style={{left:at(p.minutes)}}
    aria-label={`${p.label}, ${clockLabel(p.minutes)}`} title={`${p.label} · ${clockLabel(p.minutes)}`} aria-pressed={Math.abs(minutes-p.minutes)<6} onClick={()=>onChange(day,p.minutes)}><p.icon size={12} aria-hidden/></button>)}
  </div>
  <Slider className="model-light-year" aria-label="Day of the year" min={1} max={365} step={1} value={[day]} onValueChange={v=>onChange(v[0],minutes)}/>
  <div className="model-light-months"><span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span></div>
 </div>;
}

export type MoreActions={
 quality:Quality;detected:Quality;onQuality:(q:Quality)=>void;
 /** Extreme is offered on computers only. */
 computer:boolean;
 capture:CaptureState;heavy:boolean;eyeLevel:boolean;
 /** `limit`: the largest PNG within that many bytes. */
 onSave:(limit?:number)=>void;onPhotograph:(panorama:boolean)=>void;onFilm:()=>void;onExport:()=>void;onBreeze:(on:boolean)=>void;onSound:(on:boolean)=>void;onAbout:()=>void;
 /** Whether clouds are shown, where the detail setting has them (Extreme). */
 clouds?:boolean;onClouds:(on:boolean)=>void;
};
export function MorePanel(p:MoreActions){
 const realistic=p.quality!=='model',busy=p.capture.busy||p.capture.recording;
 return <div className="model-panel-body model-more">
  <button className="model-row" onClick={()=>p.onSave()}>Save image<small>{p.heavy?'3840 px PNG':'twice the screen'}</small></button>
  <button className="model-row" title="The largest size that fits in 1 MB" onClick={()=>p.onSave(PHOTO_LIMIT)}>Save image<small>1 MB PNG</small></button>
  {realistic&&p.heavy&&<button className="model-row" disabled={busy} onClick={()=>p.onPhotograph(false)}>Photograph<small>path-traced light</small></button>}
  {realistic&&p.heavy&&<button className="model-row" disabled={busy||!p.eyeLevel} onClick={()=>p.onPhotograph(true)}>360° panorama<small>{p.eyeLevel?'from this view':'eye-level views only'}</small></button>}
  {realistic&&<button className="model-row" disabled={p.capture.busy} onClick={p.onFilm}>{p.capture.recording?'Finish film':'Film'}<small>20-second orbit</small></button>}
  {realistic&&p.heavy&&<button className="model-row" disabled={busy} onClick={p.onExport}>Export 3D model<small>textured GLB for Blender</small></button>}
  {realistic&&<div className="model-more-toggles">
   <button aria-pressed={p.capture.breeze} title="Leaves, grass and water move" onClick={()=>p.onBreeze(!p.capture.breeze)}>Breeze</button>
   <button aria-pressed={p.capture.sound} title="Designed ambience, not a recording" onClick={()=>p.onSound(!p.capture.sound)}>Garden sound</button>
   {p.clouds!==undefined&&<button aria-pressed={p.clouds} title="Drifting clouds and their shadows; off, the sun's light reads alone" onClick={()=>p.onClouds(!p.clouds)}>Clouds</button>}
  </div>}
  <div className="model-segments" role="radiogroup" aria-label="Detail">
   {([...(p.computer?[['extreme','Extreme']] as const:[]),['detailed','Detailed'],['balanced','Balanced'],['model','Model']] as const).map(([id,label])=><button key={id} role="radio" aria-checked={p.quality===id} title={id==='extreme'?'Path-traced when the camera rests, where the browser has WebGPU; asks a lot of the graphics card':p.detected===id?'Suits this device':undefined} onClick={()=>p.onQuality(id)}>{label}{p.detected===id&&<small aria-label="suits this device"/>}</button>)}
  </div>
  <button className="model-link" onClick={p.onAbout}>About this model</button>
 </div>;
}
