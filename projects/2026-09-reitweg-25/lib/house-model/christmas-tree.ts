import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {passable} from './walk';

/** A Christmas tree in the family room while the snow lies whole or falls: a Nordmann fir `height` metres tall and
 * `radius` wide at its lowest branches, `skirt` metres up, in a woven basket at `at` on the ground floor: before the
 * south-east window, clear of the sofa, the cane chair and the dining table the east façade's renovation sets there, and
 * seen from the garden. `lights` warm bulbs wind up it in `turns`, lit day and night at `bulb` times white on the screen;
 * in the evening they light the room around them (`glow`: candela and reach in metres). */
export const CHRISTMAS_TREE={at:[4.15,.16,8.62],height:2.2,radius:.52,skirt:.55,whorls:15,lights:120,turns:9,ornaments:28,bulb:3,glow:{color:'#ffb469',candela:.12,reach:3.5}};

export function christmasTree(){
 const {height,radius,skirt,whorls}=CHRISTMAS_TREE;
 let state=20261224;const r=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 const painted=(g:T.BufferGeometry,colour:(p:T.Vector3)=>T.Color)=>{
  const flat=g.index?g.toNonIndexed():g,p=flat.attributes.position,colours=new Float32Array(p.count*3),v=new T.Vector3();
  for(let i=0;i<p.count;i++){const c=colour(v.fromBufferAttribute(p,i));colours.set([c.r,c.g,c.b],i*3);}
  flat.setAttribute('color',new T.BufferAttribute(colours,3));flat.deleteAttribute('uv');return flat;
 };
 // How far the branches reach at a height, 0 at the skirt to 1 at the tip.
 const reach=(t:number)=>radius*Math.pow(1-t,.9)+.06,top=height-.16;
 const deep=new T.Color('#0e2215'),fresh=new T.Color('#264a2b'),mix=new T.Color();
 // A bough: a flat spray of needles tapering to its tip along x, darker toward the trunk.
 const bough=(length:number,width:number,shade:number)=>painted(new T.ConeGeometry(width/2,length,6,2).translate(0,length/2,0).rotateZ(-Math.PI/2).scale(1,.42,1),
  p=>mix.copy(deep).lerp(fresh,Math.min(1,p.x/length)*.85+p.y/width).multiplyScalar(shade).clone());
 const parts:T.BufferGeometry[]=[],turn=new T.Matrix4(),move=new T.Matrix4();
 for(let i=0;i<whorls;i++){
  const t=i/(whorls-1),y=skirt+(top-skirt)*t,length=reach(t),count=Math.round(T.MathUtils.lerp(13,5,t)),start=r()*Math.PI*2;
  // The lowest boughs droop a little under their weight; toward the tip they lift.
  const lift=T.MathUtils.lerp(-.2,.55,t*t);
  for(let k=0;k<count;k++){
   const a=start+(k+(r()-.5)*.35)/count*Math.PI*2,l=length*(.86+r()*.22),shade=.8+r()*.4;
   turn.makeRotationY(a).multiply(move.makeRotationZ(lift+(r()-.5)*.12));move.makeTranslation(0,y+(r()-.5)*.03,0).multiply(turn);
   parts.push(bough(l,l*.5+.06,shade).applyMatrix4(move));
   // Two side sprays leave it part of the way out.
   for(const side of [-1,1])parts.push(bough(l*.55,l*.26+.04,shade*1.06).applyMatrix4(new T.Matrix4().makeRotationY(side*.7)).applyMatrix4(new T.Matrix4().makeTranslation(l*.32,0,0)).applyMatrix4(move));
  }
 }
 const bark=new T.Color('#4b3626'),wicker=[new T.Color('#b08a5c'),new T.Color('#8f6c44')];
 parts.push(painted(new T.ConeGeometry(.05,.3,6).translate(0,top+.1,0),()=>fresh.clone().multiplyScalar(.9)));
 parts.push(painted(new T.CylinderGeometry(.012,.04,top,8).translate(0,top/2,0),()=>bark));
 // The dark of its inside, so that the room does not show between the boughs.
 {const inside=deep.clone().multiplyScalar(.7);parts.push(painted(new T.ConeGeometry(radius*.62,top-skirt+.12,10).translate(0,skirt-.06+(top-skirt+.12)/2,0),()=>inside));}
 // The basket, woven in bands.
 parts.push(painted(new T.CylinderGeometry(.22,.18,.3,18,10).translate(0,.15,0),p=>wicker[(Math.floor(p.y*33)+Math.floor(Math.atan2(p.z,p.x)*18/Math.PI+18))%2]));
 const matte=new T.MeshStandardMaterial({vertexColors:true,roughness:.82});
 const body=new T.Mesh(mergeGeometries(parts),matte);body.name='christmas-tree';
 for(const g of parts)g.dispose();
 // Where the lights and the baubles hang: on the boughs' tips, `inset` of the way in.
 const on=(t:number,a:number,inset:number,drop:number)=>new T.Vector3(Math.cos(a)*reach(t)*inset,skirt+(top-skirt)*t+reach(t)*inset*T.MathUtils.lerp(-.2,.55,t*t)-drop,Math.sin(a)*reach(t)*inset);
 // Baubles in deep red, gold and silvered glass, and a gold star at the tip, facing the room and the garden.
 const colours=[new T.Color('#7d1218'),new T.Color('#c9a046'),new T.Color('#d9dee0')],shiny:T.BufferGeometry[]=[];
 for(let i=0;i<CHRISTMAS_TREE.ornaments;i++){
  const t=.04+.8*(i+r()*.6)/CHRISTMAS_TREE.ornaments,at=on(t,i*2.4+r()*.5,.9,.05),size=.03+r()*.012,colour=colours[i%3];
  shiny.push(painted(new T.SphereGeometry(size,12,8).translate(at.x,at.y,at.z),()=>colour));
 }
 const star=new T.Shape();for(let i=0;i<10;i++){const a=i/10*Math.PI*2+Math.PI/2,q=i%2?.036:.09;star[i?'lineTo':'moveTo'](Math.cos(a)*q,Math.sin(a)*q);}
 shiny.push(painted(new T.ExtrudeGeometry(star,{depth:.02,bevelEnabled:false}).translate(0,height+.03,-.01),()=>colours[1]));
 const polished=new T.MeshStandardMaterial({vertexColors:true,roughness:.24,metalness:.6});
 const baubles=new T.Mesh(mergeGeometries(shiny),polished);baubles.name='christmas-tree-baubles';
 for(const g of shiny)g.dispose();
 // The fairy lights wind up the tree from the skirt to the tip.
 const bulbs:T.BufferGeometry[]=[];
 for(let i=0;i<CHRISTMAS_TREE.lights;i++){
  const t=Math.pow((i+.5)/CHRISTMAS_TREE.lights,1.25)*.97,at=on(t,t*CHRISTMAS_TREE.turns*Math.PI*2+r()*.25,.84+r()*.14,r()*.03);
  bulbs.push(new T.SphereGeometry(.013,6,4).translate(at.x,at.y,at.z));
 }
 const lit=new T.MeshStandardMaterial({color:'#fff1d0',emissive:'#ffc98a',emissiveIntensity:1,roughness:.4});
 const lights=new T.Mesh(mergeGeometries(bulbs),lit);lights.name='christmas-tree-lights';
 for(const g of bulbs)g.dispose();
 const group=new T.Group();group.name='christmas-tree-in-the-family-room';group.position.set(CHRISTMAS_TREE.at[0],CHRISTMAS_TREE.at[1],CHRISTMAS_TREE.at[2]);group.visible=false;
 // It comes and goes with the snow: outside the static batches, the walker's obstacles and the photographs' scene.
 for(const o of [body,baubles,lights]){o.userData.dynamic=true;o.userData.skipPhotographic=true;o.castShadow=o!==lights;o.receiveShadow=o!==lights;group.add(o);}
 passable(group);
 const glow=new T.PointLight(CHRISTMAS_TREE.glow.color,0,CHRISTMAS_TREE.glow.reach,2);glow.name='christmas-tree-glow';glow.position.set(CHRISTMAS_TREE.at[0]-.45,CHRISTMAS_TREE.at[1]+height*.5,CHRISTMAS_TREE.at[2]-.8);
 return {
  group,
  /** Its light on the room, for the evening lamps' group (lighting.ts): one more unshadowed light among them, standing
   * a little into the room so that the tree itself is lit from the front. */
  glow,
  /** Shown or not, with its bulbs as bright on the screen at any `exposure`, and its glow as the lamps come on (`dusk`). */
  show:(shown:boolean,exposure:number,dusk:number)=>{group.visible=shown;lit.emissiveIntensity=CHRISTMAS_TREE.bulb/Math.max(exposure,1e-3);glow.intensity=shown?CHRISTMAS_TREE.glow.candela*dusk:0;},
  dispose:()=>{for(const o of [body,baubles,lights]){o.geometry.dispose();(o.material as T.Material).dispose();}},
 };
}
