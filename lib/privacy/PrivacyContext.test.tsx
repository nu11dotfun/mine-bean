import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { keccak256, toHex, type Hex, type Address } from 'viem'

import { PrivacyProvider, usePrivacy, NeedsDepositError, NeedsExportError } from './PrivacyContext'
import { subaccountAddressFromSignature, buildDerivationMessage } from './subaccount'
import { addNote, loadNotes, markExported, saveCachedSubaccountAddress, type PrivateNote } from './notes'
import { saveProof, loadProof, type CachedProof } from './proofCache'
import { RelayerError } from './relayerClient'
import { SUBACCOUNT_GAS_BUFFER, ENTRYPOINT_ADDRESS } from './config'

const MAIN = '0xabc0000000000000000000000000000000000001' as Address
const SIG = keccak256(toHex('signature-a')) as Hex
const SUB = subaccountAddressFromSignature(SIG)

// ---- mocks ----------------------------------------------------------------
// vi.mock factories are hoisted above imports, so everything they reference
// must come from vi.hoisted.

const {
  signMessageAsync,
  writeContractAsync,
  recoverMessageAddress,
  relayer,
  withdrawal,
  depositMod,
  subClient,
} = vi.hoisted(() => {
  const ENTRYPOINT = '0xF1310bB55EA962C56Ed67D15c79C7b0f5055d370'
  const MAIN_ADDR = '0xabc0000000000000000000000000000000000001'
  return {
    signMessageAsync: vi.fn(),
    writeContractAsync: vi.fn(async () => '0xdeposit'),
    // EOA: the derivation signature recovers to the connected main address.
    recoverMessageAddress: vi.fn(async () => MAIN_ADDR),
    relayer: {
      getRelayerInfo: vi.fn(async () => ({ entrypoint: ENTRYPOINT, aspRoot: '222', publishedRoot: '222', approved: 1 })),
      getStateLeaves: vi.fn(async () => [] as bigint[]),
      getAspProof: vi.fn(async () => ({ root: '222', depth: 1, index: 0, siblings: ['0'] })),
      pollAspProof: vi.fn(async () => ({ root: '222', depth: 1, index: 0, siblings: ['0'] })),
      pollAspProofPublished: vi.fn(async () => ({ root: '222', depth: 1, index: 0, siblings: ['0'] })),
      relayWithdrawal: vi.fn(async () => '0xrelay'),
    },
    withdrawal: {
      proveNoteWithdrawal: vi.fn(async () => ({
        withdrawal: { processooor: ENTRYPOINT, data: '0xdead' },
        proof: {
          proof: { pi_a: [], pi_b: [], pi_c: [], protocol: 'groth16', curve: 'bn128' },
          publicSignals: [],
        },
        scope: '12901289605159910316638194281312061245557881706842167749120449807259745070144',
        stateRoot: '111',
        aspRoot: '222',
      })),
      stateRootOf: vi.fn(async () => 111n),
    },
    depositMod: {
      prepareDeposit: vi.fn(async () => ({
        depositIndex: 0,
        secrets: { nullifier: 1n, secret: 2n, precommitment: 333n },
      })),
      extractNoteFromReceipt: vi.fn(async (_r: unknown, _p: unknown, tags: any = {}) => ({
        label: tags.purpose === 'cashout' ? (tags.pool === 'bean' ? '888' : '777') : '123',
        value: '1000000000000000',
        commitment: '444',
        depositIndex: tags.purpose === 'cashout' ? 1 : 0,
        spent: false,
        txHash: '0xdeposit',
        createdAt: 1,
        purpose: tags.purpose ?? 'funding',
        depositor: tags.depositor ?? 'main',
        pool: tags.pool ?? 'eth',
      })),
    },
    subClient: {
      createSubaccountClient: vi.fn(() => ({})),
      sendContractWithSuffix: vi.fn(async () => '0xprivatetx'),
      getSubBalance: vi.fn(async () => 0n),
      getSubTokenBalance: vi.fn(async () => 0n),
      waitForBalanceAtLeast: vi.fn(async (_a: unknown, min: bigint) => min),
      waitForReceipt: vi.fn(async () => ({})),
      depositFromSubaccount: vi.fn(async () => '0xcashoutdeposit'),
      approveErc20FromSubaccount: vi.fn(async () => '0xapprove'),
      depositErc20FromSubaccount: vi.fn(async () => '0xbeandeposit'),
      estimateDepositGasReserve: vi.fn(async () => 100_000_000_000_000n),
      estimateErc20CashoutGasReserve: vi.fn(async () => 100_000_000_000_000n),
      getPoolAssetConfig: vi.fn(async () => ({
        pool: ENTRYPOINT,
        minimumDepositAmount: 0n,
        vettingFeeBPS: 50n,
        maxRelayFeeBPS: 1000n,
      })),
      isContractAccount: vi.fn(async () => false),
    },
  }
})

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0xabc0000000000000000000000000000000000001',
    connector: { id: 'metaMask' },
  }),
  useSignMessage: () => ({ signMessageAsync }),
  useWriteContract: () => ({ writeContractAsync }),
}))

