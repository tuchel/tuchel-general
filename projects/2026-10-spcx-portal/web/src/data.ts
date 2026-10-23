/**
 * SPCX source data. Every figure carries the URL it came from; derived numbers
 * say how they were derived. See ../../notes/sources.md for the trail.
 */

import { RESEARCH } from './licensed.ts';

/** `url` is absent for research distributed to a bank's clients rather than published. */
export type Source = { label: string; url?: string };

export const SRC = {
  q2: { label: 'SpaceX Q2 2026 earnings release (8-K exhibit)', url: 'https://www.sec.gov/Archives/edgar/data/0001181412/000162828026052515/earningsreleaseq22608042.htm' },
  s1: { label: 'SpaceX Form S-1', url: 'https://www.sec.gov/Archives/edgar/data/1181412/000162828026036936/spaceexplorationtechnologi.htm' },
  q3: { label: 'SpaceX Q3 2026 earnings release', url: 'https://ir.spacex.com/financials/default.aspx' },
  prices: { label: 'Yahoo Finance, SPCX historical prices', url: 'https://finance.yahoo.com/quote/SPCX/history/' },
  pricesRecent: { label: 'StockAnalysis, SPCX price history', url: 'https://stockanalysis.com/stocks/spcx/history/' },
  ipo: { label: 'NBC News, SpaceX IPO pricing', url: 'https://www.nbcnews.com/business/business-news/spacex-ipo-trading-price-rcna349225' },
  coverage: { label: 'Yahoo Finance, initiations of July 7, 2026', url: 'https://finance.yahoo.com/markets/stocks/article/spacex-stock-drops-below-ipo-opening-price-despite-flood-of-bullish-wall-street-ratings-153809443.html' },
  coverageMs: { label: 'Yahoo Finance, Morgan Stanley and Wells Fargo initiations', url: 'https://finance.yahoo.com/markets/stocks/article/spacex-snags-street-high-300-price-target-from-morgan-stanley-as-rocket-company-enters-nasdaq-100-160316317.html' },
  consensus: { label: 'StockAnalysis, analyst consensus', url: 'https://stockanalysis.com/stocks/spcx/' },
  q3Moves: { label: 'Before It\'s News, post-Q3 target changes, Oct 21, 2026', url: 'https://beforeitsnews.com/motor-junkies/2026/10/spacex-stock-gets-a-slew-of-price-target-boosts-after-bullish-earnings-call-2633454.html' },
  q3MovesKucoin: { label: 'KuCoin News, Wall Street raises SpaceX targets, Oct 21, 2026', url: 'https://www.kucoin.com/news/flash/wall-street-raises-spacex-target-prices-after-q2-earnings-report' },
  gsQ3: { label: 'Investing.com, Goldman Sachs raises SpaceX target to $245, Oct 21, 2026', url: 'https://www.investing.com/news/analyst-ratings/goldman-sachs-raises-spacex-stock-price-target-to-245-on-growth-outlook-93CH-4962792' },
  cantorQ3: { label: 'GuruFocus, Cantor Fitzgerald raises SpaceX target to $345, Oct 21, 2026', url: 'https://www.gurufocus.com/news/9133705/spcx-maintained-by-cantor-fitzgerald-price-target-raised-to-345' },
  close1021: { label: 'StockAnalysis, SPCX quote, Oct 21, 2026 close', url: 'https://stockanalysis.com/stocks/spcx/' },
  bofaQ3: { label: 'Investing.com, BofA raises SpaceX target to $275, Oct 22, 2026', url: 'https://www.investing.com/news/analyst-ratings/bofa-raises-spacex-stock-price-target-to-275-on-launch-growth-93CH-4966106' },
  mbRatings: { label: 'MarketBeat, SPCX analyst ratings history', url: 'https://www.marketbeat.com/stocks/NASDAQ/SPCX/forecast/' },
  xai: { label: 'KraneShares, xAI–SpaceX merger complete, Feb 11, 2026', url: 'https://kraneshares.com/xai-spacex-merger-complete-spacex-ipo-timeline-intact-how-agix-fits-in/' },
  ipoTimeline: { label: 'Wikipedia, Initial public offering of SpaceX', url: 'https://en.wikipedia.org/wiki/Initial_public_offering_of_SpaceX' },
  cursor: { label: 'Gigazine, SpaceX officially completes acquisition of Cursor, Aug 16, 2026', url: 'https://gigazine.net/gsc_news/en/20260816-spacex-officially-closes-cursor-acquisition/' },
  ndx: { label: 'Nasdaq, SpaceX to join the Nasdaq-100 beginning Jul 7, 2026', url: 'https://ir.nasdaq.com/news-releases/news-release-details/space-exploration-technologies-corporation-join-nasdaq-100' },
  call: { label: 'The Motley Fool, SpaceX Q3 2026 earnings call transcript, Oct 20, 2026', url: 'https://www.fool.com/earnings/call-transcripts/2026/10/20/spacex-spcx-q3-2026-earnings-call-transcript/' },
} satisfies Record<string, Source>;

