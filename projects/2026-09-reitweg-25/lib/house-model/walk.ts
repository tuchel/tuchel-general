import * as T from 'three';
import {computeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';
import {materialsOf} from './shader-features';

/** Walking at eye level: moves the camera over floors, up stairs and around walls and furniture.
 * Rays run against the visible static scene; bounding-volume trees are built on the first step. The walker never falls:
 * it stops at any drop deeper than a stair step. */
// Collision rays start just above the step height: anything lower is climbed, like a stair tread.
// Walking pace is 1.5× an everyday 1.4 m/s, so the rooms and garden cover quickly; Shift runs.
const RADIUS=.3,STEP=.45,WALK=2.1,RUN=5.1,KNEE=.5,CHEST=1.2;
export type WalkInput={forward:number;strafe:number;run:boolean};
/** Doors, door glazing and gate leaves: drawn, but the walker passes through them. */
export function passable<O extends T.Object3D>(o:O){o.traverse(c=>{c.userData.passable=true;});return o;}

/** Moving a body over the house: walls and furniture slide it aside (rays at knee and chest height), floors carry it a
 * stair's height up or down at a time, and it never falls: a deeper drop or nothing below stops it. Shared by the
 * eye-level walker and the figures of Sims Mode (sims.ts). */
export function createMover(surfaces:()=>T.Mesh[],radius=RADIUS){
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),normal=new T.Vector3(),from=new T.Vector3(),direction=new T.Vector3();
 ray.firstHitOnly=true;
 const prepared=new WeakSet<T.BufferGeometry>();
 const solids=()=>surfaces().filter(o=>{if(o.userData.passable)return false;for(let a:T.Object3D|null=o;a;a=a.parent)if(!a.visible)return false;return true;}).map(o=>{
  const g=o.geometry as T.BufferGeometry&{computeBoundsTree?:typeof computeBoundsTree;boundsTree?:unknown};
  if(!g.boundsTree&&!prepared.has(g)){g.computeBoundsTree=computeBoundsTree;g.computeBoundsTree();prepared.add(g);}
  o.raycast=acceleratedRaycast;return o;
 });
 // 48 directions over the sky and a little below the horizon, evenly spread.
 const sky=Array.from({length:48},(_,i)=>{const y=1-1.2*(i+.5)/48,r=Math.sqrt(1-y*y),a=i*2.399963;return new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);});
 const groundAt=(x:number,z:number,top:number,meshes:T.Mesh[])=>{ray.set(from.set(x,top,z),down);ray.far=8;const hit=ray.intersectObjects(meshes,false)[0];return hit?.point.y;};
 return {
  solids,groundAt,
  /** The share of the sky and far horizon seen from `at` past solid parts of the house; glass does not block it. */
  openness:(at:T.Vector3)=>{
   const meshes=solids().filter(o=>materialsOf(o).every(m=>!m.transparent));let open=0;
   for(const d of sky){ray.set(at,d);ray.far=60;if(!ray.intersectObjects(meshes,false).length)open++;}
   return open/sky.length;
  },
  /** Feet at `at` moved by the horizontal `move` (changed in place as walls slide it): the new feet position, or undefined
   * where the floor drops away. */
  slide:(at:T.Vector3,move:T.Vector3,meshes:T.Mesh[]=solids())=>{
   // Slide along walls and furniture: two rays, at knee and chest height, in the direction of travel.
   for(let pass=0;pass<2;pass++){
    const length=move.length();if(length<1e-5)break;direction.copy(move).normalize();let blocked=false;
    for(const h of [KNEE,CHEST]){
     ray.set(from.set(at.x,at.y+h,at.z),direction);ray.far=length+radius;
     const hit=ray.intersectObjects(meshes,false)[0];if(!hit?.face)continue;
     normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);normal.y=0;if(normal.lengthSq()<1e-6)continue;normal.normalize();
     const into=move.dot(normal);if(into<0){move.addScaledVector(normal,-into);move.addScaledVector(normal,Math.max(0,radius-hit.distance)*.5);blocked=true;}
    }
    if(!blocked)break;
   }
   const x=at.x+move.x,z=at.z+move.z;
   // Follow the floor a stair's height up or down at a time. A deeper drop (a stairwell, the gallery edge, a stair's open
   // side, the pool) or nothing below stops the body: railings of thin bars would let the knee and chest rays through.
   const ground=groundAt(x,z,at.y+STEP,meshes);
   if(ground===undefined||ground<at.y-STEP)return undefined;
   return new T.Vector3(x,ground,z);
  },
 };
}

export function createWalker(camera:T.PerspectiveCamera|T.OrthographicCamera,surfaces:()=>T.Mesh[]){
 const mover=createMover(surfaces),forward=new T.Vector3(),right=new T.Vector3(),move=new T.Vector3(),feetAt=new T.Vector3();
 let eye=1.65,feet:number|undefined;
 return {
  /** The share of the sky and far horizon the camera sees past solid parts of the house; glass does not block it.
   * Near 0 inside a room, about 0.2 under the courtyard eaves, 0.4 and up on the terrace and in the garden. */
  openness:()=>mover.openness(camera.position),
  /** Starts a walk from the current eye-level position, keeping its height above the floor (or above `floor`). */
  reset:(floor?:number)=>{feet=floor;if(floor!==undefined)eye=T.MathUtils.clamp(camera.position.y-floor,1.3,1.8);},
  /** Moves by one frame of input; returns true when the camera moved. */
  step:(dt:number,input:WalkInput)=>{
   if(!input.forward&&!input.strafe)return false;
   const meshes=mover.solids();
   if(feet===undefined){const g=mover.groundAt(camera.position.x,camera.position.z,camera.position.y,meshes);feet=g??camera.position.y-1.65;eye=T.MathUtils.clamp(camera.position.y-feet,1.3,1.8);}
   camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<1e-6)return false;forward.normalize();right.crossVectors(forward,camera.up).normalize();
   move.copy(forward).multiplyScalar(input.forward).addScaledVector(right,input.strafe);if(move.lengthSq()<1e-6)return false;
   move.setLength((input.run?RUN:WALK)*dt);
   const next=mover.slide(feetAt.set(camera.position.x,feet,camera.position.z),move,meshes);
   if(!next)return false;
   feet=next.y;
   camera.position.set(next.x,feet+eye,next.z);camera.updateMatrixWorld();
   return true;
  },
 };
}
