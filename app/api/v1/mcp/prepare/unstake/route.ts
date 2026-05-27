import { isAddress, encodeFunctionData, parseUnits, formatUnits } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { successEnvelope, badRequest, validationError, upstreamError } from '@/lib/mcp/envelope'

// Base MCP prepare endpoint: withdraw BEAN from the Staking contract.
// Encodes Staking.withdraw(uint256 amount).
// amount=max unstakes the full position.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

const withdrawAbi = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

export async function GET(req: Request) {
  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')
  const amountParam = url.searchParams.get('amount')

  if (!fromParam || !isAddress(fromParam)) {
    return badRequest('from must be a valid Ethereum address', { received: fromParam })
  }
  if (!amountParam) {
    return badRequest('amount is required (decimal BEAN or "max")')
  }
  const from = fromParam.toLowerCase() as `0x${string}`

  // Fetch current stake balance from backend
  let stakedBalance: bigint
  try {
    const res = await fetch(`${API_BASE}/api/staking/${from}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return upstreamError(`Staking backend returned ${res.status}`)
    const data = (await res.json()) as { balance?: string }
    stakedBalance = BigInt(data.balance ?? '0')
  } catch (e) {
    console.error('[mcp/prepare/unstake] backend fetch failed', e)
    return upstreamError('Failed to reach staking backend')
  }

  if (stakedBalance === BigInt(0)) {
    return validationError('Nothing staked to unstake.', 'NOTHING_STAKED', { stakedBalanceWei: '0' })
  }

  // Resolve amount: "max" → full balance, else parse decimal
  let unstakeAmount: bigint
  if (amountParam === 'max') {
    unstakeAmount = stakedBalance
  } else {
    try {
      unstakeAmount = parseUnits(amountParam, 18)
    } catch {
      return badRequest('amount must be "max" or a decimal BEAN value', { received: amountParam })
    }
  }

  if (unstakeAmount > stakedBalance) {
    return validationError(
      'Unstake amount exceeds current staked balance.',
      'EXCEEDS_STAKED',
      {
        requestedWei: unstakeAmount.toString(),
        requestedFormatted: formatUnits(unstakeAmount, 18),
        stakedBalanceWei: stakedBalance.toString(),
        stakedBalanceFormatted: formatUnits(stakedBalance, 18),
      }
    )
  }

  const data = encodeFunctionData({
    abi: withdrawAbi,
    functionName: 'withdraw',
    args: [unstakeAmount],
  })

  const displayAmount =
    amountParam === 'max' ? formatUnits(stakedBalance, 18) : amountParam

  return successEnvelope({
    to: CONTRACTS.Staking.address,
    from,
    data,
    description: `Unstake ${displayAmount} BEAN from the MineBean Staking contract.`,
    meta: {
      validation: {
        requestedWei: unstakeAmount.toString(),
        requestedFormatted: formatUnits(unstakeAmount, 18),
        stakedBalanceWei: stakedBalance.toString(),
        stakedBalanceFormatted: formatUnits(stakedBalance, 18),
      },
    },
  })
}
