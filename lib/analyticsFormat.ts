// Shared number formatting for the /global analytics sections.

export const fmtInt = (n: number): string => Math.floor(n).toLocaleString()

export const fmtNum = (n: number, max = 2): string =>
  n.toLocaleString(undefined, { maximumFractionDigits: max })

export const fmtEth = (n: number, dp = 4): string => n.toFixed(dp)

export const fmtPct = (n: number, dp = 1): string => `${n.toFixed(dp)}%`

export const fmtUsd = (n: number): string =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })

export function fmtUsdCompact(n: number): string {
  if (!isFinite(n)) return '$0'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

export function fmtCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return Math.round(n).toLocaleString()
}

// Token supply in the Blockworks style: three-decimal K/M/B (e.g. "99.233K").
export function fmtTokenSupply(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(3) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(3) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(3) + 'K'
  return Math.round(n).toLocaleString()
}
