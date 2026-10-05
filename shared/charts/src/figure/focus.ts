/**
 * Every data mark that carries a value is reachable three ways: pointer,
 * keyboard (one tab stop per figure, arrow keys between marks), and screen
 * reader (each mark is a labeled image; the figure also ships its numbers as a
 * table). Hover and focus share one emphasis state.
 */
import type { KeyboardEvent, SVGAttributes } from 'react';

import { useEmphasis, useFigure, type Tip } from './context.ts';

export type Focusable = {
  id: string;
  label: string;
  tip?: Tip;
  /** Keys this mark answers to; lighting any of them lights the mark. */
  keys?: readonly string[];
  /** Keys to light when this mark is the active one (default: its own keys). */
  lights?: readonly string[];
  /** Click, Enter, or Space. */
  onActivate?: () => void;
  pressed?: boolean;
};

export function useFocusable(f: Focusable | undefined): SVGAttributes<SVGGElement> & Record<string, unknown> {
  const ctx = useFigure();
  const { dimmed, lit } = useEmphasis(f ? [f.id, ...(f.keys ?? [])] : []);
  if (!f) return { 'data-dim': ctx.active ? '1' : undefined };
  if (f.tip) ctx.registerTip(f.id, f.tip);
  const common = { 'data-dim': dimmed ? '1' : undefined, 'data-lit': lit ? '1' : undefined };
  if (ctx.mode === 'check') return common;
  const lights = f.lights ?? f.keys ?? [];
  return {
    ...common,
    'data-fig-focus': f.id,
    role: 'img',
    'aria-label': f.label,
    tabIndex: -1,
    onPointerEnter: () => ctx.setActive(f.id, lights),
    onPointerLeave: () => ctx.setActive(null),
    onFocus: () => ctx.setActive(f.id, lights),
    onBlur: () => ctx.setActive(null),
    ...(f.onActivate ? {
      role: 'button',
      'aria-pressed': f.pressed ? true : false,
      onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); f.onActivate!(); },
      onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.onActivate!(); } },
    } : {}),
  };
}

/** Roving focus across `[data-fig-focus]` inside `root`, in document order. */
export function rovingKeyDown(root: HTMLElement | null, e: KeyboardEvent) {
  if (!root) return;
  const marks = Array.from(root.querySelectorAll<SVGElement>('[data-fig-focus]'));
  if (!marks.length) return;
  const i = marks.indexOf(document.activeElement as SVGElement);
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i < 0 ? 0 : Math.min(marks.length - 1, i + 1);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i < 0 ? 0 : Math.max(0, i - 1);
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = marks.length - 1;
  else if (e.key === 'Escape' && i >= 0) { (marks[i] as unknown as HTMLElement).blur(); return; }
  if (next < 0) return;
  e.preventDefault();
  marks.forEach((m, j) => m.setAttribute('tabindex', j === next ? '0' : '-1'));
  (marks[next] as unknown as HTMLElement).focus();
}

/** One tab stop per figure: the first mark, until the reader moves. */
export function ensureTabStop(root: HTMLElement | null) {
  if (!root) return;
  const marks = Array.from(root.querySelectorAll<SVGElement>('[data-fig-focus]'));
  if (!marks.length || marks.some((m) => m.getAttribute('tabindex') === '0')) return;
  marks[0].setAttribute('tabindex', '0');
}
