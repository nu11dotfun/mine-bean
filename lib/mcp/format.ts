import { formatUnits } from 'viem'

// Display helpers for Base MCP prepare endpoints. Keep descriptions readable
// (max ~6 decimals) so agent UIs don't paste an 18-digit fraction at the user.

export function fmtForDescription(wei: bigint, decimals = 18, maxFracDigits = 6): string {
  const num = parseFloat(formatUnits(wei, decimals))
  if (num === 0) return '0'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFracDigits,
  })
}
