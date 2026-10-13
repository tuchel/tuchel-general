import type {Point} from './site-data';

/** One step of a routine: walk a path (world x, z), through doors and, at `pace` below 1, up or down a stair; or stay
 * where the last walk ended, standing (`idle`), working with the hands (`work`) or sitting (`sit`, the hips at `at`),
 * facing a point. */
export type Step={path:Point[];pace?:number}|{stay:'idle'|'work'|'sit';face:Point;seconds:number;at?:Point};

// Shared ways through the house, each reversible: from the courtyard lawn along the loggia's east end (clear of the
// fireside lounge's long table and serving counter, when built) through the link's courtyard door, the link and the west
// corridor into the hall; from the hall into the kitchen's cooking aisle; up the main stair; along the gallery to the
// master bedroom.
const courtyardDoor:Point[]=[[-6.6,7.4],[-6.58,4.4],[-6.58,3.3],[-6.2,2.75]];
const courtyardToHall:Point[]=[...courtyardDoor,[-5.6,2.75],[-3.6,2.75],[-1.3,2.75]];
const hallToStove:Point[]=[[-1.3,2.75],[-1.3,-1.4],[-1.35,-2.9],[-2.7,-3.6],[-2.7,-5.33]];
const stairFoot:Point=[-2.35,2.4],stairHead:Point=[-2.35,-2.45],STAIR=.55;
const galleryToBedroom:Point[]=[stairHead,[-1.9,-2.75],[1.55,-2.75],[1.55,3.3],[1.69,4.3],[2.25,5.2],[2.25,6]];
const back=(p:Point[])=>[...p].reverse();

/** Five minutes each, starting and ending where Sims Mode first shows them, on the courtyard lawn. */
export const ROUTINES:{him:Step[];her:Step[]}={
 her:[
  {stay:'idle',face:[-9,8],seconds:3},
  // Into the house and to the stove.
  {path:[[-11.2,10.1],[-8,9.2],...courtyardToHall,...hallToStove.slice(1)]},
  {stay:'work',face:[-1.8,-5.33],seconds:30},
  // Up to the master bedroom: the bed straightened, a moment sitting at its foot, a look out of the gable window.
  {path:[...back(hallToStove),[-2.35,2.75],stairFoot]},
  {path:[stairFoot,stairHead],pace:STAIR},
  {path:galleryToBedroom},
  {stay:'work',face:[1.2,6],seconds:14},
  {stay:'sit',at:[1.42,6],face:[3.8,6],seconds:18},
  {path:[[2.25,6],[2.4,8],[2.35,8.9]]},
  {stay:'idle',face:[2.35,10],seconds:6},
  // Down to the family room's fireplace.
  {path:[[2.35,8.9],[2.3,5.2],...back(galleryToBedroom).slice(2)]},
  {path:[stairHead,stairFoot],pace:STAIR},
  {path:[stairFoot,[-2.35,2.95],[-.4,3.3],[-.4,4.4],[-.95,5],[-.95,7.9],[-.06,8.5]]},
  {stay:'work',face:[-.06,9.3],seconds:11},
  // Out by the loggia door and round the pool, back to the courtyard.
  {path:[[-.06,8.5],[-.95,7.9],[-.95,5],[-5.4,5],[-5.5,5.8],[-6.7,5.8],[-6.6,7.4],[-7.6,15.3],[12.3,15.3],[12.6,22.8],[-7,22.8],[-8.6,17.5],[-11.2,10.1]]},
  {stay:'idle',face:[-9,8],seconds:2},
 ],
 him:[
  {stay:'idle',face:[-13,12],seconds:3},
  // A turn by the pool first.
  {path:[[-11.9,11.1],[-11.6,14.2],[-8.4,17.6],[-7.2,23.1],[4,23.1]]},
  {stay:'idle',face:[4,18.8],seconds:6},
  // To the garage's workbench, through the link.
  {path:[[4,23.1],[12.4,23.1],[12.6,15],[-7.8,15],[-7.4,9.6],...courtyardDoor.slice(0,3),[-7.2,2.2],[-12,2.2],[-14.2,1.87],[-15.7,1.87],[-16.5,2.4]]},
  {stay:'work',face:[-16.5,3.3],seconds:35},
  // Out of the front door to the gate for the post.
  {path:[[-16.5,2.4],[-15.7,1.87],[-14.2,1.87],[-13.73,1.6],[-13.73,.7],[-14.05,-1.05],[-25.1,-2.22],[-33.2,-5.4]]},
  {stay:'idle',face:[-34.2,-5.45],seconds:8},
  // Back in for a coffee at the stove.
  {path:[[-33.2,-5.4],[-25.1,-2.22],[-14.05,-1.05],[-13.73,.7],[-13.73,2],[-12,2.2],[-7.2,2.2],...courtyardToHall.slice(3),...hallToStove.slice(1)]},
  {stay:'work',face:[-1.8,-5.33],seconds:25},
  // Out to the courtyard to read the post.
  {path:[...back(hallToStove),...back(courtyardToHall),[-8,9.2],[-11.9,11.1]]},
  {stay:'idle',face:[-13,12],seconds:25},
 ],
};
