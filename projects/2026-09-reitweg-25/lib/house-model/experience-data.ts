import {planPoint as p,UPPER_PLAN_X_OFFSET} from './site-data';
export type Place='living'|'dining'|'kitchen'|'pool'|'court'|'entrance'|'lane'|'bedroom'|'upstairs';
const at=(x:number,z:number,h:number):[number,number,number]=>{const [a,b]=p(x,z);return [a,h,b];};
const upper=(x:number,z:number,h:number):[number,number,number]=>{const [a,b]=p(x,z);return [a+UPPER_PLAN_X_OFFSET,h,b];};
/** Eye-level places; exposure follows how much sky each spot sees (lighting.ts, roomExposure). */
/** `floor` names the floor a walk starts on when the viewpoint is not standing on it (leaning out of a window). */
export const places:Record<Place,{label:string;short:string;position:[number,number,number];target:[number,number,number];photo:string;caption:string;floor?:number}>={
 lane:{label:'Beneath the avenue',short:'Avenue',position:[-45.5,1.65,17],target:[-60,2.3,57],photo:'setting-tree-lined-lane.jpg',caption:'Street level · beneath the tall trees'},
 entrance:{label:'Along the entrance walk',short:'Entrance',position:[-25,1.65,-2.21],target:[-14,1.4,1.1],photo:'F92D9025-5B99-4FAF-9BAE-ECC47E3D555A_1_105_c.jpg',caption:'Standing height · approaching the front door'},
 pool:{label:'Under the courtyard eaves',short:'Eaves',position:[-12,1.65,5.7],target:[-9,1.3,20],photo:'207644AC-3AC6-42D5-86F7-98FFC7A242DC_1_105_c.jpg',caption:'Standing height · looking toward the pool'},
 court:{label:'In the courtyard',short:'Courtyard',position:[-7.5,1.65,11],target:[-17,1.4,9],photo:'FDE39D63-B192-4A7E-A16B-886A2F38F0A6_1_105_c.jpg',caption:'Standing height · across the lawn to the loggia'},
 living:{label:'In the family room',short:'Family room',position:at(991,727,1.65),target:at(1190,810,1.4),photo:'IMG_1457.jpg',caption:'Standing height · looking toward the garden'},
 dining:{label:'A seat at the table',short:'Dining',position:at(1100,611,1.22),target:at(1230,593,1.45),photo:'94D23FDE-62F0-49DF-8A1F-A4C216E61825_1_105_c.jpg',caption:'Seated height · looking east'},
 kitchen:{label:'Morning in the kitchen',short:'Kitchen',position:at(912,350,1.65),target:at(735,260,1.35),photo:'A3DBBB95-78B2-4B2E-B973-6D22C9FC98CE_4_5005_c.jpg',caption:'Standing height · looking northwest'},
 bedroom:{label:'The master bedroom',short:'Master bedroom',position:upper(1165,700,4.72),target:upper(1115,873,4.2),photo:'604A85F7-1750-41C0-B9F4-5B09375CB119_1_105_c.jpg',caption:'Standing height · looking toward the south gable'},
 upstairs:{label:'The upstairs garden view',short:'Upstairs',position:[4.83,4.72,-1.5],target:[80,-4,7],floor:3.07,photo:'setting-upstairs-horizon.jpg',caption:'Leaning out of the roof window · meadow and distant Alps'},
};
export type CaptureState={
 breeze:boolean;sound:boolean;render:'idle'|'preparing'|'refining'|'panorama';samples:number;
 busy:boolean;recording:boolean;maximum:boolean;message:string;
};
export const initialCapture:CaptureState={breeze:false,sound:false,render:'idle',samples:0,busy:false,recording:false,maximum:false,message:''};
