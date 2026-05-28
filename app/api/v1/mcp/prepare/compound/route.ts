import { isAddress, encodeFunctionData } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { successEnvelope, badRequest, validationError, upstreamError } from '@/lib/mcp/envelope'
import { fmtForDescription } from '@/lib/mcp/format'

// Base MCP prepare endpoint: claim + redeposit staking yield in one call.
// Encodes Staking.compound() - no args.
// Pre-flights via /api/staking/:address (canCompound + pendingRewards).

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

const compoundAbi = [
  { name: 'compound', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const

export async function GET(req: Request) {
  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')

  if (!fromParam || !isAddress(fromParam)) {
    return badRequest('from must be a valid Ethereum address', { received: fromParam })
  }
  const from = fromParam.toLowerCase() as `0x${string}`

  // Pre-flight: fetch staking position from backend
  let stakingData: {
    pendingRewards?: string
    pendingRewardsFormatted?: string
    compoundFeeReserve?: string
    canCompound?: boolean
  }
  try {
    const res = await fetch(`${API_BASE}/api/staking/${from}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      return upstreamError(`Staking backend returned ${res.status}`)
    }
    stakingData = await res.json()
  } catch (e) {
    console.error('[mcp/prepare/compound] backend fetch failed', e)
    return upstreamError('Failed to reach staking backend')
  }

  const pendingRewardsWei = BigInt(stakingData.pendingRewards ?? '0')
  const compoundReserveWei = BigInt(stakingData.compoundFeeReserve ?? '0')

  if (compoundReserveWei === BigInt(0)) {
    return validationError(
      'No compound fee reserve. Stake with a non-zero compoundFeeEth first to fund the reserve.',
      'NO_COMPOUND_RESERVE',
      { compoundFeeReserveWei: '0' }
    )
  }

  if (pendingRewardsWei === BigInt(0)) {
    return validationError(
      'No pending staking yield to compound.',
      'NOTHING_TO_COMPOUND',
      { pendingRewardsWei: '0' }
    )
  }

  const data = encodeFunctionData({
    abi: compoundAbi,
    functionName: 'compound',
    args: [],
  })

  const pendingFormatted = fmtForDescription(pendingRewardsWei)

  return successEnvelope({
    to: CONTRACTS.Staking.address,
    from,
    data,
    description: `Compound ${pendingFormatted} BEAN of pending staking yield back into your stake.`,
    meta: {
      validation: {
        pendingRewardsWei: pendingRewardsWei.toString(),
        pendingRewardsFormatted: stakingData.pendingRewardsFormatted ?? '0',
        compoundFeeReserveWei: compoundReserveWei.toString(),
        canCompound: stakingData.canCompound ?? false,
      },
    },
  })
}
