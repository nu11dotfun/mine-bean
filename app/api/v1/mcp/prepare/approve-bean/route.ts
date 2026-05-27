import { isAddress, encodeFunctionData, formatUnits, parseUnits, erc20Abi, maxUint256 } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { publicClient } from '@/lib/mcp/client'
import { successEnvelope, badRequest, upstreamError } from '@/lib/mcp/envelope'

// Base MCP prepare endpoint: ERC20 approve BEAN for a spender (default STAKING).
// Encodes Bean.approve(spender, amount). amount=max for MaxUint256.
// No validation failures — approve is always callable, even with 0 balance.

export async function GET(req: Request) {
  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')
  const amountParam = url.searchParams.get('amount')
  const spenderParam = url.searchParams.get('spender')

  if (!fromParam || !isAddress(fromParam)) {
    return badRequest('from must be a valid Ethereum address', { received: fromParam })
  }
  if (!amountParam) {
    return badRequest('amount is required (decimal BEAN or "max")')
  }

  const from = fromParam.toLowerCase() as `0x${string}`
  const spender = (spenderParam && isAddress(spenderParam)
    ? (spenderParam as `0x${string}`)
    : CONTRACTS.Staking.address)

  let parsedAmount: bigint
  if (amountParam === 'max') {
    parsedAmount = maxUint256
  } else {
    try {
      parsedAmount = parseUnits(amountParam, 18)
    } catch {
      return badRequest('amount must be "max" or a decimal BEAN value', { received: amountParam })
    }
  }

  // Read context for the meta block (balance + current allowance). Non-fatal if it fails.
  let balance: bigint = BigInt(0)
  let currentAllowance: bigint = BigInt(0)
  try {
    const [bal, allow] = await Promise.all([
      publicClient.readContract({
        address: CONTRACTS.Bean.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [from],
      }),
      publicClient.readContract({
        address: CONTRACTS.Bean.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [from, spender],
      }),
    ])
    balance = bal as bigint
    currentAllowance = allow as bigint
  } catch (e) {
    console.error('[mcp/prepare/approve-bean] RPC failure (non-fatal, continuing)', e)
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, parsedAmount],
  })

  const spenderLabel = spender === CONTRACTS.Staking.address ? 'MineBean Staking' : spender
  const description =
    amountParam === 'max'
      ? `Approve ${spenderLabel} to spend unlimited BEAN from your wallet.`
      : `Approve ${spenderLabel} to spend up to ${amountParam} BEAN.`

  return successEnvelope({
    to: CONTRACTS.Bean.address,
    from,
    data,
    description,
    meta: {
      validation: {
        spender,
        spenderLabel,
        balanceWei: balance.toString(),
        balanceFormatted: formatUnits(balance, 18),
        currentAllowanceWei: currentAllowance.toString(),
        currentAllowanceFormatted:
          currentAllowance > BigInt(1) << BigInt(128)
            ? 'max'
            : formatUnits(currentAllowance, 18),
        requestedAmount: amountParam,
      },
    },
  })
}
