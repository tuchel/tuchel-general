import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sitePoint as s,guestRoofFrame,GUEST_ROOF} from './site-data';
import {timberBoards} from './front-wall';
import {passable} from './walk';

/** The front garage (a renovation option): a two-car garage on the lane in the plot's south-west corner, its doors facing
 * north to a straight drive from a new gate; a slate roof at the guest wing's pitch, eaves along the lane; a bin room for
 * four bins beside it, opening to the lane and, by a cobbled path, to the drive; a 2 m timber fence with a sliding drive
 * gate and a pedestrian gate on the road line across the notch. A concept on the grounds plan, not a survey.
 *
 * Along the lane south of the notch, positions are (m, v): m metres into the plot from the road line, v metres along it
 * southward from the notch's south corner. Across the notch they are (u, n): u along the road line northward from that
 * corner, n into the plot. */
const S=s(246,626),SW=s(199,849),N=s(336,399),NW=s(441,220);
export const LANE_LENGTH=Math.hypot(SW[0]-S[0],SW[1]-S[1]);
const ALONG=[(SW[0]-S[0])/LANE_LENGTH,(SW[1]-S[1])/LANE_LENGTH],INWARD=[ALONG[1],-ALONG[0]];
export const garagePoint=(m:number,v:number):[number,number]=>[S[0]+INWARD[0]*m+ALONG[0]*v,S[1]+INWARD[1]*m+ALONG[1]*v];
export const ROAD_LENGTH=Math.hypot(N[0]-S[0],N[1]-S[1]);
const UP=[(N[0]-S[0])/ROAD_LENGTH,(N[1]-S[1])/ROAD_LENGTH],IN=[-UP[1],UP[0]];
export const roadPoint=(u:number,n=0):[number,number]=>[S[0]+UP[0]*u+IN[0]*n,S[1]+UP[1]*u+IN[1]*n];

/** 6.4 × 6.0 m outside, set 0.15 m in from the road line so its roof stays on the plot; eaves at 2.6 m. */
export const GARAGE={v0:5.4,v1:11.4,m0:.15,m1:6.55,eave:2.6};
/** Four 240-litre bins side by side need 2.6 m along the lane. */
export const BIN_ROOM={v0:GARAGE.v1,v1:14,m0:.15,m1:1.75};
/** The guest wing's pitch: its roof's rise over half its width. */
export const GARAGE_PITCH=Math.atan2(GUEST_ROOF.ridge-GUEST_ROOF.eave,guestRoofFrame.width/2+GUEST_ROOF.overhang);
export const DRIVE_GATE:[number,number]=[6.5,10.5],PEDESTRIAN_GATE:[number,number]=[14,15.2];
/** The bin path, (m, v): from the apron, down the garage's east side, then along its south gable to the bin room's garden
 * door; 0.9 m wide. */
export const BIN_PATH:[number,number][]=[[7.35,5],[7.35,12.6],[BIN_ROOM.m1,12.6]];
export const BIN_PATH_WIDTH=.9;
/** Where the old recessed wall stood between the notch and the drive: a band 0.45 m into the plot from its line, which
 * the cobbles close over once it comes down (world x, z). */
const WN=s(365,422),WS=s(346,610),wall=Math.hypot(WS[0]-WN[0],WS[1]-WN[1]),wd=[(WS[0]-WN[0])/wall,(WS[1]-WN[1])/wall];
export const OLD_WALL_LINE:[number,number][]=[[WN[0]-wd[0]*.15,WN[1]-wd[1]*.15],WS,[WS[0]+wd[1]*.45,WS[1]-wd[0]*.45],[WN[0]-wd[0]*.15+wd[1]*.45,WN[1]-wd[1]*.15-wd[0]*.45]];
/** The lane's frontage south of the notch, as world z from 3 m north of it to 3 m south of the plot's corner. */
export const GARAGE_FRONTAGE:[number,number]=[S[1]-3,SW[1]+3];
/** Cobbles from the notch to the garage doors, joining the drive, reaching 0.4 m over its old edge (world x, z). */
export const GARAGE_APRON:[number,number][]=[S,garagePoint(0,GARAGE.v0),garagePoint(7.85,GARAGE.v0),s(343,707),s(352,610),s(346,610)];

