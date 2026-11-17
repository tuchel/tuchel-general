import type {Level,Viewpoint} from './site-data';
export const renovations = [
 {id:'kitchen',title:'Winter Garden · As Permitted',detail:'The Winter Garden as approved in 2021: 7.70 × 8.81 m round the north-west corner, 3.40 m out from the west wall and 2.26 m from the north gable, at the kitchen’s floor level. Black post-and-transom glazing on a 1.10 m grid, 2.50 m high with transoms at 0.65 m and 2.10 m, and a full-height lift-and-slide door in the south end beside the house, under a glass roof falling 3° to the garden from an edge 2.65 m above the floor. The old corner stays as a T of wall; the west wall opens onto the garden dining under a lintel, and the north wall has a door to the breakfast end.',view:'arrival',center:[-5.7,-7.5],span:16},
 {id:'wideGlass',title:'Winter Garden · Large Panes',detail:'The same approved outline and glass roof, glazed in full-height panes up to 2.6 m wide with no transoms: three to the north, four to the west and one at the east end, with the same full-height sliding door in the south end. The old corner becomes a slim T-shaped pier, the north and west walls opening beside it under downstand beams, and the breakfast stools stand where the north wall was.',view:'arrival',center:[-5.7,-7.5],span:16},
 {id:'catslide',title:'Winter Garden · Zinc Roof',detail:'The same Winter Garden under the main roof carried on unbroken over it, flattened to 10° at the old eave, in dark standing-seam zinc and wrapping round to the north with a hip: one eave line at 2.51 m, glass to 2.39 m under a dark timber head, the ceiling lined in oak.',view:'arrival',center:[-5.7,-7.5],span:16},
 {id:'east',title:'Lower East Façade Glass',detail:'On the ground floor, floor-to-ceiling glass, a private bathroom band and a south wall glazed on both sides of the fireplace.',view:'east',center:[1,1],span:25},
 {id:'masterWindows',title:'Master Bedroom & Bath Windows',detail:'Upstairs, the south gable is glazed on both sides of the chimney: the master bedroom’s from the chimney to the east knee wall and the master bathroom’s from the chimney to the west knee wall, each from just above the floor to 3 m and under the roof slope, in place of their single windows, with an upright over each frame line of the living room’s windows below.',view:'masterGable',center:[0,9.6],span:15},
 {id:'alignedGable',title:'Master Windows · Aligned Mullions',detail:'The south gable glazed only straight above the living room’s two windows below, each pane as wide as the window under it and divided where it is; beside the chimney and out to the knee walls the gable stays wall, so the master bedroom and bathroom each get one tall window lined up with the one below.',view:'masterGable',center:[0,9.6],span:15},
 {id:'nookWindow',title:'Office Nook Window Expansion',detail:'The dining alcove’s window and garden door become one fixed pane, 2.7 m wide and 2.2 m high from the floor, framed in oak inside and black outside.',view:'east',center:[3.3,1.3],span:9},
 {id:'nook',title:'Layout Updates',detail:'The garden bedroom becomes a family room with an 85-inch television, an L-shaped couch and an armchair. The dining alcove becomes a library with a desk on the hall wall and a lounge chair at the window. The living room gets a corner L-shaped couch around the glass table, a second lounge chair, a rug before the fire and a centered dining table.',view:'east',center:[.4,1.4],span:23},
 {id:'terrace',title:'Dining on the east terrace',detail:'A generous stone terrace, long oak table and a little shade.',view:'east',center:[7.5,5.8],span:14},
 {id:'courtyard',title:'Lounge by the fire',detail:'The fireside lounge, long table under the eaves and a wall-side serving counter.',view:'courtyard',center:[-13.7,7],span:20},
 {id:'front',title:'Arrival Wall',detail:'A taller boundary in the house’s upright timber cladding, with matching gates.',view:'wall',center:[-35,0],span:35},
 {id:'garage',title:'Front Garage',detail:'A two-car garage on the lane, under a slate roof at the guest wing’s pitch, reached from a new gate by one lane curving round to its doors. Beside it, a bin room for four bins opens to the lane, with a cobbled path from the drive. A 2 m timber fence and gates close the notch. The rest of the old drive and the notch is planted with ornamental grasses, like the island beside the walk, except a lawn between the walk’s border and the lane. The well garden and the drive’s south end, where cars no longer park, become one lawn bordered with roses edged in box, three cherry trees down its middle.',view:'garage',center:[-37,13],span:24},
 {id:'skylights',title:'Guest Wing Skylights',detail:'Four more roof windows in the guest wing’s west slope: two over the study and two over the bedroom, at the 1.9 m spacing of the three over the landing and shower room, and high enough up the slope to open from shoulder height.',view:'guestRoof',center:[-21,10],span:20},
 {id:'guestSuite',title:'Guest Suite Updates',detail:'Upstairs in the guest wing, the bedroom’s washbasin moves into the shower room, onto its north wall beside the toilet.',view:'guestRoof',center:[-21,14],span:10},
 {id:'solar',title:'Solar & battery storage',detail:'50 panels on the main roof · 22.5 kWp, with two battery placeholders. Gas heating retained; annual electricity balance, with winter grid support.',view:'east',center:[-7,2],span:38},
] as const;
export type RenovationId=typeof renovations[number]['id'];
export type RenovationState=Record<RenovationId,boolean>;
export const renovationState=(enabled=false):RenovationState=>({kitchen:enabled,wideGlass:enabled,catslide:enabled,east:enabled,masterWindows:enabled,alignedGable:enabled,nookWindow:enabled,nook:enabled,terrace:enabled,courtyard:enabled,front:enabled,garage:enabled,skylights:enabled,guestSuite:enabled,solar:enabled});
/** Kept in the model but not offered for now (the arrival wall is superseded by the front garage, the Zinc Roof Winter Garden by the two that follow the permit): out of the panel, and off with "All on" or when a link names them. */
export const setAside:ReadonlySet<RenovationId>=new Set<RenovationId>(['catslide','terrace','courtyard','front','solar']);
export const offered=renovations.filter(r=>!setAside.has(r.id));
/** Some changes come in versions that share one base: each version is the base with its own id on as well, so everything
 * the base changes follows any of them. The panel shows them as tiles, one on at a time. The Winter Gardens share one room
 * (`kitchen`); the aligned master windows are the glazed gable (`masterWindows`) narrowed to the windows below. */
