import { isAddress, encodeFunctionData, parseUnits, parseEther, formatUnits, erc20Abi } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { publicClient } from '@/lib/mcp/client'
import { successEnvelope, badRequest, validationError, upstreamError } from '@/lib/mcp/envelope'

// Base MCP prepare endpoint: deposit BEAN into the Staking contract.
// Encodes Staking.deposit(uint256 amount) payable.
// Optional `compoundFeeEth` query param funds the contract's per-user
// compoundFeeReserve (sent as msg.value).

const depositAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

export async function GET(req: Request) {
  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')
  const amountParam = url.searchParams.get('amount')
  const compoundFeeEthParam = url.searchParams.get('compoundFeeEth') ?? '0'

  if (!fromParam || !isAddress(fromParam)) {
    return badRequest('from must be a valid Ethereum address', { received: fromParam })
  }
  if (!amountParam) {
    return badRequest('amount is required (decimal BEAN, no "max")')
  }
  if (amountParam === 'max') {
    return badRequest('amount must be an explicit decimal BEAN value, not "max"')
  }
  const from = fromParam.toLowerCase() as `0x${string}`

  let parsedAmount: bigint
  try {
    parsedAmount = parseUnits(amountParam, 18)
  } catch {
    return badRequest('amount must be a decimal BEAN value', { received: amountParam })
  }
  if (parsedAmount <= BigInt(0)) {
    return badRequest('amount must be greater than 0', { received: amountParam })
  }

  let compoundFeeWei: bigint
  try {
    compoundFeeWei = parseEther(compoundFeeEthParam)
  } catch {
    return badRequest('compoundFeeEth must be a decimal ETH value', { received: compoundFeeEthParam })
  }
  if (compoundFeeWei < BigInt(0)) {
    return badRequest('compoundFeeEth must be >= 0')
  }

  // Pre-flight: balance + allowance via RPC
  let balance: bigint
  let allowance: bigint
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
        args: [from, CONTRACTS.Staking.address],
      }),
    ])
    balance = bal as bigint
    allowance = allow as bigint
  } catch (e) {
    console.error('[mcp/prepare/stake] RPC failure', e)
    return upstreamError('Failed to read balance / allowance from chain')
  }

  if (parsedAmount > balance) {
    return validationError('Stake amount exceeds wallet BEAN balance.', 'INSUFFICIENT_BALANCE', {
      requestedWei: parsedAmount.toString(),
      requestedFormatted: amountParam,
      balanceWei: balance.toString(),
      balanceFormatted: formatUnits(balance, 18),
    })
  }

  if (allowance < parsedAmount) {
    return validationError(
      'BEAN allowance is below stake amount. Call prepare/approve-bean first (or batch approve + stake via send_calls).',
      'INSUFFICIENT_ALLOWANCE',
      {
        requestedWei: parsedAmount.toString(),
        requestedFormatted: amountParam,
        allowanceWei: allowance.toString(),
        allowanceFormatted:
          allowance > (BigInt(1) << BigInt(128)) ? 'max' : formatUnits(allowance, 18),
      }
    )
  }

  const data = encodeFunctionData({
    abi: depositAbi,
    functionName: 'deposit',
    args: [parsedAmount],
  })

  const description =
    compoundFeeWei > BigInt(0)
      ? `Stake ${amountParam} BEAN into the MineBean Staking contract. Includes ${compoundFeeEthParam} ETH for the compound fee reserve.`
      : `Stake ${amountParam} BEAN into the MineBean Staking contract.`

  return successEnvelope({
    to: CONTRACTS.Staking.address,
    from,
    data,
    value: compoundFeeWei,
    description,
    meta: {
      validation: {
        requestedWei: parsedAmount.toString(),
        requestedFormatted: amountParam,
        balanceWei: balance.toString(),
        balanceFormatted: formatUnits(balance, 18),
        allowanceWei: allowance.toString(),
        allowanceFormatted:
          allowance > (BigInt(1) << BigInt(128)) ? 'max' : formatUnits(allowance, 18),
        compoundFeeEthWei: compoundFeeWei.toString(),
        compoundFeeEthFormatted: compoundFeeEthParam,
      },
    },
  })
}
