import type {Level,Viewpoint} from './site-data';
export const renovations = [
 {id:'kitchen',title:'The garden kitchen',detail:'The full west + north volume, garden dining, breakfast bar and wider cooking aisle.',view:'arrival',center:[-5.7,-7.5],span:16},
 {id:'east',title:'Open the east façade',detail:'Floor-to-ceiling glass, a private bathroom band and a south wall glazed on both sides of the fireplace.',view:'east',center:[1,1],span:25},
 {id:'nook',title:'A reading & office nook',detail:'The dining alcove becomes a library corner: bookshelves along the north wall, a deep sofa facing the garden and a desk at the east window.',view:'east',center:[3.4,1.8],span:8},
 {id:'terrace',title:'Dining on the east terrace',detail:'A generous stone terrace, long oak table and a little shade.',view:'east',center:[7.5,5.8],span:14},
 {id:'courtyard',title:'Lounge by the fire',detail:'The fireside lounge, long table under the eaves and a wall-side serving counter.',view:'courtyard',center:[-13.7,7],span:20},
 {id:'front',title:'A timber arrival wall',detail:'A taller boundary in the house’s upright timber cladding, with matching gates.',view:'arrival',center:[-35,0],span:35},
 {id:'solar',title:'Solar & battery storage',detail:'50 panels on the main roof · 22.5 kWp, with two battery placeholders. Gas heating retained; annual electricity balance, with winter grid support.',view:'east',center:[-7,2],span:38},
] as const;
export type RenovationId=typeof renovations[number]['id'];
export type RenovationState=Record<RenovationId,boolean>;
export const renovationState=(enabled=false):RenovationState=>({kitchen:enabled,east:enabled,nook:enabled,terrace:enabled,courtyard:enabled,front:enabled,solar:enabled});
/** Kept in the model but not offered for now: out of the panel, and off with "All on" or when a link names them. */
export const setAside:ReadonlySet<RenovationId>=new Set<RenovationId>(['terrace','courtyard','solar']);
export const offered=renovations.filter(r=>!setAside.has(r.id));
/** Offered renovations switched on: all of them, or only those named (a link's `renovations` list). */
export const offeredState=(ids?:readonly string[]):RenovationState=>({...renovationState(),...Object.fromEntries(offered.filter(r=>!ids||ids.includes(r.id)).map(r=>[r.id,true]))});
export const renovationVisibleOn=(level:Level)=>level==='exterior'||level==='ground';
export function renovationView(id:RenovationId):Viewpoint{return renovations.find(r=>r.id===id)!.view;}
