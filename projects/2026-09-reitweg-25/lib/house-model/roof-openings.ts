import * as T from 'three';
export type Skylight={side:number;z:number;fraction:number};
/** Exact existing roof pitch and footprint, with physical openings under the roof windows. */
export function roofSlopeWithOpenings(half:number,length:number,eave:number,ridge:number,side:number,windows:Skylight[]){
 const rise=ridge-eave,span=Math.hypot(half,rise),cos=half/span,sin=rise/span;
 const shape=new T.Shape([new T.Vector2(0,-length/2),new T.Vector2(span,-length/2),new T.Vector2(span,length/2),new T.Vector2(0,length/2)]);
 for(const win of windows.filter(w=>w.side===side)){const u=win.fraction*span,path=new T.Path();path.moveTo(u-.66,win.z-.35);path.lineTo(u-.66,win.z+.35);path.lineTo(u+.66,win.z+.35);path.lineTo(u+.66,win.z-.35);path.closePath();shape.holes.push(path);}
 const geometry=new T.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:false}),position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){const u=position.getX(i),z=position.getY(i),t=position.getZ(i);position.setXYZ(i,side*(u*cos-t*sin),ridge-u*sin-t*cos,z);}
 if(side<0){const indices=[];for(let i=0;i<position.count;i+=3)indices.push(i,i+2,i+1);geometry.setIndex(indices);}
 geometry.computeVertexNormals();return geometry;
}

/** Plastered ceiling under a roof slope: a sheet `drop` below the roof slab (the insulated build-up), from the ridge
 * `reach` metres out, with holes where the roof windows' reveals come through. Faces the room. */
export function roofLining(half:number,length:number,eave:number,ridge:number,side:number,windows:Skylight[],drop:number,reach:number){
 const rise=ridge-eave,span=Math.hypot(half,rise),cos=half/span,sin=rise/span,end=Math.min(span,reach/cos),t=.15+drop;
 const shape=new T.Shape([new T.Vector2(0,-length/2),new T.Vector2(end,-length/2),new T.Vector2(end,length/2),new T.Vector2(0,length/2)]);
 for(const win of windows.filter(w=>w.side===side&&w.fraction*span+.72<end)){const u=win.fraction*span,path=new T.Path();path.moveTo(u-.72,win.z-.41);path.lineTo(u-.72,win.z+.41);path.lineTo(u+.72,win.z+.41);path.lineTo(u+.72,win.z-.41);path.closePath();shape.holes.push(path);}
 const geometry=new T.ShapeGeometry(shape),position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){const u=position.getX(i),z=position.getY(i);position.setXYZ(i,side*(u*cos-t*sin),ridge-u*sin-t*cos,z);}
 if(side<0){const index=geometry.index!;for(let i=0;i<index.count;i+=3){const k=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,k);}}
 geometry.computeVertexNormals();return geometry;
}
