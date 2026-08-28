export function money(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits })
}

export function miles(n: number): string {
  return `${n.toFixed(n < 10 ? 1 : 0)} mi`
}

export function minutes(n: number): string {
  const r = Math.round(n)
  return `${r} min`
}

export function flagLabel(v: boolean | 'extra' | 'claimed'): string {
  if (v === true) return 'yes'
  if (v === 'extra') return 'extra fee'
  if (v === 'claimed') return 'claimed'
  return '—'
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}`
}
