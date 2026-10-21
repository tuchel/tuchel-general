/**
 * Figures from bank research distributed to clients (J.P. Morgan, Morgan Stanley).
 * The public build swaps this module for licensed.public.ts, which carries only
 * press-reported equivalents, so none of this reaches the public site.
 */
import type { Source, TargetPoint } from './data.ts';

const jpm: Source = { label: 'J.P. Morgan (Doug Anmuth), SpaceX tearsheet, Oct 20, 2026' };
const ms: Source = { label: 'Morgan Stanley (Adam Jonas), "SPCX $159: Cheap and Getting Cheaper", Oct 4, 2026' };
const ms3q: Source = { label: 'Morgan Stanley (Adam Jonas), "3Q Results: Next Stop... MARS", Oct 21, 2026' };

export const RESEARCH: {
  sources: Source[];
  jpm: TargetPoint[];
  /** Morgan Stanley points after its Jul 7 initiation, which is press-reported. */
  ms: TargetPoint[];
  fy26: Array<{ firm: string; revenue: number; source: Source }>;
} = {
  sources: [jpm, ms, ms3q],
  jpm: [
    { date: '2026-07-07', target: 225, source: jpm, horizon: '2027-12-31' },
    { date: '2026-08-05', target: 240, source: jpm },
    { date: '2026-10-20', target: 240, source: jpm, set: '2026-08-05' },
    { date: '2026-10-21', target: 500, source: jpm, horizon: '2027-12-31' },
  ],
  ms: [
    { date: '2026-10-04', target: 300, source: ms },
    { date: '2026-10-21', target: 300, source: ms3q },
  ],
  fy26: [
    { firm: 'Morgan Stanley', revenue: 50_889, source: ms3q },
    { firm: 'J.P. Morgan', revenue: 51_057, source: jpm },
  ],
};
