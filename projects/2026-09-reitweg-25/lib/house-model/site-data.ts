import type {StandKind} from './foliage';
/** Source tracing in the 1888px-wide presentation of the exposé spreads.
 * Ground plan is calibrated to its labelled ~12 m main-house width.
 * Plot tracing uses the same house width as a registration anchor.
 * Heights, terrain and vegetation are interpretations, not a survey.
 */
export type Point = [number, number];
export const PLAN_SCALE = 12 / 434;
export const planPoint = (x:number,z:number):Point => [(x-1012)*PLAN_SCALE,(z-529.5)*PLAN_SCALE];
// The upper spread is shifted 52 trace pixels east of the ground spread.
// Main stair and chimney axes provide the registration anchors.
export const UPPER_PLAN_X_OFFSET = -52 * PLAN_SCALE;
// The basement sheet is drawn 20 px east of the ground sheet (stair, light wells and footprint agree).
export const BASEMENT_PLAN_X_OFFSET = -20 * PLAN_SCALE;
// Guest roof eaves on the upper spread, registered to the ground plan.
// Includes the roof over the courtyard-side loggia.
export const guestRoofCorners:Point[] = [[160,535],[525,570],[466,1247],[92,1213]].map(([x,z])=>planPoint(x-52,z));
export const guestRoofFrame = (()=>{
 const [nw,ne,se,sw]=guestRoofCorners;
 const north:Point=[(nw[0]+ne[0])/2,(nw[1]+ne[1])/2];
 const south:Point=[(sw[0]+se[0])/2,(sw[1]+se[1])/2];
 return {center:[(north[0]+south[0])/2,(north[1]+south[1])/2] as Point,
  width:(Math.hypot(ne[0]-nw[0],ne[1]-nw[1])+Math.hypot(se[0]-sw[0],se[1]-sw[1]))/2,
  length:Math.hypot(south[0]-north[0],south[1]-north[1]),
  rotation:Math.atan2(south[0]-north[0],south[1]-north[1])};
})();
export const sitePoint = (x:number,z:number):Point => [(x-874)*(12/181),(z-531.5)*(12/181)];
export const plotOutline:Point[] = [[441,220],[1717,417],[1599,1016],[199,849],[246,626],[346,610],[365,422],[336,399]].map(([x,z])=>sitePoint(x,z));
/** The north boundary hedge stands taller from the arrival wall to abreast of the main house's north gable (owner
 * photographs and aerial photograph): its height (m) as far east as x = until (world m). */
export const TALL_HEDGE={until:4.4,height:3.2};
/** Trees traced from the owner's aerial photograph (north up, calibrated on the house and the neighbours' surveyed
 * buildings to about 2 m): [x, z, height, crown radius, kind], world metres. Heights from the owner's photographs: from
 * the east roof window the canopy's skyline caps each tree in view (camera fitted to the neighbours' buildings, the roof
 * verge and the north hedge to 8 px). Kinds as photographed: broadleaves grown in a wood, a silver birch, spruces.
 * North of the boundary: a spruce in No. 21's garden behind the main house's north gable, and the wood round and behind
 * Nos. 21 and 23; the silver birch behind No. 23's west end, under the wood's canopy from above, is placed from the roof
 * window photograph (its bearing and height, at the house it stands behind). */
export const NORTH_TREES:[number,number,number,number,StandKind][]=[
 [-3,-31,26,3,'spruce'],[18.5,-52,18,4.5,'woodland'],[20.5,-66.5,23.5,6.5,'woodland'],[7.5,-73.5,23,7.5,'woodland'],[-7,-74,26,8,'woodland'],
 [-17,-51,24,6.5,'woodland'],[-23,-38,22,6,'woodland'],[27.5,-65.5,23.5,6,'woodland'],[52.5,-72,24.5,8.5,'woodland'],[67,-57.5,26,9.5,'woodland'],[63.5,-40.5,23.5,7.5,'woodland'],
 [28,-50.5,18.5,6,'birch'],
];
/** East of the garden: a dense wood beyond the north-east corner that ends about halfway down the east hedge, with a
 * silver birch at its foot; a large broadleaf and a few small spruces in the pasture; a clump beyond the south-east
 * corner. */
