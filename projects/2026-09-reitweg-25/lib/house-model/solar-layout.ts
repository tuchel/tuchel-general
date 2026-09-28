import {guestRoofFrame} from './site-data';
export const solarModule={watts:450,width:1.134,length:1.722,area:1.134*1.722};
export const roofSkylights=(kind:'main'|'guest')=>kind==='main'?[
 ...[[-7.5,.7],[-4.5,.7],[-1.5,.7],[-5,.28],[1.1,.45],[3.1,.45],[5.1,.45],[5.6,.72],[7.3,.72],[8.8,.72]].map(([z,fraction])=>({side:1,z,fraction})),
 // West slope: the eight roof windows above the knee wall on the upper plan.
 ...[-6.57,-4.77,-2.97,-1.18,.71,2.36,6.15,7.92].map(z=>({side:-1,z,fraction:.58}))
// Guest roof windows are all on the west slope (upper plan; FDE39D63 shows none on the east).
]:[...[0,2,4].map(z=>({side:-1,z,fraction:.62}))];
export const solarRoofs=[
 {id:'main',center:[0,0],width:13.1,length:20.2,eave:2.64,ridge:8,rotation:0,eastAzimuth:97.5},
 {id:'guest',...guestRoofFrame,width:guestRoofFrame.width+.18,length:guestRoofFrame.length+.18,eave:2.94,ridge:6.75,eastAzimuth:102.8}
] as const;
export type SolarPanel={roof:'main'|'guest';side:number;u:number;z:number};
// Landscape modules on each slope. u is distance down the slope from the ridge.
// Retain skylights, a 0.45m perimeter, 0.25m around windows and roof junctions.
export const solarCapacityPanels:SolarPanel[]=solarRoofs.flatMap(roof=>{
 const span=Math.hypot(roof.width/2,roof.ridge-roof.eave),panels:SolarPanel[]=[];
 const rows=Math.floor((span-.9+.025)/(solarModule.width+.025)),cols=Math.floor((roof.length-.9+.025)/(solarModule.length+.025));
 const along=cols*solarModule.length+(cols-1)*.025;
 for(const side of [-1,1])for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const u=.45+solarModule.width/2+row*(solarModule.width+.025),z=-along/2+solarModule.length/2+col*(solarModule.length+.025);
  const window=roofSkylights(roof.id).some(w=>w.side===side&&Math.abs(u-w.fraction*span)<(solarModule.width+1.4)/2+.25&&Math.abs(z-w.z)<(solarModule.length+.78)/2+.25);
  const junction=roof.id==='main'?(side===-1&&z>-.2&&z<6.8&&u>4.4)||(z>7.7&&u<1.7):(side===1&&z<-3.1&&u>2.8);
  if(!window&&!junction)panels.push({roof:roof.id,side,u,z});
 }
 return panels;
});
// Gas retained: 50 modules on the main house, leaving the guest roof untouched.
// The proposal keeps 50 modules: the first 26 east-face and 24 west-face positions from the checked packing.
export const solarPanels:SolarPanel[]=[...solarCapacityPanels.filter(p=>p.roof==='main'&&p.side===1).slice(0,26),...solarCapacityPanels.filter(p=>p.roof==='main'&&p.side===-1).slice(0,24)];
export const solarArray={panels:solarPanels.length,kwp:solarPanels.length*solarModule.watts/1000,area:solarPanels.length*solarModule.area};
