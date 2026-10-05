/**
 * Swap one view for another: the old view fades out while the new one fades
 * in, on the crossfade token. Reduced motion and print swap at once.
 * Works inside SVG (`as="g"`) and in HTML (`as="div"`).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useFigure } from '../figure/context.ts';
import { MOTION } from '../tokens.ts';

type Layer = { key: string; node: ReactNode; state: 'in' | 'out' | 'pre' };

export function Crossfade({ view, children, as = 'g' }: { view: string; children: ReactNode; as?: 'g' | 'div' }) {
  const ctx = useFigure();
  const [layers, setLayers] = useState<Layer[]>([{ key: view, node: children, state: 'in' }]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (layers.some((l) => l.key === view && l.state !== 'out')) return;
    if (ctx.still || ctx.mode === 'check') {
      setLayers([{ key: view, node: children, state: 'in' }]);
      return;
    }
    setLayers((ls) => [...ls.map((l) => ({ ...l, state: 'out' as const })), { key: view, node: children, state: 'pre' }]);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      setLayers((ls) => ls.map((l) => (l.key === view && l.state === 'pre' ? { ...l, state: 'in' } : l)));
    }));
    const t = window.setTimeout(() => setLayers((ls) => ls.filter((l) => l.state !== 'out')), MOTION.duration.crossfade + 40);
    timers.current.push(t);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const Tag = as;
  return (
    <>
      {layers.map((l) => (
        <Tag key={l.key} className="fig-xfade" data-state={l.state} aria-hidden={l.state === 'out' ? true : undefined}>
          {l.key === view && l.state !== 'out' ? children : l.node}
        </Tag>
      ))}
    </>
  );
}