export type Quarter = {
  id: string;
  label: string;
  /** First and last calendar day of the quarter, ISO. */
  start: string;
  end: string;
  /** Results release date, ISO; released after the close. */
  released?: string;
  /** Revenue, $ millions. */
  revenue: number;
  /** Same quarter a year earlier, $ millions. */
  yearAgo?: number;
  /** Segment revenue, $ millions, largest first. */
  segments: Array<[string, number]>;
  /** How the figure follows from filed totals, when no filing states it directly. */
  derived?: string;
  source: Source;
};

// Super Intelligence (SI) is the segment SpaceX reported as Artificial Intelligence (AI) before Q3 2026.
export const QUARTERS: Quarter[] = [
  {
    id: 'q1-25', label: 'Q1 2025', start: '2025-01-01', end: '2025-03-31',
    revenue: 4067, segments: [['Connectivity', 2474], ['Space', 865], ['Super Intelligence', 728]],
    derived: 'Nine months to Sep 30, 2025 less Q2 and Q3 2025.', source: SRC.q3,
  },
  {
    id: 'q2-25', label: 'Q2 2025', start: '2025-04-01', end: '2025-06-30',
    revenue: 4071, segments: [['Connectivity', 2588], ['Space', 746], ['Super Intelligence', 737]],
    source: SRC.q2,
  },
  {
    id: 'q3-25', label: 'Q3 2025', start: '2025-07-01', end: '2025-09-30',
    revenue: 5576, segments: [['Connectivity', 3097], ['Space', 1666], ['Super Intelligence', 813]],
    source: SRC.q3,
  },
  {
    id: 'q4-25', label: 'Q4 2025', start: '2025-10-01', end: '2025-12-31',
    revenue: 4960, segments: [['Connectivity', 3228], ['Super Intelligence', 923], ['Space', 809]],
    derived: 'Full-year 2025 (Form S-1) less nine months to Sep 30, 2025 (Q3 2026 release).', source: SRC.s1,
  },
  {
    id: 'q1-26', label: 'Q1 2026', start: '2026-01-01', end: '2026-03-31',
    revenue: 4694, yearAgo: 4067, segments: [['Connectivity', 3257], ['Super Intelligence', 818], ['Space', 619]],
    source: SRC.s1,
  },
  {
    id: 'q2-26', label: 'Q2 2026', start: '2026-04-01', end: '2026-06-30', released: '2026-08-04',
    revenue: 7814, yearAgo: 4071, segments: [['Connectivity', 4291], ['Super Intelligence', 2561], ['Space', 962]],
    source: SRC.q2,
  },
  {
    id: 'q3-26', label: 'Q3 2026', start: '2026-07-01', end: '2026-09-30', released: '2026-10-20',
    revenue: 14575, yearAgo: 5576, segments: [['Super Intelligence', 7560], ['Connectivity', 5248], ['Space', 1767]],
    source: SRC.q3,
  },
];

/** Q3 2026 revenue from Cursor, acquired Aug 14, 2026 (Q3 2026 release). */
export const CURSOR_Q3 = 608;

export const IPO = { date: '2026-06-12', price: 135, source: SRC.ipo };

/** Key company and market events for the hero chart, oldest first. */
export type KeyEvent = { date: string; title: string; detail: string; source: Source };
export const EVENTS: KeyEvent[] = [
  { date: '2026-02-02', title: 'xAI combined with SpaceX', detail: 'Its AI business is reported as Super Intelligence from Q3 2026.', source: SRC.xai },
  { date: '2026-05-20', title: 'S-1 filed publicly', detail: 'The prospectus gave 2025 revenue of $18.7B.', source: SRC.ipoTimeline },
  { date: '2026-06-12', title: 'First trade on Nasdaq', detail: 'Priced at $135 the evening before.', source: SRC.ipo },
  { date: '2026-06-16', title: 'Cursor deal signed', detail: '$60B, all in SpaceX stock.', source: SRC.cursor },
  { date: '2026-07-07', title: 'Joins the Nasdaq-100', detail: 'The same day banks initiated coverage.', source: SRC.ndx },
  { date: '2026-08-04', title: 'Q2 2026 results', detail: 'First report as a public company.', source: SRC.q2 },
  { date: '2026-08-14', title: 'Cursor acquisition closes', detail: 'Adds $608M to Q3 2026 revenue.', source: SRC.cursor },
  { date: '2026-10-20', title: 'Q3 2026 results', detail: 'Q1 2027 revenue guided to $33–37B on the call.', source: SRC.q3 },
];

