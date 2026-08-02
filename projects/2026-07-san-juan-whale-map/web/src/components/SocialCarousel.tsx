import { useEffect, useRef } from 'react'
import {
  formatSightingWhen,
  speciesLabel,
  type SocialPost,
} from '../lib/social'

type Props = {
  posts: SocialPost[]
  index: number
  onIndexChange: (i: number) => void
  speciesLabels?: Record<string, string>
}

export function SocialCarousel({ posts, index, onIndexChange, speciesLabels }: Props) {
  const touchX = useRef<number | null>(null)
  const n = posts.length
  const post = n ? posts[Math.min(Math.max(index, 0), n - 1)] : null

  useEffect(() => {
    if (!n) return
    if (index < 0 || index >= n) onIndexChange(0)
  }, [n, index, onIndexChange])

  if (!post || !n) return null

  const go = (delta: number) => {
    const next = Math.min(Math.max(index + delta, 0), n - 1)
    if (next !== index) onIndexChange(next)
  }

  const when = formatSightingWhen(post.createdAt)

  return (
    <div
      className="social-carousel"
      role="region"
      aria-label="Bluesky sightings by time"
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const x = e.changedTouches[0]?.clientX
        if (x == null) return
        const dx = x - touchX.current
        touchX.current = null
        if (dx < -48) go(1)
        else if (dx > 48) go(-1)
      }}
    >
      <div className="social-carousel-top">
        <span>Bluesky trail · red = newest</span>
        <span>
          {index + 1} / {n}
        </span>
      </div>
      <div className="heat-scale-bar social-heat-bar social-carousel-scale" aria-hidden />

      <div className="social-carousel-main">
        <button
          type="button"
          className="social-carousel-nav"
          aria-label="Newer post"
          disabled={index <= 0}
          onClick={() => go(-1)}
        >
          ‹
        </button>

        <div className="social-carousel-card">
          <p className="social-carousel-title">
            {speciesLabel(post.species, speciesLabels)}
            {post.place ? ` · ${post.place}` : ''}
          </p>
          <p className="social-carousel-meta">
            {[
              when.absolute,
              when.relative,
              post.direction,
              post.geocodePrecision === 'place_name' ? 'approx place' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="social-carousel-text">{post.text.slice(0, 160)}</p>
          <a className="social-carousel-link" href={post.url} target="_blank" rel="noreferrer">
            Open post →
          </a>
        </div>

        <button
          type="button"
          className="social-carousel-nav"
          aria-label="Older post"
          disabled={index >= n - 1}
          onClick={() => go(1)}
        >
          ›
        </button>
      </div>

      <p className="social-carousel-hint">Swipe for older · map follows each pin</p>
    </div>
  )
}
