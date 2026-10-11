import * as T from 'three';
import {plotOutline} from './site-data';

/** Round the main house and along its north gable, from the owner's photographs from the north-west corner, the kitchen
 * terrace and the courtyard (cameras fitted to the gable, the eaves and the corners). World metres. */
// Outside the cladding (±6.105 × ±9.715), a 0.5 m strip of pale gravel held by a steel edge, wherever lawn or beds meet
// the walls: round both gables and the north-east corner, and up the west wall to the kitchen terrace and the courtyard
// paving (which end 8.85 m north and 8.65 m south of the middle).
const W=6.105,N=9.715,STRIP=.5,KITCHEN=-8.85,COURTYARD=8.65;
const GRAVEL:[number,number][]=[[-W,KITCHEN],[-W-STRIP,KITCHEN],[-W-STRIP,-N-STRIP],[W+STRIP,-N-STRIP],[W+STRIP,N+STRIP],[-W-STRIP,N+STRIP],[-W-STRIP,COURTYARD],[-W,COURTYARD],[-W,N],[W,N],[W,-N],[-W,-N]];
// The fence runs north from the north-east corner to the hedge; the mulch fills the bed west of it, from the gravel to
// the hedge, past the north-west corner.
const FENCE_X=5.95,MULCH_WEST=-9;
const boundary=(x:number)=>{const [a,b]=plotOutline;return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);};

export function buildNorthGarden(){
 const group=new T.Group();group.name='house-surround';
 const flat=(points:[number,number][],y:number,depth:number,mat:T.Material,name:string)=>{const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=new T.Mesh(geo,mat);mesh.position.y=y;mesh.name=name;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 // Thin enough that the basement light-well grates (2.4 cm) still stand clear of it.
 flat(GRAVEL,.005,.01,new T.MeshStandardMaterial({color:'#bdb8ad',roughness:1}),'house-gravel-strip');
 flat([[MULCH_WEST,-N-STRIP],[FENCE_X,-N-STRIP],[FENCE_X,boundary(FENCE_X)],[MULCH_WEST,boundary(MULCH_WEST)]],.005,.012,new T.MeshStandardMaterial({color:'#5e4a37',roughness:1}),'north-gable-mulch');
 const steel=new T.MeshStandardMaterial({color:'#4a4640',roughness:.7,metalness:.4}),edge=new T.Group();edge.name='gravel-strip-edge';group.add(edge);
 const outer=GRAVEL.slice(1,7);
 for(let i=0;i+1<outer.length;i++){const [a,b]=[outer[i],outer[i+1]],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const plate=new T.Mesh(new T.BoxGeometry(len+.006,.05,.006),steel);plate.position.set((a[0]+b[0])/2,.005,(a[1]+b[1])/2);plate.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);plate.receiveShadow=true;edge.add(plate);}
 // A dark green welded-mesh fence about 1 m tall: posts 2 m apart, paired horizontal wires every 20 cm and upright wires
 // every 5 cm, into the hedge.
 const fence=new T.Group();fence.name='north-garden-fence';group.add(fence);
 const green=new T.MeshStandardMaterial({color:'#2f3a31',roughness:.55,metalness:.3}),from=-N-STRIP-.05,to=boundary(FENCE_X)+1.1,span=from-to;
 const bar=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),green);o.position.set(x,y+h/2,z);o.castShadow=true;fence.add(o);};
 const posts=Math.ceil(span/2);for(let i=0;i<=posts;i++)bar(FENCE_X,0,from-i*span/posts,.06,1.05,.04);
 for(let y=.1;y<1.03;y+=.2)for(const side of [-.012,.012])bar(FENCE_X+side,y,from-span/2,.006,.006,span);
 for(let z=from-.025;z>to;z-=.05)bar(FENCE_X,.04,z,.004,.99,.004);
 return group;
}
