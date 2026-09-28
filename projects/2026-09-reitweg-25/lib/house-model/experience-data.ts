import {initialSunStudy,type SunStudy} from './sun-position';
import {planPoint as p} from './site-data';
export type Mood='daylight'|'overcast'|'evening';
export type Presence='overview'|'living'|'dining'|'kitchen'|'pool'|'entrance'|'lane'|'upstairs';
const at=(x:number,z:number,h:number):[number,number,number]=>{const [a,b]=p(x,z);return [a,h,b];};
export const places={
 lane:{label:'Beneath the avenue',position:[-45.5,1.65,17] as [number,number,number],target:[-60,2.3,57] as [number,number,number],photo:'setting-tree-lined-lane.jpg',caption:'Street level · beneath the tall trees'},
 upstairs:{label:'The upstairs garden view',position:[4.45,4.62,-1.5] as [number,number,number],target:[80,4.1,7] as [number,number,number],photo:'setting-upstairs-horizon.jpg',caption:'By the roof window · meadow and distant Alps'},
 entrance:{label:'Along the entrance walk',position:[-25,1.65,-2.21] as [number,number,number],target:[-14,1.4,1.1] as [number,number,number],photo:'F92D9025-5B99-4FAF-9BAE-ECC47E3D555A_1_105_c.jpg',caption:'Standing height · approaching the front door'},
 living:{label:'In the family room',position:at(991,727,1.65),target:at(1190,810,1.4),photo:'IMG_1457.jpg',caption:'Standing height · looking toward the garden'},
 dining:{label:'A seat at the table',position:at(1100,611,1.22),target:at(1230,593,1.45),photo:'94D23FDE-62F0-49DF-8A1F-A4C216E61825_1_105_c.jpg',caption:'Seated height · looking east'},
 kitchen:{label:'Morning in the kitchen',position:at(912,350,1.65),target:at(735,260,1.35),photo:'A3DBBB95-78B2-4B2E-B973-6D22C9FC98CE_4_5005_c.jpg',caption:'Standing height · looking northwest'},
 pool:{label:'Under the courtyard eaves',position:[-12,1.65,5.7] as [number,number,number],target:[-9,1.3,20] as [number,number,number],photo:'207644AC-3AC6-42D5-86F7-98FFC7A242DC_1_105_c.jpg',caption:'Standing height · looking toward the pool'}
};
export type ExperienceState={sun:SunStudy;mood:Mood;presence:Presence;breeze:boolean;sound:boolean;render:string;samples:number;busy:boolean;recording:boolean;maximum:boolean;message:string};
export const initialExperience:ExperienceState={sun:initialSunStudy,mood:'daylight',presence:'overview',breeze:false,sound:false,render:'idle',samples:0,busy:false,recording:false,maximum:false,message:''};
