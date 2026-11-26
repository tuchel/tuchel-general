/**
 * The Tuchel Indicator: a one-line reading that opens onto its evidence.
 *
 * The figure has two panels on one 0–100 scale. The map plots execution credit against market
 * mood, one dot per trading day joined in order, with the score's bands as diagonals. The
 * history draws credit, mood, and their mean over time. A day lights in both panels at once.
 */
import {
  AxisX, AxisY, Dots, Figure, Line, Rules, Texts, c, d3, labelBox,
  type Dot, type Label, type RenderMode, type Rule, type Tip,
} from '../../../../shared/charts/src/index.ts';
import { BANDS, HORIZON, LATEST, READINGS, RECORD, WARMUP, moodName, type Reading } from './tuchel.ts';
import { MARKET_SRC, SHARES } from './sentiment.ts';

const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const day = (iso: string) => new Date(t(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const usd = (v: number) => `$${v.toFixed(2)}`;
const n0 = (v: number) => String(Math.round(v));
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;

const first = READINGS[0];
const high = READINGS.reduce((a, r) => (r.score > a.score ? r : a));
const side = (r: Reading) => (r.verdict.id.endsWith('buy') ? 'buy' : r.verdict.id.endsWith('sell') ? 'sell' : 'hold');
// The run of days, ending today, on the same side of the gauge.
const runStart = READINGS[READINGS.length - 1 - [...READINGS].reverse().findIndex((r) => side(r) !== side(LATEST)) + 1] ?? first;
const low = RECORD[0];
const sells = READINGS.filter((r) => side(r) === 'sell' && r.forward !== undefined);
const sellMean = sells.length ? sells.reduce((a, r) => a + r.forward!, 0) / sells.length : undefined;

function tip(r: Reading): Tip {
  const rows: Array<[string, string]> = [
    ['Reading', `${r.verdict.label}, ${n0(r.score)}`],
    ['Execution credit', n0(r.credit)],
    ['Market mood', `${n0(r.mood)}, ${moodName(r.mood)}`],
    ['Close', usd(r.close)],
  ];
  if (r.forward !== undefined) rows.push([`${HORIZON} trading days later`, pct(r.forward)]);
  return { title: `${day(r.date)}, 2026`, rows };
}

type Box = { x0: number; x1: number; y0: number; y1: number };
const boxOf = (l: Label): Box => {
  const b = labelBox(l.text, { size: l.size ?? 12, weight: l.weight });
  const x0 = l.anchor === 'end' ? l.x - b.width : l.anchor === 'middle' ? l.x - b.width / 2 : l.x;
  return { x0, x1: x0 + b.width, y0: l.y - b.height, y1: l.y + 3 };
};
const hits = (a: Box, b: Box) => a.x0 < b.x1 + 4 && b.x0 < a.x1 + 4 && a.y0 < b.y1 + 2 && b.y0 < a.y1 + 2;

export function TuchelIndicator({ mode }: { mode?: RenderMode }) {
  return (
    <Figure
      id="tuchel-indicator"
      mode={mode}
      headline={[
        'The Tuchel Indicator reads ', { value: LATEST.score, format: n0, from: 50 },
        `, ${LATEST.verdict.label.toLowerCase()}: execution credit `, { value: LATEST.credit, format: n0, from: 50 },
        ', market mood ', { value: LATEST.mood, format: n0, from: 50 },
      ]}
      dek={`Execution credit is how richly SPCX is priced against analyst targets, the Nasdaq-100, and its sales, as a percentile of every day since the IPO. Market mood is the CNN Fear & Greed Index. Both run 0 to 100; the score is their mean. Daily, ${day(first.date)} to ${day(LATEST.date)}, 2026.`}
      takeaways={{
        look: `The filled dot on the map, ${day(LATEST.date)}: credit ${n0(LATEST.credit)} and mood ${n0(LATEST.mood)}, against ${n0(high.credit)} and ${n0(high.mood)} on ${day(high.date)}, the highest score so far at ${n0(high.score)}.`,
        learn: low.mean !== undefined && sellMean !== undefined
          ? `Scores under 25 were followed by a mean ${pct(low.mean)} move in the close over ${HORIZON} trading days (${low.complete} days); the ${sells.length} scores above 55 by ${pct(sellMean)}.`
          : `The score has ranged from ${n0(Math.min(...READINGS.map((r) => r.score)))} to ${n0(high.score)} over ${READINGS.length} trading days.`,
        scrutinize: `${READINGS.length} trading days hold one low and one high, and the ${HORIZON}-day windows overlap; the gauge has read ${side(LATEST)} since ${day(runStart.date)}, while the close went from ${usd(runStart.close)} to ${usd(LATEST.close)}.`,
      }}
      note={`Not investment advice. Each percentile uses only the days up to that reading, so past readings never change; the first is trading day ${WARMUP + 1}. Bands are CNN's for its index, applied to the score.`}
      keyItems={[
        { label: 'Score', color: c('ink'), shape: 'line' },
        { label: 'Execution credit', color: c('series1'), shape: 'line' },
        { label: 'Market mood', color: c('series2'), shape: 'line' },
      ]}
      label={`Two panels. A map of execution credit against market mood with one dot per trading day from ${day(first.date)} to ${day(LATEST.date)}, 2026, and the same two measures and their mean over time. The latest score is ${n0(LATEST.score)}, ${LATEST.verdict.label.toLowerCase()}.`}
      data={{
        caption: 'Daily readings',
        columns: ['Date', 'Close ($)', 'Execution credit', 'Market mood', 'Score', 'Reading', `Close ${HORIZON} trading days later`],
        rows: [...READINGS].reverse().map((r) => [day(r.date), r.close.toFixed(2), n0(r.credit), r.mood.toFixed(1), n0(r.score), r.verdict.label, r.forward === undefined ? '—' : pct(r.forward)]),
      }}
      height={(w) => (w < 700 ? Math.min(w - 48, 340) + 66 + 238 : 372)}
    >
      {({ width, height }) => {
        const wide = width >= 700;
        const mt = 26;
        const mb = 40;
        const ml = 30;
        const size = wide ? height - mt - mb : Math.min(width - 48, 340);
        // Map: a square, credit across and mood up.
        const mx = d3.scaleLinear().domain([0, 100]).range([ml, ml + size]);
        const my = d3.scaleLinear().domain([0, 100]).range([mt + size, mt]);
        // History: beside the map when there is room, under it otherwise.
        const hr = 78;
        const hx0 = wide ? ml + size + 64 : ml;
        const hTop = wide ? mt : mt + size + mb + 26;
        const hBot = wide ? mt + size : height - 30;
        const hx = d3.scaleLinear().domain([t(first.date), t(LATEST.date)]).range([hx0, width - hr]);
        const hy = d3.scaleLinear().domain([0, 100]).range([hBot, hTop]);

        const edges = BANDS.slice(1).map((b) => b.from);
        const diagonals: Rule[] = edges.map((s) => {
          const sum = 2 * s;
          const [a, b] = sum <= 100 ? [[0, sum], [sum, 0]] : [[sum - 100, 100], [100, sum - 100]];
          return { id: `diag${s}`, x1: mx(a[0]), y1: my(a[1]), x2: mx(b[0]), y2: my(b[1]), stroke: c('slate'), dash: '2 3', opacity: 0.55 };
        });
        const frame: Rule[] = [
          { id: 'mx', x1: mx(0), x2: mx(100), y1: my(0), y2: my(0), stroke: c('slate'), opacity: 0.6 },
          { id: 'my', x1: mx(0), x2: mx(0), y1: my(0), y2: my(100), stroke: c('slate'), opacity: 0.6 },
          { id: 'hx', x1: hx0, x2: width - hr, y1: hy(0), y2: hy(0), stroke: c('slate'), opacity: 0.6 },
        ];
        // Band names sit in the map's lower right, where low mood meets high credit and days are rare.
        const zoneAt: Array<[number, number, 'middle' | 'end']> = [[27, 4, 'middle'], [66, 4, 'middle'], [98, 4, 'end'], [98, 31, 'end'], [98, 78, 'end']];
        const zones: Label[] = BANDS.map((b, i) => ({
          id: `zone-${b.id}`, x: mx(zoneAt[i][0]), y: my(zoneAt[i][1]), text: b.label, anchor: zoneAt[i][2], size: 11.5,
          weight: b.id === LATEST.verdict.id ? 600 : 400, fill: b.id === LATEST.verdict.id ? c('ink') : c('slate'), halo: c('halo'),
        }));

        const path = READINGS.map((r) => [mx(r.credit), my(r.mood)] as const);
        const dots: Dot[] = READINGS.map((r, i) => {
          const latest = r === LATEST;
          return {
            id: `m${i}`, cx: path[i][0], cy: path[i][1], r: latest ? 5 : r === high ? 3.5 : 2,
            fill: latest ? c('signal') : c('ink'), fillOpacity: latest || r === high ? 1 : 0.45, stroke: latest || r === high ? c('halo') : undefined, strokeWidth: 1.5, hit: 7,
            label: `${day(r.date)}: ${r.verdict.label}, score ${n0(r.score)}, credit ${n0(r.credit)}, mood ${n0(r.mood)}`, tip: tip(r), keys: [`d${i}`],
          };
        });
        // The latest day and the highest score are named; each label takes the first seat clear of the others.
        const placed: Box[] = zones.map(boxOf);
        const named: Label[] = [];
        for (const r of high === LATEST ? [LATEST] : [LATEST, high]) {
          const [px, py] = [mx(r.credit), my(r.mood)];
          const base = { id: `name-${r.date}`, text: day(r.date), size: 12, weight: 600, fill: r === LATEST ? c('signal') : c('ink'), halo: c('halo') };
          const seats: Label[] = [
            { ...base, x: px + 9, y: py + 4, anchor: 'start' }, { ...base, x: px, y: py - 10, anchor: 'middle' },
            { ...base, x: px - 9, y: py + 4, anchor: 'end' }, { ...base, x: px, y: py + 19, anchor: 'middle' },
          ];
          const seat = seats.find((s) => {
            const b = boxOf(s);
            return b.x0 >= mx(0) + 2 && b.x1 <= mx(100) && b.y0 >= my(100) && b.y1 <= my(0) - 2 && !placed.some((o) => hits(b, o));
          });
          if (seat) { named.push(seat); placed.push(boxOf(seat)); }
        }
        const titles: Label[] = [
          { id: 't-mood', x: 0, y: mt - 12, text: 'Market mood', anchor: 'start', size: 11.5, weight: 600, fill: c('series2') },
          { id: 't-credit', x: mx(100), y: my(0) + 34, text: 'Execution credit', anchor: 'end', size: 11.5, weight: 600, fill: c('series1') },
          { id: 't-hist', x: hx0, y: hTop - 12, text: 'Since July', anchor: 'start', size: 11.5, weight: 600, fill: c('ink') },
        ];

        const series = (id: string, f: (r: Reading) => number, stroke: string, w: number) => (
          <Line spec={{ id, points: READINGS.map((r) => [hx(t(r.date)), hy(f(r))] as const), stroke, width: w }} />
        );
        const bandNames: Label[] = BANDS.map((b) => ({
          id: `band-${b.id}`, x: width - hr + 8, y: hy((b.from + b.to) / 2), baseline: 'middle', text: b.label, anchor: 'start', size: 11.5,
          weight: b.id === LATEST.verdict.id ? 600 : 400, fill: b.id === LATEST.verdict.id ? c('ink') : c('slate'),
        }));
        const scrub: Dot[] = READINGS.map((r, i) => ({
          id: `h${i}`, cx: hx(t(r.date)), cy: hy(r.score), r: 3.5, fill: c('ink'), stroke: c('halo'), strokeWidth: 2, hit: 9,
          label: `${day(r.date)}: score ${n0(r.score)}`, tip: tip(r), keys: [`d${i}`],
        }));
        const months = d3.range(0, 12).map((m) => Date.UTC(2026, m, 1)).filter((v) => v >= t(first.date) && v <= t(LATEST.date));
        const quarter = [0, 25, 50, 75, 100];

        return (
          <>
            <AxisY scale={my} ticks={quarter} format={n0} at={mx(0)} grid={{ to: mx(100) }} unit="mood" />
            <AxisX scale={mx} ticks={quarter} format={n0} at={my(0)} unit="credit" />
            <AxisY scale={hy} ticks={[0, ...edges, 100]} format={n0} at={hx0} grid={{ to: width - hr }} unit="score" />
            <AxisX scale={hx} ticks={months} format={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} at={hy(0)} unit="time" />
            <Rules data={[...frame, ...diagonals]} />
            <Line spec={{ id: 'path', points: path, stroke: c('slate'), width: 1 }} />
            <Texts data={[...zones, ...titles, ...bandNames]} />
            {series('credit', (r) => r.credit, c('series1'), 1.25)}
            {series('mood', (r) => r.mood, c('series2'), 1.25)}
            {series('score', (r) => r.score, c('ink'), 2)}
            <Dots data={dots} className="ti-days" />
            <Texts data={named} />
            <Dots data={scrub} className="spcx-days" />
          </>
        );
      }}
    </Figure>
  );
}

const fix = (v: number, d: number) => v.toFixed(d);

/** The always-visible reading; opening it shows the figure, the parts, and the record. */
export function TuchelPanel() {
  const r = LATEST;
  const s = side(r);
  const parts: Array<[string, string, string]> = [
    ['Price ÷ median analyst target', `${fix(r.target.value, 2)} (${usd(r.close)} against $${r.target.median}, ${r.target.firms} firms)`, n0(r.target.rank)],
    ['SPCX ÷ Nasdaq-100', 'ratio of the two closes', n0(r.relative.rank)],
    ['Run-rate sales multiple', `${fix(r.sales.value, 1)}× (market value ÷ four times ${r.sales.quarter} revenue)`, n0(r.sales.rank)],
  ];
  return (
    <details className="ti">
      <summary>
        <span className="ti-name">Tuchel Indicator</span>
        <span className="ti-read" data-side={s}>
          <span className="ti-verdict">{r.verdict.label}</span>
          <span className="ti-score">{n0(r.score)}</span>
        </span>
        <span className="ti-gauge" role="img" aria-label={`Score ${n0(r.score)} on a scale from 0, strong buy, to 100, strong sell`}>
          <span className="ti-track">
            {BANDS.map((b) => <span key={b.id} style={{ flexGrow: b.to - b.from }} data-on={b.id === r.verdict.id ? s : undefined} />)}
            <span className="ti-pin" style={{ left: `${r.score}%` }} />
          </span>
          <span className="ti-ends"><span>Buy</span><span>Hold</span><span>Sell</span></span>
        </span>
        <span className="ti-axes">
          Execution credit <b>{n0(r.credit)}</b> · Market mood <b>{n0(r.mood)}</b>, {moodName(r.mood)} · {day(r.date)} close
        </span>
      </summary>
      <div className="ti-body">
        <TuchelIndicator />

        <h3 className="ti-h">What is in the reading</h3>
        <table className="cov ti-table">
          <thead><tr><th scope="col">Part</th><th scope="col">Value on {day(r.date)}</th><th scope="col">Percentile since IPO</th></tr></thead>
          <tbody>
            {parts.map(([name, value, rank]) => <tr key={name}><th scope="row">{name}</th><td>{value}</td><td>{rank}</td></tr>)}
            <tr className="ti-sum"><th scope="row">Execution credit</th><td>mean of the three percentiles</td><td>{n0(r.credit)}</td></tr>
            <tr><th scope="row">Market mood</th><td>CNN Fear &amp; Greed Index, {moodName(r.mood)}; VIX {fix(r.vix, 2)}</td><td>{fix(r.mood, 1)}</td></tr>
            <tr className="ti-sum"><th scope="row">Score</th><td>mean of credit and mood</td><td>{n0(r.score)}</td></tr>
          </tbody>
        </table>

        <h3 className="ti-h">What followed each reading</h3>
        <table className="cov ti-table">
          <thead><tr><th scope="col">Reading</th><th scope="col">Score</th><th scope="col">Days</th><th scope="col">Mean move, next {HORIZON} trading days</th><th scope="col">Rose</th></tr></thead>
          <tbody>
            {RECORD.map((b) => (
              <tr key={b.id}>
                <th scope="row">{b.label}</th>
                <td>{b.from}–{b.to}</td>
                <td>{b.days}</td>
                <td>{b.mean === undefined ? '—' : `${pct(b.mean)} (${b.complete} days)`}</td>
                <td>{b.complete ? `${b.rose} of ${b.complete}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="more-note">
          {READINGS.length} trading days is a short record: it holds one low and one high, and neighbouring {HORIZON}-day windows share most of their days, so the day counts overstate the evidence. The run-rate multiple uses {fix(SHARES.count / 1e9, 2)} billion shares ({MARKET_SRC.shares.label.split(',')[0]}, {day(SHARES.asOf)}); the VIX is shown for context and is not in the score.
        </p>
      </div>
    </details>
  );
}
