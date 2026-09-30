import {PLAN_SCALE,UPPER_PLAN_X_OFFSET,viewpoints,type Viewpoint} from './site-data';
import {places,type Place} from './experience-data';

/** The Views map: the exposé site and floor plans, with a dot where each eye-level view stands and an arrow on the frame
 * for each overview. The sheets are 2200 px wide; tracing used their 1888 px-wide presentation (site-data.ts). */
const K=2200/1888;
export type Sheet='grounds'|'ground'|'upper';
/** Where a name sits beside its dot; 'above-left' ends just past the dot, for dots near a map's right edge. */
export type Side='left'|'right'|'above'|'below'|'above-left';
/** crop: [x, y, width, height] in sheet pixels. The floor crops cover the same ground: the upper sheet is drawn 52 trace
 * pixels east of the ground sheet. */
export const sheets:Record<Sheet,{src:string;title:string;crop:[number,number,number,number];toSheet:(x:number,z:number)=>[number,number]}>={
 grounds:{src:'grounds.png',title:'Grounds',crop:[110,250,1265,810],toSheet:(x,z)=>[(x*181/12+874)*K,(z*181/12+531.5)*K]},
 ground:{src:'ground-floor.png',title:'Ground floor',crop:[905,190,555,880],toSheet:(x,z)=>[(x/PLAN_SCALE+1012)*K,(z/PLAN_SCALE+529.5)*K]},
 upper:{src:'upper-floor.png',title:'Upper floor',crop:[966,190,555,880],toSheet:(x,z)=>[((x-UPPER_PLAN_X_OFFSET)/PLAN_SCALE+1012)*K,(z/PLAN_SCALE+529.5)*K]},
};
/** The sheet each place stands on, and the side of its dot the name sits (clear of the way it looks). */
const placeSheets:Record<Place,[Sheet,Side]>={
 lane:['grounds','above'],entrance:['grounds','above'],pool:['grounds','left'],court:['grounds','below'],
 living:['ground','below'],dining:['ground','left'],kitchen:['ground','right'],
 bedroom:['upper','above-left'],upstairs:['upper','left'],
};
/** Overviews that look across the house from one side; the whole lot and the plan view look at everything. */
const overviews:Partial<Record<Viewpoint,Side>>={courtyard:'left',east:'left',arrival:'right'};
export const wholeViews:Viewpoint[]=['estate','top'];
/** Sizes in CSS pixels, shared with globals.css (.view-map-*). */
export const MARKER={dot:14,air:24,gap:6,pad:6,labelHeight:20,pair:8,overhang:10};
export type MapMarker={id:Place|Viewpoint;label:string;kind:'eye'|'air';x:number;y:number;heading:number;side:Side};

/** Markers on one sheet, as fractions of its crop. Overviews are offered with the whole house, not in floor cutaways. */
export function mapMarkers(sheet:Sheet,withOverviews:boolean):MapMarker[]{
 const {crop:[cx,cy,cw,ch],toSheet}=sheets[sheet],frac=([x,y]:[number,number])=>[(x-cx)/cw,(y-cy)/ch];
 const angle=(a:[number,number],b:[number,number])=>Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
 const eye=(Object.keys(placeSheets) as Place[]).filter(id=>placeSheets[id][0]===sheet).map(id=>{
  const p=places[id],from=toSheet(p.position[0],p.position[2]),to=toSheet(p.target[0],p.target[2]),[x,y]=frac(from);
  return {id,label:p.short,kind:'eye' as const,x,y,heading:angle(from,to),side:placeSheets[id][1]};
 });
 if(sheet!=='grounds'||!withOverviews)return eye;
 // Each overview sits where the line from what it looks at back to its camera crosses the frame, just inside it.
 const inset=60,[x0,y0,x1,y1]=[cx+inset,cy+inset,cx+cw-inset,cy+ch-inset];
 const air=(Object.keys(overviews) as Viewpoint[]).map(id=>{
  const v=viewpoints[id],to=toSheet(v.target[0],v.target[2]),camera=toSheet(v.position[0],v.position[2]),d=[camera[0]-to[0],camera[1]-to[1]];
  const tx=d[0]>0?(x1-to[0])/d[0]:(x0-to[0])/d[0],ty=d[1]>0?(y1-to[1])/d[1]:(y0-to[1])/d[1],t=Math.min(tx,ty);
  const at:[number,number]=[to[0]+d[0]*t,to[1]+d[1]*t],[x,y]=frac(at);
  return {id,label:v.label,kind:'air' as const,x,y,heading:angle(at,to),side:overviews[id]!};
 });
 return [...eye,...air];
}
/** The map a view belongs on, so the panel opens where the current view is. */
export const sheetOf=(id:string):Sheet|undefined=>id in placeSheets?placeSheets[id as Place][0]:id in overviews||wholeViews.includes(id as Viewpoint)?'grounds':undefined;
