/**
 * Kit sampler: synthetic learning-curve data that exercises every part of the
 * kit — scenario tweens on bars, a line, and an axis; a headline ticker; the
 * hover and focus emphasis layer; a crossfaded annotation; the numbers table.
 */
import { useState } from 'react';

import {
  AxisX, AxisY, Bars, Crossfade, Figure, Line, Rules, Segmented, Texts, c, d3,
  type Bar, type Label, type RenderMode,
} from '../src/index.ts';

type Scenario = 'base' | 'fast';
const RATE: Record<Scenario, number> = { base: 0.9, fast: 0.8 };
const units = d3.range(1, 9);
const cost = (s: Scenario, n: number) => 100 * n ** Math.log2(RATE[s]);
const usd = (v: number) => `$${Math.round(v)}`;

export function Sampler({ mode, scenario = 'base' }: { mode?: RenderMode; scenario?: Scenario }) {
  const [s, setS] = useState<Scenario>(scenario);
  const last = cost(s, 8);
  return (
    <Figure
      id="kit-sampler"
      mode={mode}
      headline={['Unit 8 costs ', { value: last, format: usd, from: 100 }, ' against $100 for unit 1']}
      dek={`Illustrative unit cost by build number on a ${Math.round((1 - RATE[s]) * 100)}% learning curve, dollars per unit.`}
      takeaways={{
        look: `Unit 8 against unit 1: ${usd(last)} against $100.`,
        learn: `Each doubling of builds cuts unit cost by ${Math.round((1 - RATE[s]) * 100)}% on this curve.`,
        scrutinize: 'The learning rate is an input, not a measurement: every bar holds only if that rate holds.',
      }}
      note="Synthetic data. Hover or tab to a bar for its value; the line is the running average."
      label="Bar chart of unit cost for builds 1 through 8, falling along a learning curve, with the running average as a line."
      controls={<Segmented label="Learning rate" value={s} onChange={setS} options={[{ id: 'base', label: '10% per doubling' }, { id: 'fast', label: '20% per doubling' }]} />}
      keyItems={[{ label: 'Unit cost', color: c('series1') }, { label: 'Running average', color: c('series2'), shape: 'line' }]}
      data={{ columns: ['Unit', 'Cost ($)', 'Running average ($)'], rows: units.map((n) => [n, Math.round(cost(s, n)), Math.round(d3.sum(units.slice(0, n), (k) => cost(s, k)) / n)]) }}
      height={280}
    >
      {({ width, height }) => {
        const m = { l: 40, r: 16, t: 12, b: 30 };
        const x = d3.scaleBand<number>().domain(units).range([m.l, width - m.r]).padding(0.28);
        const yMax = s === 'base' ? 100 : 100;
        const y = d3.scaleLinear().domain([0, yMax]).nice().range([height - m.b, m.t]);
        const bars: Bar[] = units.map((n) => ({
          id: `u${n}`,
          x: x(n)!, y: y(cost(s, n)), w: x.bandwidth(), h: y(0) - y(cost(s, n)),
          fill: c('series1'), rx: 2,
          label: `Unit ${n}: ${usd(cost(s, n))}`,
          tip: { title: `Unit ${n}`, rows: [['Cost', usd(cost(s, n))], ['Versus unit 1', `${n === 1 ? '0' : `−${Math.round((1 - cost(s, n) / 100) * 100)}`}%`]] },
          keys: [`u${n}`],
        }));
        const avg = units.map((n) => [x(n)! + x.bandwidth() / 2, y(d3.sum(units.slice(0, n), (k) => cost(s, k)) / n)] as const);
        const values: Label[] = units.map((n) => ({
          id: `v${n}`, x: x(n)! + x.bandwidth() / 2, y: y(cost(s, n)) - 9, text: usd(cost(s, n)), value: cost(s, n), format: usd,
          anchor: 'middle', size: 12, fill: c('ink2'), keys: [`u${n}`], halo: c('halo'),
        }));
        return (
          <>
            <AxisY scale={y} ticks={y.ticks(4)} format={(v) => `$${v}`} at={m.l} grid={{ to: width - m.r }} />
            <Rules data={[{ id: 'base', x1: m.l, x2: width - m.r, y1: y(0), y2: y(0), stroke: c('slate'), opacity: 0.6 }]} />
            <Bars data={bars} grow="up" />
            <Line spec={{ id: 'avg', points: avg as Array<readonly [number, number]>, stroke: c('series2'), width: 2.25 }} />
            <Texts data={values} />
            <AxisX scale={(n) => x(n)! + x.bandwidth() / 2} ticks={units} format={(n) => `#${n}`} at={height - m.b} />
            <Crossfade view={s}>
              <text x={width - m.r} y={m.t + 18} textAnchor="end" fontSize={12} fill={c('slate')} stroke={c('halo')} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                {`Unit 8 is ${Math.round(last)}% of unit 1`}
              </text>
            </Crossfade>
          </>
        );
      }}
    </Figure>
  );
}

export const figures = { 'kit-sampler': { component: Sampler, states: [{ scenario: 'fast' as const }] } };
