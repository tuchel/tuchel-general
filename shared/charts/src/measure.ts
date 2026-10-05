/**
 * Text width from the real font metrics (advances plus kerning pairs,
 * generated from the .woff2 files the page loads). Pure and deterministic, so
 * the check render and the browser lay out a figure identically.
 *
 * Each app sets its chart face once, before rendering:
 *   import { PLEX_SANS } from '…/shared/charts/src/fonts/plex-sans.generated.ts';
 *   setChartFace(PLEX_SANS);
 * The face's .css file (next to its .woff2 files in `fonts/`) must be loaded
 * by the page, so the measured and the drawn glyphs are the same.
 */
import { INTER } from './fonts/inter.generated.ts';
import type { Face, FaceMetrics } from './fonts/types.ts';

export type { Face, FaceMetrics };
export type TextStyle = { size: number; weight?: number; face?: Face };

let current: Face = INTER;

/** The face every figure measures and draws with. Default: Inter. */
export function setChartFace(face: Face): void {
  current = face;
}

export function chartFace(): Face {
  return current;
}

function metricsFor(face: Face, weight: number): FaceMetrics {
  if (face.weights[weight]) return face.weights[weight];
  const w = Object.keys(face.weights).map(Number).reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
  return face.weights[w];
}

export function measure(text: string, style: TextStyle): number {
  const m = metricsFor(style.face ?? current, style.weight ?? 400);
  let units = 0;
  let prev = '';
  for (const ch of text) {
    units += m.adv[ch] ?? m.fallback;
    if (prev) units += m.kern[prev + ch] ?? 0;
    prev = ch;
  }
  return (units / m.upm) * style.size;
}

/** Greedy wrap to `width` px; never breaks inside a word. */
export function wrap(text: string, width: number, style: TextStyle): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, style) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Measured box for a single-line label, for the placement primitives. */
export function labelBox(text: string, style: TextStyle): { width: number; height: number } {
  return { width: measure(text, style), height: style.size };
}