export const versionsOf:Partial<Record<RenovationId,readonly RenovationId[]>>={kitchen:['wideGlass','catslide'],masterWindows:['alignedGable']};
export const winterGardenVersions:readonly RenovationId[]=versionsOf.kitchen!;
const bases=Object.keys(versionsOf) as RenovationId[],allVersions=bases.flatMap(b=>versionsOf[b]!);
const baseOf=(id:RenovationId)=>versionsOf[id]?id:bases.find(b=>versionsOf[b]!.includes(id));
/** A state with at most one version of each base on, and that version's base on with it. */
export const versionNormal=(state:RenovationState):RenovationState=>bases.reduce((s,base)=>{const versions=versionsOf[base]!,version=versions.find(id=>s[id]);
 return version?{...s,[base]:true,...Object.fromEntries(versions.map(id=>[id,id===version]))}:s;},state);
export const winterGardenNormal=versionNormal;
/** Whether a tile shows as on: a base (the permitted Winter Garden, the fully glazed gable) is on only while none of its versions is. */
export const shownOn=(state:RenovationState,id:RenovationId)=>versionsOf[id]?state[id]&&!versionsOf[id]!.some(v=>state[v]):state[id];
/** The state after a tile is pressed: any version turns the others of its base off. */
export const toggled=(state:RenovationState,id:RenovationId):RenovationState=>{const on=!shownOn(state,id),base=baseOf(id);if(!base)return {...state,[id]:on};
 const off=Object.fromEntries(versionsOf[base]!.map(v=>[v,false]));return id===base?{...state,...off,[base]:on}:{...state,...off,[base]:on,[id]:on};};
/** Offered renovations switched on: all of them (with the permitted Winter Garden), or only those named (a link's `renovations` list). */
export const offeredState=(ids?:readonly string[]):RenovationState=>versionNormal({...renovationState(),...Object.fromEntries(offered.filter(r=>ids?ids.includes(r.id):!allVersions.includes(r.id)).map(r=>[r.id,true]))});
export const renovationVisibleOn=(level:Level)=>level==='exterior'||level==='ground';
export function renovationView(id:RenovationId):Viewpoint{return renovations.find(r=>r.id===id)!.view;}
