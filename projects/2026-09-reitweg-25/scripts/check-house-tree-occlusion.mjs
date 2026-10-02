import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {build} from 'esbuild';
// Trees the house hides are not drawn (Extreme). After the scene is drawn, each tree in view is drawn again as its
// bounding box against the scene's depth, writing nothing, and the graphics card counts whether any of it passed. A tree
// is left out only while its last count was zero, taken from within 0.25 m of where the eye is now, and with the whole
// box on screen or the view turned under 1° since, so what was off screen still is; the box grows with distance, so a
// tree coming out from behind a wall is drawn before it shows. Trees the
// pool's mirror sees are always drawn, and shadows and the path tracer still take every tree.
await build({entryPoints:['lib/house-model/foliage.ts','lib/house-model/tree-occlusion.ts'],outdir:'tmp/tree-occlusion-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const [{foliageMaterials,buildTrees,drawTrees,treeBoxes},{createTreeOcclusion,TREE_OCCLUSION}]=await Promise.all(['foliage','tree-occlusion'].map(n=>import(`../tmp/tree-occlusion-check/${n}.mjs`)));

// Three trees east of the eye: one in the open, one the test treats as behind a wall, one at the edge of the view.
const specs=[{x:20,z:0,r:3,height:9,seed:11,kind:'broadleaf'},{x:30,z:-8,r:3,height:9,seed:23,kind:'maple'},{x:25,z:16,r:3,height:9,seed:37,kind:'broadleaf'}];
const group=buildTrees(specs,foliageMaterials('leaves'),'garden-trees'),scene=new T.Scene();scene.add(group);scene.updateMatrixWorld(true);
const camera=new T.PerspectiveCamera(50,1.6,.1,500);camera.position.set(0,1.65,0);camera.lookAt(20,4,0);camera.updateMatrixWorld();

// Each tree's box holds every point of its trunk and crown.
const boxes=treeBoxes(scene);assert.equal(boxes.length,specs.length,'a box per tree');
// Boxes come in archetype order; the test speaks of trees in the order above.
const specOf=boxes.map(b=>specs.findIndex(s=>b.box.containsPoint(new T.Vector3(s.x,s.height/2,s.z))));assert.deepEqual([...specOf].sort(),[0,1,2],'each box around its own tree');
{let checked=0;const p=new T.Vector3(),m=new T.Matrix4();
 group.traverse(o=>{if(!o.isInstancedMesh)return;const pos=o.geometry.attributes.position;for(let i=0;i<o.userData.instances;i++){o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);
  const c=new T.Vector3().setFromMatrixPosition(m),own=boxes.reduce((a,b)=>b.box.distanceToPoint(c)<a.box.distanceToPoint(c)?b:a);
  for(let v=0;v<pos.count;v+=97){p.fromBufferAttribute(pos,v).applyMatrix4(m);assert(own.box.containsPoint(p),`${o.name} inside its tree's box`);checked++;}}});
 assert(checked>100,`${checked} points checked`);}

// A graphics context that answers each query as the test says: samples for every tree but the one "behind a wall".
const queries=[];let behind=new Set([1]),answered=true;
const gl={ANY_SAMPLES_PASSED_CONSERVATIVE:0x8D6A,QUERY_RESULT_AVAILABLE:0x8867,QUERY_RESULT:0x8866,active:null,
 createQuery(){const q={tree:-1,done:false};queries.push(q);return q;},deleteQuery(){},
 beginQuery(t,q){assert.equal(t,this.ANY_SAMPLES_PASSED_CONSERVATIVE);this.active=q;},endQuery(){this.active.done=true;this.active=null;},
 getQueryParameter(q,p){if(p===this.QUERY_RESULT_AVAILABLE)return q.done&&answered;return behind.has(specOf[q.tree])?0:1;}};
const drawnBoxes=[];
const renderer={getContext:()=>gl,autoClear:true,render(s,c){assert.equal(this.autoClear,false,'the boxes draw over the scene, clearing nothing');
 s.traverseVisible(o=>{if(!o.isMesh)return;const m=o.material;assert(!m.colorWrite&&!m.depthWrite&&m.depthTest,'boxes write nothing and test depth');
  o.onBeforeRender(this,s,c,o.geometry,m);gl.active.tree=o.userData.tree;drawnBoxes.push(specOf[o.userData.tree]);o.onAfterRender(this,s,c,o.geometry,m);});}};
const occlusion=createTreeOcclusion(gl,scene);
const frame=()=>{camera.updateMatrixWorld();occlusion.poll(camera);const counts=drawTrees(scene,[camera],1e-3,camera,occlusion.hidden);occlusion.test(renderer,camera);return counts;};
const drawnTrees=()=>{const bark=[];group.traverse(o=>{if(o.name==='tree-bark'){const m=new T.Matrix4(),p=new T.Vector3();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);p.setFromMatrixPosition(m);bark.push(specs.findIndex(s=>Math.hypot(s.x-p.x,s.z-p.z)<.01));}}});return bark.sort();};

