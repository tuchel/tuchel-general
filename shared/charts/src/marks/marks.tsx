/**
 * Marks: bars, dots, text, rules, and lines. Geometry tweens between states
 * through `useKeyedTween`; opacity and emphasis ride CSS on the motion tokens.
 * Each mark's `id` is its identity across states, so a bar that exists in two
 * scenarios moves instead of being replaced.
 */
import { useRef, type ReactNode } from 'react';
import { line as d3line, curveLinear, curveMonotoneX } from '../../vendor/d3.js';

import { timingFor, useEmphasis, useFigure, type Tip } from '../figure/context.ts';
import { useFocusable, type Focusable } from '../figure/focus.ts';
import { resample, useKeyedTween, useTween, type Phase } from '../motion/tween.ts';
import { c } from '../tokens.ts';
import { measure } from '../measure.ts';

type Interactive = { label?: string; tip?: Tip; keys?: readonly string[]; lights?: readonly string[]; onActivate?: () => void; pressed?: boolean };

function Mark({ id, d, children, className }: { id: string; d: Interactive; children: ReactNode; className?: string }) {
  const f: Focusable | undefined = d.label ? { id, label: d.label, tip: d.tip, keys: d.keys, lights: d.lights, onActivate: d.onActivate, pressed: d.pressed } : undefined;
  const props = useFocusable(f);
  const passive = useEmphasis([id, ...(d.keys ?? [])]);
  const attrs = f ? props : { 'data-dim': passive.dimmed ? '1' : undefined, 'data-lit': passive.lit ? '1' : undefined };
  return <g className={className ? `fig-mark ${className}` : 'fig-mark'} {...attrs}>{children}</g>;
}

function useMarkTween<G extends object>(items: Array<{ id: string } & G>, geom: (d: { id: string } & G) => Record<string, number>, enter: (g: Record<string, number>) => Record<string, number>, o: { stagger?: boolean } = {}) {
  const ctx = useFigure();
  const targets = items.map((d) => ({ id: d.id, g: geom(d) }));
  const shown = ctx.revealed ? targets : targets.map((t) => ({ id: t.id, g: enter(t.g) }));
  const timing = timingFor(ctx, o);
  const values = useKeyedTween(shown, {
    key: (t) => t.id,
    timing: (phase: Phase, _d, i) => timing(phase, null, i),
    enter: (t) => ({ id: t.id, g: enter(t.g) }),
    exit: (t) => ({ id: t.id, g: enter(t.g) }),
    still: ctx.still || ctx.mode === 'check',
  });
  const last = useRef(new Map<string, { id: string } & G>());
  for (const d of items) last.current.set(d.id, d);
  const byId = new Map(items.map((d) => [d.id, d]));
  return values.map((v) => ({ d: byId.get(v.key) ?? last.current.get(v.key)!, g: v.value.g, phase: v.phase })).filter((v) => v.d);
}

export type Bar = Interactive & {
  id: string; x: number; y: number; w: number; h: number; fill: string; rx?: number; opacity?: number;
  /** `grow="origin"`: the x the bar grows out of on entrance (a base line). */
  ox?: number;
  /** Taller invisible hit area, centered on the bar (a whole row). */
  hitH?: number;
};

/** Rects. `grow` picks the entrance: from the left edge, up from the baseline, or out of each bar's `ox`. */
export function Bars({ data, grow = 'right', className }: { data: Bar[]; grow?: 'right' | 'up' | 'origin'; className?: string }) {
  const vals = useMarkTween(data,
    (d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, o: d.opacity ?? 1, ox: d.ox ?? d.x }),
    (g) => (grow === 'right' ? { ...g, w: 0 } : grow === 'origin' ? { ...g, x: g.ox, w: 0 } : { ...g, y: g.y + g.h, h: 0 }));
  return (
    <g className={className}>
      {vals.map(({ d, g, phase }) => (
        <Mark key={d.id} id={d.id} d={d}>
          {d.hitH && d.label && <rect x={g.x - 4} y={g.y + g.h / 2 - d.hitH / 2} width={Math.max(0, g.w) + 8} height={d.hitH} fill="transparent" className="fig-hit" />}
          <rect x={g.x} y={g.y} width={Math.max(0, g.w)} height={Math.max(0, g.h)} rx={d.rx} fill={d.fill} opacity={phase === 'exit' ? 0 : g.o} className="fig-fade" />
        </Mark>
      ))}
    </g>
  );
}

