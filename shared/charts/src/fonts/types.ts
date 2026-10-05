export type FaceMetrics = { upm: number; fallback: number; adv: Record<string, number>; kern: Record<string, number> };

/** A chart face: its CSS family, the stack figures draw with, and metrics per weight. */
export type Face = { family: string; stack: string; weights: Record<number, FaceMetrics> };
