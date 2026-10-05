/**
 * Axes with keyed ticks. When the scale changes, surviving ticks slide to
 * their new place, entering ticks start where the old scale would have put
 * them, and leaving ticks fade toward the new scale — a rescale reads as a
 * rescale, not a redraw. Default ticks are nice numbers; label an extent only
 * when it carries meaning.
 */
import { useEffect, useRef } from 'react';

import { timingFor, useFigure } from '../figure/context.ts';
import { useKeyedTween } from '../motion/tween.ts';
import { c, TYPE } from '../tokens.ts';

type Scale = (v: number) => number;
type Tick = { v: number; p: number; o: number; label: string };

function useTicks(scale: Scale, values: number[], format: (v: number) => string, prefix = '') {
  const ctx = useFigure();
  const prev = useRef<Scale | null>(null);
  const timing = timingFor(ctx, { stagger: false });
  const items: Tick[] = values.map((v) => ({ v, p: scale(v), o: ctx.revealed ? 1 : 0, label: format(v) }));
  const vals = useKeyedTween(items, {
    key: (t) => `${prefix}${t.v}`,
    timing: (phase, _d, i) => timing(phase, null, i),
    enter: (t) => {
      const from = prev.current ? prev.current(t.v) : t.p;
      return { v: t.v, p: Number.isFinite(from) ? from : t.p, o: 0, label: t.label };
    },
    exit: (t) => ({ v: t.v, p: Number.isFinite(scale(t.v)) ? scale(t.v) : t.p, o: 0, label: t.label }),
    still: ctx.still || ctx.mode === 'check',
  });
  useEffect(() => { prev.current = scale; });
  return vals.map((x) => ({ ...x.value, key: x.key }));
}

export type AxisProps = {
  scale: Scale;
  ticks: number[];
  format: (v: number) => string;
  /** Where the axis sits on the other dimension (px). */
  at: number;
  /** Gridlines from `at` to `to` (px on the other dimension). */
  grid?: { to: number; stroke?: string };
  /** Draw the axis line across [a, b]. */
  line?: [number, number];
  offset?: number;
  anchor?: 'start' | 'middle' | 'end';
  /** Ticks from different units never share identity: '$' ticks leave while '%' ticks arrive. */
  unit?: string;
};

export function AxisX({ scale, ticks, format, at, grid, line, offset = 18, anchor = 'middle', unit = '' }: AxisProps) {
  const t = useTicks(scale, ticks, format, unit);
  return (
    <g className="fig-axis" aria-hidden="true">
      {grid && t.map((k) => <line key={`g${k.key}`} x1={k.p} x2={k.p} y1={at} y2={grid.to} stroke={grid.stroke ?? c('hair')} opacity={k.o} />)}
      {line && <line x1={line[0]} x2={line[1]} y1={at} y2={at} stroke={c('slate')} strokeOpacity={0.55} />}
      {t.map((k) => (
        <text key={`t${k.key}`} x={k.p} y={at + offset} textAnchor={anchor} fontSize={TYPE.tick.size} fill={c('slate')} opacity={k.o}>{k.label}</text>
      ))}
    </g>
  );
}

export function AxisY({ scale, ticks, format, at, grid, line, offset = 8, anchor = 'end', unit = '' }: AxisProps) {
  const t = useTicks(scale, ticks, format, unit);
  return (
    <g className="fig-axis" aria-hidden="true">
      {grid && t.map((k) => <line key={`g${k.key}`} x1={at} x2={grid.to} y1={k.p} y2={k.p} stroke={grid.stroke ?? c('hair')} opacity={k.o} />)}
      {line && <line x1={at} x2={at} y1={line[0]} y2={line[1]} stroke={c('slate')} strokeOpacity={0.55} />}
      {t.map((k) => (
        <text key={`t${k.key}`} x={at - offset} y={k.p} textAnchor={anchor} dominantBaseline="middle" fontSize={TYPE.tick.size} fill={c('slate')} opacity={k.o}>{k.label}</text>
      ))}
    </g>
  );
}
