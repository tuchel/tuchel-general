import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** A lounge chair and ottoman of the Eames kind (Layout Updates): moulded walnut shells on a five-star swivel base,
 * black leather cushions, a reclined back and headrest. The chair faces −z: 0.84 m wide, 0.9 m deep with its base
 * (0.39 m in front of the swivel, 0.51 m behind) and 0.94 m to the headrest; the ottoman 0.66 × 0.56 m, 0.45 m high. */
export function loungeChair(materials:{walnut:T.Material;leather:T.Material;metal:T.Material}){
 const {walnut,leather,metal}=materials,unit=new T.BoxGeometry(1,1,1),soft=new RoundedBoxGeometry(1,1,1,3,.18),post=new T.CylinderGeometry(1,1,1,16);
 const piece=(parent:T.Object3D,geometry:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 /** A swivel base: a column and `legs` splayed feet, `reach` from the centre to each glide. */
 const base=(parent:T.Group,legs:number,reach:number,height:number)=>{
  piece(parent,post,metal,0,height/2+.03,0,.035,height,.035);
  for(let i=0;i<legs;i++){const a=i/legs*Math.PI*2+Math.PI/legs,leg=new T.Group();leg.rotation.y=a;parent.add(leg);
   const arm=piece(leg,unit,metal,reach/2,.05,0,reach,.028,.05);arm.rotation.z=-.08;piece(leg,post,metal,reach,.015,0,.025,.03,.025);}
 };
 /** A shell with its cushion in front, tilted back by `tilt`: `w` × `h` (up the shell), cushion `t` thick. */
 const shell=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,t:number,tilt:number)=>{
  const g=new T.Group();g.position.set(x,y,z);g.rotation.x=tilt;parent.add(g);
  piece(g,soft,walnut,0,h/2,.02,w,h,.04);piece(g,soft,leather,0,h/2,-t/2,w-.07,h-.05,t);return g;
 };
 const chair=new T.Group();chair.name='lounge-chair';
 base(chair,5,.38,.24);
 // Seat: a shell rising a little toward the front, with its cushion on top.
 const seat=new T.Group();seat.position.set(0,.3,0);seat.rotation.x=.13;chair.add(seat);
 piece(seat,soft,walnut,0,0,0,.76,.04,.6);piece(seat,soft,leather,0,.075,-.02,.7,.12,.56);
 // Back and headrest, reclined.
 shell(chair,0,.36,.22,.76,.44,.13,.42);shell(chair,0,.69,.37,.68,.25,.12,.42);
 // Arms: leather pads on walnut rests, from the back to past the front of the seat.
 for(const x of [-.38,.38]){piece(chair,unit,walnut,x,.5,.02,.05,.035,.48);piece(chair,soft,leather,x,.54,.02,.08,.055,.46);piece(chair,unit,metal,x,.42,.16,.03,.12,.03);}
 const ottoman=new T.Group();ottoman.name='lounge-ottoman';
 base(ottoman,4,.3,.24);
 const top=new T.Group();top.position.set(0,.3,0);top.rotation.x=-.06;ottoman.add(top);
 piece(top,soft,walnut,0,0,0,.66,.04,.55);piece(top,soft,leather,0,.075,0,.6,.12,.5);
 return {chair,ottoman};
}
