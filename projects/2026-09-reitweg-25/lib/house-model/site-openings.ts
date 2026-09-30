import * as T from 'three';
import {passable} from './walk';
import {planPoint as p,PLAN_SCALE} from './site-data';

/** Openings in the ground: the guest basement's external stair and the basement light wells.
 * Positions follow the ground and basement plans; depths and finishes are estimates. */

// External stair along the guest wing's south façade: top step at the west end, landing and basement door at the east end.
const top=p(89,1234),bottom=p(262,1247),WIDTH=1.05,RISERS=14,RUN=2.8,FLOOR=-2.45;
const length=Math.hypot(bottom[0]-top[0],bottom[1]-top[1]),ux=(bottom[0]-top[0])/length,uz=(bottom[1]-top[1])/length;
const at=(u:number,v:number):[number,number]=>[top[0]+ux*u-uz*v,top[1]+uz*u+ux*v];

/** The open stairwell, for cutting the lawn, soil and surrounding ground. */
export function basementStairWell():[number,number][]{const h=WIDTH/2+.2;return [at(-.05,-h),at(length+.25,-h),at(length+.25,h),at(-.05,h)];}

/** The hall's stairwell to the basement, beneath the open stair up (ground-plan pixels x0, z0, x1, z1): all of the
 * basement flight but its top step, which is the landing from the hall (build-model.ts). */
export const HALL_WELL=[906,478,946,607] as const;
export function hallStairWell():[number,number][]{const [x0,z0,x1,z1]=HALL_WELL;return [p(x0,z0),p(x1,z0),p(x1,z1),p(x0,z1)];}

/** Every opening cut from the ground around and under the house (the viewer's surrounding ground, the lawn and soil). */
export const groundOpenings=()=>[basementStairWell(),hallStairWell()];

export function buildBasementStair(stone:T.Material,steel:T.Material,door:T.Material){
 const g=new T.Group();g.name='guest-basement-external-stair';g.position.set(top[0],0,top[1]);g.rotation.y=-Math.atan2(uz,ux);
 const geo=new T.BoxGeometry(1,1,1);
 const box=(u:number,y:number,v:number,w:number,h:number,d:number,mat:T.Material)=>{const o=new T.Mesh(geo,mat);o.position.set(u,y+h/2,v);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const rise=-FLOOR/RISERS,tread=RUN/(RISERS-1);
 for(let i=0;i<RISERS-1;i++)box((i+.5)*tread,-(i+1)*rise-.3,0,tread+.01,.3,WIDTH,stone);
 box((RUN+length)/2+.05,FLOOR-.12,0,length-RUN+.1,.12,WIDTH,stone);
 // Retaining walls on both sides and at the landing end; the north side is the basement wall.
 for(const v of [-1,1])box(length/2+.1,FLOOR-.15,v*(WIDTH/2+.1),length+.3,-FLOOR+.23,.2,stone);
 box(length+.15,FLOOR-.15,0,.2,-FLOOR+.23,WIDTH+.4,stone);
 passable(box(length-.85,FLOOR,-(WIDTH/2)+.015,.9,2.05,.03,door));
 // Guard rail along the open south edge and the landing end.
 for(let u=.1;u<=length+.1;u+=1.1)box(u,.08,WIDTH/2+.1,.04,.95,.04,steel);
 box(length/2+.1,1.01,WIDTH/2+.1,length+.05,.04,.05,steel);
 box(length+.15,1.01,0,.05,.04,WIDTH+.25,steel);box(length+.15,.08,0,.04,.95,.04,steel);
 return g;
}

// Light wells beside the basement windows (basement plan, basement-sheet x shifted onto the ground sheet), and the windows themselves.
export const BASEMENT_WINDOWS:{wall:'north'|'south'|'east'|'west';from:number;to:number}[]=[
 {wall:'north',from:1010,to:1042},{wall:'north',from:1083,to:1112},
 {wall:'south',from:1083,to:1112},{wall:'south',from:1125,to:1154},
 {wall:'west',from:271,to:298},{wall:'west',from:312,to:339},{wall:'west',from:349,to:378},{wall:'west',from:391,to:420},{wall:'west',from:512,to:543},
 {wall:'east',from:257,to:289},{wall:'east',from:395,to:424},{wall:'east',from:530,to:560},
];
const WELLS:{wall:'north'|'south'|'east'|'west';from:number;to:number}[]=[
 {wall:'north',from:1004,to:1050},{wall:'north',from:1075,to:1121},{wall:'south',from:1069,to:1165},
 {wall:'west',from:262,to:305},{wall:'west',from:306,to:344},{wall:'west',from:345,to:384},{wall:'west',from:386,to:424},{wall:'west',from:505,to:549},
 {wall:'east',from:251,to:297},{wall:'east',from:389,to:426},{wall:'east',from:522,to:568},
];
/** Steel grates flush with the lawn, just outside the ground-floor cladding. xShift maps basement-sheet x to the ground sheet. */
export function buildLightWells(grate:T.Material,frame:T.Material,xShift:number){
 const g=new T.Group();g.name='basement-light-well-grates';const geo=new T.BoxGeometry(1,1,1);
 const box=(x:number,z:number,w:number,d:number,h:number,y:number,mat:T.Material)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y+h/2,z);o.scale.set(w,h,d);o.receiveShadow=true;g.add(o);return o;};
 const out=.105,depth=.75,face={north:p(0,182)[1]-out,south:p(0,877)[1]+out,west:p(795,0)[0]-out,east:p(1229,0)[0]+out};
 for(const w of WELLS){
  const along=w.wall==='north'||w.wall==='south',a=along?(w.from-1012)*PLAN_SCALE+xShift:(w.from-529.5)*PLAN_SCALE,b=along?(w.to-1012)*PLAN_SCALE+xShift:(w.to-529.5)*PLAN_SCALE;
  const sign=w.wall==='north'||w.wall==='west'?-1:1,edge=face[w.wall],mid=edge+sign*depth/2,centre=(a+b)/2,span=b-a;
  const [x,z,sx,sz]=along?[centre,mid,span,depth]:[mid,centre,depth,span];
  box(x,z,sx,sz,.02,.004,grate);
  for(const s of [-1,1]){if(along){box(x+s*span/2,z,.05,depth,.03,0,frame);box(x,z+s*depth/2,span,.05,.03,0,frame);}else{box(x,z+s*span/2,depth,.05,.03,0,frame);box(x+s*depth/2,z,.05,span,.03,0,frame);}}
  const bars=Math.floor(span/.12);for(let i=1;i<bars;i++){const t=-span/2+i*span/bars;if(along)box(x+t,z,.012,depth,.028,0,frame);else box(x,z+t,depth,.012,.028,0,frame);}
 }
 return g;
}
