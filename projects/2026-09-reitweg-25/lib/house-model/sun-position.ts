/** NOAA/Meeus solar geometry. Angles in degrees; longitude positive east.
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 * Address from the portal's solar feasibility study. Plan north is 8.7° east of true north: the house's own building
 * in the Bavarian survey's LoD2 models fits the model 7.0° from UTM grid north (neighbors.json), and grid north lies
 * 1.7° east of true north here (meridian convergence). */
export const SUN_SITE={latitude:47.8606705,longitude:11.2919095,planNorthBearing:8.7,timeZone:'Europe/Berlin',year:2026} as const;
export type SunStudy={enabled:boolean;day:number;minutes:number};
export const initialSunStudy:SunStudy={enabled:false,day:172,minutes:9*60};
const rad=Math.PI/180,deg=180/Math.PI,mod=(a:number,n:number)=>((a%n)+n)%n;
export const studyDate=(day:number)=>new Date(Date.UTC(SUN_SITE.year,0,day));
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:SUN_SITE.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function civil(date:Date){const p=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));return {year:+p.year,month:+p.month,day:+p.day,minutes:+p.hour*60+(+p.minute)};}
/** Resolve local clock time without using the viewer's time zone. Spring gap
 * moves forward one hour; repeated autumn hour selects its first occurrence. */
export function studyInstant(day:number,minutes:number){
 const d=studyDate(day),wall=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),0,minutes);
 const candidates=[2,1].map(offset=>new Date(wall-offset*3600000));
 const exact=candidates.filter(date=>{const c=civil(date);return c.month===d.getUTCMonth()+1&&c.day===d.getUTCDate()&&c.minutes===minutes;});
 const date=exact[0]??candidates[1],local=civil(date),offset=(Date.UTC(local.year,local.month-1,local.day,0,local.minutes)-date.getTime())/3600000;
 return {date,minutes:local.minutes,zone:offset===2?'CEST':'CET',notice:exact.length===0?'Clock-change gap: moved forward one hour.':exact.length>1?'Repeated autumn hour: first occurrence (CEST).':''};
}
export function solarPosition(date:Date,latitude:number=SUN_SITE.latitude,longitude:number=SUN_SITE.longitude){
 const t=(date.getTime()/86400000+2440587.5-2451545)/36525;
 const l=mod(280.46646+t*(36000.76983+t*.0003032),360)*rad,m=(357.52911+t*(35999.05029-.0001537*t))*rad;
 const e=.016708634-t*(.000042037+.0000001267*t),omega=(125.04-1934.136*t)*rad;
 const center=Math.sin(m)*(1.914602-t*(.004817+.000014*t))+Math.sin(2*m)*(.019993-.000101*t)+Math.sin(3*m)*.000289;
 const apparent=l+(center-.00569-.00478*Math.sin(omega))*rad;
 const obliquity=(23+(26+(21.448-t*(46.815+t*(.00059-t*.001813)))/60)/60+.00256*Math.cos(omega))*rad;
 const declination=Math.asin(Math.sin(obliquity)*Math.sin(apparent)),y=Math.tan(obliquity/2)**2;
 const eq=4*deg*(y*Math.sin(2*l)-2*e*Math.sin(m)+4*e*y*Math.sin(m)*Math.cos(2*l)-.5*y*y*Math.sin(4*l)-1.25*e*e*Math.sin(2*m));
 const minutes=date.getUTCHours()*60+date.getUTCMinutes()+date.getUTCSeconds()/60;
 const hourAngle=(mod(minutes+eq+4*longitude,1440)/4-180)*rad,lat=latitude*rad;
 const elevation=deg*Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(declination)+Math.cos(lat)*Math.cos(declination)*Math.cos(hourAngle))));
 const azimuth=mod(deg*Math.atan2(Math.sin(hourAngle),Math.cos(hourAngle)*Math.sin(lat)-Math.tan(declination)*Math.cos(lat))+180,360);
 const tan=Math.tan(elevation*rad);
 const refraction=elevation>85?0:elevation>5?(58.1/tan-.07/tan**3+.000086/tan**5)/3600:elevation>-.575?(1735+elevation*(-518.2+elevation*(103.4+elevation*(-12.79+elevation*.711))))/3600:-20.774/tan/3600;
 return {azimuth,elevation,apparentElevation:elevation+refraction};
}
/** The moon from the address: where it stands and how much of its disc is lit. Low-precision series (Astronomical
 * Almanac; about 0.3° in longitude, 0.2° in latitude), with the parallax of an observer on the ground, which lowers the
 * moon by up to a degree. `lit` is the lit share of the disc, 0 new to 1 full. */
