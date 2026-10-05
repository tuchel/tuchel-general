/**
 * What every mark needs from its figure: size, render mode, whether the figure
 * has been revealed, why the last change happened, and the shared emphasis
 * state (hover, focus, and the tooltip).
 */
import { createContext, useContext } from 'react';

import { ease } from '../motion/ease.ts';
import type { Phase, Timing } from '../motion/tween.ts';
import { MOTION } from '../tokens.ts';

/** live: the interactive figure · check: an in-memory render at a fixed width, for `check-figures`. */
export type RenderMode = 'live' | 'check';
/** reveal: first entrance · hide: parked before entrance · resize · data: an author state change. */
export type Cause = 'reveal' | 'hide' | 'resize' | 'data';

export type Tip = { title: string; rows?: Array<[string, string]>; note?: string };

export type FigureCtx = {
  mode: RenderMode;
  width: number;
  revealed: boolean;
  cause: Cause;
  still: boolean;
  active: string | null;
  activeKeys: readonly string[];
  setActive: (id: string | null, keys?: readonly string[]) => void;
  registerTip: (id: string, tip: Tip) => void;
  figureId: string;
};

export const FigureContext = createContext<FigureCtx>({
  mode: 'check',
  width: 640,
  revealed: true,
  cause: 'data',
  still: true,
  active: null,
  activeKeys: [],
  setActive: () => {},
  registerTip: () => {},
  figureId: 'fig',
});

export function useFigure(): FigureCtx {
  return useContext(FigureContext);
}

const ZERO: Timing = { duration: 0, ease: (t) => t, delay: 0 };

/**
 * The motion scale applied to one change. Reveal staggers entering marks;
 * data changes move everything together on the slow curve; exits leave on the
 * exit curve; parking, resizing, printing, and reduced motion are instant.
 */
export function timingFor(ctx: Pick<FigureCtx, 'cause' | 'still' | 'mode'>, o: { stagger?: boolean } = {}) {
  return (phase: Phase, _d: unknown, i: number): Timing => {
    if (ctx.still || ctx.mode === 'check' || ctx.cause === 'hide' || ctx.cause === 'resize') return ZERO;
    if (ctx.cause === 'reveal') {
      const delay = o.stagger === false ? 0 : Math.min(i * MOTION.stagger.step, MOTION.stagger.max);
      return { duration: MOTION.duration.reveal, ease: ease('enter'), delay };
    }
    if (phase === 'exit') return { duration: MOTION.duration.base, ease: ease('exit'), delay: 0 };
    if (phase === 'enter') return { duration: MOTION.duration.slow, ease: ease('enter'), delay: MOTION.duration.fast };
    return { duration: MOTION.duration.slow, ease: ease('standard'), delay: 0 };
  };
}

/** Emphasis for one mark: active if any of its keys is the active key. */
export function useEmphasis(keys: readonly string[]) {
  const { active, activeKeys } = useFigure();
  if (!active) return { dimmed: false, lit: false };
  const lit = keys.some((k) => k === active || activeKeys.includes(k));
  return { dimmed: !lit, lit };
}
