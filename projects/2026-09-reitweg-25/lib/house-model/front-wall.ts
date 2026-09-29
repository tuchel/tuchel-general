import * as T from 'three';
import {passable} from './walk';
import {sitePoint as s} from './site-data';

/** Existing wall, not the proposed higher timber replacement.
 * Gate locations follow the overview; finish and openings follow IMG_1625/1627.
 * The photograph supplies proportions, not surveyed heights.
 */
export function buildFrontWall(material:(pale:string,natural?:string)=>T.MeshStandardMaterial,renovated=false){
 const group=new T.Group();group.name=renovated?'proposed-timber-roadside-wall':'existing-roadside-wall';
 const render=material('#dedcd2','#d7d2bc'),cap=material('#aaa99f','#686b65'),metal=material('#727970','#343d38'),road=material('#aaa99f','#737264');
 const grain=new Uint8Array(128*128*4);let grainSeed=433;for(let i=0;i<128*128;i++){grainSeed=(grainSeed*1664525+1013904223)>>>0;const v=210+Math.round(grainSeed/4294967296*45);grain.set([v,v,v,255],i*4);}const asphalt=new T.DataTexture(grain,128,128);asphalt.colorSpace=T.SRGBColorSpace;asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping;asphalt.repeat.set(240,4);asphalt.needsUpdate=true;road.map=asphalt;road.bumpMap=asphalt;road.bumpScale=.006;
 const geo=new T.BoxGeometry(1,1,1);
 const box=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const timber=material('#967b59'),darkTimber=material('#52483c');
 const boards=(g:T.Group,lo:number,hi:number)=>{box(g,(lo+hi)/2,.16,0,hi-lo,1.94,.23,darkTimber);for(let y=.19;y<2.06;y+=.15)box(g,(lo+hi)/2,y,0,hi-lo,.128,.27,timber);box(g,(lo+hi)/2,2.1,0,hi-lo,.045,.3,cap);};
 const run=(start:[number,number],end:[number,number],height=1.25)=>{const a=s(...start),b=s(...end),len=Math.hypot(b[0]-a[0],b[1]-a[1]);const g=new T.Group();g.position.set(a[0],0,a[1]);g.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);group.add(g);if(renovated){boards(g,0,len);return g;}box(g,len/2,0,0,len,.18,.3,cap);box(g,len/2,.18,0,len,height-.18,.26,render);box(g,len/2,height,0,len+.04,.045,.33,cap);return g;};
 run([441,220],[336,399]);run([336,399],[365,422]);
 // Recessed arrival frontage, north to south: pedestrian gate, service doors, vehicle gate.
 const a=s(365,422),b=s(346,610),len=Math.hypot(b[0]-a[0],b[1]-a[1]);const g=new T.Group();g.position.set(a[0],0,a[1]);g.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);group.add(g);
 const wall=(lo:number,hi:number)=>{if(renovated){boards(g,lo,hi);return;}box(g,(lo+hi)/2,0,0,hi-lo,.18,.31,cap);box(g,(lo+hi)/2,.18,0,hi-lo,1.14,.28,render);box(g,(lo+hi)/2,1.32,0,hi-lo+.035,.045,.34,cap);};
 wall(0,1.15);wall(2.45,3.45);wall(5.7,7.65);wall(11.85,len);
 // Gate leaves let the walker through; the posts stay solid.
 const gate=(lo:number,hi:number,barred:boolean)=>{for(const x of [lo,hi])if(renovated)box(g,x,0,0,.09,2.15,.3,metal);else box(g,x,.05,0,.09,1.31,.1,metal);const leaves=g.children.length;leaf(lo,hi,barred);g.children.slice(leaves).forEach(passable);};
 const leaf=(lo:number,hi:number,barred:boolean)=>{if(renovated){boards(g,lo+.05,hi-.05);box(g,hi-.18,.92,-.17,.045,.27,.04,metal);return;}if(barred){for(let x=lo+.12;x<hi;x+=.13)box(g,x,.16,0,.035,1.04,.055,metal);for(const y of [.16,1.2])box(g,(lo+hi)/2,y,0,hi-lo,.065,.065,metal);}else{box(g,(lo+hi)/2,.08,0,hi-lo-.07,1.21,.06,metal);box(g,hi-.14,.71,-.055,.12,.03,.025,cap);}};
 gate(1.15,2.45,false);gate(3.45,5.7,false);gate(7.65,11.85,true);
 box(g,2.98,.88,-.16,.31,.36,.06,metal); // inset mailbox/intercom, facing the road
 run([346,610],[246,626]);run([246,626],[199,849]);
 // Road and cobbled approach, just outside the source-plan boundary.
 const strip=(start:[number,number],end:[number,number],w:number,mat:T.Material,y:number)=>{const u=s(...start),v=s(...end);const m=box(group,(u[0]+v[0])/2,y,(u[1]+v[1])/2,Math.hypot(v[0]-u[0],v[1]-u[1]),.04,w,mat);m.rotation.y=-Math.atan2(v[1]-u[1],v[0]-u[0]);};
 strip([995,-1430],[-451,2487],4.4,road,-.055);
 // The complete recessed forecourt is cobbled by buildEntranceGarden,
 // shared by the existing and renovated walls.
 return group;
}
