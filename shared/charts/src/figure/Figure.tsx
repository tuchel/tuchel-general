/**
 * The figure shell: a <figure> with an HTML headline and dek, optional
 * takeaways and controls, a swatch key, the plot as an SVG laid out at the
 * container's real width (1:1, so type renders at its set size), a tooltip, a
 * note, and a "Show the numbers" table.
 *
 * `mode="check"` renders the plot alone at a fixed width, for `check-figures`.
 * There is no standalone SVG export: figures live in the apps.
 */
import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';

import { chartFace } from '../measure.ts';
import { useStillMotion } from '../motion/env.ts';
import { useReveal } from '../motion/reveal.ts';
import { Ticker } from '../motion/ticker.tsx';
import { FigureContext, type Cause, type FigureCtx, type RenderMode, type Tip } from './context.ts';
import { ensureTabStop, rovingKeyDown } from './focus.ts';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type HeadlinePart = string | { value: number; format: (n: number) => string; from?: number };
export type KeyItem = { label: string; color: string; shape?: 'square' | 'line' | 'dot' | 'ring' };
export type DataTable = { caption?: string; columns: string[]; rows: Array<Array<string | number>> };
/** What the reader should do with the figure: one sentence each, numbers from the data. */
export type Takeaways = { look: string; learn: string; scrutinize: string };
const TAKEAWAY_LABELS: Array<[keyof Takeaways, string]> = [['look', 'Look at'], ['learn', 'Learn'], ['scrutinize', 'Scrutinize']];

export type FigureProps = {
  id: string;
  mode?: RenderMode;
  /** Design width in px. The live figure starts at it, then fits its container. */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  height: number | ((width: number) => number);
  headline: HeadlinePart[] | string;
  dek?: string;
  /** Required on explanatory figures: "Look at", "Learn", "Scrutinize". */
  takeaways?: Takeaways;
  /** A tool panel (a workbench chart, a side-panel scatter): takeaways are not required. */
  instrument?: boolean;
  note?: string;
  keyItems?: KeyItem[];
  controls?: ReactNode;
  data?: DataTable;
  /** One-sentence description of what the figure shows, for assistive technology. */
  label: string;
  reveal?: boolean;
  /** The page's lead figure: a larger headline. Its edges stay on the reading column's. */
  hero?: boolean;
  /** Opt-in: break out of the reading column, symmetrically, up to 960 px. For figures that need the room. */
  breakout?: boolean;
  /** A mark held active (a pinned card); hover still wins while it lasts. */
  pinned?: string | null;
  /** Tooltip beside the mark (default) or centered under it, clear of the mark's own row labels. */
  tipPlacement?: 'side' | 'below';
  /** Replaces the tooltip: render anything at the active mark's box (plot coordinates). */
  overlay?: (id: string, anchor: DOMRect, width: number) => ReactNode;
  children: (size: { width: number; height: number }) => ReactNode;
};

type CheckSink = { width?: number; labels: unknown[]; takeaways: Array<{ figure: string; takeaways: Takeaways | null; instrument: boolean }> };

function KeySwatch({ k }: { k: KeyItem }) {
  const shape = k.shape ?? 'square';
  if (shape === 'line') return <svg width="16" height="10" aria-hidden="true"><line x1="0" x2="16" y1="5" y2="5" stroke={k.color} strokeWidth="2" /></svg>;
  if (shape === 'dot') return <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={k.color} /></svg>;
  if (shape === 'ring') return <svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke={k.color} strokeWidth="1.6" /></svg>;
  return <svg width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="2" fill={k.color} /></svg>;
}