// Keep viem real except for the EOA-signature recovery guard.
vi.mock('viem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('viem')>()),
  recoverMessageAddress,
}))

vi.mock('./keys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./keys')>()),
  deriveDepositMasterKeys: vi.fn(async () => ({ masterNullifier: 1n, masterSecret: 2n })),
}))

// Re-spread keeps RelayerError real while stubbing the calls.
vi.mock('./relayerClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./relayerClient')>()),
  ...relayer,
}))

vi.mock('./withdrawal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./withdrawal')>()),
  ...withdrawal,
}))

vi.mock('./deposit', () => depositMod)

vi.mock('./circuits', () => ({
  prefetchArtifacts: vi.fn(async () => undefined),
}))

vi.mock('./subaccountClient', () => subClient)

// ---- helpers ---------------------------------------------------------------

const NOTE: PrivateNote = {
  label: '123',
  value: '1000000000000000',
  commitment: '444',
  depositIndex: 0,
  spent: false,
  txHash: '0xdeposit',
  createdAt: 1,
}

const currentProof = (): CachedProof => ({
  noteLabel: '123',
  withdrawal: { processooor: ENTRYPOINT_ADDRESS, data: '0xdead' },
  proof: {
    proof: { pi_a: ['1'], pi_b: [['2']], pi_c: ['3'], protocol: 'groth16', curve: 'bn128' },
    publicSignals: ['4'],
  },
  stateRoot: '111',
  aspRoot: '222',
  subaccountAddress: SUB,
  generatedAt: 1,
})

function setup() {
  return renderHook(() => usePrivacy(), {
    wrapper: ({ children }) => <PrivacyProvider>{children}</PrivacyProvider>,
  })
}

async function enabled() {
  const hook = setup()
  await act(async () => {
    await hook.result.current.enablePrivateMode()
  })
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  signMessageAsync.mockResolvedValue(SIG)
  recoverMessageAddress.mockResolvedValue(MAIN) // EOA: recovers to main
  writeContractAsync.mockResolvedValue('0xdeposit')
  subClient.getSubBalance.mockResolvedValue(0n)
  subClient.waitForBalanceAtLeast.mockImplementation(
    async (_a: unknown, min: bigint) => min
  )
  subClient.isContractAccount.mockResolvedValue(false)
  // Default to "key already backed up" so happy-path tests aren't blocked by
  // the export gate; gate-specific tests clear it.
  markExported(MAIN)
})

// ---- tests -----------------------------------------------------------------

describe('enablePrivateMode', () => {
  it('signs the canonical message and switches identity to the subaccount', async () => {
    const { result } = await enabled()
    expect(signMessageAsync).toHaveBeenCalledWith({
      message: buildDerivationMessage(MAIN),
    })
    expect(result.current.enabled).toBe(true)
    expect(result.current.subaccountAddress).toBe(SUB)
    expect(result.current.effectiveAddress).toBe(SUB)
    expect(result.current.determinismWarning).toBe(false)
  })

  it('hard-errors when re-derivation does not match the cached subaccount', async () => {
    saveCachedSubaccountAddress(
      MAIN,
      '0x9999999999999999999999999999999999999999' as Address
    )
    const { result } = setup()
    await act(async () => {
      await expect(result.current.enablePrivateMode()).rejects.toThrow(
        /does not match the original/
      )
    })
    expect(result.current.enabled).toBe(false)
    expect(result.current.status).toBe('error')
  })

  it('effectiveAddress falls back to main when disabled', async () => {
    const { result } = await enabled()
    act(() => result.current.disablePrivateMode())
    expect(result.current.effectiveAddress).toBe(MAIN)
    expect(result.current.subaccountAddress).toBeNull()
  })
})

