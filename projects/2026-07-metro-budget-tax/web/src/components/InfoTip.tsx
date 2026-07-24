import { useEffect, useState } from 'react'

/** Hover info tip — WHAT / WHY pattern for KPIs. */
export function InfoTip({
  label,
  what,
  why,
}: {
  label: string
  what: string
  why: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-btn"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span className="info-tip-panel" role="tooltip">
          <strong>{label}</strong>
          <span>
            <em>What:</em> {what}
          </span>
          <span>
            <em>Why:</em> {why}
          </span>
        </span>
      )}
    </span>
  )
}

export function FloatingToc({
  items,
}: {
  items: { id: string; label: string }[]
}) {
  const [active, setActive] = useState(items[0]?.id ?? '')

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActive(visible.target.id)
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.25, 0.5] },
    )
    items.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [items])

  return (
    <nav className="floating-toc" aria-label="On this page">
      <p className="eyebrow">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className={active === item.id ? 'is-active' : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
