import * as T from 'three';
import data from './forests.json';
import {addShaderFeature} from './shader-features';

/** The woods round the house from OpenStreetMap's woodland outlines (scripts/build-forests.mjs), from 120 m out, where
 * the traced trees end, to 700 m. Each stands on the land's own height (at most 3 m above the model's level ground) at a
 * stand's height: spruce woods with a saw edge of crowns, broadleaf woods with a rounded one. At this distance a wood reads as its edge and canopy, so each is a
 * wall from below the ground to the crowns and a canopy over it, not single trees. */
export const FORESTS=data;
/** A stand's height by leaf type (m): spruce about 28, broadleaves about 24. From the east roof window the spruce wood
 * beyond the pasture tops out 2–7° above eye level in the owner's photographs. */
export const STAND_HEIGHT={needleleaved:28,mixed:26,broadleaved:24};
const STEP=2.5;

/** The land a wood stands on, as far as the model's level ground can carry it: where the land rises more than 3 m above
 * that ground the wood stands 3 m up, on a hill the model does not have. */
export const footing=(land:number,x:number,ground:(x:number)=>number)=>Math.min(land,ground(x)+3);
/** The woods whose crowns rise above the model's ground; the rest the falling land hides. */
export function standing(ground:(x:number)=>number){
 return data.woods.filter(w=>{const p=w.points,h=STAND_HEIGHT[w.leaf as keyof typeof STAND_HEIGHT];let crown=-Infinity;
  for(let i=0;i<p.length;i+=3)crown=Math.max(crown,footing(p[i+2],p[i],ground)+h*.9-ground(p[i]));
  return crown>2;});
}

export function distantWoods(ground:(x:number)=>number){
 const positions:number[]=[],colours:number[]=[],walls:[number,number,number,number][]=[];
 const dark=new T.Color('#1d2a17'),spruce=new T.Color('#30462a'),broad=new T.Color('#3f582b'),air=new T.Color('#a9bfca'),c=new T.Color();
 let seed=5113;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 // A little air between the house and each point, baked in; the view's own haze is added in the shader (below).
 const push=(x:number,y:number,z:number,colour:T.Color)=>{positions.push(x,y,z);c.copy(colour).lerp(air,.05+.15*(1-Math.exp(-Math.hypot(x,z)/800)));colours.push(c.r,c.g,c.b);};
 const canopy:number[]=[];
 for(const wood of standing(ground)){
  const p=wood.points,n=p.length/3,height=STAND_HEIGHT[wood.leaf as keyof typeof STAND_HEIGHT],needles=wood.leaf==='needleleaved'?1:wood.leaf==='mixed'?.5:0;
  const crown=broad.clone().lerp(spruce,needles);
  // The edge, every 2.5 m: spruce crowns every other step, a notch between; broadleaf crowns rounded over about 10 m.
  const edge:{x:number;z:number;land:number;top:number}[]=[];
  for(let i=0;i<n;i++){const a=i*3,b=((i+1)%n)*3,len=Math.hypot(p[b]-p[a],p[b+1]-p[a+1]),steps=Math.max(1,Math.round(len/STEP));
   for(let k=0;k<steps;k++){const t=k/steps,x=p[a]+(p[b]-p[a])*t,z=p[a+1]+(p[b+1]-p[a+1])*t,land=footing(p[a+2]+(p[b+2]-p[a+2])*t,x,ground),j=edge.length;
    const saw=j%2?.76+.1*random():random()<.06?1.1:1,round=.92+.08*Math.sin(j*STEP/10*Math.PI*2+random());
    edge.push({x,z,land,top:land+height*(.88+.2*random())*(needles*saw+(1-needles)*round)});}}
  for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length],baseA=Math.min(a.land,ground(a.x))-1,baseB=Math.min(b.land,ground(b.x))-1;
   walls.push([a.x,baseA,a.top,a.land]);
   const shadeA=dark.clone().lerp(crown,.75+.25*random()),shadeB=dark.clone().lerp(crown,.75+.25*random());
   push(a.x,baseA,a.z,dark);push(b.x,baseB,b.z,dark);push(b.x,b.top,b.z,shadeB);
   push(a.x,baseA,a.z,dark);push(b.x,b.top,b.z,shadeB);push(a.x,a.top,a.z,shadeA);}
  // A second row of crowns 7 m in, staggered, standing over the canopy, so the edge has depth.
  let area=0;for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];area+=a.x*b.z-b.x*a.z;}
  for(let i=0;i<edge.length;i+=2){const a=edge[i],b=edge[(i+1)%edge.length],len=Math.hypot(b.x-a.x,b.z-a.z)||1,inward=Math.sign(area);
   const nx=-(b.z-a.z)/len*inward*7,nz=(b.x-a.x)/len*inward*7,x=a.x+nx,z=a.z+nz,low=a.land+height*.72,tip=a.land+height*(needles?.9+.24*random():.85+.15*random()),w=STEP*(.8+.4*random());
   const shade=dark.clone().lerp(crown,.65+.3*random());
   push(x-(b.x-a.x)/len*w,low,z-(b.z-a.z)/len*w,shade);push(x+(b.x-a.x)/len*w,low,z+(b.z-a.z)/len*w,shade);push(x,tip,z,shade);}
  // The canopy over it, under the notches between crowns so the edge keeps its outline from the ground.
  const shape=edge.map(e=>new T.Vector2(e.x,e.z));
  for(const [i,j,k] of T.ShapeUtils.triangulateShape(shape,[]))for(const e of [edge[i],edge[k],edge[j]]){canopy.push(positions.length/3);push(e.x,e.land+height*.72,e.z,crown.clone().multiplyScalar(.8+.35*random()));}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.computeVertexNormals();
 // The canopy faces the sky evenly; its colour varies from crown to crown.
 const normal=geometry.attributes.normal;for(const v of canopy)normal.setXYZ(v,0,1,0);
 // The woods take the scene's haze over a longer range than its fog (set for the compressed scenery beyond): clear a
 // couple of hundred metres out, as photographed, and gone into the haze where the ground around them is.
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide});
 addShaderFeature(material,{key:'distant-woods-haze',compile:shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','#ifdef USE_FOG\n gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,smoothstep(fogNear*1.5,fogFar*2.2,vFogDepth));\n#endif');}});
 const mesh=new T.Mesh(geometry,material);mesh.name='distant-woods';mesh.receiveShadow=true;mesh.userData.dynamic=true;
 mesh.userData.walls=walls;
 return mesh;
}
