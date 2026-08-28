import { useLayoutEffect, useRef, type RefObject } from 'react'

export function useFlip(rootRef: RefObject<HTMLElement | null>, token: string) {
  const prev = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, DOMRect>()
    const nodes = root.querySelectorAll<HTMLElement>('[data-flip]')
    nodes.forEach((el) => next.set(el.dataset.flip!, el.getBoundingClientRect()))
    if (!reduce) {
      nodes.forEach((el) => {
        const id = el.dataset.flip!
        const a = prev.current.get(id)
        const b = next.get(id)
        if (!a || !b) return
        const dx = a.left - b.left
        const dy = a.top - b.top
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: 340,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
        })
      })
    }
    prev.current = next
  }, [rootRef, token])
}
