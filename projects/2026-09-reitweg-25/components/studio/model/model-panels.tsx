'use client';
import {useMemo,useState,type CSSProperties} from 'react';
import {Sun,Sunrise,Sunset,Moon,Check} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {viewpoints,type Level,type Viewpoint} from '@/lib/house-model/site-data';
import type {Place,CaptureState} from '@/lib/house-model/experience-data';
import {interiorRooms} from '@/lib/house-model/interior-data';
import {sheets,mapMarkers,sheetOf,wholeViews,type Sheet} from '@/lib/house-model/view-map';
import {sunDayEvents,clockLabel,studyDate,SUN_SITE,sunStudyReading} from '@/lib/house-model/sun-position';
import type {Quality} from '@/lib/house-model/device-tier';

export const floors:{id:Level;label:string;short:string}[]=[{id:'exterior',label:'Whole house',short:'House'},{id:'ground',label:'Ground floor',short:'Ground'},{id:'upper',label:'Upper floor',short:'Upper'},{id:'basement',label:'Basement',short:'Basement'}];
export type ViewKey=Viewpoint|Place|`room:${string}`;

export function ViewsPanel({level,view,onView}:{level:Level;view:ViewKey|null;onView:(v:ViewKey)=>void}){
 const rooms=interiorRooms.filter(r=>r.level===level),whole=level==='exterior';
 const [inside,setInside]=useState(()=>{const sheet=view?sheetOf(view):undefined;return sheet==='ground'||sheet==='upper';});
 const chip=(id:ViewKey,label:string)=><button key={id} className="model-chip" aria-pressed={view===id} onClick={()=>onView(id)}>{label}</button>;
 return <div className="model-panel-body">
  {!whole&&<><span className="model-panel-label">This floor</span><div className="model-chips">{[chip('top','Whole floor'),...rooms.map(r=>chip(`room:${r.id}`,r.label))]}</div></>}
  <div className="view-map-tabs" role="tablist" aria-label="Map">
   <button role="tab" aria-selected={!inside} onClick={()=>setInside(false)}>Outside</button>
   <button role="tab" aria-selected={inside} onClick={()=>setInside(true)}>Inside</button>
  </div>
  {inside?<div className="view-map-pair">{(['ground','upper'] as const).map(sheet=><ViewMap key={sheet} sheet={sheet} overviews={false} view={view} onView={onView}/>)}</div>
   :<ViewMap sheet="grounds" overviews={whole} view={view} onView={onView}/>}
  <div className="view-map-foot">
   <span className="view-map-key"><i aria-hidden/>Eye level{whole&&!inside&&<><i className="air" aria-hidden/>From above</>}</span>
   {whole&&!inside&&<div className="view-map-whole">{wholeViews.map(id=>chip(id,viewpoints[id].label))}</div>}
  </div>
 </div>;
}

/** An exposé plan with a dot where each eye-level view stands, its cone the way it looks, and overview arrows on the frame. */
function ViewMap({sheet,overviews,view,onView}:{sheet:Sheet;overviews:boolean;view:ViewKey|null;onView:(v:ViewKey)=>void}){
 const {src,title,crop}=sheets[sheet];
 return <figure className="view-map" style={{aspectRatio:`${crop[2]} / ${crop[3]}`}}>
  <svg viewBox={crop.join(' ')} aria-hidden><image href={'/assets/'+src} width="2200" height="1556"/></svg>
  {sheet!=='grounds'&&<figcaption>{title}</figcaption>}
  {mapMarkers(sheet,overviews).map(m=><button key={m.id} className="view-map-marker" data-kind={m.kind} data-side={m.side} aria-pressed={view===m.id} onClick={()=>onView(m.id)}
   style={{left:`${m.x*100}%`,top:`${m.y*100}%`,'--heading':`${m.heading}deg`} as CSSProperties}>
   {m.kind==='eye'&&<span className="view-map-cone" aria-hidden/>}<span className="view-map-pin" aria-hidden/><span className="view-map-label">{m.label}</span>
  </button>)}
 </figure>;
}

