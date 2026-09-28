import * as T from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

/** A framing names what the camera looks at, from which direction, and how much must fit. */
export type Framing={target:T.Vector3;direction:T.Vector3;span:number;exterior:boolean};
type Pose={target:T.Vector3;offset:T.Spherical;span:number};
const ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const angle=(a:number,b:number,t:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;

/** Field of view stays fixed while moving; framing changes distance instead, so transitions never warp. */
export function overviewFov(aspect:number){return aspect>=1?36:T.MathUtils.lerp(52,36,T.MathUtils.clamp((aspect-.45)/.55,0,1));}
export function eyeLevelFov(aspect:number){
 if(aspect>=1)return 58;
 // Portrait phones keep about 50° horizontally rather than a narrow vertical slice.
 return Math.min(88,2*T.MathUtils.radToDeg(Math.atan(Math.tan(T.MathUtils.degToRad(26))/aspect)));
}
export function fitDistance(span:number,aspect:number,fov:number,exterior:boolean,narrow:boolean){
 const v=Math.tan(T.MathUtils.degToRad(fov)/2),h=v*aspect,wide=span*(exterior?(narrow?1.28:1.65):1);
 return Math.max(span/2/v,wide/2/h);
}

export function createCameraRig(camera:T.PerspectiveCamera|T.OrthographicCamera,controls:OrbitControls,reduced:boolean){
 const perspective=camera instanceof T.PerspectiveCamera;
 let width=1,height=1,span=58,exterior=true,eye=false,transition:null|{start:number;duration:number;from:Pose;to:Pose}=null;
 const pose=():Pose=>({target:controls.target.clone(),offset:new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target)),span});
 const narrow=()=>width<768;
 const project=()=>{
  const aspect=width/height;
  if(camera instanceof T.OrthographicCamera){
   const framing=Math.max(span,span*(exterior?(narrow()?1.28:1.65):1)/aspect);
   Object.assign(camera,{left:-framing*aspect/2,right:framing*aspect/2,top:framing/2,bottom:-framing/2});
  }else{
   camera.aspect=aspect;camera.fov=eye?eyeLevelFov(aspect):overviewFov(aspect);
   const distance=eye?0:camera.position.distanceTo(controls.target);
   camera.near=eye?.05:T.MathUtils.clamp(distance*.006,.08,2);camera.far=3000;
  }
  camera.updateProjectionMatrix();
 };
 const poseFor=(f:Framing):Pose=>{
  const aspect=width/height,distance=perspective?fitDistance(f.span,aspect,overviewFov(aspect),f.exterior,narrow()):f.direction.length()||60;
  return {target:f.target.clone(),offset:new T.Spherical().setFromVector3(f.direction.clone().normalize().multiplyScalar(distance)),span:f.span};
 };
 const place=(p:Pose)=>{controls.target.copy(p.target);camera.position.copy(p.target).add(new T.Vector3().setFromSpherical(p.offset));span=p.span;camera.lookAt(controls.target);project();};
 const look={yaw:0,pitch:0};
 return {
  get eyeLevel(){return eye;},
  get moving(){return !!transition;},
  resize:(w:number,h:number)=>{width=Math.max(1,w);height=Math.max(1,h);project();},
  /** Frames a view; overview-to-overview moves travel around the target on a sphere. */
  frame:(f:Framing,instant=false)=>{
   eye=false;controls.enabled=true;camera.zoom=1;exterior=f.exterior;
   const to=poseFor(f);
   if(instant||reduced){transition=null;place(to);return;}
   const from=pose();from.offset.theta=to.offset.theta+Math.atan2(Math.sin(from.offset.theta-to.offset.theta),Math.cos(from.offset.theta-to.offset.theta));
   transition={start:performance.now(),duration:900,from,to};
  },
  /** Eye-level views cut rather than fly, so the camera never passes through walls. */
  enterEyeLevel:(position:T.Vector3,target:T.Vector3)=>{
   transition=null;eye=true;controls.enabled=false;camera.zoom=1;
   camera.position.copy(position);camera.lookAt(target);
   const e=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');look.yaw=e.y;look.pitch=e.x;
   project();
  },
  lookBy:(dx:number,dy:number)=>{
   look.yaw-=dx;look.pitch=T.MathUtils.clamp(look.pitch-dy,-1.35,1.35);
   camera.quaternion.setFromEuler(new T.Euler(look.pitch,look.yaw,0,'YXZ'));
  },
  zoomBy:(factor:number)=>{
   if(eye){camera.zoom=T.MathUtils.clamp(camera.zoom*factor,1,2.6);camera.updateProjectionMatrix();return;}
   if(camera instanceof T.OrthographicCamera){camera.zoom=T.MathUtils.clamp(camera.zoom*factor,.45,5);camera.updateProjectionMatrix();return;}
   const offset=camera.position.clone().sub(controls.target),d=T.MathUtils.clamp(offset.length()/factor,controls.minDistance,controls.maxDistance);
   camera.position.copy(controls.target).add(offset.setLength(d));project();
  },
  orbitBy:(dTheta:number,dPhi:number)=>{
   const s=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
   s.theta+=dTheta;s.phi=T.MathUtils.clamp(s.phi+dPhi,controls.minPolarAngle,controls.maxPolarAngle);
   camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(s));camera.lookAt(controls.target);project();
  },
  /** Advances a transition; returns true while the camera moved this frame. */
  update:(now:number)=>{
   if(!transition)return false;
   const {start,duration,from,to}=transition,t=Math.min(1,(now-start)/duration),k=ease(t);
   const offset=new T.Spherical(Math.exp(T.MathUtils.lerp(Math.log(from.offset.radius),Math.log(to.offset.radius),k)),T.MathUtils.lerp(from.offset.phi,to.offset.phi,k),angle(from.offset.theta,to.offset.theta,k));
   place({target:from.target.clone().lerp(to.target,k),offset,span:T.MathUtils.lerp(from.span,to.span,k)});
   if(t>=1)transition=null;
   return true;
  },
  cancel:()=>{transition=null;},
  project,
  snapshot:()=>({position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom,span}),
  restore:(s:{position:number[];target:number[];zoom:number;span:number})=>{transition=null;eye=false;controls.enabled=true;camera.position.fromArray(s.position);controls.target.fromArray(s.target);camera.zoom=s.zoom;span=s.span;camera.lookAt(controls.target);project();},
 };
}
export type CameraRig=ReturnType<typeof createCameraRig>;
