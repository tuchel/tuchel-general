'use client';
import {useMemo,useState} from 'react';
import {Sun,Sunrise,Sunset,X} from 'lucide-react';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import {Slider} from '@/components/ui/slider';
import {SUN_SITE,studyDate,sunStudyReading,clockLabel,sunDayEvents} from '@/lib/house-model/sun-position';
import type {ExperienceState} from '@/lib/house-model/experience-data';
import type {HouseViewer} from '@/lib/house-model/viewer';

export default function SunStudyControls({api,state,ready}:{api:HouseViewer|null;state:ExperienceState;ready:boolean}){
 const [open,setOpen]=useState(false),s=state.sun,r=sunStudyReading(s);
 const events=useMemo(()=>sunDayEvents(s.day),[s.day]);
 const milestones=[{label:'Sunrise',icon:Sunrise,...events.sunrise},{label:'Peak sun',icon:Sun,...events.peak},{label:'Sunset',icon:Sunset,...events.sunset}];
 const date=studyDate(s.day).toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'long'});
 const direction=['N','NE','E','SE','S','SW','W','NW'][Math.round(r.azimuth/45)%8];
 const edit=(change:Partial<typeof s>)=>api?.experience?.sun({...change,enabled:true});
 return <Popover open={open} onOpenChange={value=>{setOpen(value);if(value)edit({});}}>
  <PopoverTrigger className="sun-study-launch" disabled={!ready} aria-label="Sun study: time of day and year"><Sun size={18}/><span>{s.enabled?`${clockLabel(r.minutes)} · ${studyDate(s.day).toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short'})}`:'Sun study'}</span></PopoverTrigger>
  <PopoverContent className="sun-study-panel" side="bottom" align="start" sideOffset={10} collisionPadding={12} onOpenAutoFocus={e=>e.preventDefault()}>
   <div className="sun-study-heading"><div><strong>Follow the sun</strong><small>Bernried · {SUN_SITE.year} · local time</small></div><button aria-label="Close sun study" onClick={()=>setOpen(false)}><X size={20}/></button></div>
   <div className="sun-slider-label"><label id="sun-time-label">Time of day</label><output>{clockLabel(r.minutes)} <small>{r.zone}</small></output></div>
   <div className="sun-day-timeline">
    <Slider className="sun-slider sun-day-slider" style={{'--sunrise':`${events.sunrise.minutes/1435*100}%`,'--sunset':`${events.sunset.minutes/1435*100}%`} as React.CSSProperties} min={0} max={1435} step={1} value={[s.minutes]} onValueChange={v=>edit({minutes:v[0]})} ref={node=>{const thumb=node?.querySelector('[role=slider]');thumb?.setAttribute('aria-labelledby','sun-time-label');thumb?.setAttribute('aria-valuetext',`${clockLabel(r.minutes)} ${r.zone}`);}}/>
    <div className="sun-event-pins" aria-hidden="true">{milestones.map(({label,icon:Icon,minutes})=><span key={label} style={{left:`calc(12px + (100% - 24px) * ${minutes/1435})`}}><Icon size={14}/></span>)}</div>
    <div className="sun-event-markers">{milestones.map(({label,minutes,elevation})=><button key={label} onClick={()=>edit({minutes})} aria-label={`${label}, ${clockLabel(minutes)} ${events.zone}${label==='Peak sun'?`, ${elevation.toFixed(1)} degrees elevation`:''}`} title={`Jump to ${label.toLowerCase()}`}><span>{label}</span><strong>{clockLabel(minutes)}</strong></button>)}</div>
   </div>
   <div className="sun-day-summary"><span>{Math.floor(events.daylightMinutes/60)}h {events.daylightMinutes%60}m daylight</span><span>Peak {events.peak.elevation.toFixed(1)}°</span></div>
   <div className="sun-slider-label"><label id="sun-date-label">Time of year</label><output>{date}</output></div>
   <Slider className="sun-slider" min={1} max={365} step={1} value={[s.day]} onValueChange={v=>edit({day:v[0]})} ref={node=>{const thumb=node?.querySelector('[role=slider]');thumb?.setAttribute('aria-labelledby','sun-date-label');thumb?.setAttribute('aria-valuetext',`${date} ${SUN_SITE.year}`);}}/>
   <div className="sun-slider-ticks"><span>January</span><span>July</span><span>December</span></div>

   <div className="sun-reading" aria-live="polite"><span>{r.elevation<-.833?'Below the horizon':r.elevation<6?'Low sun':'Sun above horizon'}</span><strong>{r.azimuth.toFixed(1)}° {direction} · {r.apparentElevation.toFixed(1)}° elevation</strong></div>
   {r.notice&&<p className="sun-study-note">{r.notice}</p>}
   <details className="sun-study-details"><summary>Seasons & accuracy</summary><div className="sun-season-shortcuts">{[{day:79,label:'Spring'},{day:172,label:'Summer'},{day:265,label:'Autumn'},{day:355,label:'Winter'}].map(p=><button key={p.day} onClick={()=>edit({day:p.day})}>{p.label}</button>)}</div><p>47.86067° N, 11.29191° E. <a href="https://gml.noaa.gov/grad/solcalc/calcdetails.html" target="_blank" rel="noreferrer">NOAA/Meeus sun position</a>, with Europe/Berlin clock changes.</p><p>Tap a sun marker to see that moment. Sunrise and sunset assume an unobstructed horizon and standard atmospheric refraction; trees and mountains may hide the sun. Peak sun is its highest elevation, not peak solar-panel output. Times are approximate to the minute.</p><p>Plan north is approximately 7.5° east of true north. House heights, trees and distant terrain are modelled estimates. Light brightness is illustrative; no measured horizon or seasonal leaf cover is included.</p><button className="sun-study-reset" onClick={()=>{api?.experience?.sun({enabled:false});setOpen(false);}}>Return to studio lighting</button></details>

  </PopoverContent>
 </Popover>;
}
