// Aggregates daily time-series into Weekly / Monthly / Quarterly buckets for the
// analytics chart granularity dropdowns.

export type Granularity = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly'
export const GRANULARITIES: Granularity[] = ['Daily', 'Weekly', 'Monthly', 'Quarterly']

// Start-of-period timestamp (ms, UTC) for a time under a granularity.
export function bucketStart(t: number, g: Granularity): number {
  const d = new Date(t)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  if (g === 'Weekly') {
    const day = new Date(Date.UTC(y, m, d.getUTCDate()))
    const dow = (day.getUTCDay() + 6) % 7 // Monday = 0
    day.setUTCDate(day.getUTCDate() - dow)
    return day.getTime()
  }
  if (g === 'Monthly') return Date.UTC(y, m, 1)
  if (g === 'Quarterly') return Date.UTC(y, Math.floor(m / 3) * 3, 1)
  return Date.UTC(y, m, d.getUTCDate())
}

export interface Bucket<T> { t: number; rows: T[] }

// Groups chronologically-sorted rows into buckets by granularity, preserving order.
export function bucketize<T>(rows: T[], getTime: (r: T) => number, g: Granularity): Bucket<T>[] {
  if (g === 'Daily') return rows.map((r) => ({ t: bucketStart(getTime(r), g), rows: [r] }))
  const out: Bucket<T>[] = []
  const index: Record<number, Bucket<T>> = {}
  for (const r of rows) {
    const key = bucketStart(getTime(r), g)
    if (!index[key]) { index[key] = { t: key, rows: [] }; out.push(index[key]) }
    index[key].rows.push(r)
  }
  return out
}

export function bucketLabel(t: number, g: Granularity): string {
  const d = new Date(t)
  if (g === 'Monthly') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  if (g === 'Quarterly') return 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1) + " '" + String(d.getUTCFullYear()).slice(2)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