export function FloorPanel({level,onLevel}:{level:Level;onLevel:(l:Level)=>void}){
 return <div className="model-panel-body"><div className="model-segments" role="radiogroup" aria-label="Floor">
  {floors.map(f=><button key={f.id} role="radio" aria-checked={level===f.id} onClick={()=>onLevel(f.id)}>{f.label}{level===f.id&&<Check size={15} aria-hidden/>}</button>)}
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
 return <div className="model-panel-body model-light">
  <div className="model-light-heading"><strong>{clockLabel(reading.minutes)} <small>{reading.zone}</small></strong><span>{date}</span><button className="model-link" onClick={now}>Now</button></div>
  <div className="model-light-slider" style={{'--sunrise':`${events.sunrise.minutes/1435*100}%`,'--sunset':`${events.sunset.minutes/1435*100}%`} as React.CSSProperties}>
   <Slider aria-label="Time of day" min={0} max={1435} step={5} value={[minutes]} onValueChange={v=>onChange(day,v[0])}/>
  </div>
  <div className="model-light-presets">{presets(events).map(p=><button key={p.label} className="model-chip" aria-pressed={Math.abs(minutes-p.minutes)<6} onClick={()=>onChange(day,p.minutes)}><p.icon size={15} aria-hidden/>{p.label}</button>)}</div>
  <label className="model-panel-label" htmlFor="model-day">Time of year · {date}</label>
  <Slider id="model-day" aria-label="Day of the year" min={1} max={365} step={1} value={[day]} onValueChange={v=>onChange(v[0],minutes)}/>
  <div className="model-light-months"><span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span></div>
  <p className="model-light-reading">{reading.apparentElevation< -.833?`Sun ${Math.abs(reading.apparentElevation).toFixed(0)}° below the horizon`:`Sun ${reading.apparentElevation.toFixed(0)}° high in the ${direction}`} · sunrise {clockLabel(events.sunrise.minutes)}, sunset {clockLabel(events.sunset.minutes)}</p>
 </div>;
}

export type MoreActions={
 quality:Quality;detected:Quality;onQuality:(q:Quality)=>void;
 capture:CaptureState;heavy:boolean;eyeLevel:boolean;
 onSave:()=>void;onPhotograph:(panorama:boolean)=>void;onFilm:()=>void;onExport:()=>void;onBreeze:(on:boolean)=>void;onSound:(on:boolean)=>void;onAbout:()=>void;
};
export function MorePanel(p:MoreActions){
 const realistic=p.quality!=='model',busy=p.capture.busy||p.capture.recording;
 return <div className="model-panel-body model-more">
  <span className="model-panel-label">Keep this view</span>
  <button className="model-row" onClick={p.onSave}>Save image<small>{p.heavy?'3840 px PNG':'About twice the screen'}</small></button>
  {realistic&&p.heavy&&<button className="model-row" disabled={busy} onClick={()=>p.onPhotograph(false)}>Photograph<small>Path-traced light; refines while the view stays still</small></button>}
  {realistic&&p.heavy&&<button className="model-row" disabled={busy||!p.eyeLevel} onClick={()=>p.onPhotograph(true)}>360° panorama<small>{p.eyeLevel?'From this eye-level view':'Choose an eye-level view first'}</small></button>}
  {realistic&&<button className="model-row" disabled={p.capture.busy} onClick={p.onFilm}>{p.capture.recording?'Finish film':'Film'}<small>20-second orbit</small></button>}
  {realistic&&p.heavy&&<button className="model-row" disabled={busy} onClick={p.onExport}>Export 3D model<small>Textured GLB for Blender</small></button>}
  {realistic&&<>
   <span className="model-panel-label">Atmosphere</span>
   <button className="model-row model-toggle" aria-pressed={p.capture.breeze} onClick={()=>p.onBreeze(!p.capture.breeze)}>Breeze<small>Leaves, grass and water move</small><i>{p.capture.breeze?'On':'Off'}</i></button>
   <button className="model-row model-toggle" aria-pressed={p.capture.sound} onClick={()=>p.onSound(!p.capture.sound)}>Garden sound<small>Designed ambience, not a recording</small><i>{p.capture.sound?'On':'Off'}</i></button>
  </>}
  <span className="model-panel-label">Detail</span>
  <div className="model-segments" role="radiogroup" aria-label="Detail">
   {([['detailed','Detailed'],['balanced','Balanced'],['model','Model']] as const).map(([id,label])=><button key={id} role="radio" aria-checked={p.quality===id} onClick={()=>p.onQuality(id)}>{label}{p.detected===id&&<small>suits this device</small>}</button>)}
  </div>
  <button className="model-row" onClick={p.onAbout}>About this model<small>Sources, photographs and limits</small></button>
 </div>;
}