/** Daily closing price, USD. Jun 12–Oct 15 from Yahoo Finance; Oct 16–20 from StockAnalysis. */
const CLOSES = `
2026-06-12 160.95
2026-06-15 192.50
2026-06-16 211.39
2026-06-17 191.82
2026-06-18 185.00
2026-06-22 154.60
2026-06-23 156.11
2026-06-24 154.54
2026-06-25 153.00
2026-06-26 153.23
2026-06-29 164.19
2026-06-30 170.86
2026-07-01 157.54
2026-07-02 162.00
2026-07-06 160.42
2026-07-07 149.47
2026-07-08 148.30
2026-07-09 152.16
2026-07-10 145.30
2026-07-13 139.14
2026-07-14 136.08
2026-07-15 135.27
2026-07-16 131.11
2026-07-17 123.99
2026-07-20 119.85
2026-07-21 123.54
2026-07-22 115.26
2026-07-23 118.24
2026-07-24 115.07
2026-07-27 113.50
2026-07-28 116.41
2026-07-29 112.55
2026-07-30 112.20
2026-07-31 108.37
2026-08-03 114.53
2026-08-04 125.33
2026-08-05 108.27
2026-08-06 114.92
2026-08-07 133.11
2026-08-10 138.74
2026-08-11 133.29
2026-08-12 146.15
2026-08-13 141.29
2026-08-14 140.00
2026-08-17 146.23
2026-08-18 143.34
2026-08-19 139.65
2026-08-20 134.00
2026-08-21 136.97
2026-08-24 135.00
2026-08-25 137.95
2026-08-26 139.63
2026-08-27 140.87
2026-08-28 141.50
2026-08-31 143.69
2026-09-01 142.23
2026-09-02 140.71
2026-09-03 149.74
2026-09-04 147.95
2026-09-08 153.47
2026-09-09 147.55
2026-09-10 148.18
2026-09-11 151.21
2026-09-14 148.15
2026-09-15 143.49
2026-09-16 150.88
2026-09-17 154.81
2026-09-18 152.71
2026-09-21 151.85
2026-09-22 154.72
2026-09-23 148.36
2026-09-24 148.03
2026-09-25 148.68
2026-09-28 145.47
2026-09-29 149.24
2026-09-30 150.86
2026-10-01 148.07
2026-10-02 158.96
2026-10-05 171.09
2026-10-06 171.92
2026-10-07 167.60
2026-10-08 160.57
2026-10-09 162.57
2026-10-12 163.42
2026-10-13 156.54
2026-10-14 152.16
2026-10-15 148.62
2026-10-16 146.03
2026-10-19 147.96
2026-10-20 147.79
2026-10-21 159.31
2026-10-22 144.75
`;

/** `intraday` marks a price taken during the session, before the close. */
export type Close = { date: string; close: number; intraday?: string };
export const PRICES: Close[] = [
  ...CLOSES.trim().split('\n').map((l) => {
    const [date, close] = l.split(' ');
    return { date, close: Number(close) };
  }),
];

export type TargetPoint = {
  /** The date the target was reported as in force, ISO. */
  date: string;
  target: number;
  source: Source;
  /** When the target was set, if earlier than `date` (a target restated in a later report). */
  set?: string;
  /** The date the target is for, when the firm states it; otherwise 12 months after it was set. */
  horizon?: string;
};
export type Firm = { firm: string; rating: string; points: TargetPoint[] };

const pt = (date: string, target: number, source: Source, more: Pick<TargetPoint, 'set' | 'horizon'> = {}): TargetPoint => ({ date, target, source, ...more });

/**
 * Price targets by firm, oldest first. Oct 20 points are the "prior" targets that
 * post-Q3 reports give for each change, so they are in force before the report;
 * when each was set is not in the sources.
 */
