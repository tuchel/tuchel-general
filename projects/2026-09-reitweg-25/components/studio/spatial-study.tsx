"use client";
import {useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {type Concept} from '@/lib/design-data';

const courtyardOptions={
 A:{title:'Fireplace lounge + long-table dining',north:'Long table',west:'Fireplace lounge',note:'Gather around the fire in one bay; give the perpendicular bay to a long dining table. Best for hosting with distinct places to sit and eat.'},
 B:{title:'Dining by the fire + pool-facing lounge',north:'Pool-facing lounge',west:'Dining by the fire',note:'Move dining beside the existing fireplace and let a freestanding sofa group face the courtyard and pool. The two main uses exchange places.'},
 C:{title:'A garden salon',north:'Reading + daybed',west:'Fireside conversation',note:'Use small conversation groups in the fireplace bay, with a reading corner and daybed in the perpendicular bay. Keep this courtyard for relaxing, with full-size outdoor dining on the east terrace.'}
};
export function SpatialStudy({layout,onSelect}:{layout:Concept['layout'];onSelect?:(layout:Concept['layout'])=>void}){
 const [showSource,setShowSource]=useState(false);
 if(!layout)return null;
 if(layout==='courtyard-focused')return <section className="spatial-study" aria-label="Selected courtyard arrangement">
  <div className="section-heading"><h3>Two places to gather, one courtyard</h3><span className="status-chip">Selected direction</span></div>
  <div className="courtyard-design-notes"><div><span className="mini-label">WEST WING · BY THE FIRE</span><p>Comfortable lounge seating and a few cozy places to sit, gathered around the existing hearth.</p></div><div><span className="mini-label">NORTH BAY · UNDER THE EAVES</span><p>A long timber dining table, with a low serving and storage counter against the timber wall.</p></div><div><span className="mini-label">THE SPACE BETWEEN</span><p>Keep door access, the tree and routes to the pool clear. The existing roof and posts stay; exact furniture fit needs measuring.</p></div></div>
  <div className="layout-source-action"><p className="image-caption">Four views of this configuration. Other arrangements, including the isometric daybed studies, are in the archive above.</p><button className="text-btn" onClick={()=>setShowSource(!showSource)}>{showSource?'Hide source plan':'See the original courtyard plan'}</button></div>
  {showSource&&<div className="courtyard-source"><svg viewBox="340 740 1200 740" role="img" aria-label="Original ground-floor plan showing the two courtyard bays, fireplace and pool"><image href="/assets/ground-floor.png" width="2200" height="1556"/></svg><a href="/assets/expose.pdf#page=19" target="_blank" rel="noreferrer">Open full source plan <ArrowUpRight size={14}/></a></div>}
 </section>;
 if(layout==='courtyard-isometric')return <section className="spatial-study" aria-label="Courtyard layout foundations">
  <div className="section-heading"><h3>Dining, daybeds and somewhere cozy</h3><span className="status-chip">Three layout studies</span></div>
  <p>Every option combines the same three ingredients. The north bay has a covered strip and an open terrace in front; the west wing is longer and narrower. The drawings keep that distinction, the existing post positions and the angled outline from the exposé.</p>
  <div className="courtyard-design-notes"><div><span className="mini-label">KEEP THE CHARACTER</span><p>Timber walls, the existing fireplace, a leafy courtyard and the pool beyond.</p></div><div><span className="mini-label">LOOK UNDER THE ROOF</span><p>The roof is hidden in the isometric graphics so you can see the furniture. The proposal keeps it.</p></div><div><span className="mini-label">COMPARE THE ARRANGEMENT</span><p>Choose a thumbnail above, then use Plan or Spatial model. Compare places the model beside its AI illustration.</p></div></div>
  <div className="layout-source-action"><p className="image-caption">Traced from the source plan, with indicative furniture and tree positions. Check door access, chair space and rain coverage before choosing exact pieces.</p><button className="text-btn" onClick={()=>setShowSource(!showSource)}>{showSource?'Hide source plan':'See the original courtyard plan'}</button></div>
  {showSource&&<div className="courtyard-source"><svg viewBox="340 740 1200 740" role="img" aria-label="Original ground-floor plan with the courtyard loggias, uncovered terrace, fireplace and pool"><image href="/assets/ground-floor.png" width="2200" height="1556"/></svg><a href="/assets/expose.pdf#page=19" target="_blank" rel="noreferrer">Open full source plan <ArrowUpRight size={14}/></a></div>}
 </section>;
 const winter=layout==='winter-full';
 const key=(layout.split('-')[1]||'A') as keyof typeof courtyardOptions;
 const option=courtyardOptions[key];
 return <section className="spatial-study" aria-label={winter?'Full wintergarten footprint':'Courtyard layout comparison'}>
  <div className="section-heading"><h3>{winter?'The confirmed north-and-west footprint':'Three ways to use the whole courtyard'}</h3><span className="status-chip">{winter?'Footprint confirmed':'Layout study'}</span></div>
  {winter?<>
   <p>The footprint is confirmed. A is the long west wing, B the shallower north return, C the existing kitchen and D the east cooker wall. The current garden kitchen uses C for cooking, A for dining and B for breakfast stools at the low L return. Every archived layout starts from this same outline.</p>
   <div className="confirmed-kitchen-plan"><a href="/assets/kitchen-confirmed-footprint.svg" target="_blank" rel="noreferrer"><img src="/assets/kitchen-confirmed-footprint.svg" alt="Confirmed green A+B extension traced directly on the original exposé inset, with existing kitchen C and east cooker wall D"/></a><div><span className="mini-label">OUR FIXED STARTING POINT</span><h3>One footprint. New possibilities.</h3><p>Use Plan to see the selected layout and proposed openings, and Spatial model to inspect the arrangement. The gallery explores it from inside and outside; Compare shows the reference photograph beside each render. Earlier layouts remain in the clickable archive above.</p><p>The green edge follows the exposé proposal. Your confirmation sets our design brief; dimensions, height and the stamped approval remain to be verified.</p><div className="button-row"><a className="btn" href="/assets/kitchen-footprint-review.pdf" target="_blank" rel="noreferrer">Open annotated plan <ArrowUpRight size={14}/></a><a className="text-btn" href="/assets/expose.pdf#page=19" target="_blank" rel="noreferrer">Original exposé <ArrowUpRight size={14}/></a></div></div></div>
   <div className="kitchen-orientation"><div><span className="mini-label">KEEPING INSIDE AND OUTSIDE ALIGNED</span><h3>The furniture stays put. The camera moves.</h3><p>The earlier exterior images did not consistently preserve the interior furniture axes. The current plan keeps the table and island parallel, both running north–south. From the west garden, the table is nearest the glass, the island is behind it and the cooker is on the far east wall.</p><p>The new gallery replaces those exterior views. Its camera directions are shown here; exact perspectives and dimensions remain illustrative. Earlier exterior images are marked as superseded in the archive.</p></div><a href="/assets/kitchen-camera-orientation-v4.svg" target="_blank" rel="noreferrer"><img src="/assets/kitchen-camera-orientation-v4.svg" alt="North-up kitchen plan with arrows for north-facing interior, west-facing dining and east-facing garden cameras"/><span className="text-btn">Open camera diagram <ArrowUpRight size={14}/></span></a></div>
  </>:<>
   <RadioGroup className="layout-options" aria-label="Choose courtyard layout" value={key} onValueChange={id=>onSelect?.(`courtyard-${id}` as Concept['layout'])}>{Object.entries(courtyardOptions).map(([id,item])=><label key={id} htmlFor={`courtyard-layout-${id}`} className={key===id?'selected':''}><RadioGroupItem id={`courtyard-layout-${id}`} value={id} className="sr-only"/><span>{id}</span>{item.title}</label>)}</RadioGroup>
   <p>{option.note}</p>
   <div className="diagram-scroll" tabIndex={0} aria-label="Courtyard layout; scroll horizontally on small screens"><svg className="courtyard-diagram" viewBox="0 0 680 450" role="img" aria-label={`Unmeasured courtyard zoning: ${option.west} in the fireplace bay, ${option.north} in the perpendicular bay. Existing roof, posts, tree and fireplace retained.`}>
    <path d="M62 66H585V177H185V345H62Z" fill="#e5eae4" stroke="#7d877d" strokeWidth="2"/>
    <rect x="66" y="181" width="12" height="39" fill="#a34b31"/><text x="30" y="165" className="diagram-small">Fire</text><path d="M42 170L66 196" stroke="#a34b31"/>
    <text x="385" y="48" textAnchor="middle" className="diagram-small">HOUSE / NORTH BAY</text>
    <text x="123" y="255" textAnchor="middle" className="diagram-small">{key==='A'?'Lounge':key==='B'?'Dining':'Small groups'}</text><text x="123" y="277" textAnchor="middle" className="diagram-small">by the fire</text>
    <text x="380" y="124" textAnchor="middle">{option.north}</text>
    {[235,380,525].map(x=><rect key={x} x={x} y="171" width="8" height="8" fill="#56644f"/>)}<rect x="180" y="275" width="8" height="8" fill="#56644f"/>
    <path d="M570 195H218V353H570" fill="none" stroke="#ad7458" strokeWidth="2" strokeDasharray="5 6"/>
    <circle cx="352" cy="268" r="42" fill="#dbe3d8" stroke="#7e9475" strokeDasharray="4 4"/><text x="352" y="273" textAnchor="middle" className="diagram-small">Tree</text>
    <text x="494" y="271" textAnchor="middle" className="diagram-small">Open courtyard</text>
    <rect x="265" y="374" width="320" height="46" fill="#d7e5e9" stroke="#8faeb5"/><text x="425" y="403" textAnchor="middle">POOL</text>
   </svg></div>
   <div className="layout-source-action"><p className="image-caption">Unmeasured zoning diagram; swipe sideways on smaller screens. Dashed route keeps the two bays and pool connected. Furniture positions and the tree location are indicative; check fit against a survey.</p><button className="text-btn" onClick={()=>setShowSource(!showSource)}>{showSource?'Hide source plan':'See the original courtyard plan'}</button></div>
   {showSource&&<div className="courtyard-source"><svg viewBox="340 760 1185 715" role="img" aria-label="Original ground-floor plan showing covered courtyard, outdoor fireplace and pool"><image href="/assets/ground-floor.png" width="2200" height="1556"/></svg><a href="/assets/expose.pdf#page=19" target="_blank" rel="noreferrer">Open full source plan <ArrowUpRight size={14}/></a></div>}
  </>}
 </section>
}
