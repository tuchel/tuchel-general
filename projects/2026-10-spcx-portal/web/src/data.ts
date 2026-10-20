/**
 * SPCX source data. Every figure carries the URL it came from; derived numbers
 * say how they were derived. See ../../notes/sources.md for the trail.
 */

export type Source = { label: string; url: string };

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
`;

export type Close = { date: string; close: number };
export const PRICES: Close[] = CLOSES.trim().split('\n').map((l) => {
  const [date, close] = l.split(' ');
  return { date, close: Number(close) };
});

export type Coverage = { firm: string; rating: string; target: number; source: Source };

/** Initiations of July 7, 2026, as reported. Full research notes are behind each bank's client portal. */
export const COVERAGE: Coverage[] = [
  { firm: 'Morgan Stanley', rating: 'Overweight', target: 300, source: SRC.coverageMs },
  { firm: 'Deutsche Bank', rating: 'Buy', target: 255, source: SRC.coverage },
  { firm: 'Macquarie', rating: 'Outperform', target: 250, source: SRC.coverage },
  { firm: 'Bernstein', rating: 'Outperform', target: 239, source: SRC.coverage },
  { firm: 'Bank of America', rating: 'Buy', target: 235, source: SRC.coverage },
  { firm: 'Wells Fargo', rating: 'Overweight', target: 230, source: SRC.coverageMs },
  { firm: 'JPMorgan', rating: 'Overweight', target: 225, source: SRC.coverage },
  { firm: 'RBC Capital Markets', rating: 'Outperform', target: 225, source: SRC.coverage },
  { firm: 'UBS', rating: 'Buy', target: 210, source: SRC.coverage },
  { firm: 'Goldman Sachs', rating: 'Buy', target: 205, source: SRC.coverage },
  { firm: 'Mizuho', rating: 'Outperform', target: 200, source: SRC.coverage },
];

export const CONSENSUS = { analysts: 38, rating: 'Buy', target: 222.71, asOf: '2026-10-20', source: SRC.consensus };