// Before any count is in, every tree in view is drawn and queried.
frame();
assert.deepEqual(drawnTrees(),[0,1,2],'all three drawn before the first counts');
assert.deepEqual([...new Set(drawnBoxes)].sort(),[0,1,2],'and all three queried');
assert.equal(renderer.autoClear,true,'the renderer is left as it was');
// The count for the tree behind the wall comes back zero: it is left out, and still queried.
drawnBoxes.length=0;frame();
assert.deepEqual(drawnTrees(),[0,2],'the hidden tree is left out');
assert(drawnBoxes.includes(1),'its box is still tested, so it comes back as soon as it shows');
// It shows again: drawn as soon as the count says so.
behind=new Set();frame();frame();assert.deepEqual(drawnTrees(),[0,1,2],'drawn again once its box is seen');
// Counts not yet back keep the last answer only while the eye stays within 0.25 m of where it was asked.
behind=new Set([1]);frame();frame();assert.deepEqual(drawnTrees(),[0,2],'hidden again');
answered=false;camera.position.x+=TREE_OCCLUSION.move*1.2;frame();assert.deepEqual(drawnTrees(),[0,1,2],'an answer from more than 0.25 m away is not trusted');
answered=true;frame();frame();assert.deepEqual(drawnTrees(),[0,2],'until a new one comes back');
camera.position.x-=TREE_OCCLUSION.move*1.2;
// A box partly off screen when counted is left out only while the view turns less than 1°: what was off screen was not
// counted, and must stay off screen.
{const edge=camera.clone();edge.lookAt(20,4,-30);edge.updateMatrixWorld();behind=new Set([0,1,2]);
 const f=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(edge.projectionMatrix,edge.matrixWorldInverse));
 const corners=b=>[0,1,2,3,4,5,6,7].map(i=>new T.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z));
 const at=boxes.findIndex(b=>f.intersectsBox(b.box)&&!corners(b.box).every(c=>f.containsPoint(c))),partly=specOf[at];
 assert(at>=0,'a tree at the edge of this view');
 const step=()=>{edge.updateMatrixWorld();occlusion.poll(edge);drawTrees(scene,[edge],1e-3,edge,occlusion.hidden);occlusion.test(renderer,edge);};
 for(let i=0;i<3;i++)step();assert(!drawnTrees().includes(partly),'left out while the view holds still');
 // Settling frames shift the lens by under a pixel; that is the same view.
 edge.setViewOffset(1600,1000,.4,-.3,1600,1000);step();assert(!drawnTrees().includes(partly),'and through the sub-pixel shifts of settling');edge.clearViewOffset();
 answered=false;edge.rotateY(T.MathUtils.degToRad(.5));step();assert(!drawnTrees().includes(partly),'a half-degree turn keeps the answer');
 edge.rotateY(T.MathUtils.degToRad(1.5));step();assert(drawnTrees().includes(partly),'a two-degree turn drawn again until it is counted anew');
 answered=true;edge.lookAt(20,4,-30);}
// The mirror's camera draws what it sees, hidden from the eye or not.
{behind=new Set([1]);frame();frame();const mirror=camera.clone();mirror.lookAt(30,4,-8);mirror.updateMatrixWorld();
 occlusion.poll(camera);drawTrees(scene,[camera,mirror],1e-3,camera,occlusion.hidden);assert(drawnTrees().includes(1),'the mirror still sees it');}
// Inside a tree's box (under its crown) it is always drawn and never counted.
{const under=camera.clone();under.position.set(20,1.65,0);under.lookAt(30,1.65,0);under.updateMatrixWorld();behind=new Set([0,1,2]);drawnBoxes.length=0;
 for(let i=0;i<3;i++){occlusion.poll(under);drawTrees(scene,[under],1e-3,under,occlusion.hidden);occlusion.test(renderer,under);}
 assert(drawnTrees().includes(0)&&!drawnBoxes.includes(0),'a tree around the eye is drawn without a count');}
// Boxes grow by a twentieth of their distance, at least half a metre, so a tree is counted in a little before it shows.
assert(TREE_OCCLUSION.grow>=.05&&TREE_OCCLUSION.least>=.5&&TREE_OCCLUSION.move<=.25,'margins');
// Shadows still come from every tree.
group.traverse(o=>{if(o.isInstancedMesh&&o.castShadow){o.onBeforeShadow();assert.equal(o.count,o.userData.instances,`${o.name} casts from every tree`);o.onBeforeRender();}});

// The wiring: Extreme only, counted right after the scene pass, read before trees are chosen.
{const read=f=>fs.readFileSync(`lib/house-model/${f}`,'utf8'),post=read('post.ts'),viewer=read('viewer.ts'),tiers=read('device-tier.ts');
 assert(/extreme:\{[^}]*treeOcclusion:true/.test(tiers)&&/detailed:\{[^}]*treeOcclusion:false/.test(tiers),'Extreme counts hidden trees');
 assert(/afterScene/.test(post)&&/super\.render\(/.test(post),'the post chain runs the count right after the scene pass');
 assert(/createTreeOcclusion\(/.test(viewer)&&/occlusion\?\.poll\(/.test(viewer)&&/drawTrees\([^;]*occlusion\?\.hidden/.test(viewer),'the viewer reads the counts before choosing trees');}
console.log(`Passed: each tree's box holds the whole tree; a tree whose box shows no pixel is left out and still tested, and drawn again as soon as it shows; answers from more than ${TREE_OCCLUSION.move} m away, for boxes partly off screen after the view turns 1°, and for trees around the eye are not trusted; the mirror and shadows keep every tree.`);