export const EAST_TREES:[number,number,number,number,StandKind][]=[
 [55.5,-30,20.5,7.5,'woodland'],[68,-33,23.5,8.5,'woodland'],[79.5,-37.5,22,7.5,'woodland'],[61.5,-16,20,8,'woodland'],[75.5,-17,23,8.5,'woodland'],[85,-25,21,6,'woodland'],
 [69,-2.5,19,6.5,'woodland'],[59,1.5,19,5.5,'birch'],[54.5,7,14,3.5,'woodland'],[74,6,18,5.5,'woodland'],
 [102,-17.5,25,10.5,'woodland'],[125,-16.5,20,7.5,'woodland'],[101.5,-58.5,10,3,'spruce'],[116,-52,10,3,'spruce'],[108.5,-36.5,11,3.5,'woodland'],
 [49.5,51.5,14,7.5,'woodland'],[53,66,16,8.5,'woodland'],[48.5,84.5,13,6,'woodland'],
];
/** Two small trees in the east meadow (aerial photograph), in site-plan units as treePositions: [x, z, radius, height]. */
export const MEADOW_TREES:[number,number,number,number][]=[[1455,554,2,5],[1508,803,2,5]];
export const treePositions = [
 [473,294,2.8],[480,363,2.3],[421,426,2],[524,458,1.7],[613,329,2.8],[619,442,2.6],[740,310,2.8],[708,500,2.5],
 [1081,361,2.8],[1166,406,1.4],[1201,386,1.6],[1020,578,2],[1185,617,3],[1009,729,3.1],[667,713,2.2],
 [690,858,2.7],[747,881,2],[793,895,2],[841,904,1.8],[931,918,1.4],[967,905,1.5],[992,929,1.4],[1045,934,1.4],
 [579,878,1.7],[357,846,1.4],[308,839,1.3],[256,833,1.3],[246,690,3.9]
] as const;
export const viewpoints = {
 courtyard:{label:'Courtyard',position:[24,25,44],target:[-10,1,9],span:36},
 east:{label:'East garden',position:[48,20,21],target:[-1,2,1],span:41},
 arrival:{label:'Arrival',position:[-47,24,-35],target:[-14,1,0],span:48},
 estate:{label:'Whole lot',position:[65,62,89],target:[8,0,8],span:115},
 garden:{label:'By the garden',position:[24,4.5,15],target:[0,2.5,0],span:19},
 poolside:{label:'By the pool',position:[-5,4,25],target:[-17,2,10],span:22},
 top:{label:'Plan view',position:[-5,85,6.01],target:[-5,0,6],span:45},
 // Low over the far verge of the road, between two avenue trees, the arrival wall in front; `reach` keeps narrow screens
 // this close, clear of the trees beyond.
 wall:{label:'Arrival wall',position:[-45,2.8,2.5],target:[-34.4,1.2,-1],span:8,reach:16}
} as const;
export type Viewpoint = keyof typeof viewpoints;
export type Level = 'exterior'|'ground'|'upper'|'basement';
export type Region = 'main'|'guest'|'courtyard'|'pool'|'kitchen'|'grounds';
export const regions:Record<Region,{title:string;detail:string;source:string;renovation?:string}>= {
 main:{title:'The main house',detail:'Kitchen, bedroom, bath, dining and family room below a long pitched roof. Explore the ground floor, upper floor or basement.',source:'ground-floor.png',renovation:'east'},
 guest:{title:'The guest & wellness wing',detail:'The angled second wing holds the garage, wellness rooms and upstairs guest spaces. Its connection to the main house encloses the courtyard.',source:'ground-floor.png'},
 courtyard:{title:'The sheltered courtyard',detail:'Two covered bays form the courtyard edge, with the existing outdoor fireplace in the west wing and the pool beyond.',source:'grounds.png',renovation:'courtyard'},
 pool:{title:'The pool',detail:'The exposé labels the pool approximately 16 × 4 m. The steps and position follow the source plans.',source:'ground-floor.png'},
 kitchen:{title:'Kitchen & west terrace',detail:'The existing kitchen and terrace sit northwest of the entrance connection. The renovation brief develops the confirmed west-and-north extension.',source:'ground-floor.png',renovation:'kitchen'},
 grounds:{title:'The whole property',detail:'The lot boundary, drive, fountain and principal planting positions are traced from the exposé overview. The model uses level ground; surveyed contours and exact tree heights are unavailable.',source:'grounds.png'}
};
export const sourceNotes = [
 'Footprints, room relationships, pool and lot outline: traced from the exposé ground, upper, basement and grounds plans.',
 'Main-house plan calibration: approximately 12 × 19.3 m. Pool: approximately 16 × 4 m, using the dimensions printed in the exposé.',
 'The upper-floor spread is registered 52 trace pixels west to align its stair and chimney axes with the ground-floor spread. The guest roof outline includes the courtyard loggia.',
 'Photo checks: two separate timber garage doors; three lower guest-gable windows and the wide upper window; main chimney-gable windows; entrance glazing; staggered east roof windows. Frames and dimensions remain approximate.',
 'Existing roadside wall: cream render, dark plinth and coping, pedestrian gate, solid service doors and barred driveway gate. Gate positions follow the plan; heights are estimated from IMG_1625/1627.',
 'Interior photo review covers the 201 original library images. Furnishings are based on the photographed existing state, with room-by-room references available in each cutaway. Small loose items are simplified.',
 'Owner-confirmed corrections: mirrored north bedrooms, kitchen sliding door and terrace table, open dining/sitting-room connection, clear entrance walkway, shorter corridor storage, guest stair atrium and yoga-to-wellness door.',
 'Roof heights and joinery are approximate. The guest roof footprint follows the registered eave outline, including the covered loggia.',
 'Meadow islands, mown routes, sparse wildflowers and ornamental grass drifts are photo-led interpretations. Plant species and exact bed edges have not been surveyed.',
 'The detailed view uses the same geometry. Cladding, roof slates, oak, limestone, lawn, linen and plaster are generated tileable textures matched to the average colour of the owner’s photographs; Extreme uses photo-scanned textures from Poly Haven and ambientCG (CC0) instead, scaled to the same average colours, with scanned bark on the trees. Trees have modelled leaves on computers and leafy solid crowns on phones. It is not a measured or scanned reconstruction.',
 'Terrain is shown level. Trees are simplified, with indicative heights and canopies. The boundary is a plan tracing, not a cadastral survey.',
 'Renovations are independently switchable spatial concepts, using the selected portal briefs. The kitchen follows the confirmed A+B+C outline with one uniform plan registration. New roof form, supports, terrace extent and boundary height are illustrative and need an architect’s measured design. Cutaway walls are lowered to make rooms readable.'
];

export const photoChecks = [
 {file:'IMG_1627.jpg',label:'Existing roadside wall & gates'},
 {file:'DC2E6390-D8F3-4212-A5DB-8EB9AE083A93_1_105_c.jpg',label:'Two timber garage doors'},
 {file:'F92D9025-5B99-4FAF-9BAE-ECC47E3D555A_1_105_c.jpg',label:'Guest gable & entrance glazing'},
 {file:'9C75DDCD-4380-4B8B-A1FD-F1CD30EE9836_1_105_c.jpg',label:'Windows beside the chimney'},
 {file:'IMG_1403.jpg',label:'East façade & roof windows'},
 {file:'D49F9E4C-E7C1-48A1-8F18-B41D1EB45792_1_105_c.jpg',label:'Meadow beside the mown lawn'},
 {file:'7DEB0B61-9B56-4D64-87F0-E9750E13ACD8_1_105_c.jpg',label:'Tall grasses & scattered flowers'},
];
