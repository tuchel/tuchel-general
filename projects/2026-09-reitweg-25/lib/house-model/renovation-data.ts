import type {Level,Viewpoint} from './site-data';
export const renovations = [
 {id:'kitchen',title:'The garden kitchen',detail:'The full west + north volume, garden dining, breakfast bar and wider cooking aisle.',view:'arrival',center:[-5.7,-7.5],span:16},
 {id:'east',title:'Open the east façade',detail:'Floor-to-ceiling glass, a private bathroom band and the wrap to the fireplace.',view:'east',center:[1,1],span:25},
 {id:'terrace',title:'Dining on the east terrace',detail:'A generous stone terrace, long oak table and a little shade.',view:'east',center:[7.5,5.8],span:14},
 {id:'courtyard',title:'Lounge by the fire',detail:'The fireside lounge, long table under the eaves and a wall-side serving counter.',view:'courtyard',center:[-13.7,7],span:20},
 {id:'front',title:'A timber arrival wall',detail:'A taller boundary with horizontal timber and matching gates.',view:'arrival',center:[-35,0],span:35},
 {id:'solar',title:'Solar & battery storage',detail:'50 panels on the main roof · 22.5 kWp, with two battery placeholders. Gas heating retained; annual electricity balance, with winter grid support.',view:'east',center:[-7,2],span:38},
] as const;
export type RenovationId=typeof renovations[number]['id'];
export type RenovationState=Record<RenovationId,boolean>;
export const renovationState=(enabled=false):RenovationState=>({kitchen:enabled,east:enabled,terrace:enabled,courtyard:enabled,front:enabled,solar:enabled});
export const renovationVisibleOn=(level:Level)=>level==='exterior'||level==='ground';
export function renovationView(id:RenovationId):Viewpoint{return renovations.find(r=>r.id===id)!.view;}
