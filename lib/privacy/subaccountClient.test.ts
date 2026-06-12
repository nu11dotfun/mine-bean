import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decodeFunctionData, type Hex } from 'viem'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_DEPOSIT_ABI } from './config'
import { BUILDER_CODE_SUFFIX } from '../contracts'

// Mock viem's client builders; keep the pure encoders (encodeFunctionData,
// concatHex, decodeFunctionData) real.
const sendTransaction = vi.fn(async () => '0xdeposit' as Hex)
const getBytecode = vi.fn(async () => undefined as Hex | undefined)
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createWalletClient: vi.fn(() => ({ sendTransaction })),
    createPublicClient: vi.fn(() => ({ getBytecode })),
  }
})

import {
  depositFromSubaccount,
  sendContractWithSuffix,
  isContractAccount,
} from './subaccountClient'

const account = { address: '0x1111111111111111111111111111111111111111' } as any

beforeEach(() => {
  sendTransaction.mockClear()
  getBytecode.mockReset()
})

describe('depositFromSubaccount', () => {
  it('calls Entrypoint.deposit with the precommitment, the value, and NO builder suffix', async () => {
    await depositFromSubaccount({ account, precommitment: 333n, value: 7n })

    expect(sendTransaction).toHaveBeenCalledOnce()
    const arg = sendTransaction.mock.calls[0][0] as any
    expect(arg.to).toBe(ENTRYPOINT_ADDRESS)
    expect(arg.value).toBe(7n)
    expect(arg.account).toBe(account)

    // The calldata is a bare deposit(precommitment) — decodable, no suffix.
    const decoded = decodeFunctionData({ abi: ENTRYPOINT_DEPOSIT_ABI, data: arg.data })
    expect(decoded.functionName).toBe('deposit')
    expect(decoded.args).toEqual([333n])
  })
})

describe('sendContractWithSuffix (regression — deploys DO carry the suffix)', () => {
  it('appends the builder suffix to the calldata', async () => {
    await sendContractWithSuffix({
      client: { sendTransaction } as any,
      account,
      address: '0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0',
      abi: [
        { type: 'function', name: 'deploy', stateMutability: 'payable', inputs: [{ name: 'b', type: 'uint8[]' }], outputs: [] },
      ],
      functionName: 'deploy',
      args: [[1, 2]],
      value: 5n,
    })
    const arg = sendTransaction.mock.calls[0][0] as any
    expect(arg.data.endsWith(BUILDER_CODE_SUFFIX.slice(2))).toBe(true)
  })
})

describe('isContractAccount', () => {
  it('true when the address has bytecode (smart account)', async () => {
    getBytecode.mockResolvedValue('0x60806040' as Hex)
    expect(await isContractAccount(account.address)).toBe(true)
  })

  it('false for an EOA (no code / 0x)', async () => {
    getBytecode.mockResolvedValue(undefined)
    expect(await isContractAccount(account.address)).toBe(false)
    getBytecode.mockResolvedValue('0x' as Hex)
    expect(await isContractAccount(account.address)).toBe(false)
  })
})
