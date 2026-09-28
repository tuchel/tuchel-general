import * as T from 'three';

/** A restrained, photo-led Alpine impression, not georeferenced mountain terrain.
 * Actual slopes and gullies replace upright silhouette cards. Render distances
 * are compressed, retaining the small apparent height seen in the owner's photos. */
export function alpineTerrain(){
 const group=new T.Group();group.name='atmospheric-alpine-terrain';
 const profile=[.24,.28,.36,.4,.32,.43,.39,.45,.37,.53,.47,.55,.62,.58,.48,.5,.61,.56,.75,.69,.64,.77,.84,.7,.67,.76,.72,.81,.7,.69,.73,.62,.68,.58,.53,.62,.58,.45,.53,.4];
 const smooth=(t:number)=>t*t*(3-2*t);
 function contour(u:number,layer:number){const f=T.MathUtils.clamp(u,0,1)*(profile.length-1),i=Math.floor(f);return T.MathUtils.lerp(profile[(i+layer*3)%profile.length],profile[(i+1+layer*3)%profile.length],smooth(f-i));}
 const sun=new T.Vector3(-.55,.55,.4).normalize();
 for(const [layer,radius,relief,width,haze] of [[0,465,39,112,.79],[1,358,27,88,.69],[2,252,14,74,.57]] as const){
  const cols=192,rows=28,positions:number[]=[],indices:number[]=[],colours:number[]=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const u=i/cols,v=j/rows,angle=T.MathUtils.degToRad(-43+u*113),r=radius+(v-.5)*width;
   const ends=T.MathUtils.smoothstep(u,0,.1)*(1-T.MathUtils.smoothstep(u,.9,1));
   const crest=.46+.095*Math.sin(u*27+layer)+.035*Math.sin(u*79);
   const flank=Math.max(0,1-Math.abs(v-crest)/(v<crest?crest:1-crest));
   // Coherent valleys branch down each slope; fine relief is strongest below the crest.
   const ridge=contour(u,layer)+.02*Math.sin(u*411+layer)+.013*Math.sin(u*917);
   const gullies=(Math.sin(u*183+v*9+Math.sin(v*13)*.8)+.45*Math.sin(u*397-v*17))*.038*Math.sin(Math.PI*v);
   const height=-7+ends*relief*(ridge*Math.pow(flank,.85)+gullies);
   positions.push(Math.cos(angle)*r,height,Math.sin(angle)*r);
   if(i<cols&&j<rows){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const normals=geometry.attributes.normal,p=geometry.attributes.position,n=new T.Vector3(),stone=new T.Color('#667f8b'),air=new T.Color('#b0c6cf');
  for(let i=0;i<p.count;i++){
   n.fromBufferAttribute(normals,i);if(n.y<0)n.negate();
   const reliefLight=.86+.19*n.dot(sun),height=p.getY(i),lowMist=.12*(1-T.MathUtils.smoothstep(height,-3,18));
   const c=stone.clone().multiplyScalar(reliefLight).lerp(air,Math.min(.94,haze+lowMist));colours.push(...c.toArray());
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  // Haze is baked into the colour, keeping far mountains from becoming black
  // under the scene's near-field shadows or disappearing into its short fog range.
  const material=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,fog:false,toneMapped:false});
  const ridge=new T.Mesh(geometry,material);ridge.name='photo-inspired-alpine-horizon-'+layer;ridge.userData.scenicBackdrop=true;group.add(ridge);
 }
 return group;
}