export const FIRMS: Firm[] = [
  { firm: 'J.P. Morgan', rating: 'Overweight', points: RESEARCH.jpm },
  { firm: 'Morgan Stanley', rating: 'Overweight', points: [pt('2026-07-07', 300, SRC.coverageMs), ...RESEARCH.ms] },
  { firm: 'Cantor Fitzgerald', rating: 'Overweight', points: [pt('2026-10-20', 246, SRC.cantorQ3), pt('2026-10-21', 345, SRC.cantorQ3)] },
  { firm: 'Barclays', rating: 'Overweight', points: [pt('2026-10-20', 254, SRC.q3Moves), pt('2026-10-21', 300, SRC.q3Moves)] },
  { firm: 'Wells Fargo', rating: 'Overweight', points: [pt('2026-07-07', 230, SRC.coverageMs), pt('2026-10-20', 214, SRC.q3MovesKucoin), pt('2026-10-21', 274, SRC.q3MovesKucoin)] },
  { firm: 'Deutsche Bank', rating: 'Buy', points: [pt('2026-07-07', 255, SRC.coverage)] },
  { firm: 'Macquarie', rating: 'Outperform', points: [pt('2026-07-07', 250, SRC.coverage)] },
  { firm: 'Clear Street', rating: 'Not stated', points: [pt('2026-10-20', 217, SRC.q3Moves), pt('2026-10-21', 248, SRC.q3Moves)] },
  { firm: 'Goldman Sachs', rating: 'Buy', points: [pt('2026-07-07', 205, SRC.coverage), pt('2026-10-20', 230, SRC.gsQ3), pt('2026-10-21', 245, SRC.gsQ3)] },
  { firm: 'Citi', rating: 'Buy', points: [pt('2026-07-07', 200, SRC.coverageMs), pt('2026-10-20', 200, SRC.q3MovesKucoin), pt('2026-10-21', 240, SRC.q3MovesKucoin)] },
  { firm: 'Bernstein', rating: 'Outperform', points: [pt('2026-07-07', 239, SRC.coverage)] },
  { firm: 'Bank of America', rating: 'Buy', points: [pt('2026-07-07', 235, SRC.coverage), pt('2026-10-22', 275, SRC.bofaQ3)] },
  { firm: 'UBS', rating: 'Buy', points: [pt('2026-07-07', 210, SRC.coverage), pt('2026-10-20', 210, SRC.q3MovesKucoin), pt('2026-10-21', 230, SRC.q3MovesKucoin)] },
  { firm: 'RBC Capital Markets', rating: 'Outperform', points: [pt('2026-07-07', 225, SRC.coverage)] },
  { firm: 'TD Cowen', rating: 'Buy', points: [pt('2026-10-20', 200, SRC.q3Moves), pt('2026-10-21', 224, SRC.q3Moves)] },
  { firm: 'Mizuho', rating: 'Outperform', points: [pt('2026-07-07', 200, SRC.coverage), pt('2026-10-21', 205, SRC.gsQ3)] },
  { firm: 'Stifel', rating: 'Buy', points: [pt('2026-10-20', 190, SRC.gsQ3), pt('2026-10-21', 190, SRC.gsQ3)] },
  { firm: 'Pivotal Research', rating: 'Buy', points: [pt('2026-10-20', 230, SRC.mbRatings), pt('2026-10-21', 260, SRC.mbRatings)] },
  { firm: 'Needham', rating: 'Buy', points: [pt('2026-10-21', 250, SRC.mbRatings)] },
  { firm: 'Susquehanna', rating: 'Neutral', points: [pt('2026-10-20', 173, SRC.mbRatings), pt('2026-10-21', 176, SRC.mbRatings)] },
];

export type VintageId = 'jul7' | 'oct20' | 'oct21' | 'latest';
export type Vintage = { id: VintageId; date: string; label: string; name: string };

/** The most recent dated target point across all firms. */
const LAST_POINT = FIRMS.flatMap((f) => f.points.map((p) => p.date)).sort().at(-1)!;
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Dates at which the set of targets is known: initiations, the day before Q3 results,
 * the day after, and a rolling "latest" once any firm has moved since.
 */
export const VINTAGES: Vintage[] = [
  { id: 'jul7', date: '2026-07-07', label: 'Jul 7', name: 'Initiations' },
  { id: 'oct20', date: '2026-10-20', label: 'Oct 20', name: 'Before Q3 results' },
  { id: 'oct21', date: '2026-10-21', label: 'Oct 21', name: 'After Q3 results' },
  ...(LAST_POINT > '2026-10-21' ? [{ id: 'latest' as const, date: LAST_POINT, label: dayLabel(LAST_POINT), name: 'Latest' }] : []),
];
export const LATEST_VINTAGE = VINTAGES[VINTAGES.length - 1].id;

/** Reported revenue, nine months to Sep 30, 2026, $ millions (Q3 2026 release). */
export const NINE_MONTHS_2026 = 27_083;

/** Full-year 2026 revenue estimates, $ millions. Q4 is the estimate less the nine months reported. */
export const FY26_ESTIMATES = RESEARCH.fy26;

/** Bank research supplied by James; empty in the public build. */
export const NOTES = RESEARCH.sources;

/** Q1 2027 revenue guidance, $ millions: the CFO on the Oct 20, 2026 call. */
export const Q1_27_GUIDE = { low: 33_000, high: 37_000, source: SRC.call };

export const CONSENSUS = { analysts: 38, rating: 'Buy', target: 222.71, asOf: '2026-10-20', source: SRC.consensus };