export type Dot = Interactive & { id: string; cx: number; cy: number; r: number; fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number; dash?: string; shape?: 'circle' | 'diamond'; hit?: number };

export function Dots({ data, className }: { data: Dot[]; className?: string }) {
  const vals = useMarkTween(data, (d) => ({ cx: d.cx, cy: d.cy, r: d.r }), (g) => ({ ...g, r: 0 }));
  return (
    <g className={className}>
      {vals.map(({ d, g, phase }) => (
        <Mark key={d.id} id={d.id} d={d}>
          <g transform={`translate(${g.cx} ${g.cy})`} opacity={phase === 'exit' ? 0 : 1} className="fig-fade">
            {d.shape === 'diamond'
              ? <path d={`M0 ${-g.r} L${g.r} 0 L0 ${g.r} L${-g.r} 0 Z`} fill={d.fill ?? 'none'} fillOpacity={d.fillOpacity} stroke={d.stroke} strokeWidth={d.strokeWidth} strokeDasharray={d.dash} />
              : <circle r={Math.max(0, g.r)} fill={d.fill ?? 'none'} fillOpacity={d.fillOpacity} stroke={d.stroke} strokeWidth={d.strokeWidth} strokeDasharray={d.dash} />}
            {d.label && <circle r={Math.max(d.hit ?? 12, g.r)} fill="transparent" className="fig-hit" />}
          </g>
        </Mark>
      ))}
    </g>
  );
}

export type Label = Interactive & {
  id: string;
  x: number;
  y: number;
  text: string;
  /** When set, the text is `format(value)` and the number tweens (a ticker). */
  value?: number;
  format?: (n: number) => string;
  anchor?: 'start' | 'middle' | 'end';
  baseline?: 'middle' | 'auto' | 'hanging';
  size?: number;
  weight?: number;
  fill?: string;
  halo?: string | false;
  rotate?: number;
  opacity?: number;
};

/** Check renders record every label's measured box; `check-figures` fails on any overlap. */
type Collected = { figure: string; id: string; text: string; x: number; y: number; w: number; h: number };
function collect(figure: string, d: Label) {
  const sink = (globalThis as { __figCheck?: { labels: Collected[] } }).__figCheck?.labels;
  if (!sink || (d.opacity ?? 1) <= 0 || !d.text) return;
  const size = d.size ?? 12.5;
  const lines = d.text.split('\n');
  const w = Math.max(...lines.map((l) => measure(l, { size, weight: d.weight ?? 400 })));
  const h = lines.length * size * 1.2;
  const x = d.anchor === 'end' ? d.x - w : d.anchor === 'middle' ? d.x - w / 2 : d.x;
  const baseline = d.baseline ?? 'middle';
  const y = baseline === 'middle' ? d.y - h / 2 : baseline === 'hanging' ? d.y : d.y - size * 0.76;
  sink.push({ figure, id: d.id, text: d.text, x, y, w, h: baseline === 'auto' ? size * 0.96 : h });
}

