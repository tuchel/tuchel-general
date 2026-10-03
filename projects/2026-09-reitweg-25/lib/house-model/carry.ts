import * as T from 'three';

/** Carrying a traced image through small moves (Extreme; post.ts). `move` (m) and `turn` (radians): how far the view
 * may go from the one the image was traced for; `tolerance`: how far (a share of the distance, plus 5 cm) the kept
 * depth may differ from where a point should be before it counts as uncovered. */
export const CARRY={move:1.5,turn:T.MathUtils.degToRad(30),tolerance:.03};
export type KeptView={viewProjection:T.Matrix4;view:T.Matrix4};

/** Whether `camera` is close enough to the kept view `kept` (a camera's pose at the time) to carry its image. */
export function carryApplies(kept:T.Camera,camera:T.Camera){
 const a=kept.getWorldPosition(new T.Vector3()),b=camera.getWorldPosition(new T.Vector3());
 return a.distanceTo(b)<CARRY.move&&kept.getWorldDirection(new T.Vector3()).angleTo(camera.getWorldDirection(new T.Vector3()))<CARRY.turn;
}

/** Where the kept view saw the point under `uv` (0–1) at `depth` (metres along the view) in `camera`'s view, and whether
 * it still saw that point there: on its screen, in front of it, and with `keptDepth` (its depth at that place) within
 * the tolerance. The finish does the same per pixel (post.ts, TracedBlend). */
export function reproject(uv:T.Vector2,depth:number,camera:T.Camera,kept:KeptView,keptDepth:number){
 const ray=new T.Vector4(uv.x*2-1,uv.y*2-1,1,1).applyMatrix4(camera.projectionMatrixInverse);ray.divideScalar(ray.w);
 const world=new T.Vector4(ray.x,ray.y,ray.z,0).multiplyScalar(depth/-ray.z).setW(1).applyMatrix4(camera.matrixWorld);
 const clip=world.clone().applyMatrix4(kept.viewProjection),at=new T.Vector2(clip.x/clip.w*.5+.5,clip.y/clip.w*.5+.5);
 const expected=-world.clone().applyMatrix4(kept.view).z;
 const valid=clip.w>0&&at.x>0&&at.x<1&&at.y>0&&at.y<1&&Math.abs(keptDepth-expected)<CARRY.tolerance*expected+.05;
 return {uv:at,valid};
}
