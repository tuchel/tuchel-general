/**
 * Scenario and view switcher: a radio group with arrow-key movement, a
 * sliding indicator on the motion tokens, and touch-sized targets.
 */
import { useLayoutEffect, useEffect, useRef, useState, type KeyboardEvent } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type Option<T extends string> = { id: T; label: string };

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value]);
  const move = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length];
    onChange(next.id);
    ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[options.indexOf(next)]?.focus();
  };
  return (
    <div ref={ref} className="fig-seg" role="radiogroup" aria-label={label}>
      {ind && <span className="fig-seg-ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          tabIndex={o.id === value ? 0 : -1}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => move(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
