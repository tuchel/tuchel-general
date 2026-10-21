/**
 * The public build's stand-in for licensed.ts: J.P. Morgan targets as reported in
 * the press, and no figures that only the banks' client research carries.
 */
import type { Source, TargetPoint } from './data.ts';

const jpmInit: Source = { label: 'Traders Union, J.P. Morgan starts coverage at $225 for December 2027, Jul 7, 2026', url: 'https://tradersunion.com/news/market-voices/show/2603037-jp-morgan-spacex-target/' };
const jpmQ3: Source = { label: 'Investing.com, J.P. Morgan raises SpaceX target to $500 from $240, Oct 21, 2026', url: 'https://www.investing.com/news/analyst-ratings/jpmorgan-raises-spacex-stock-price-target-to-500-on-growth-outlook-93CH-4962780' };

export const RESEARCH: {
  sources: Source[];
  jpm: TargetPoint[];
  ms: TargetPoint[];
  fy26: Array<{ firm: string; revenue: number; source: Source }>;
} = {
  sources: [],
  jpm: [
    { date: '2026-07-07', target: 225, source: jpmInit, horizon: '2027-12-31' },
    { date: '2026-10-20', target: 240, source: jpmQ3 },
    { date: '2026-10-21', target: 500, source: jpmQ3 },
  ],
  ms: [],
  fy26: [],
};