describe('depositToPool', () => {
  it('deposits via the entrypoint with the derived precommitment and stores the note', async () => {
    const { result } = await enabled()
    await act(async () => {
      await result.current.depositToPool(1000000000000000n)
    })
    expect(writeContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ENTRYPOINT_ADDRESS,
        functionName: 'deposit',
        args: [333n],
        value: 1000000000000000n,
      })
    )
    expect(relayer.pollAspProof).toHaveBeenCalledWith('123')
    expect(loadNotes(MAIN)).toHaveLength(1)
    expect(result.current.unspentNote?.label).toBe('123')
  })

  it('refuses a second deposit while a note is unspent', async () => {
    addNote(MAIN, NOTE)
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.depositToPool(1n)).rejects.toThrow(
        /already have funds/
      )
    })
    expect(writeContractAsync).not.toHaveBeenCalled()
  })

  it('rejects a deposit below the pool minimum without sending a tx', async () => {
    const { result } = await enabled()
    // Fallback minimum is 0.001 ETH; 0.0005 is below it.
    await act(async () => {
      await expect(result.current.depositToPool(500000000000000n)).rejects.toThrow(
        /minimum deposit/
      )
    })
    expect(writeContractAsync).not.toHaveBeenCalled()
  })
})

describe('ensureFunded', () => {
  it('fast path: no note + subaccount has balance → no relay', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n)
    const { result } = await enabled()
    await act(async () => {
      await result.current.ensureFunded(1000n)
    })
    expect(relayer.relayWithdrawal).not.toHaveBeenCalled()
  })

  it('flushes a pooled note on deploy even when the subaccount already covers it', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n) // already covers
    addNote(MAIN, NOTE) // but pooled funds exist (approved by default mock)
    saveProof(MAIN, currentProof())
    const { result } = await enabled()
    await act(async () => {
      await result.current.ensureFunded(1000n)
    })
    expect(relayer.relayWithdrawal).toHaveBeenCalledOnce()
    expect(loadNotes(MAIN)[0].spent).toBe(true)
  })

  it('does NOT block a funded subaccount on a not-yet-approved note', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n) // already covers
    addNote(MAIN, NOTE)
    // Persistent (the background watcher also calls getAspProof); restored below.
    relayer.getAspProof.mockRejectedValue(
      new RelayerError('label not approved yet', 400)
    )
    const { result } = await enabled()
    await act(async () => {
      await result.current.ensureFunded(1000n)
    })
    // Deploys from existing balance now; the note flushes on a later deploy.
    expect(relayer.relayWithdrawal).not.toHaveBeenCalled()
    expect(relayer.pollAspProofPublished).not.toHaveBeenCalled()
    expect(loadNotes(MAIN)[0].spent).toBe(false)
    relayer.getAspProof.mockResolvedValue({ root: '222', depth: 1, index: 0, siblings: ['0'] })
  })

  it('throws NeedsDepositError when no note exists', async () => {
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.ensureFunded(1000n)).rejects.toBeInstanceOf(
        NeedsDepositError
      )
    })
  })

  it('uses the cached proof (no re-prove), relays, marks spent, clears cache', async () => {
    addNote(MAIN, NOTE)
    saveProof(MAIN, currentProof())
    const { result } = await enabled()
    await act(async () => {
      await result.current.ensureFunded(1000n)
    })
    expect(withdrawal.proveNoteWithdrawal).not.toHaveBeenCalled()
    expect(relayer.relayWithdrawal).toHaveBeenCalledOnce()
    expect(loadNotes(MAIN)[0].spent).toBe(true)
    expect(loadProof(MAIN)).toBeNull()
    expect(result.current.status).toBe('funded')
    expect(subClient.waitForBalanceAtLeast).toHaveBeenCalledWith(
      SUB,
      1000n + SUBACCOUNT_GAS_BUFFER
    )
  })

  it('proves on demand when no cached proof exists', async () => {
    addNote(MAIN, NOTE)
    const { result } = await enabled()
    await act(async () => {
      await result.current.ensureFunded(1000n)
    })
    expect(withdrawal.proveNoteWithdrawal).toHaveBeenCalled()
    expect(relayer.relayWithdrawal).toHaveBeenCalled()
  })

  it('does NOT mark the note spent when the relay fails', async () => {
    addNote(MAIN, NOTE)
    saveProof(MAIN, currentProof())
    relayer.relayWithdrawal.mockRejectedValueOnce(new Error('simulation reverted'))
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.ensureFunded(1000n)).rejects.toThrow(
        'simulation reverted'
      )
    })
    expect(loadNotes(MAIN)[0].spent).toBe(false)
    // Stale-proof suspicion → cache cleared for a fresh background re-prove.
    expect(loadProof(MAIN)).toBeNull()
    expect(result.current.status).toBe('error')
  })

  it('rejects amounts the note + balance cannot cover', async () => {
    addNote(MAIN, NOTE)
    const { result } = await enabled()
    await act(async () => {
      await expect(
        result.current.ensureFunded(10n ** 18n)
      ).rejects.toThrow(/not enough private funds/)
    })
    expect(relayer.relayWithdrawal).not.toHaveBeenCalled()
  })

  it('retries on IncorrectASPRoot — clears stale cached proof and re-proves', async () => {
    addNote(MAIN, NOTE)
    saveProof(MAIN, currentProof())
    relayer.relayWithdrawal
      .mockRejectedValueOnce(new Error('execution reverted: IncorrectASPRoot()'))
      .mockResolvedValueOnce('0xrelay-success')
    const { result } = await enabled()
    await act(async () => {
      await result.current.ensureFunded(1000n)
    })
    expect(relayer.relayWithdrawal).toHaveBeenCalledTimes(2)
    // First attempt used cached, second was a fresh prove.
    expect(withdrawal.proveNoteWithdrawal).toHaveBeenCalledTimes(1)
    expect(loadProof(MAIN)).toBeNull() // stale cache was cleared
    expect(loadNotes(MAIN)[0].spent).toBe(true)
    expect(result.current.status).toBe('funded')
  })
})

