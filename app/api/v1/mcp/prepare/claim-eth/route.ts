import { isAddress, encodeFunctionData, formatUnits } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { publicClient } from '@/lib/mcp/client'
import { successEnvelope, badRequest, validationError, upstreamError } from '@/lib/mcp/envelope'

// Base MCP prepare endpoint: claim mining ETH rewards.
// Encodes GridMining.claimETH() — no args, non-payable.
// Pre-flights via GridMining.getTotalPendingRewards to surface pending ETH
// and reject with NOTHING_TO_CLAIM when the wallet has nothing to claim.

const claimEthAbi = [
  { name: 'claimETH', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const

const getTotalPendingRewardsAbi = [
  {
    name: 'getTotalPendingRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'pendingETH', type: 'uint256' },
      { name: 'pendingUnroasted', type: 'uint256' },
      { name: 'pendingRoasted', type: 'uint256' },
      { name: 'uncheckpointedRound', type: 'uint256' },
    ],
  },
] as const

export async function GET(req: Request) {
  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')

  if (!fromParam || !isAddress(fromParam)) {
    return badRequest('from must be a valid Ethereum address', { received: fromParam })
  }
  const from = fromParam.toLowerCase() as `0x${string}`

  // Pre-flight: read pending ETH from the contract
  let pendingETH: bigint
  try {
    const tuple = (await publicClient.readContract({
      address: CONTRACTS.GridMining.address,
      abi: getTotalPendingRewardsAbi,
      functionName: 'getTotalPendingRewards',
      args: [from],
    })) as readonly [bigint, bigint, bigint, bigint]
    pendingETH = tuple[0]
  } catch (e) {
    console.error('[mcp/prepare/claim-eth] RPC failure', e)
    return upstreamError('Failed to read pending rewards from chain')
  }

  if (pendingETH === BigInt(0)) {
    return validationError('No ETH rewards to claim.', 'NOTHING_TO_CLAIM', {
      pendingEthWei: '0',
      pendingEthFormatted: '0',
    })
  }

  const data = encodeFunctionData({
    abi: claimEthAbi,
    functionName: 'claimETH',
    args: [],
  })

  const pendingFormatted = formatUnits(pendingETH, 18)

  return successEnvelope({
    to: CONTRACTS.GridMining.address,
    from,
    data,
    description: `Claim ${pendingFormatted} ETH from your MineBean mining rewards.`,
    meta: {
      validation: {
        pendingEthWei: pendingETH.toString(),
        pendingEthFormatted: pendingFormatted,
      },
    },
  })
}
