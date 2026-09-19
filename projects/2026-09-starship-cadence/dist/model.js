// Pure, deterministic model. Years are decimal calendar years; rates are launches/year.
export const defaults = {
  bearish:{name:'Bearish',color:'#e5ab71',growth:1,delay:1.5,ceiling:120,fleet:8,turn:25,uptime:65,start:6},
  baseline:{name:'Baseline',color:'#62dccb',growth:1.65,delay:.75,ceiling:1500,fleet:30,turn:5,uptime:80,start:6},
  bullish:{name:'Bullish',color:'#afa0ff',growth:2.5,delay:.25,ceiling:10000,fleet:100,turn:1,uptime:90,start:6}
};
export function rate(t,p,h){
  const elapsed=Math.max(0,t-h.cutoff-p.delay);
  const end=Math.max(.01,2036-h.cutoff-p.delay);
  const progress=Math.min(1,elapsed/end);
  const k=h.cadenceFit.k*p.growth;
  const potential=p.ceiling/(1+(p.ceiling/p.start-1)*Math.exp(-k*elapsed));
  // Net flight-ready equivalents include replacement production; geometric transition ends Jan 1, 2036.
  const fleet=2*Math.pow(p.fleet/2,progress);
  const turn=h.stats.recentMedian*Math.pow(p.turn/h.stats.recentMedian,progress);
  const vehicleCapacity=365.25*fleet/turn;
  const ceiling=Math.min(potential,vehicleCapacity,p.ceiling);
  return {value:p.uptime/100*ceiling,potential,vehicleCapacity,fleet,turn,limit:vehicleCapacity<potential?'Vehicle availability':'Cadence ramp'};
}
export function forecast(p,h){
 const result=[];let cumulative=0;
 for(let year=2026;year<=2035;year++){
   const from=Math.max(year,h.cutoff),to=year+1,n=104,dt=(to-from)/n;
   let future=0;for(let i=0;i<n;i++)future+=rate(from+(i+.5)*dt,p,h).value*dt;
   const observed=year===2026?h.starship.filter(f=>f.date.startsWith('2026')).length:0;
   cumulative+=future;
   result.push({year,annual:future+observed,future,cumulative,weekly:(future+observed)/(365.25/7),...Object.fromEntries(Object.entries(rate(year+.5,p,h)).filter(([k])=>k!=='value'))});
 }
 return result;
}