export function moonPosition(date:Date,latitude:number=SUN_SITE.latitude,longitude:number=SUN_SITE.longitude){
 const days=date.getTime()/86400000+2440587.5-2451545,t=days/36525,sin=(d:number)=>Math.sin(d*rad);
 const lambda=(218.32+481267.881*t+6.29*sin(135+477198.87*t)-1.27*sin(259.3-413335.36*t)+.66*sin(235.7+890534.22*t)+.21*sin(269.9+954397.74*t)-.19*sin(357.5+35999.05*t)-.11*sin(186.5+966404.03*t))*rad;
 const beta=(5.13*sin(93.3+483202.02*t)+.28*sin(228.2+960400.89*t)-.28*sin(318.3+6003.15*t)-.17*sin(217.6-407332.21*t))*rad;
 const obliquity=(23.439-.013*t)*rad;
 const x=Math.cos(beta)*Math.cos(lambda),y=Math.cos(obliquity)*Math.cos(beta)*Math.sin(lambda)-Math.sin(obliquity)*Math.sin(beta),z=Math.sin(obliquity)*Math.cos(beta)*Math.sin(lambda)+Math.cos(obliquity)*Math.sin(beta);
 const rightAscension=Math.atan2(y,x),declination=Math.asin(z);
 // Greenwich mean sidereal time, then the moon's hour angle at the address.
 const sidereal=mod(280.46061837+360.98564736629*days+longitude,360)*rad,hourAngle=sidereal-rightAscension,lat=latitude*rad;
 const geocentric=Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(declination)+Math.cos(lat)*Math.cos(declination)*Math.cos(hourAngle))));
 const azimuth=mod(deg*Math.atan2(Math.sin(hourAngle),Math.cos(hourAngle)*Math.sin(lat)-Math.tan(declination)*Math.cos(lat))+180,360);
 const elevation=deg*geocentric-.95*Math.cos(geocentric);
 // The sun's ecliptic longitude, for the moon's phase.
 const m=(357.52911+35999.05029*t)*rad,sun=(280.46646+36000.76983*t)*rad+(1.914602*Math.sin(m)+.019993*Math.sin(2*m))*rad;
 const elongation=Math.acos(Math.max(-1,Math.min(1,Math.cos(beta)*Math.cos(lambda-sun))));
 return {azimuth,elevation,lit:(1-Math.cos(elongation))/2,elongation:elongation*deg,latitude:beta*deg};
}
export function sunDirection(azimuth:number,elevation:number):[number,number,number]{const a=(azimuth-SUN_SITE.planNorthBearing)*rad,h=elevation*rad;return [Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)];}
export function sunStudyReading(s:SunStudy){const local=studyInstant(s.day,s.minutes);return {...local,...solarPosition(local.date),moon:moonPosition(local.date)};}
export const clockLabel=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;

/** Daily events use UTC instants throughout, including days with clock changes.
 * Sunrise/set are the standard -0.833° solar-centre crossing (unobstructed
 * horizon). Peak is maximum geometric altitude, not maximum energy production. */
export function sunDayEvents(day:number){
 const start=studyInstant(day,0).date.getTime(),end=studyInstant(day+1,0).date.getTime();
 const altitude=(ms:number)=>solarPosition(new Date(ms)).elevation;
 const event=(ms:number)=>{const date=new Date(ms),local=civil(date);return {date,minutes:local.minutes,elevation:altitude(ms)};};
 let lo=start+6*3600000,hi=start+18*3600000;
 for(let i=0;i<42;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(altitude(a)<altitude(b))lo=a;else hi=b;}
 const peak=event((lo+hi)/2);
 function crossing(a:number,b:number,rising:boolean){
  for(let i=0;i<40;i++){const m=(a+b)/2;if((altitude(m)<-.833)===rising)a=m;else b=m;}
  return event((a+b)/2);
 }
 const sunrise=crossing(start,peak.date.getTime(),true),sunset=crossing(peak.date.getTime(),end,false);
 return {sunrise,peak,sunset,daylightMinutes:Math.round((sunset.date.getTime()-sunrise.date.getTime())/60000),zone:studyInstant(day,720).zone};
}
