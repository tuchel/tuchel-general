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

/** Traced light that stays while the camera moves (Extreme; post.ts). When a traced image is shown, what it changed is
 * kept as well: the traced image over the live one, point by point (held between `least` and `most`), which is light
 * and not surface. Moving frames are multiplied by it where the traced view saw the same point, so the traced view's
 * bounced light and soft shadows stay on the walls while the live frame supplies surfaces, reflections and what moves.
 * In full within `full` of `move` m and of `turn` (radians) from the traced view, then fading to none at those limits;
 * a point the traced view did not see, or saw within `edge` of its frame's border, takes the light of that part of the
 * frame as a whole (the kept image `coarse` levels down). */
export const LIGHT_CARRY={move:4,turn:T.MathUtils.degToRad(60),full:.6,edge:.08,least:.25,most:4,coarse:6};
/** How much (0–1) of the kept view's light `camera`'s view carries. */
export function lightCarried(kept:T.Camera,camera:T.Camera){
 const a=kept.getWorldPosition(new T.Vector3()),b=camera.getWorldPosition(new T.Vector3());
 const gone=Math.max(a.distanceTo(b)/LIGHT_CARRY.move,kept.getWorldDirection(new T.Vector3()).angleTo(camera.getWorldDirection(new T.Vector3()))/LIGHT_CARRY.turn);
 return 1-T.MathUtils.smoothstep(gone,LIGHT_CARRY.full,1);
}
export const lightCarryGlsl=`uniform sampler2D frame;uniform sampler2D ratio;uniform sampler2D depth;uniform sampler2D prevDepth;uniform float amount;uniform mat4 prevViewProj;uniform mat4 prevView;uniform mat4 invProj;uniform mat4 camWorld;varying vec2 vUv;
 void main(){
  vec4 c=texture2D(frame,vUv),ray=invProj*vec4(vUv*2.0-1.0,1.0,1.0);ray.xyz/=ray.w;
  vec4 world=camWorld*vec4(ray.xyz*(texture2D(depth,vUv).r/-ray.z),1.0),clip=prevViewProj*world;
  vec2 at=clip.xy/clip.w*0.5+0.5;float expected=-(prevView*world).z;
  float valid=clip.w>0.0&&abs(texture2D(prevDepth,at).r-expected)<${CARRY.tolerance}*expected+0.05?smoothstep(0.0,${LIGHT_CARRY.edge.toFixed(2)},min(min(at.x,at.y),min(1.0-at.x,1.0-at.y))):0.0;
  // A point the traced view did not see takes the light of that part of the frame as a whole, so no patch of live
  // light opens beside what passes in front.
  gl_FragColor=vec4(c.rgb*mix(vec3(1.0),mix(texture2D(ratio,clamp(at,0.0,1.0),${LIGHT_CARRY.coarse.toFixed(1)}).rgb,texture2D(ratio,at).rgb,valid),amount),c.a);
 }`;
