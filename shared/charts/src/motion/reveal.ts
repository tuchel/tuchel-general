import { useLayoutEffect, useEffect, useState, type RefObject } from 'react';

import { motionState, subscribeMotion } from './env.ts';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Reveal-on-scroll. Starts `true`. A figure already on screen when it mounts
 * never replays its entrance; one below the
 * fold parks at its enter state before paint and plays once when it scrolls
 * in. Reduced motion and printing reveal at once.
 */
export function useReveal(ref: RefObject<Element | null>, enabled = true): boolean {
  const [revealed, setRevealed] = useState(true);
  useIsoLayoutEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;
    const env = motionState();
    const el = ref.current;
    if (!el || env.reduced || env.instant) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return;
    setRevealed(false);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setRevealed(true);
        io.disconnect();
      }
    }, { threshold: 0.25, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    const off = subscribeMotion(() => {
      const s = motionState();
      if (s.reduced || s.instant) { setRevealed(true); io.disconnect(); }
    });
    return () => { io.disconnect(); off(); };
  }, [enabled]);
  return revealed;
}