describe('background proving watcher', () => {
  it('pre-proves and caches once a live approved note exists', async () => {
    addNote(MAIN, NOTE)
    const { result } = await enabled()
    await waitFor(() => {
      expect(result.current.proofState).toBe('ready')
    })
    expect(withdrawal.proveNoteWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ note: expect.objectContaining({ label: '123' }), recipient: SUB })
    )
    expect(loadProof(MAIN)?.noteLabel).toBe('123')
  })
})

describe('sendPrivateTx', () => {
  it('signs with the subaccount and appends the builder suffix path', async () => {
    const { result } = await enabled()
    let hash: Hex | undefined
    await act(async () => {
      hash = await result.current.sendPrivateTx({
        address: '0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0',
        abi: [],
        functionName: 'deploy',
        args: [[1, 2]],
        value: 5n,
      })
    })
    expect(hash).toBe('0xprivatetx')
    expect(subClient.sendContractWithSuffix).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'deploy', value: 5n })
    )
  })
})

describe('cashOut (subaccount → pool → main)', () => {
  it('deposits from the subaccount then withdraws to MAIN — never a direct transfer', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n) // 1 ETH
    const { result } = await enabled()
    await act(async () => {
      await result.current.cashOut()
    })

    // Step 1: pool deposit signed by the subaccount.
    expect(subClient.depositFromSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ precommitment: 333n })
    )
    // Step 3: withdrawal proof addressed to MAIN, not the subaccount.
    expect(withdrawal.proveNoteWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: MAIN })
    )
    // Step 4: relayed, then the cashout note is marked spent.
    expect(relayer.relayWithdrawal).toHaveBeenCalledOnce()
    expect(loadNotes(MAIN).find((n) => n.purpose === 'cashout')?.spent).toBe(true)
    expect(result.current.cashoutStatus).toBe('done')
  })

  it('tags the cashout note {purpose:cashout, depositor:subaccount}', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n)
    const { result } = await enabled()
    await act(async () => {
      await result.current.cashOut()
    })
    expect(depositMod.extractNoteFromReceipt).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { purpose: 'cashout', depositor: 'subaccount', pool: 'eth' }
    )
  })

  it('resumes an interrupted cashout without depositing again', async () => {
    // A prior attempt already landed the deposit → unspent cashout note exists.
    addNote(MAIN, {
      label: '777', value: '900000000000000', commitment: '5',
      depositIndex: 1, spent: false, txHash: '0x', createdAt: 1,
      purpose: 'cashout', depositor: 'subaccount',
    })
    const { result } = await enabled()
    await act(async () => {
      await result.current.cashOut()
    })
    expect(subClient.depositFromSubaccount).not.toHaveBeenCalled()
    expect(withdrawal.proveNoteWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: MAIN })
    )
    expect(relayer.relayWithdrawal).toHaveBeenCalledOnce()
  })

  it('leaves the cashout note unspent when the relay fails (funds safe in pool)', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n)
    relayer.relayWithdrawal.mockRejectedValueOnce(new Error('relay reverted'))
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.cashOut()).rejects.toThrow('relay reverted')
    })
    expect(loadNotes(MAIN).find((n) => n.purpose === 'cashout')?.spent).toBe(false)
    expect(result.current.cashoutStatus).toBe('error')
    expect(result.current.ethCashoutInFlight).toBe(true)
  })

  it('rejects when the subaccount cannot cover the deposit gas', async () => {
    subClient.getSubBalance.mockResolvedValue(0n)
    subClient.estimateDepositGasReserve.mockResolvedValue(100_000_000_000_000n)
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.cashOut()).rejects.toThrow(/too low/)
    })
    expect(subClient.depositFromSubaccount).not.toHaveBeenCalled()
  })

  it('retries on IncorrectASPRoot — reproves and relays successfully', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n)
    relayer.relayWithdrawal
      .mockRejectedValueOnce(new Error('execution reverted: IncorrectASPRoot()'))
      .mockResolvedValueOnce('0xrelay-success')
    const { result } = await enabled()
    await act(async () => {
      await result.current.cashOut()
    })
    expect(relayer.relayWithdrawal).toHaveBeenCalledTimes(2)
    expect(withdrawal.proveNoteWithdrawal).toHaveBeenCalledTimes(2) // re-proves
    expect(result.current.cashoutStatus).toBe('done')
    expect(loadNotes(MAIN).find((n) => n.purpose === 'cashout')?.spent).toBe(true)
  })

  it('gives up after MAX_RELAY_ATTEMPTS persistent IncorrectASPRoot reverts', async () => {
    subClient.getSubBalance.mockResolvedValue(10n ** 18n)
    relayer.relayWithdrawal.mockRejectedValue(
      new Error('execution reverted: IncorrectASPRoot()')
    )
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.cashOut()).rejects.toThrow(/IncorrectASPRoot/)
    })
    expect(relayer.relayWithdrawal).toHaveBeenCalledTimes(3)
    // Funds remain in the pool (note unspent) — user can retry later.
    expect(loadNotes(MAIN).find((n) => n.purpose === 'cashout')?.spent).toBe(false)
    relayer.relayWithdrawal.mockResolvedValue('0xrelay') // restore for other tests
  })
})