type MaterialFactory=(pale:string,natural?:string,roughness?:number)=>T.MeshStandardMaterial;
export function buildFrontGarage(material:MaterialFactory){
 const group=new T.Group();group.name='front-garage';
 const roof=new T.Group();roof.name='front-garage-roof';
 const clad=material('#e4e0d5','#6e5946'),doorWood=material('#a6a397','#493c31'),slate=material('#c3c4bc','#4d5453'),trim=material('#999d92','#3c443f'),slab=material('#d6d3c9','#b1afa4');
 clad.userData.photo='cladding';doorWood.userData.photo='cladding';slate.userData.photo='roof';slab.userData.photo='stone';
 const unit=new T.BoxGeometry(1,1,1);
 const mesh=(parent:T.Object3D,geometry:T.BufferGeometry,mat:T.Material)=>{const o=new T.Mesh(geometry,mat);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 // A box from (m0, y0, v0) to (m1, y1, v1) in the lane frame.
 const box=(parent:T.Object3D,m0:number,m1:number,y0:number,y1:number,v0:number,v1:number,mat:T.Material)=>{const o=mesh(parent,unit,mat);o.position.set((m0+m1)/2,(y0+y1)/2,(v0+v1)/2);o.scale.set(m1-m0,y1-y0,v1-v0);return o;};
 // A wall across the lane frame (in the m–height plane) from `v0` to `v1`, its outline in (m, height).
 const across=(parent:T.Object3D,outline:number[][],v0:number,v1:number,mat:T.Material)=>{const geo=new T.ExtrudeGeometry(new T.Shape(outline.map(([m,y])=>new T.Vector2(m,y))),{depth:v1-v0,bevelEnabled:false});const o=mesh(parent,geo,mat);o.position.z=v0;return o;};
 // A wall along the lane frame (in the v–height plane) from `m0` to `m1`, its outline in (v, height).
 const along=(parent:T.Object3D,outline:number[][],m0:number,m1:number,mat:T.Material)=>{const geo=new T.ExtrudeGeometry(new T.Shape(outline.map(([v,y])=>new T.Vector2(v,y))),{depth:m1-m0,bevelEnabled:false}).rotateY(-Math.PI/2);const o=mesh(parent,geo,mat);o.position.x=m1;return o;};
 const frame=(parent:T.Object3D)=>{const f=new T.Group();f.position.set(S[0],0,S[1]);f.rotation.y=Math.atan2(-INWARD[1],INWARD[0]);parent.add(f);return f;};
 const lane=frame(group),over=frame(roof);

 // The garage: a slab, two long walls under the eaves and two gables; the north gable takes two doors 2.5 m wide.
 const {v0,v1,m0,m1,eave}=GARAGE,mid=(m0+m1)/2,tan=Math.tan(GARAGE_PITCH),wall=.2,under=(m:number)=>eave+(mid-m0-Math.abs(m-mid))*tan;
 const ridgeUnder=eave+(mid-m0)*tan,head=2.25,doors:[number,number][]=[[m0+.4,m0+2.9],[m0+3.5,m0+6]];
 box(lane,m0,m1,0,.1,v0,v1,slab).name='front-garage-floor';
 for(const [a,b] of [[m0,m0+wall],[m1-wall,m1]])box(lane,a,b,0,eave+wall*tan-.02,v0+wall,v1-wall,clad).name='front-garage-wall';
 const gable=[[m1,0],[m1,eave],[mid,ridgeUnder],[m0,eave],[m0,0]];
 across(lane,[...doors.flatMap(([a,b])=>[[a,0],[a,head],[b,head],[b,0]]),...gable],v0,v0+wall,clad).name='front-garage-north-gable';
 across(lane,[[m0,0],...gable.slice(0,-1)],v1-wall,v1,clad).name='front-garage-south-gable';
 for(const [a,b] of doors){const door=new T.Group();door.name='front-garage-door';lane.add(door);
  box(door,a+.02,b-.02,.02,head-.02,v0+.08,v0+.13,doorWood);
  // Vertical boarding: shallow battens over the leaf, as on the guest wing's garage doors.
  const parts:T.BufferGeometry[]=[];for(let m=a+.16;m<b-.1;m+=.19)parts.push(new T.BoxGeometry(.03,head-.12,.015).translate(m,head/2,v0+.072));
  mesh(door,mergeGeometries(parts)!,doorWood);parts.forEach(part=>part.dispose());
  box(door,b-.32,b-.18,1,1.04,v0+.05,v0+.07,trim);
  for(const [p,q] of [[a-.05,a],[b,b+.05]])box(lane,p,q,0,head+.05,v0-.02,v0+.02,trim);box(lane,a-.05,b+.05,head,head+.05,v0-.02,v0+.02,trim);}

 // The roof: two slate slopes on the walls' outer top edges, 0.15 m thick. On the lane side the eave stops short of the
 // road line; on the garden side and at the gables it reaches 0.35 and 0.3 m past the walls.
 const thick=.15,lift=thick/2/Math.cos(GARAGE_PITCH),ends=[v0-.3,v1+.3];
 for(const [from,to] of [[mid,.05],[mid,m1+.35]]){const run=Math.abs(to-from),centre=(from+to)/2,side=Math.sign(to-from);
  const slope=box(over,-run/2/Math.cos(GARAGE_PITCH),run/2/Math.cos(GARAGE_PITCH),-thick/2,thick/2,ends[0],ends[1],slate);slope.name='front-garage-roof-slope';
  slope.position.set(centre,under(centre)+lift,(ends[0]+ends[1])/2);slope.rotation.z=-side*GARAGE_PITCH;}
 box(over,mid-.13,mid+.13,ridgeUnder+thick/Math.cos(GARAGE_PITCH)-.06,ridgeUnder+thick/Math.cos(GARAGE_PITCH)+.05,ends[0],ends[1],trim).name='front-garage-ridge';
 // A fascia on the lane, a gutter on the garden side with a downpipe at each end of the long wall.
 box(over,.01,.05,under(.05)-.2,under(.05)+.05,ends[0],ends[1],trim);
 const gutter=eave-(.35)*tan;box(over,m1+.33,m1+.45,gutter-.14,gutter-.02,ends[0],ends[1],trim);
 for(const v of [v0+.3,v1-.3]){box(over,m1+.02,m1+.1,0,gutter-.1,v-.04,v+.04,trim);box(over,m1+.02,m1+.42,gutter-.14,gutter-.08,v-.04,v+.04,trim);}

 // The bin room: a lean-to against the south gable, 2.6 × 1.6 m, under a zinc roof falling south; a pair of slatted
 // doors to the lane for collection day and a door to the garden, where the cobbled path arrives.
 const room=BIN_ROOM,top=(v:number)=>2.46-(v-room.v0)*.13;
 box(lane,room.m0,room.m1,0,.06,room.v0,room.v1,slab);
 const laneDoors=[room.v0+.15,room.v1-.15],gardenDoor=[BIN_PATH[2][1]-.45,BIN_PATH[2][1]+.45],doorTop=1.95;
 along(lane,[[room.v0,0],[laneDoors[0],0],[laneDoors[0],doorTop],[laneDoors[1],doorTop],[laneDoors[1],0],[room.v1,0],[room.v1,top(room.v1)],[room.v0,top(room.v0)]],room.m0,room.m0+.12,clad).name='bin-room-wall';
 along(lane,[[room.v0,0],[gardenDoor[0],0],[gardenDoor[0],doorTop],[gardenDoor[1],doorTop],[gardenDoor[1],0],[room.v1,0],[room.v1,top(room.v1)],[room.v0,top(room.v0)]],room.m1-.12,room.m1,clad).name='bin-room-wall';
 box(lane,room.m0+.12,room.m1-.12,0,top(room.v1),room.v1-.12,room.v1,clad).name='bin-room-wall';
 const leanTo=box(over,.03,room.m1+.15,-.03,.03,room.v0,room.v1+.15,trim);leanTo.name='bin-room-roof';
 leanTo.position.y=top((room.v0+room.v1+.15)/2)+.03;leanTo.rotation.x=Math.atan(.13);
 {const g=new T.Group();g.name='bin-room-lane-door';lane.add(g);const w=(laneDoors[1]-laneDoors[0])/2;
  for(const k of [0,1]){box(g,room.m0+.03,room.m0+.08,.05,doorTop-.02,laneDoors[0]+k*w+.01,laneDoors[0]+(k+1)*w-.01,doorWood);box(g,room.m0-.01,room.m0+.03,1,1.04,laneDoors[0]+w+(k?.08:-.12),laneDoors[0]+w+(k?.12:-.08),trim);}
  box(g,room.m0,room.m0+.03,.05,doorTop-.02,laneDoors[0]+w-.04,laneDoors[0]+w+.04,doorWood);}
 {const g=new T.Group();g.name='bin-room-garden-door';lane.add(g);box(g,room.m1-.08,room.m1-.03,.05,doorTop-.02,gardenDoor[0]+.01,gardenDoor[1]-.01,doorWood);box(g,room.m1-.03,room.m1+.01,1,1.04,gardenDoor[1]-.16,gardenDoor[1]-.12,trim);}
 // Four 240-litre wheeled bins (0.58 × 0.73 × 1.07 m), lids hinged to the lane so they roll straight out.
 const colours=[['#8f9290','#4a4d4c'],['#a58e7c','#5c4332'],['#8ea2bd','#2f5684'],['#d8c78f','#c79e2a']];
 const wheel=material('#777777','#222222',.9);
 colours.forEach(([pale,natural],i)=>{const bin=new T.Group();bin.name='wheelie-bin';lane.add(bin);const body=material(pale,natural,.6);
  const v=room.v0+.04+.6*i+.29;bin.position.set(room.m0+.12+.45,.06,v);
  box(bin,-.36,.36,.05,1,-.29,.29,body);box(bin,-.4,.37,1,1.07,-.3,.3,body);box(bin,-.42,-.37,.85,.9,-.22,.22,body);
  for(const z of [-.24,.24]){const w=mesh(bin,new T.CylinderGeometry(.1,.1,.05,16).rotateX(Math.PI/2),wheel);w.position.set(-.34,.1,z);}});

 // The fence: 2 m of the arrival wall's slats along the whole west boundary. From the plot's north-west corner to the
 // notch; on the road line across the notch, with a sliding drive gate 4 m wide and a pedestrian gate beside a letterbox
 // and bell; along the lane either side of the garage and bin room; and from the lane's south corner along the
 // neighbour's boundary to where the hedge begins.
 const {boards,box:post,metal}=timberBoards(material),TOP=1.955,FENCE=.08;
 const run=(a:[number,number],b:[number,number])=>{const g=new T.Group();g.position.set(a[0],0,a[1]);g.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);group.add(g);return g;};
 const north=run(NW,N);north.name='garage-fence';boards(north,0,Math.hypot(N[0]-NW[0],N[1]-NW[1]),TOP,-FENCE);
 const notch=run(roadPoint(0),roadPoint(ROAD_LENGTH));notch.name='garage-fence';
 for(const [lo,hi] of [[0,DRIVE_GATE[0]],[DRIVE_GATE[1],PEDESTRIAN_GATE[0]],[PEDESTRIAN_GATE[1],ROAD_LENGTH]])boards(notch,lo,hi,TOP,FENCE);
 for(const [[lo,hi],name] of [[DRIVE_GATE,'garage-drive-gate'],[PEDESTRIAN_GATE,'garage-pedestrian-gate']] as const){
  for(const u of [lo,hi])post(notch,u,0,FENCE,.09,TOP+.045,.3,metal);
  const leaf=new T.Group();leaf.name=name;notch.add(leaf);boards(leaf,lo+.045,hi-.045,TOP,FENCE);post(leaf,hi-.18,.92,FENCE-.17,.045,.27,.04,metal);passable(leaf);}
 post(notch,PEDESTRIAN_GATE[0]-.45,.88,FENCE-.16,.31,.36,.06,metal).name='garage-letterbox';
 const laneFence=run(garagePoint(0,LANE_LENGTH),garagePoint(0,0));laneFence.name='garage-fence';
 for(const [lo,hi] of [[0,LANE_LENGTH-BIN_ROOM.v1],[LANE_LENGTH-GARAGE.v0,LANE_LENGTH]])boards(laneFence,lo,hi,TOP,FENCE);
 const east=[SW[0]+(1599-199)*12/181,SW[1]+(1016-849)*12/181],toEast=Math.hypot(east[0]-SW[0],east[1]-SW[1]);
 const south=run(SW,[SW[0]+(east[0]-SW[0])*2.1/toEast,SW[1]+(east[1]-SW[1])*2.1/toEast]);south.name='garage-fence';
 boards(south,0,2.1,TOP,-FENCE);
 for(const [x,z] of [NW,N,S,SW])post(group,x,0,z,.12,TOP+.045,.12,metal);
 return {group,roof};
}
