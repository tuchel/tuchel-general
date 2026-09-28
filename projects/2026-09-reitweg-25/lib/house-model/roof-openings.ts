import * as T from 'three';
export type Skylight={side:number;z:number;fraction:number};
/** Exact existing roof pitch and footprint, with physical openings under the roof windows. */
export function roofSlopeWithOpenings(half:number,length:number,eave:number,ridge:number,side:number,windows:Skylight[]){
 const rise=ridge-eave,span=Math.hypot(half,rise),cos=half/span,sin=rise/span;
 const shape=new T.Shape([new T.Vector2(0,-length/2),new T.Vector2(span,-length/2),new T.Vector2(span,length/2),new T.Vector2(0,length/2)]);
 for(const win of windows.filter(w=>w.side===side)){const u=win.fraction*span,path=new T.Path();path.moveTo(u-.51,win.z-.61);path.lineTo(u-.51,win.z+.61);path.lineTo(u+.51,win.z+.61);path.lineTo(u+.51,win.z-.61);path.closePath();shape.holes.push(path);}
 const geometry=new T.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:false}),position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){const u=position.getX(i),z=position.getY(i),t=position.getZ(i);position.setXYZ(i,side*(u*cos-t*sin),ridge-u*sin-t*cos,z);}
 if(side<0){const indices=[];for(let i=0;i<position.count;i+=3)indices.push(i,i+2,i+1);geometry.setIndex(indices);}
 geometry.computeVertexNormals();return geometry;
}
