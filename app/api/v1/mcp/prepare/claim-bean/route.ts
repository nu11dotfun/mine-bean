import { isAddress, encodeFunctionData, formatUnits } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { publicClient } from '@/lib/mcp/client'
import { successEnvelope, badRequest, validationError, upstreamError } from '@/lib/mcp/envelope'
import { fmtForDescription } from '@/lib/mcp/format'

// Base MCP prepare endpoint: claim mining BEAN rewards.
// Encodes GridMining.claimBEAN() — no args, non-payable.
// Pre-flights via getTotalPendingRewards to compute gross / fee / net BEAN.
// Returns NOTHING_TO_CLAIM when pendingBeanGross is 0.

const claimBeanAbi = [
  { name: 'claimBEAN', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
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

const BEAN_FEE_BPS = 1000 // 10% fee on unroasted only — matches backend logic

export async function GET(req: Request) {
  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')

  if (!fromParam || !isAddress(fromParam)) {
    return badRequest('from must be a valid Ethereum address', { received: fromParam })
  }
  const from = fromParam.toLowerCase() as `0x${string}`

  let pendingUnroasted: bigint
  let pendingRoasted: bigint
  try {
    const tuple = (await publicClient.readContract({
      address: CONTRACTS.GridMining.address,
      abi: getTotalPendingRewardsAbi,
      functionName: 'getTotalPendingRewards',
      args: [from],
    })) as readonly [bigint, bigint, bigint, bigint]
    pendingUnroasted = tuple[1]
    pendingRoasted = tuple[2]
  } catch (e) {
    console.error('[mcp/prepare/claim-bean] RPC failure', e)
    return upstreamError('Failed to read pending rewards from chain')
  }

  const grossBean = pendingUnroasted + pendingRoasted
  const feeBean = (pendingUnroasted * BigInt(BEAN_FEE_BPS)) / BigInt(10_000)
  const netBean = grossBean - feeBean

  if (grossBean === BigInt(0)) {
    return validationError('No BEAN rewards to claim.', 'NOTHING_TO_CLAIM', {
      pendingBeanGrossWei: '0',
      pendingBeanGrossFormatted: '0',
    })
  }

  const data = encodeFunctionData({
    abi: claimBeanAbi,
    functionName: 'claimBEAN',
    args: [],
  })

  const netFormatted = fmtForDescription(netBean)
  const feeFormatted = fmtForDescription(feeBean)

  return successEnvelope({
    to: CONTRACTS.GridMining.address,
    from,
    data,
    description: `Claim ${netFormatted} BEAN from your MineBean mining rewards (after the ${feeFormatted} BEAN unroasted fee).`,
    meta: {
      validation: {
        pendingBeanGrossWei: grossBean.toString(),
        pendingBeanGrossFormatted: formatUnits(grossBean, 18),
        pendingBeanFeeWei: feeBean.toString(),
        pendingBeanFeeFormatted: formatUnits(feeBean, 18),
        pendingBeanNetWei: netBean.toString(),
        pendingBeanNetFormatted: formatUnits(netBean, 18),
        unroastedFormatted: formatUnits(pendingUnroasted, 18),
        roastedFormatted: formatUnits(pendingRoasted, 18),
      },
    },
  })
}
