import * as T from 'three';
import {COVER} from './sky-links';
import {SNOW,snowRoofs} from './snow';
import {drawOver,fallingNodes,fallingQuads,held,type FallingGPU} from './falling';

/** Snow mode: `count` flakes in a box of air (metres) that follows the camera, set ahead of it. They fall at `fall` m/s on a light wind
 * (`wind`, m/s east and south), each swaying `sway` metres about its line, `size` metres across. Nearer than `focus`
 * metres a flake goes out of focus: `blur` is the lens's aperture in metres. `ease`: the seconds the ground takes to
 * whiten when it starts on bare ground, and to clear again. */
export const SNOWFALL={lamps:40,glow:[1,.74,.46] as const,count:24000,box:[32,18,32],fall:[.7,1.3],wind:[.32,.12],sway:.2,size:[.02,.045],focus:2,blur:.012,opacity:.92,ease:6};
const f=(v:number)=>v.toFixed(4);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The same flakes for the WebGPU renderer: the vertex and fragment shaders below as nodes, on squares (falling.ts). */
function flakes(gpu:FallingGPU,u:any,sky?:Record<string,T.IUniform>){
 const {attribute,uniformArray,vec2,vec3,vec4,float,fract,sin,cos,mix,max,min,dot,length,smoothstep,varying,cameraViewMatrix}=gpu.tsl,fall=fallingNodes(gpu,u,sky);
 const r=attribute('chance','float'),q=fract(r.mul(61)),turn=u.uTime.mul(q.mul(.6).add(.5)).add(r.mul(40)),seed=attribute('seed','vec3').mul(u.uBox);
 const sway=vec2(sin(turn),cos(turn.mul(.8).add(q.mul(5)))).mul(r.add(.4).mul(SNOWFALL.sway)).add(vec2(SNOWFALL.wind[0],SNOWFALL.wind[1]).mul(u.uTime));
 const {p,shows}=fall.wrap(vec3(seed.x.add(sway.x),seed.y.sub(u.uTime.mul(mix(SNOWFALL.fall[0],SNOWFALL.fall[1],r))),seed.z.add(sway.y)));
 const lamps=uniformArray(u.uLamps.value);let glow=float(0);
 for(let k=0;k<SNOWFALL.lamps;k++){const l=p.sub(lamps.element(k));glow=glow.add(float(1).div(dot(l,l).mul(.8).add(1)));}
 const mv=cameraViewMatrix.mul(vec4(p,1)),d=max(mv.z.negate(),.05),size=mix(SNOWFALL.size[0],SNOWFALL.size[1],q).mul(fall.scale).div(d);
 // Out of focus a flake spreads and thins; smaller than a pixel it dims instead of flickering.
 const blur=fall.scale.mul(SNOWFALL.blur).mul(max(0,float(1).div(d).sub(1/SNOWFALL.focus))),wide=size.add(blur);
 const alpha=shows.mul(SNOWFALL.opacity).mul(min(1,wide.div(1.5))).mul(mix(1,size.div(wide),.8));
 const {vertex,at}=fall.sprite(mv.xyz,min(max(wide,1.5),64),alpha.lessThan(.004).or(mv.z.negate().lessThan(.12)));
 const material=new gpu.NodeMaterial() as any;u.uDepth=fall.depth;
 Object.assign(material,{vertexNode:vertex,fragmentNode:vec4(mix(u.uLight,u.uLamp.rgb,min(varying(min(glow,1.6)),1).mul(u.uLamp.a)),
  varying(alpha).mul(smoothstep(mix(.45,0,varying(blur.div(wide))),1,length(at)).oneMinus()).mul(fall.seen(varying(d)))),transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
 return material as T.Material;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
/** The flakes: one draw of points, placed by the vertex shader from the time alone. Each has a fixed track through the
 * world, wrapped into the box around the camera, so walking through them shows real parallax. None falls under a roof:
 * the height over each point is read from the sky light's links (sky-links.ts, COVER) and the roofs it does not know
 * (snow.ts, snowCovers), so rooms and porches stay clear while it falls outside their windows. They are drawn over the
 * finished image, behind whatever the scene's depth says is nearer: each flake whole, by its own distance. `sky`: the sky light's uniforms, where there is one.
 * `lamps`: where lamplight reaches the air outdoors (the glazing with lit rooms behind it, the garden's path lights; up
 * to SNOWFALL.lamps): flakes falling past them catch it in the evening, warm against the blue. */
export function createSnowfall(sky?:Record<string,T.IUniform>,lamps:T.Vector3[]=[],gpu?:FallingGPU){
 const seeds=new Float32Array(SNOWFALL.count*3),chance=new Float32Array(SNOWFALL.count);
 let state=20260123;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<SNOWFALL.count;i++){seeds.set([random(),random(),random()],i*3);chance[i]=random();}
 const geometry=gpu?fallingQuads(seeds,chance):new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(seeds,3)).setAttribute('chance',new T.BufferAttribute(chance,1));
 const uniforms={uTime:held(gpu,0),uBox:held(gpu,new T.Vector3(...SNOWFALL.box)),uMiddle:held(gpu,new T.Vector3()),uView:held(gpu,new T.Vector2(1,1)),uDepth:{value:null as T.Texture|null},uLight:held(gpu,new T.Color()),uLamp:held(gpu,new T.Vector4(...SNOWFALL.glow,0)),
  uLamps:{value:Array.from({length:SNOWFALL.lamps},(_,i)=>lamps[i]?.clone()??new T.Vector3(0,-1e4,0))},...snowRoofs,...sky};
 const material=gpu?flakes(gpu,uniforms,sky):new T.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,defines:sky?{ROOFED:1}:{},
  vertexShader:`attribute float chance;uniform vec3 uLamps[${SNOWFALL.lamps}];varying float vGlow;uniform float uTime;uniform vec3 uBox;uniform vec3 uMiddle;uniform vec2 uView;uniform vec4 uSnowCoverA[${SNOW.covers}];uniform vec4 uSnowCoverB[${SNOW.covers}];
   #ifdef ROOFED
   uniform highp sampler3D uSkyReach;uniform vec3 uSkyMin;uniform vec3 uSkyGrid;uniform float uSkyCell;uniform float uSkyLinked;
   #endif
   varying float vAlpha;varying float vSoft;varying float vAway;
   void main(){
    float r=chance,q=fract(r*61.0),turn=uTime*(0.5+q*0.6)+r*40.0;
    vec3 p=position*uBox;
    p.y-=uTime*mix(${f(SNOWFALL.fall[0])},${f(SNOWFALL.fall[1])},r);
    p.xz+=vec2(${f(SNOWFALL.wind[0])},${f(SNOWFALL.wind[1])})*uTime+vec2(sin(turn),cos(turn*0.8+q*5.0))*${f(SNOWFALL.sway)}*(0.4+r);
    // The copy of its track in the box; it fades out toward the box's faces, where it would jump across.
    p=uMiddle+mod(p-uMiddle+uBox*0.5,uBox)-uBox*0.5;
    vec3 edge=abs(p-uMiddle)/(uBox*0.5);
    float alpha=${f(SNOWFALL.opacity)}*(1.0-smoothstep(0.8,1.0,max(edge.x,max(edge.y,edge.z))));
    for(int k=0;k<${SNOW.covers};k++){vec2 d=p.xz-uSnowCoverA[k].xy;
     if(p.y<uSnowCoverB[k].z&&max(abs(dot(d,uSnowCoverA[k].zw)),abs(dot(d,uSnowCoverB[k].xy)))<1.0)alpha=0.0;}
    #ifdef ROOFED
    vec2 g=(p.xz-uSkyMin.xz)/${f(COVER.cell)};
    if(uSkyLinked>0.5&&all(greaterThan(g,vec2(0.0)))&&all(lessThan(g,uSkyGrid.xz*uSkyCell/${f(COVER.cell)}))){
     ivec2 c=ivec2(g);vec4 t=texelFetch(uSkyReach,ivec3(c.x,c.y>>1,int(uSkyGrid.y)+1),0);
     if(p.y<uSkyMin.y+((c.y&1)==0?t.r:t.g)*uSkyGrid.y*uSkyCell-0.1)alpha=0.0;
    }
    #endif
    vGlow=0.0;for(int k=0;k<${SNOWFALL.lamps};k++){vec3 l=p-uLamps[k];vGlow+=1.0/(1.0+dot(l,l)*0.8);}
    vGlow=min(vGlow,1.6);
    vec4 mv=viewMatrix*vec4(p,1.0);float d=max(-mv.z,0.05),scale=uView.y*projectionMatrix[1][1]*0.5;
    float size=mix(${f(SNOWFALL.size[0])},${f(SNOWFALL.size[1])},q)*scale/d,blur=${f(SNOWFALL.blur)}*scale*max(0.0,1.0/d-${f(1/SNOWFALL.focus)}),wide=size+blur;
    // Out of focus a flake spreads and thins; smaller than a pixel it dims instead of flickering.
    float small=min(1.0,wide/1.5);
    vAlpha=alpha*small*mix(1.0,size/wide,0.8);vSoft=blur/wide;vAway=d;
    gl_PointSize=min(max(wide,1.5),64.0);gl_Position=vAlpha<0.004||-mv.z<0.12?vec4(2.0,2.0,2.0,1.0):projectionMatrix*mv;
   }`,
  fragmentShader:`uniform sampler2D uDepth;uniform vec2 uView;uniform vec3 uLight;uniform vec4 uLamp;varying float vGlow;varying float vAlpha;varying float vSoft;varying float vAway;
   void main(){
    if(vAway>texture2D(uDepth,gl_FragCoord.xy/uView).r)discard;
    gl_FragColor=vec4(mix(uLight,uLamp.rgb,min(vGlow,1.0)*uLamp.a),vAlpha*(1.0-smoothstep(mix(0.45,0.0,vSoft),1.0,length(gl_PointCoord-0.5)*2.0)));
   }`});
 const points=gpu?new T.Mesh(geometry,material):new T.Points(geometry,material);points.frustumCulled=false;
 const day=new T.Color(.97,.98,1),night=new T.Color(.5,.56,.7),eye=new T.Vector3();
 return {
  points,
  /** Draws the flakes over the frame on the canvas, `seconds` into the fall. `depth`: the scene's, as last drawn, in metres from the camera (post.ts, keepDepth).
   * `daylight` (0–1): white by day, pale blue at night. `dusk` (0–1): how far the lamps are on. */
  draw:(renderer:T.WebGLRenderer,camera:T.Camera,depth:T.Texture,seconds:number,daylight:number,dusk=0)=>{
   camera.getWorldDirection(uniforms.uMiddle.value).multiply(uniforms.uBox.value).multiplyScalar(.4).add(camera.getWorldPosition(eye));
   uniforms.uTime.value=seconds;uniforms.uDepth.value=depth;uniforms.uLight.value.copy(night).lerp(day,daylight);uniforms.uLamp.value.w=dusk;renderer.getDrawingBufferSize(uniforms.uView.value);
   drawOver(renderer,points,camera,gpu);
  },
  dispose:()=>{geometry.dispose();material.dispose();},
 };
}
export type Snowfall=ReturnType<typeof createSnowfall>;
