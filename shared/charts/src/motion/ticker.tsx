/**
 * Animated numbers. The server and the screen reader get the final value;
 * the visible digits count from the previous value (or `from` on entrance).
 */
import type { SVGProps } from 'react';

import { timingFor, useFigure } from '../figure/context.ts';
import { useTween } from './tween.ts';

export type TickerProps = { value: number; format: (n: number) => string; from?: number };

function useTicker({ value, from }: TickerProps) {
  const ctx = useFigure();
  const target = ctx.revealed ? value : (from ?? value);
  return useTween(target, (p) => timingFor(ctx, { stagger: false })(p, null, 0), { still: ctx.still });
}

export function Ticker(p: TickerProps) {
  const v = useTicker(p);
  return (
    <span className="fig-ticker">
      <span aria-hidden="true">{p.format(v)}</span>
      <span className="fig-sr">{p.format(p.value)}</span>
    </span>
  );
}

export function TickerText({ value, format, from, ...rest }: TickerProps & SVGProps<SVGTextElement>) {
  const v = useTicker({ value, format, from });
  return <text {...rest}>{format(v)}</text>;
}