describe('cashOut BEAN (subaccount → BEAN pool → main)', () => {
  const ONE_BEAN = 10n ** 18n

  it('approves then deposits BEAN, proves to MAIN, relays with the BEAN scope', async () => {
    subClient.getSubTokenBalance.mockResolvedValue(ONE_BEAN)
    subClient.getSubBalance.mockResolvedValue(10n ** 18n) // ETH for gas
    const { result } = await enabled()
    await act(async () => {
      await result.current.cashOut('bean')
    })

    // approve BEFORE deposit, both ERC20-routed.
    expect(subClient.approveErc20FromSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ amount: ONE_BEAN })
    )
    expect(subClient.depositErc20FromSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ amount: ONE_BEAN, precommitment: 333n })
    )
    expect(subClient.depositFromSubaccount).not.toHaveBeenCalled() // not the ETH path
    // note tagged pool:bean; proof to main; relay uses the proof's (bean) scope.
    expect(depositMod.extractNoteFromReceipt).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { purpose: 'cashout', depositor: 'subaccount', pool: 'bean' }
    )
    expect(withdrawal.proveNoteWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: MAIN })
    )
    expect(relayer.relayWithdrawal).toHaveBeenCalledOnce()
    expect(result.current.cashoutAsset).toBe('bean')
    expect(result.current.cashoutStatus).toBe('done')
    expect(loadNotes(MAIN).find((n) => n.pool === 'bean')?.spent).toBe(true)
  })

  it('rejects when BEAN balance is below the pool minimum', async () => {
    subClient.getSubTokenBalance.mockResolvedValue(500_000_000_000_000n) // 0.0005 BEAN
    subClient.getSubBalance.mockResolvedValue(10n ** 18n)
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.cashOut('bean')).rejects.toThrow(/not enough BEAN/)
    })
    expect(subClient.approveErc20FromSubaccount).not.toHaveBeenCalled()
  })

  it('rejects when there is no ETH for gas', async () => {
    subClient.getSubTokenBalance.mockResolvedValue(ONE_BEAN)
    subClient.getSubBalance.mockResolvedValue(0n)
    subClient.estimateErc20CashoutGasReserve.mockResolvedValue(100_000_000_000_000n)
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.cashOut('bean')).rejects.toThrow(/not enough ETH/)
    })
    expect(subClient.approveErc20FromSubaccount).not.toHaveBeenCalled()
  })

  it('resumes a BEAN cashout without re-depositing', async () => {
    addNote(MAIN, {
      label: '888', value: '1000000000000000', commitment: '5',
      depositIndex: 0, spent: false, txHash: '0x', createdAt: 1,
      purpose: 'cashout', depositor: 'subaccount', pool: 'bean',
    })
    const { result } = await enabled()
    await act(async () => {
      await result.current.cashOut('bean')
    })
    expect(subClient.approveErc20FromSubaccount).not.toHaveBeenCalled()
    expect(subClient.depositErc20FromSubaccount).not.toHaveBeenCalled()
    expect(relayer.relayWithdrawal).toHaveBeenCalledOnce()
  })
})

