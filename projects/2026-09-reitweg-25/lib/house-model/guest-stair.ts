import * as T from 'three';
import {planPoint} from './site-data';

/** A wall-side flight, quarter landing and right-turn return, shared by both cutaways. */
export function guestStair(timber:T.Material,steel:T.Material,upper=false){
 const g=new T.Group();g.name=upper?'guest-upper-turning-stair':'guest-ground-turning-stair';
 const [x,z]=planPoint(112+(upper?52:0),808);g.position.set(x,0,z);g.rotation.y=-.093;
 const geo=new T.BoxGeometry(1,1,1);
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y+h/2,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const rail=(a:number[],b:number[],width=.03)=>{const u=new T.Vector3(...a),v=new T.Vector3(...b);const o=box(0,0,0,width,u.distanceTo(v),width,steel);o.position.copy(u.clone().add(v).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.sub(u).normalize());};
 const base=.16,landing=2.3,top=3.1;
 for(let i=0;i<12;i++){const y=base+(i+1)*(landing-base)/12,z=3.3-(i+.5)*2.7/12;box(0,y-.055,z,1,.055,.25,timber);box(.49,y,z,.025,.92,.025,steel);}
 rail([.49,base+1.05,3.3],[.49,landing+.96,.6]);rail([-.43,base,3.3],[-.43,landing-.07,.6],.075);rail([.43,base,3.3],[.43,landing-.07,.6],.075);
 box(0,landing-.1,.1,1,.1,1,timber);
 for(let i=0;i<4;i++){const x=.5+(i+.5)*1.25/4,y=landing+(i+1)*(top-landing)/4;box(x,y-.055,.1,1.25/4+.025,.055,1,timber);box(x,y,-.39,.025,.94,.025,steel);}
 rail([.5,landing+.96,-.39],[1.75,top+.96,-.39]);
 rail([-.49,landing+.96,-.4],[.5,landing+.96,-.4]);for(const x of [-.49,.5])box(x,landing,-.4,.025,.96,.025,steel);
 return g;
}
