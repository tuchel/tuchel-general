import * as T from 'three';
import {treeBoxes} from './foliage';

/** `move`: how far the eye may go from where a count was taken before the count stops counting; `turn`: how far the
 * view may turn (radians) before a count of a box partly off screen stops counting. `grow`, `least`: a tree's box grows
 * by this share of its distance, and at least this much, so it is counted in a little before it shows past a wall's
 * edge (counts arrive a frame or a few late). */
export const TREE_OCCLUSION={move:.25,turn:T.MathUtils.degToRad(1),grow:.05,least:.5};
type Queries=Pick<WebGL2RenderingContext,'createQuery'|'deleteQuery'|'beginQuery'|'endQuery'|'getQueryParameter'|'ANY_SAMPLES_PASSED_CONSERVATIVE'|'QUERY_RESULT_AVAILABLE'|'QUERY_RESULT'>;
/** A tree's last answer and where it was asked from: `at`, `facing`, `lens` (the projection), and whether its whole box
 * was on screen; `asked…` the same for the count still out. */
type View={at:T.Vector3;facing:T.Vector3;lens:T.Matrix4;whole:boolean};
type Entry={box:T.Box3;proxy:T.Mesh;query:WebGLQuery|null;pending:boolean;hidden:boolean;answer:View;asked:View};
const view=():View=>({at:new T.Vector3(Infinity,0,0),facing:new T.Vector3(),lens:new T.Matrix4(),whole:false});
const copyView=(to:View,from:View)=>{to.at.copy(from.at);to.facing.copy(from.facing);to.lens.copy(from.lens);to.whole=from.whole;};
/** The same field of view, aspect and zoom; the sub-pixel shifts of settling frames do not count. */
const sameLens=(a:T.Matrix4,b:T.Matrix4)=>[0,5].every(i=>Math.abs(a.elements[i]-b.elements[i])<=1e-4*Math.abs(a.elements[i]));

/** Trees the house, or nearer trees, hide from the eye are not drawn (Extreme; drawTrees). After the scene pass draws
 * into its target (post.ts), every tree in view is drawn again as its grown box, against the scene's depth and writing
 * nothing, inside an occlusion query. A tree is left out only while its last count found no pixel, taken from within
 * `move` of where the eye is now, and with its whole box on screen or the view turned less than `turn` since (with the
 * same lens), so what was off screen still is; whenever that is not so, it is drawn. Its box keeps being counted while
 * it is left out, so it comes back as soon as any of it would show. */
export function createTreeOcclusion(gl:Queries,root:T.Object3D){
 const scene=new T.Scene(),geometry=new T.BoxGeometry(1,1,1),material=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide});
 const entries=new Map<object,Entry[]>(),all:Entry[]=[];
 treeBoxes(root).forEach(({set,index,box},tree)=>{
  const proxy=new T.Mesh(geometry,material);proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;proxy.visible=false;proxy.userData.tree=tree;
  const entry:Entry={box,proxy,query:null,pending:false,hidden:false,answer:view(),asked:view()};
  proxy.onBeforeRender=()=>{entry.query??=gl.createQuery();if(entry.query)gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE,entry.query);};
  proxy.onAfterRender=()=>{if(entry.query){gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);entry.pending=true;}};
  scene.add(proxy);all.push(entry);(entries.get(set)??entries.set(set,[]).get(set)!)[index]=entry;
 });
 const now=view(),grown=new T.Box3(),centre=new T.Vector3(),size=new T.Vector3(),frustum=new T.Frustum(),corner=new T.Vector3(),viewProjection=new T.Matrix4();
 const inside=(f:T.Frustum,b:T.Box3)=>{for(let i=0;i<8;i++)if(!f.containsPoint(corner.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z)))return false;return true;};
 return {
  /** Takes in the counts that have come back; once a frame, before drawTrees. */
  poll(camera:T.Camera){
   camera.updateMatrixWorld();camera.getWorldPosition(now.at);camera.getWorldDirection(now.facing);now.lens.copy(camera.projectionMatrix);
   for(const e of all){
    if(!e.pending||!e.query||!gl.getQueryParameter(e.query,gl.QUERY_RESULT_AVAILABLE))continue;
    e.pending=false;e.hidden=!gl.getQueryParameter(e.query,gl.QUERY_RESULT);copyView(e.answer,e.asked);
   }
  },
  /** For drawTrees: a tree whose last count found none of it, still good for the view now. */
  hidden:(set:object,index:number)=>{
   const e=entries.get(set)?.[index];if(!e?.hidden||e.answer.at.distanceTo(now.at)>=TREE_OCCLUSION.move)return false;
   return e.answer.whole||(e.answer.facing.angleTo(now.facing)<TREE_OCCLUSION.turn&&sameLens(e.answer.lens,now.lens));
  },
  /** Counts the trees in `camera`'s view against the depth just drawn; called right after the scene pass, with its
   * target bound. Trees with a count still out, and those around the eye, are not asked again. */
  test(renderer:Pick<T.WebGLRenderer,'render'|'autoClear'>,camera:T.Camera){
   camera.updateMatrixWorld();frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   const from=camera.getWorldPosition(new T.Vector3()),facing=camera.getWorldDirection(new T.Vector3());let any=false;
   for(const e of all){
    e.proxy.visible=false;if(e.pending)continue;
    grown.copy(e.box).expandByScalar(Math.max(TREE_OCCLUSION.least,TREE_OCCLUSION.grow*e.box.distanceToPoint(from)));
    if(grown.containsPoint(from)){e.hidden=false;continue;}
    if(!frustum.intersectsBox(grown))continue;
    grown.getCenter(centre);grown.getSize(size);e.proxy.matrix.makeScale(size.x,size.y,size.z).setPosition(centre);e.proxy.matrixWorld.copy(e.proxy.matrix);
    e.proxy.visible=true;e.asked.at.copy(from);e.asked.facing.copy(facing);e.asked.lens.copy(camera.projectionMatrix);e.asked.whole=inside(frustum,grown);any=true;
   }
   if(!any)return;
   const clear=renderer.autoClear;renderer.autoClear=false;
   try{renderer.render(scene,camera);}finally{renderer.autoClear=clear;}
  },
  dispose:()=>{for(const e of all)if(e.query)gl.deleteQuery(e.query);geometry.dispose();material.dispose();},
 };
}
export type TreeOcclusion=ReturnType<typeof createTreeOcclusion>;