function Tooltip({ tip, anchor, width, placement = 'side' }: { tip: Tip | null; anchor: DOMRect | null; width: number; placement?: 'side' | 'below' }) {
  const [shown, setShown] = useState<{ tip: Tip; anchor: DOMRect } | null>(null);
  useEffect(() => { if (tip && anchor) setShown({ tip, anchor }); }, [tip, anchor]);
  if (!shown) return null;
  const w = Math.min(260, width - 16);
  const a = shown.anchor;
  const right = a.x + a.width + 12;
  const flip = right + w > width - 4;
  const top = Math.max(0, a.y + Math.min(a.height / 2, 40) - 24);
  const center = Math.min(width - w / 2 - 4, Math.max(w / 2 + 4, a.x + a.width / 2));
  const style = placement === 'below'
    ? { left: center, top: a.y + a.height + 4 }
    : flip ? { right: Math.max(4, width - a.x + 12), top } : { left: right, top };
  return (
    <div className="fig-tip" data-state={tip ? 'in' : 'out'} data-place={placement} style={style} aria-hidden="true">
      <div className="fig-tip-title">{shown.tip.title}</div>
      {shown.tip.rows && (
        <dl>
          {shown.tip.rows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      {shown.tip.note && <p>{shown.tip.note}</p>}
    </div>
  );
}

/**
 * The check render: the plot alone, at one width, still and fully revealed.
 * `check-figures` renders it in memory to measure label overlaps and type
 * size, and to read the takeaways. Nothing is written to disk.
 */
function CheckFigure(p: FigureProps & { width: number }) {
  const sink = (globalThis as { __figCheck?: CheckSink }).__figCheck;
  sink?.takeaways.push({ figure: p.id, takeaways: p.takeaways ?? null, instrument: !!p.instrument });
  const W = Math.round(Math.max(p.minWidth ?? 320, Math.min(p.maxWidth ?? 1100, sink?.width ?? p.width)));
  const H = typeof p.height === 'function' ? p.height(W) : p.height;
  const ctx: FigureCtx = {
    mode: 'check', width: W, revealed: true, cause: 'data', still: true,
    active: null, activeKeys: [], setActive: () => {}, registerTip: () => {}, figureId: p.id,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.label} fontFamily={chartFace().stack}>
      <FigureContext.Provider value={ctx}>{p.children({ width: W, height: H })}</FigureContext.Provider>
    </svg>
  );
}

function LiveFigure(p: FigureProps & { width: number }) {
  const rootRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');
  const still = useStillMotion();
  const revealed = useReveal(rootRef, p.reveal !== false);
  const [width, setWidth] = useState(p.width);
  const [hover, setActiveState] = useState<{ id: string; keys: readonly string[] } | null>(null);
  const active = hover ?? (p.pinned ? { id: p.pinned, keys: [] as readonly string[] } : null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const tips = useRef(new Map<string, Tip>());

  useIsoLayoutEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const fit = (w: number) => {
      const next = Math.round(Math.max(p.minWidth ?? 320, Math.min(p.maxWidth ?? 1100, w)));
      setWidth((cur) => (Math.abs(cur - next) >= 1 ? next : cur));
    };
    fit(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prev = useRef({ revealed, width });
  let cause: Cause = 'data';
  if (revealed !== prev.current.revealed) cause = revealed ? 'reveal' : 'hide';
  else if (width !== prev.current.width) cause = 'resize';
  useEffect(() => { prev.current = { revealed, width }; });

  const setActive = useCallback((id: string | null, keys: readonly string[] = []) => {
    setActiveState((cur) => (id === null ? null : cur?.id === id ? cur : { id, keys }));
  }, []);

  useEffect(() => {
    const root = plotRef.current;
    ensureTabStop(root as HTMLElement | null);
    if (!active || !root) { setAnchor(null); return; }
    const el = root.querySelector(`[data-fig-focus="${CSS.escape(active.id)}"]`);
    if (!el) return;
    const a = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    setAnchor(new DOMRect(a.x - b.x, a.y - b.y, a.width, a.height));
  }, [active?.id, width]);

  const H = typeof p.height === 'function' ? p.height(width) : p.height;
  const ctx = useMemo<FigureCtx>(() => ({
    mode: 'live', width, revealed, cause, still,
    active: active?.id ?? null, activeKeys: active?.keys ?? [],
    setActive, registerTip: (id, tip) => { tips.current.set(id, tip); }, figureId: uid,
  }), [width, revealed, cause, still, active?.id, active?.keys, setActive, uid]);

  const parts = typeof p.headline === 'string' ? [p.headline] : p.headline;
  return (
    <FigureContext.Provider value={ctx}>
      <figure ref={rootRef} className="fig" data-hero={p.hero ? '1' : undefined} data-breakout={p.breakout ? '1' : undefined} data-revealed={revealed ? '1' : '0'} aria-labelledby={`${uid}-h`}>
        <figcaption className="fig-cap">
          <span className="fig-headline" id={`${uid}-h`}>
            {parts.map((part, i) => (typeof part === 'string' ? <span key={i}>{part}</span> : <Ticker key={i} {...part} />))}
          </span>
          {p.dek && <span className="fig-dek">{p.dek}</span>}
        </figcaption>
        {p.takeaways && (
          <dl className="fig-take">
            {TAKEAWAY_LABELS.map(([k, lab]) => (
              <div key={k}><dt>{lab}</dt><dd>{p.takeaways![k]}</dd></div>
            ))}
          </dl>
        )}
        {p.controls && <div className="fig-controls">{p.controls}</div>}
        {p.keyItems?.length ? (
          <ul className="fig-key">
            {p.keyItems.map((k) => <li key={k.label}><KeySwatch k={k} />{k.label}</li>)}
          </ul>
        ) : null}
        <div className="fig-plot" ref={plotRef} onKeyDown={(e) => rovingKeyDown(plotRef.current, e)}>
          <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="group" aria-label={p.label} aria-describedby={`${uid}-kbd`} fontFamily={chartFace().stack}>
            {p.children({ width, height: H })}
          </svg>
          {p.overlay
            ? (active && anchor ? p.overlay(active.id, anchor, width) : null)
            : <Tooltip tip={active ? tips.current.get(active.id) ?? null : null} anchor={anchor} width={width} placement={p.tipPlacement} />}
          <span className="fig-sr" id={`${uid}-kbd`}>Tab to the chart, then use the arrow keys to move between marks.</span>
        </div>
        {p.note && <p className="fig-note">{p.note}</p>}
        {p.data && (
          <details className="fig-data">
            <summary>Show the numbers</summary>
            <div className="fig-data-wrap">
              <table>
                {p.data.caption && <caption>{p.data.caption}</caption>}
                <thead><tr>{p.data.columns.map((col) => <th key={col} scope="col">{col}</th>)}</tr></thead>
                <tbody>
                  {p.data.rows.map((r, i) => (
                    <tr key={i}>{r.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </figure>
    </FigureContext.Provider>
  );
}

export function Figure(props: FigureProps) {
  const width = props.width ?? 640;
  return props.mode === 'check' ? <CheckFigure {...props} width={width} /> : <LiveFigure {...props} width={width} />;
}
