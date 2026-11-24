import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** The small things of a house that is lived in: fruit and a loaf on the island, a kettle on the range, mugs and a
 * paper on the breakfast table, books on the coffee table, lamps by the beds. Unlike the furniture (interiors.ts), none
 * of it is taken from the owner's photographs: it is dressing, in the photographic settings only, and each piece hangs
 * from the furniture it stands on, so it comes and goes with that piece's renovation. The lamps' shades glow with the
 * house's lamps (`userData.lamp`, lighting.ts). */
export const LIVED_IN={shade:'#2b2013'};

export function dressHouse(root:T.Object3D,material:(pale:string,natural?:string,roughness?:number)=>T.MeshStandardMaterial){
 const m={
  ceramic:material('#efece4','#ece8dd',.35),stoneware:material('#cfc8b8','#8f9a8c',.6),steel:material('#d0d3d2','#b9bdbd',.28),oak:material('#c4b69f','#a9804f',.7),
  paper:material('#f1eee6','#ece7da',.9),linen:material('#e9e2d2','#d9cfba',.95),bread:material('#d6c2a2','#b98a52',.9),glass:material('#dfe8e4','#c9d8d2',.1),
  green:material('#b9c2a6','#6c8454',.8),orange:material('#dcbf9f','#d98433',.6),red:material('#d6b3aa','#b5402f',.5),lemon:material('#e2d9ab','#d8bd45',.6),
  wax:material('#f0ead8','#efe6cc',.6),black:material('#6f7471','#2b2e2f',.5),brass:material('#c0b49b','#ad8c48',.35),
  books:[['#c9bfb0','#7a4a3a'],['#b9c0bd','#3f5560'],['#d6d0bf','#c9b98f'],['#bdbfb2','#58614a'],['#d9cbc6','#b88379'],['#cfcfc8','#2f3336']].map(([a,b])=>material(a,b,.85)),
 };
 m.steel.metalness=.85;m.brass.metalness=.8;
 const shade=new T.MeshStandardMaterial({color:'#efe4cf',roughness:.9,emissive:LIVED_IN.shade,emissiveIntensity:0,side:T.DoubleSide});shade.userData.lamp=true;
 const unit=new T.BoxGeometry(1,1,1),soft=new RoundedBoxGeometry(1,1,1,2,.12),cyl=new T.CylinderGeometry(1,1,1,16),ball=new T.SphereGeometry(1,12,8);
 const bowlGeo=new T.CylinderGeometry(1,.55,1,20,1,true),shadeGeo=new T.CylinderGeometry(.62,1,1,20,1,true);
 const put=(g:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,turn=0)=>{
  const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.y=turn;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const box=(g:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,turn=0)=>put(g,unit,mat,x,y+h/2,z,w,h,d,turn);
 const round=(g:T.Object3D,x:number,y:number,z:number,r:number,h:number,mat:T.Material)=>put(g,cyl,mat,x,y+h/2,z,r,h,r);
 const bowl=(g:T.Object3D,x:number,y:number,z:number,r:number,mat:T.Material)=>{const o=put(g,bowlGeo,mat,x,y+r*.25,z,r,r*.5,r);(o.material as T.Material).side=T.DoubleSide;round(g,x,y,z,r*.56,.006,mat);return o;};
 /** `count` books lying in a stack, the largest at the bottom, each turned a little. */
 const stack=(g:T.Object3D,x:number,y:number,z:number,count:number,size=.3,turn=0)=>{let h=y;for(let i=0;i<count;i++){const t=.022+((i*7)%3)*.008,k=1-i*.09;box(g,x,h,z,size*k,t,size*.72*k,m.books[(i*5+count)%m.books.length],turn+(i%2?.16:-.1)*(i+1)*.5);h+=t;}return h;};
 const mug=(g:T.Object3D,x:number,y:number,z:number,mat=m.ceramic)=>{round(g,x,y,z,.04,.09,mat);box(g,x+.05,y+.025,z,.03,.045,.012,mat);};
 const plate=(g:T.Object3D,x:number,y:number,z:number)=>round(g,x,y,z,.12,.012,m.ceramic);
 const candle=(g:T.Object3D,x:number,y:number,z:number,h=.2)=>{round(g,x,y,z,.035,.012,m.brass);round(g,x,y+.012,z,.011,h,m.wax);};
 /** A table lamp: a stoneware foot, a brass stem and a linen drum that glows in the evening. */
 const lamp=(g:T.Object3D,x:number,y:number,z:number,h=.46,foot=m.stoneware)=>{
  put(g,ball,foot,x,y+h*.2,z,h*.17,h*.2,h*.17);round(g,x,y+h*.38,z,.008,h*.22,m.brass);put(g,shadeGeo,shade,x,y+h*.78,z,h*.33,h*.44,h*.33);};
 const fruit=(g:T.Object3D,x:number,y:number,z:number,r:number)=>{bowl(g,x,y,z,r,m.stoneware);
  [[-.3,.1,m.orange],[.25,-.2,m.orange],[.05,.32,m.red],[-.1,-.3,m.lemon],[.3,.22,m.green],[0,0,m.red]].forEach(([dx,dz,mat],i)=>put(g,ball,mat as T.Material,x+(dx as number)*r,y+r*.28+(i===5?r*.22:0),z+(dz as number)*r,r*.24,r*.23,r*.24));};
 /** A jug of cut stems. */
 const stems=(g:T.Object3D,x:number,y:number,z:number,h=.24)=>{round(g,x,y,z,.05,h,m.ceramic);
  for(let i=0;i<6;i++){const a=i*2.4,lean=.1+.05*(i%3),len=h*1.6+.05*(i%2),o=put(g,cyl,m.green,x+Math.cos(a)*lean*len*.5,y+h+len*.45,z+Math.sin(a)*lean*len*.5,.004,len,.004);o.rotation.set(Math.sin(a)*lean,0,-Math.cos(a)*lean);
   put(g,ball,i%2?m.green:m.lemon,x+Math.cos(a)*lean*len,y+h+len*.92,z+Math.sin(a)*lean*len,.028,.022,.028);}};
 const on=(name:string,dress:(g:T.Object3D)=>void)=>{const g=root.getObjectByName(name);if(g)dress(g);};

 // Kitchen. The island's oak top is 0.905 m up, its sink toward the hall; the range run's worktop 0.935 m.
 on('kitchen-island',g=>{const y=.905;fruit(g,-.05,y,-.75,.17);
  box(g,.2,y,-1.25,.26,.02,.4,m.oak,.2);put(g,soft,m.bread,.2,y+.075,-1.25,.13,.11,.27,.2);box(g,.33,y+.02,-1.12,.02,.004,.2,m.steel,.5);
  stack(g,-.22,y,-.1,2,.27,.3);mug(g,.18,y,.15);});
 on('kitchen-range-run',g=>{const y=.935;
  // A kettle on the cooker, a crock of spoons and three jars along the wall, bowls and cups on the oak shelf.
  round(g,-1.36,y+.015,-.02,.085,.13,m.steel);put(g,ball,m.steel,-1.36,y+.15,-.02,.08,.03,.08);box(g,-1.36,y+.16,-.02,.012,.07,.012,m.black);
  round(g,.25,y,.12,.06,.15,m.stoneware);for(let i=0;i<4;i++){const o=put(g,cyl,m.oak,.25+(i-1.5)*.02,y+.22,.12+(i%2?.015:-.015),.006,.26,.006);o.rotation.z=(i-1.5)*.12;}
  [1.25,1.42,1.6].forEach((x,i)=>{round(g,x,y,.14,.05,.13+i*.03,m.glass);round(g,x,y+.13+i*.03,.14,.052,.015,m.oak);});
  box(g,2.1,y,.05,.32,.018,.22,m.oak,.1);
  [.3,.52,.74].forEach(x=>bowl(g,x,1.52,.17,.085,m.ceramic));[1,1.12,1.24].forEach(x=>round(g,x,1.52,.17,.036,.08,m.stoneware));});
 on('kitchen-breakfast-table',g=>{const y=.75;mug(g,.3,y,.22);mug(g,-.35,y,-.2,m.stoneware);plate(g,.32,y,-.05);plate(g,-.3,y,.12);
  box(g,-.02,y,.2,.3,.008,.42,m.paper,.25);stems(g,.05,y,-.12,.16);});
 on('dining-alcove',g=>{const y=.75;box(g,0,y,0,1.9,.004,.36,m.linen);bowl(g,0,y+.004,0,.19,m.stoneware);candle(g,-.5,y+.004,.02,.22);candle(g,-.62,y+.004,-.04,.16);candle(g,.55,y+.004,0,.2);});
 // Living: books and a bowl on the glass table, in either layout; a throw over the west sofa's arm.
 for(const name of ['living-glass-table','living-glass-table-in-l'])on(name,g=>{const y=.42,top=stack(g,-.32,y,.1,3,.34,.2);round(g,-.32,top,.1,.045,.05,m.wax);bowl(g,.35,y,-.15,.13,m.ceramic);box(g,.3,y,.3,.21,.012,.29,m.paper,-.3);});
 on('living-west-sofa',g=>{const o=put(g,soft,m.linen,-1.1,.56,-.08,.5,.06,.7);o.rotation.z=.04;});
 on('family-room-console',g=>{const y=.46;stack(g,-.85,y,.02,3,.26,.1);stems(g,.88,y,0,.2);});
 on('hall-sideboard',g=>{const y=.89;lamp(g,-.98,y,0,.52);bowl(g,-.42,y,.02,.11,m.brass);stack(g,-.68,y,-.02,2,.24,.4);});
 // A lamp and a book by each bed: the bedside tables stand 0.42 m up, 0.42 m clear of the mattress, toward its head.
 for(const [name,width,sides] of [['garden-bedroom-bed',1.85,[-1,1]],['northwest-bed-against-divider',1.6,[1]],['guest-bedroom-bed-under-skylights',1.8,[-1,1]]] as const)
  on(name,g=>{for(const side of sides){const x=side*(width/2+.42);lamp(g,x-side*.03,.42,-.78,.4);if(side>0)stack(g,x-.02,.42,-.62,2,.17,.5);else mug(g,x+.04,.42,-.6);}});
 on('guest-study-desk',g=>{const y=.75;lamp(g,.12,y,.95,.44,m.black);mug(g,-.12,y,.35);box(g,.02,y,.1,.21,.006,.3,m.paper,.12);box(g,.05,y+.006,.08,.21,.004,.3,m.paper,-.2);});
}
