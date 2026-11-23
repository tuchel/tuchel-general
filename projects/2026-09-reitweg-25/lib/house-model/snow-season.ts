/** Snow in deep winter, by day of the year like the trees' leaf (foliage.ts, SHED): it settles over `settle` (the 11th to
 * the 22nd of December), lies through January and melts over `melt` (the 13th to the 28th of February). */
export const SNOW_SEASON={settle:[345,356],melt:[44,59]};
const ramp=(v:number,[a,b]:number[])=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};
/** How much snow lies on `day`: 1 from late December to mid-February, 0 from March to early December. */
export const snowOn=(day:number)=>day>200?ramp(day,SNOW_SEASON.settle):1-ramp(day,SNOW_SEASON.melt);