export function Texts({ data, className }: { data: Label[]; className?: string }) {
  const fig = useFigure();
  if (fig.mode === 'check') for (const d of data) collect(fig.figureId, d);
  const vals = useMarkTween(data,
    (d) => ({ x: d.x, y: d.y, o: d.opacity ?? 1, v: d.value ?? 0 }),
    (g) => ({ ...g, o: 0, y: g.y + 4, v: 0 }));
  return (
    <g className={className}>
      {vals.map(({ d, g, phase }) => {
        const text = d.value !== undefined && d.format ? d.format(g.v) : d.text;
        const node = (
          <text
            key={d.id}
            x={g.x}
            y={g.y}
            textAnchor={d.anchor}
            dominantBaseline={d.baseline === 'auto' ? undefined : d.baseline ?? 'middle'}
            fontSize={d.size ?? 12.5}
            fontWeight={d.weight && d.weight !== 400 ? d.weight : undefined}
            fill={d.fill ?? c('ink')}
            opacity={phase === 'exit' ? 0 : g.o}
            transform={d.rotate ? `rotate(${d.rotate} ${g.x} ${g.y})` : undefined}
            stroke={d.halo === false || d.halo === undefined ? undefined : d.halo}
            strokeWidth={d.halo ? 4 : undefined}
            paintOrder={d.halo ? 'stroke' : undefined}
            strokeLinejoin={d.halo ? 'round' : undefined}
            className="fig-text fig-fade"
            aria-hidden="true"
          >
            {text.includes('\n')
              ? text.split('\n').map((line, i) => <tspan key={i} x={g.x} dy={i === 0 ? `${-((text.split('\n').length - 1) * 0.6)}em` : '1.2em'}>{line}</tspan>)
              : text}
          </text>
        );
        return d.keys ? <Mark key={d.id} id={`${d.id}~t`} d={{ keys: d.keys }}>{node}</Mark> : node;
      })}
    </g>
  );
}

export type Rule = { id: string; x1: number; y1: number; x2: number; y2: number; stroke?: string; width?: number; dash?: string; opacity?: number; keys?: readonly string[] };

export function Rules({ data, className }: { data: Rule[]; className?: string }) {
  const vals = useMarkTween(data,
    (d) => ({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, o: d.opacity ?? 1 }),
    (g) => ({ ...g, o: 0 }), { stagger: false });
  return (
    <g className={className}>
      {vals.map(({ d, g, phase }) => (
        <line key={d.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={d.stroke ?? c('hair')} strokeWidth={d.width ?? 1} strokeDasharray={d.dash} opacity={phase === 'exit' ? 0 : g.o} className="fig-fade" />
      ))}
    </g>
  );
}

export type LineSpec = Interactive & {
  id: string;
  points: Array<readonly [number, number]>;
  stroke: string;
  width?: number;
  dash?: string;
  curve?: 'linear' | 'monotone';
};

/**
 * A polyline that morphs between states (both ends resampled to one point
 * count) and draws on from left to right when the figure is revealed.
 */
export function Line({ spec }: { spec: LineSpec }) {
  const ctx = useFigure();
  const n = Math.max(24, spec.points.length * 8);
  const pts = resample(spec.points, n).flat();
  const shown = useTween(pts, (p) => timingFor(ctx, { stagger: false })(p, null, 0), { still: ctx.still || ctx.mode === 'check' });
  const xs = spec.points.map((p) => p[0]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const draw = useTween(ctx.revealed ? 1 : 0, (p) => timingFor(ctx, { stagger: false })(p, null, 0), { still: ctx.still || ctx.mode === 'check' });
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < shown.length; i += 2) pairs.push([shown[i], shown[i + 1]]);
  const path = d3line().curve(spec.curve === 'monotone' ? curveMonotoneX : curveLinear)(pairs) ?? '';
  const clipId = `${ctx.figureId}-clip-${spec.id}`;
  const full = draw >= 0.999;
  return (
    <Mark id={spec.id} d={spec}>
      {!full && (
        <clipPath id={clipId}>
          <rect x={x0 - 8} y={-1e4} width={(x1 - x0 + 16) * draw} height={2e4} />
        </clipPath>
      )}
      <path d={path} fill="none" stroke={spec.stroke} strokeWidth={spec.width ?? 2} strokeDasharray={spec.dash} strokeLinecap="round" strokeLinejoin="round" clipPath={full ? undefined : `url(#${clipId})`} />
    </Mark>
  );
}