describe('smart-account block', () => {
  it('refuses to enable for a contract account and flags isSmartAccount', async () => {
    subClient.isContractAccount.mockResolvedValue(true)
    const { result } = setup()
    await act(async () => {
      await expect(result.current.enablePrivateMode()).rejects.toThrow(/EOA/)
    })
    expect(signMessageAsync).not.toHaveBeenCalled()
    expect(result.current.enabled).toBe(false)
    await waitFor(() => expect(result.current.isSmartAccount).toBe(true))
  })

  it('enables normally for an EOA', async () => {
    subClient.isContractAccount.mockResolvedValue(false)
    const { result } = await enabled()
    expect(result.current.enabled).toBe(true)
    expect(result.current.isSmartAccount).toBe(false)
  })

  it('blocks a counterfactual smart wallet whose signature does NOT recover to main', async () => {
    // Bytecode check passes (not deployed yet), but the signature recovers to
    // a different address (e.g. a passkey/ERC-6492 wallet) → block before
    // deriving, so no unreproducible subaccount is created.
    subClient.isContractAccount.mockResolvedValue(false)
    recoverMessageAddress.mockResolvedValue('0x9999999999999999999999999999999999999999')
    const { result } = setup()
    await act(async () => {
      await expect(result.current.enablePrivateMode()).rejects.toThrow(/EOA|smart account/)
    })
    expect(result.current.enabled).toBe(false)
    expect(result.current.subaccountAddress).toBeNull()
    await waitFor(() => expect(result.current.isSmartAccount).toBe(true))
  })

  it('blocks when the signature is not a recoverable ECDSA sig (recover throws)', async () => {
    subClient.isContractAccount.mockResolvedValue(false)
    recoverMessageAddress.mockRejectedValue(new Error('invalid signature'))
    const { result } = setup()
    await act(async () => {
      await expect(result.current.enablePrivateMode()).rejects.toThrow(/EOA|smart account/)
    })
    expect(result.current.enabled).toBe(false)
  })
})

describe('export-key backup gate', () => {
  it('blocks deposit until the key is backed up', async () => {
    window.localStorage.clear() // not yet exported
    const { result } = await enabled()
    expect(result.current.hasExported).toBe(false)
    await act(async () => {
      await expect(
        result.current.depositToPool(1000000000000000n)
      ).rejects.toBeInstanceOf(NeedsExportError)
    })
    expect(writeContractAsync).not.toHaveBeenCalled()
  })

  it('blocks ensureFunded (deploy/claim) until the key is backed up', async () => {
    window.localStorage.clear()
    addNote(MAIN, NOTE)
    const { result } = await enabled()
    await act(async () => {
      await expect(result.current.ensureFunded(1000n)).rejects.toBeInstanceOf(
        NeedsExportError
      )
    })
    expect(relayer.relayWithdrawal).not.toHaveBeenCalled()
  })

  it('confirmExported sets the flag and unblocks deposits', async () => {
    window.localStorage.clear()
    const { result } = await enabled()
    expect(result.current.hasExported).toBe(false)
    act(() => result.current.confirmExported())
    expect(result.current.hasExported).toBe(true)
    await act(async () => {
      await result.current.depositToPool(1000000000000000n)
    })
    expect(writeContractAsync).toHaveBeenCalled()
  })

  it('exportPrivateKey returns a file with the key + addresses, no secrets leaked elsewhere', async () => {
    const { result } = await enabled()
    let file: { fileName: string; content: string } | undefined
    act(() => {
      file = result.current.exportPrivateKey()
    })
    expect(file!.fileName).toMatch(/^bean-private-account-0x[0-9a-fA-F]+\.txt$/)
    expect(file!.content).toMatch(/Private key:\s+0x[0-9a-f]{64}/)
    expect(file!.content).toContain(SUB)
  })
})
