'use client'

/**
 * BEAN Private Deploys — privacy mode provider
 *
 * Owns the whole private-mode lifecycle:
 *
 *   enable (1 signature) ──► deposit (main → pool, public) ──► ASP approval
 *        │                                                          │
 *        │                 background watcher: prefetch artifacts,  │
 *        │                 pre-prove the withdrawal, keep it fresh ◄┘
 *        ▼
 *   ensureFunded() at write time: relay the (pre-proven) withdrawal
 *   pool → subaccount, then the caller executes from the subaccount.
 *
 * While `enabled`, `effectiveAddress` is the SUBACCOUNT — the rest of the app
 * (SSE, rewards, grid) threads it everywhere the connected address normally
 * goes, so the game UI simply "is" the private account.
 *
 * SECRETS: the derived subaccount key and deposit master keys live in a ref,
 * memory only — never state, never storage, never the network. Dropped on
 * disable/disconnect/account-switch. Everything is re-derivable by
 * re-signing, so dropping them costs one popup.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { recoverMessageAddress, type Address, type Hex, type Abi } from 'viem'
import { base } from 'viem/chains'
import { useAccount, useSignMessage, useWriteContract } from 'wagmi'
import type { MasterKeys } from '@0xbow/privacy-pools-core-sdk'

import {
  buildDerivationMessage,
  derivePrivateKeyFromSignature,
  isDeterminismAssumedSafe,
} from './subaccount'
import { deriveDepositMasterKeys } from './keys'
import {
  ENTRYPOINT_ADDRESS,
  ENTRYPOINT_DEPOSIT_ABI,
  POOL_SCOPE,
  SUBACCOUNT_GAS_BUFFER,
  MIN_DEPOSIT_WEI,
  ETH_POOL,
  BEAN_POOL,
  BEAN_TOKEN_ADDRESS,
} from './config'
import {
  loadNotes,
  addNote,
  markSpent,
  getUnspentNote,
  getUnspentCashoutNote,
  notePurpose,
  notePool,
  loadCachedSubaccountAddress,
  saveCachedSubaccountAddress,
  hasExportedKey,
  markExported,
  type PrivateNote,
} from './notes'
import { prepareDeposit, extractNoteFromReceipt } from './deposit'
import {
  getRelayerInfo,
  getStateLeaves,
  getAspProof,
  pollAspProof,
  pollAspProofPublished,
  isAspRootMismatch,
  relayWithdrawal,
  RelayerError,
} from './relayerClient'
import { proveNoteWithdrawal, stateRootOf, type ProvenWithdrawal } from './withdrawal'
import {
  loadProof,
  saveProof,
  clearProof,
  isProofCurrent,
  type CachedProof,
} from './proofCache'
import { prefetchArtifacts, type ArtifactProgress } from './circuits'
import {
  createSubaccountClient,
  sendContractWithSuffix,
  getSubBalance,
  waitForBalanceAtLeast,
  waitForReceipt,
  depositFromSubaccount,
  estimateDepositGasReserve,
  getPoolAssetConfig,
  isContractAccount,
  getSubTokenBalance,
  approveErc20FromSubaccount,
  depositErc20FromSubaccount,
  estimateErc20CashoutGasReserve,
} from './subaccountClient'

/** Thrown by ensureFunded when there is nothing to fund from. */
export class NeedsDepositError extends Error {
  constructor() {
    super('no funds in the privacy pool — deposit first')
    this.name = 'NeedsDepositError'
  }
}

/** BEAN pool minimum deposit: 0.001 BEAN (18 decimals) = 1e15. */
const BEAN_POOL_MIN = 1_000_000_000_000_000n

/** Thrown when a write is attempted before the user has backed up their key. */
export class NeedsExportError extends Error {
  constructor() {
    super('back up your private account key before adding funds')
    this.name = 'NeedsExportError'
  }
}

export type FundingStatus =
  | 'idle'
  | 'deriving'
  | 'depositing'
  | 'awaiting-approval'
  | 'proving'
  | 'relaying'
  | 'funded'
  | 'error'

export type ProofState = 'none' | 'preparing' | 'ready'

/** Cashout is its own multi-step flow, tracked separately from funding. */
export type CashoutStatus =
  | 'idle'
  | 'approving'
  | 'depositing'
  | 'awaiting-approval'
  | 'proving'
  | 'relaying'
  | 'done'
  | 'error'

export interface PrivacyContextValue {
  /** Private mode is on: the subaccount is the app's effective identity. */
  enabled: boolean
  status: FundingStatus
  statusDetail: string
  error: string | null
  subaccountAddress: Address | null
  /** Subaccount while enabled, otherwise the connected main address. */
  effectiveAddress: Address | undefined
  notes: PrivateNote[]
  unspentNote: PrivateNote | undefined
  subBalance: bigint
  /** Background proof readiness — 'ready' means deploys are relay-fast. */
  proofState: ProofState
  artifactProgress: ArtifactProgress | null
  /** True when the wallet's signatures may not be deterministic. */
  determinismWarning: boolean
  /** Connected wallet is a smart-contract account — private mode is blocked. */
  isSmartAccount: boolean
  /** User has backed up (downloaded + acknowledged) their subaccount key. */
  hasExported: boolean
  /** Live pool deposit fee in basis points (e.g. 50 = 0.5%). 0 until read. */
  vettingFeeBps: number
  /** Minimum deposit the Entrypoint accepts, in wei (live, with fallback). */
  minDepositWei: bigint
  /** Subaccount BEAN balance (wei). Polled while enabled. */
  subBeanBalance: bigint
  /** Cashout progress (separate from funding `status`). */
  cashoutStatus: CashoutStatus
  cashoutDetail: string
  /** Which asset the active/last cashout is for (drives the panel UI). */
  cashoutAsset: 'eth' | 'bean' | null
  /** Interrupted ETH cashout (deposit landed, funds safe in the ETH pool). */
  ethCashoutInFlight: boolean
  /** Interrupted BEAN cashout (deposit landed, funds safe in the BEAN pool). */
  beanCashoutInFlight: boolean
  enablePrivateMode: () => Promise<void>
  disablePrivateMode: () => void
  /** Build the backup .txt (key + address). Caller triggers the download. */
  exportPrivateKey: () => { fileName: string; content: string }
  /** Record that the user saved their key — unlocks deposit/deploy. */
  confirmExported: () => void
  depositToPool: (amountWei: bigint) => Promise<void>
  /** Make sure the subaccount holds at least `requiredWei` + gas buffer. */
  ensureFunded: (requiredWei: bigint) => Promise<void>
  /** Send a contract tx signed by the subaccount (builder suffix included). */
  sendPrivateTx: (params: {
    address: Address
    abi: Abi
    functionName: string
    args: readonly unknown[]
    value?: bigint
  }) => Promise<Hex>
  /** Private exit: subaccount → pool → main (deposit + ZK withdrawal). */
  cashOut: (asset?: 'eth' | 'bean') => Promise<void>
  retry: () => void
  refresh: () => Promise<void>
  /** Recovery: rebuild the note cache from chain logs + derived keys. */
  rescan: () => Promise<void>
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}

interface SessionSecrets {
  account: PrivateKeyAccount
  /** Raw subaccount key — kept for the user-initiated backup export only. */
  privateKey: Hex
  keys: MasterKeys
}

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const { address: mainAddress, connector } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { writeContractAsync } = useWriteContract()

  const secretsRef = useRef<SessionSecrets | null>(null)
  const provingRef = useRef(false)

  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState<FundingStatus>('idle')
  const [statusDetail, setStatusDetail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [subaccountAddress, setSubaccountAddress] = useState<Address | null>(null)
  const [notes, setNotes] = useState<PrivateNote[]>([])
  const [subBalance, setSubBalance] = useState(0n)
  const [proofState, setProofState] = useState<ProofState>('none')
  const [artifactProgress, setArtifactProgress] = useState<ArtifactProgress | null>(null)
  const [determinismWarning, setDeterminismWarning] = useState(false)
  const [isSmartAccount, setIsSmartAccount] = useState(false)
  const [hasExported, setHasExported] = useState(false)
  const [vettingFeeBps, setVettingFeeBps] = useState(0)
  const [minDepositWei, setMinDepositWei] = useState<bigint>(MIN_DEPOSIT_WEI)
  const [subBeanBalance, setSubBeanBalance] = useState(0n)
  const [cashoutStatus, setCashoutStatus] = useState<CashoutStatus>('idle')
  const [cashoutDetail, setCashoutDetail] = useState('')
  const [cashoutAsset, setCashoutAsset] = useState<'eth' | 'bean' | null>(null)

  // Funding watcher + ensureFunded operate on funding notes only; the cashout
  // note withdraws to MAIN, so it must never be picked up as fundable.
  const unspentNote = useMemo(
    () => notes.find((n) => !n.spent && notePurpose(n) === 'funding'),
    [notes]
  )
  // Per-pool in-flight cashout notes (independent resume per asset).
  const ethCashoutNote = useMemo(
    () => notes.find((n) => !n.spent && notePurpose(n) === 'cashout' && notePool(n) === 'eth'),
    [notes]
  )
  const beanCashoutNote = useMemo(
    () => notes.find((n) => !n.spent && notePurpose(n) === 'cashout' && notePool(n) === 'bean'),
    [notes]
  )

  const fail = useCallback((e: unknown, fallback: string) => {
    const msg = e instanceof Error ? e.message : fallback
    setStatus('error')
    setError(msg)
  }, [])

  const refresh = useCallback(async () => {
    if (!mainAddress) return
    setNotes(loadNotes(mainAddress))
    const sub = secretsRef.current?.account.address
    if (sub) {
      try {
        setSubBalance(await getSubBalance(sub))
      } catch {
        // RPC hiccup — keep the last known balance.
      }
      try {
        setSubBeanBalance(await getSubTokenBalance(BEAN_TOKEN_ADDRESS, sub))
      } catch {
        // keep last known
      }
    }
  }, [mainAddress])

  const disablePrivateMode = useCallback(() => {
    secretsRef.current = null
    setEnabled(false)
    setStatus('idle')
    setStatusDetail('')
    setError(null)
    setSubaccountAddress(null)
    setSubBalance(0n)
    setSubBeanBalance(0n)
    setProofState('none')
    setArtifactProgress(null)
    setCashoutStatus('idle')
    setCashoutDetail('')
    setCashoutAsset(null)
  }, [])

  // Account switch / disconnect drops the session secrets immediately.
  useEffect(() => {
    disablePrivateMode()
  }, [mainAddress, disablePrivateMode])

  // Per-account flags: is this a smart account (blocked)? has the user backed
  // up their key on this device? Recomputed whenever the main address changes.
  useEffect(() => {
    if (!mainAddress) {
      setIsSmartAccount(false)
      setHasExported(false)
      return
    }
    setHasExported(hasExportedKey(mainAddress))
    let cancelled = false
    isContractAccount(mainAddress)
      .then((v) => {
        if (!cancelled) setIsSmartAccount(v)
      })
      .catch(() => {
        // RPC hiccup — leave as not-smart; enablePrivateMode re-checks
        // authoritatively before deriving.
      })
    return () => {
      cancelled = true
    }
  }, [mainAddress])

  const enablePrivateMode = useCallback(async () => {
    if (!mainAddress) throw new Error('connect a wallet first')
    if (secretsRef.current) {
      setEnabled(true)
      return
    }
    // Smart accounts can't deterministically re-derive the subaccount → block
    // them. Re-check authoritatively here (the connect-time check may not have
    // resolved yet, or could have failed open).
    if (await isContractAccount(mainAddress)) {
      setIsSmartAccount(true)
      throw new Error(
        'Private mode requires a standard (EOA) wallet — smart accounts are not supported.'
      )
    }
    setStatus('deriving')
    setError(null)
    setStatusDetail('Sign the derivation message in your wallet')
    try {
      const message = buildDerivationMessage(mainAddress)
      const signature = await signMessageAsync({ message })

      // Catch smart wallets the bytecode check misses (counterfactual /
      // not-yet-deployed ones read as EOAs). A smart account's signature can
      // NEVER ecrecover to its own contract address — only an EOA's does — so
      // require the derivation signature to recover to the connected address.
      // This also rejects passkey/ERC-1271/ERC-6492 signatures, which aren't
      // recoverable ECDSA sigs at all. We must catch this BEFORE deriving,
      // because such a wallet can't reproduce the subaccount.
      let recovered: Address
      try {
        recovered = await recoverMessageAddress({ message, signature })
      } catch {
        recovered = '0x' as Address
      }
      if (recovered.toLowerCase() !== mainAddress.toLowerCase()) {
        setIsSmartAccount(true)
        throw new Error(
          'Private mode requires a standard (EOA) wallet — this wallet signs like a smart account, so its private account could not be recovered.'
        )
      }

      const privateKey = derivePrivateKeyFromSignature(signature)
      const account = privateKeyToAccount(privateKey)
      const keys = await deriveDepositMasterKeys(signature)
      // The raw signature drops out of scope here — never stored, never sent.

      const cached = loadCachedSubaccountAddress(mainAddress)
      if (cached && cached.toLowerCase() !== account.address.toLowerCase()) {
        throw new Error(
          `re-derived private account ${account.address} does not match the original ${cached}. ` +
            'Your wallet does not produce deterministic signatures — your funds are at the original address.'
        )
      }
      if (!cached) saveCachedSubaccountAddress(mainAddress, account.address)
      setDeterminismWarning(!isDeterminismAssumedSafe(connector?.id))
      setHasExported(hasExportedKey(mainAddress))

      secretsRef.current = { account, privateKey, keys }
      setSubaccountAddress(account.address)
      setNotes(loadNotes(mainAddress))
      setEnabled(true)
      setStatus('idle')
      setStatusDetail('')

      getSubBalance(account.address).then(setSubBalance).catch(() => {})
      getSubTokenBalance(BEAN_TOKEN_ADDRESS, account.address)
        .then(setSubBeanBalance)
        .catch(() => {})
      // Live pool fee + minimum deposit for previews/guards (best-effort;
      // falls back to MIN_DEPOSIT_WEI when the read fails).
      getPoolAssetConfig()
        .then((c) => {
          setVettingFeeBps(Number(c.vettingFeeBPS))
          if (c.minimumDepositAmount > 0n) setMinDepositWei(c.minimumDepositAmount)
        })
        .catch(() => {})
      // Health check — surfaced as a warning, not a hard failure.
      getRelayerInfo().catch(() => {
        setError('privacy relayer unreachable — deposits and withdrawals will fail until it is back')
      })
    } catch (e) {
      fail(e, 'failed to derive the private account')
      throw e
    }
  }, [mainAddress, connector?.id, signMessageAsync, fail])

  const depositToPool = useCallback(
    async (amountWei: bigint) => {
      const secrets = secretsRef.current
      if (!mainAddress || !secrets) throw new Error('enable private mode first')
      if (!hasExportedKey(mainAddress)) throw new NeedsExportError()
      if (getUnspentNote(mainAddress)) {
        throw new Error('you already have funds in the pool — play or withdraw them first')
      }
      // The Entrypoint reverts below its minimum deposit; reject early with a
      // clear message rather than letting the wallet tx fail.
      if (amountWei < minDepositWei) {
        throw new Error(
          `minimum deposit is ${Number(minDepositWei) / 1e18} ETH`
        )
      }
      setError(null)
      setStatus('depositing')
      setStatusDetail('Confirm the deposit in your wallet')
      try {
        // Funding deposits are always into the ETH pool.
        const prepared = await prepareDeposit(secrets.keys, mainAddress, ETH_POOL)
        const hash = await writeContractAsync({
          chainId: base.id,
          address: ENTRYPOINT_ADDRESS,
          abi: ENTRYPOINT_DEPOSIT_ABI,
          functionName: 'deposit',
          args: [prepared.secrets.precommitment as bigint],
          value: amountWei,
        })
        setStatusDetail('Waiting for the deposit to confirm…')
        const receipt = await waitForReceipt(hash)
        const note = await extractNoteFromReceipt(receipt, prepared)
        setNotes(addNote(mainAddress, note))

        setStatus('awaiting-approval')
        setStatusDetail('Waiting for pool approval (~15s)…')
        await pollAspProof(note.label)
        setStatus('idle')
        setStatusDetail('')
      } catch (e) {
        fail(e, 'deposit failed')
        throw e
      }
    },
    [mainAddress, writeContractAsync, fail, minDepositWei]
  )

  /**
   * Background watcher: once a live note exists, prefetch artifacts and keep
   * a fresh withdrawal proof in sessionStorage so deploys only pay the relay.
   */
  useEffect(() => {
    if (!enabled || !mainAddress || !unspentNote || !subaccountAddress) return
    const secrets = secretsRef.current
    if (!secrets) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const cycle = async () => {
      if (cancelled || provingRef.current) return
      try {
        // Not approved yet → nothing to prove; try again next cycle.
        let asp
        try {
          asp = await getAspProof(unspentNote.label)
        } catch (e) {
          if (e instanceof RelayerError && /not approved/i.test(e.message)) return
          throw e
        }
        // Only pre-prove against an ASP root that has been PUBLISHED on-chain
        // (`Entrypoint.latestRoot()`). The in-memory tree may have advanced
        // past it; proving against the in-memory root would revert on relay.
        try {
          const info = await getRelayerInfo()
          if (info.publishedRoot !== undefined && info.publishedRoot !== asp.root) return
        } catch {
          // Relayer hiccup — skip this cycle.
          return
        }
        const cached = loadProof(mainAddress)
        const currentStateRoot = (await stateRootOf(await getStateLeaves())).toString()
        const check = {
          currentStateRoot,
          currentAspRoot: asp.root,
          noteLabel: unspentNote.label,
          subaccountAddress,
        }
        if (isProofCurrent(cached, check)) {
          setProofState('ready')
          return
        }

        provingRef.current = true
        setProofState('preparing')
        await prefetchArtifacts(setArtifactProgress)
        const proven = await proveNoteWithdrawal({
          keys: secrets.keys,
          note: unspentNote,
          recipient: subaccountAddress,
        })
        if (cancelled) return
        saveProof(mainAddress, {
          ...proven,
          noteLabel: unspentNote.label,
          subaccountAddress,
          generatedAt: Date.now(),
        })
        setProofState('ready')
      } catch {
        // Background failure is non-fatal — ensureFunded can prove on demand.
        if (!cancelled) setProofState('none')
      } finally {
        provingRef.current = false
      }
    }

    const loop = async () => {
      await cycle()
      if (!cancelled) timer = setTimeout(loop, 60_000)
    }
    loop()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, mainAddress, unspentNote, subaccountAddress])

  const ensureFunded = useCallback(
    async (requiredWei: bigint) => {
      const secrets = secretsRef.current
      if (!mainAddress || !secrets) throw new Error('enable private mode first')
      // Backstop: the deploy button is disabled until the key is backed up,
      // but never let a write through without it.
      if (!hasExportedKey(mainAddress)) throw new NeedsExportError()
      const sub = secrets.account.address
      const target = requiredWei + SUBACCOUNT_GAS_BUFFER

      const balance = await getSubBalance(sub)
      setSubBalance(balance)
      const subaccountCovers = balance >= target

      const note = getUnspentNote(mainAddress)
      // No pooled funds — rely on the subaccount's existing balance.
      if (!note) {
        if (subaccountCovers) return
        throw new NeedsDepositError()
      }
      // There IS a pooled note. Flush it to the subaccount on this deploy so
      // the pool is never left holding stranded funds — even if the subaccount
      // could already cover the deploy on its own.
      if (balance + BigInt(note.value) < target) {
        throw new Error('not enough private funds for this amount (including gas buffer)')
      }

      setError(null)
      try {
        // Approval gate. If the note isn't ASP-approved yet (e.g. just
        // deposited) AND the subaccount can already cover this deploy, don't
        // block the round waiting for approval — deploy from the existing
        // balance now and flush the note on a later deploy.
        try {
          await getAspProof(note.label)
        } catch (e) {
          if (e instanceof RelayerError && /not approved/i.test(e.message)) {
            if (subaccountCovers) return
          } else {
            throw e
          }
        }
        // Steps below run in a retry loop: between asp gating and relay, the
        // postman may publish a NEW root (proof gen is 10–30s), invalidating
        // the proof and reverting `IncorrectASPRoot`. On that we refetch
        // against the new published root, regenerate, and retry. Note stays
        // unspent throughout.
        const MAX_RELAY_ATTEMPTS = 3
        let hash: `0x${string}` | undefined
        for (let attempt = 1; attempt <= MAX_RELAY_ATTEMPTS; attempt++) {
          // Wait for approval AND on-chain publish — `relay` checks the proof
          // against `Entrypoint.latestRoot()`, which lags the postman's in-
          // memory tree until the next publish cycle.
          const asp = await pollAspProofPublished(note.label, {
            onTick: (_e, stage) => {
              setStatus('awaiting-approval')
              setStatusDetail(
                stage === 'approval'
                  ? 'Waiting for pool approval (~15s)…'
                  : 'Finalizing the privacy root on-chain…'
              )
            },
          })

          // Use the pre-generated proof only on the FIRST attempt and only if
          // it matches the now-published root. On retries always re-prove.
          const currentStateRoot = (await stateRootOf(await getStateLeaves())).toString()
          const cached = attempt === 1 ? loadProof(mainAddress) : null
          let proven: ProvenWithdrawal | CachedProof
          if (
            cached &&
            isProofCurrent(cached, {
              currentStateRoot,
              currentAspRoot: asp.root,
              noteLabel: note.label,
              subaccountAddress: sub,
            })
          ) {
            proven = cached
          } else {
            setStatus('proving')
            setStatusDetail(
              attempt === 1
                ? 'Generating the withdrawal proof…'
                : `Re-generating against the fresh pool root (attempt ${attempt}/${MAX_RELAY_ATTEMPTS})…`
            )
            await prefetchArtifacts(setArtifactProgress)
            proven = await proveNoteWithdrawal({
              keys: secrets.keys,
              note,
              recipient: sub,
              onStatus: (s) => setStatusDetail(`Generating the withdrawal proof… (${s})`),
            })
          }

          setStatus('relaying')
          setStatusDetail('Funding your private account…')
          try {
            hash = await relayWithdrawal({
              withdrawal: proven.withdrawal,
              proof: proven.proof,
              scope: POOL_SCOPE.toString(),
            })
            break
          } catch (e) {
            if (isAspRootMismatch(e) && attempt < MAX_RELAY_ATTEMPTS) {
              // Stale ASP root — the cached proof (if used) is invalid; clear
              // it and re-prove next iteration against the new published root.
              clearProof(mainAddress)
              setProofState('none')
              continue
            }
            throw e
          }
        }
        if (!hash) throw new Error('funding failed — gave up after publish-root retries')
        await waitForReceipt(hash)
        // Only now is the note actually consumed on-chain.
        setNotes(markSpent(mainAddress, note.label))
        clearProof(mainAddress)
        setProofState('none')

        const newBalance = await waitForBalanceAtLeast(sub, target)
        setSubBalance(newBalance)
        setStatus('funded')
        setStatusDetail('')
      } catch (e) {
        if (e instanceof Error && /relay|revert|simulation/i.test(e.message)) {
          // Likely a stale proof (root moved between check and relay).
          clearProof(mainAddress)
          setProofState('none')
        }
        fail(e, 'funding the private account failed')
        throw e
      }
    },
    [mainAddress, fail]
  )

  const sendPrivateTx = useCallback(
    async (params: {
      address: Address
      abi: Abi
      functionName: string
      args: readonly unknown[]
      value?: bigint
    }) => {
      const secrets = secretsRef.current
      if (!secrets) throw new Error('enable private mode first')
      const client = createSubaccountClient(secrets.account)
      const hash = await sendContractWithSuffix({
        client,
        account: secrets.account,
        ...params,
      })
      // Refresh the balance once it lands (fire and forget).
      waitForReceipt(hash)
        .then(() => refresh())
        .catch(() => {})
      return hash
    },
    [refresh]
  )

  /**
   * Private exit: subaccount → pool → main, for ETH or BEAN (its own ERC20
   * pool). This is the funding flow in REVERSE and is NEVER a direct transfer
   * (that would publicly link the two addresses). Resumable per pool: if a
   * prior attempt already landed the deposit, that pool's cashout note sits
   * unspent and we resume at the approval step rather than depositing again.
   */
  const cashOut = useCallback(async (asset: 'eth' | 'bean' = 'eth') => {
    const secrets = secretsRef.current
    if (!mainAddress || !secrets) throw new Error('enable private mode first')
    const sub = secrets.account.address
    const pool = asset === 'bean' ? BEAN_POOL : ETH_POOL
    setError(null)
    setCashoutAsset(asset)
    setCashoutStatus('idle')
    setCashoutDetail('')

    try {
      // Step 1 — DEPOSIT into this pool (skipped when resuming).
      let note = getUnspentCashoutNote(mainAddress, asset)
      if (!note) {
        const prepared = await prepareDeposit(secrets.keys, mainAddress, pool)

        if (asset === 'bean') {
          // BEAN: deposit the full BEAN balance; gas (approve + deposit) is
          // paid in ETH from the subaccount.
          const beanBalance = await getSubTokenBalance(BEAN_TOKEN_ADDRESS, sub)
          if (beanBalance < BEAN_POOL_MIN) {
            throw new Error('not enough BEAN to withdraw (pool minimum is 0.001 BEAN)')
          }
          const ethBalance = await getSubBalance(sub)
          const gasReserve = await estimateErc20CashoutGasReserve()
          if (ethBalance < gasReserve) {
            throw new Error(
              'not enough ETH in the private account to pay gas for the BEAN withdrawal'
            )
          }

          setCashoutStatus('approving')
          setCashoutDetail('Approving BEAN…')
          const apHash = await approveErc20FromSubaccount({
            account: secrets.account,
            token: BEAN_TOKEN_ADDRESS,
            spender: ENTRYPOINT_ADDRESS,
            amount: beanBalance,
          })
          await waitForReceipt(apHash) // MUST land before depositing (stale-allowance)

          setCashoutStatus('depositing')
          setCashoutDetail('Depositing BEAN into the pool…')
          const depHash = await depositErc20FromSubaccount({
            account: secrets.account,
            asset: BEAN_TOKEN_ADDRESS,
            amount: beanBalance,
            precommitment: prepared.secrets.precommitment as bigint,
          })
          const receipt = await waitForReceipt(depHash)
          note = await extractNoteFromReceipt(receipt, prepared, {
            purpose: 'cashout',
            depositor: 'subaccount',
            pool: 'bean',
          })
        } else {
          // ETH: deposit balance minus a gas reserve (leaves dust).
          const balance = await getSubBalance(sub)
          const gasReserve = await estimateDepositGasReserve(secrets.account)
          const depositValue = balance - gasReserve
          if (depositValue <= 0n) {
            throw new Error('private balance too low to cover the cashout deposit gas')
          }
          const cfg = await getPoolAssetConfig()
          setVettingFeeBps(Number(cfg.vettingFeeBPS))
          if (depositValue < cfg.minimumDepositAmount) {
            throw new Error('private balance is below the pool minimum deposit')
          }

          setCashoutStatus('depositing')
          setCashoutDetail('Depositing your balance into the pool…')
          const depHash = await depositFromSubaccount({
            account: secrets.account,
            precommitment: prepared.secrets.precommitment as bigint,
            value: depositValue,
          })
          const receipt = await waitForReceipt(depHash)
          note = await extractNoteFromReceipt(receipt, prepared, {
            purpose: 'cashout',
            depositor: 'subaccount',
            pool: 'eth',
          })
        }
        setNotes(addNote(mainAddress, note))
        await refresh()
      }

      // Steps 2–4 (asp gate → prove → relay) run in a retry loop. The postman
      // may publish a NEW root during the 10–30s proof-gen window, which would
      // invalidate the proof and revert `IncorrectASPRoot`. On that specific
      // error we refetch the (now-current) published proof, regenerate, and
      // retry — funds are safe in the pool throughout.
      const MAX_RELAY_ATTEMPTS = 3
      let hash: `0x${string}` | undefined
      for (let attempt = 1; attempt <= MAX_RELAY_ATTEMPTS; attempt++) {
        // Step 2 — ASP approval AND on-chain publish (one global tree).
        setCashoutStatus('awaiting-approval')
        setCashoutDetail(
          attempt === 1
            ? 'Waiting for pool approval (~15s)…'
            : `Retrying — waiting for a fresh pool root (attempt ${attempt}/${MAX_RELAY_ATTEMPTS})…`
        )
        await pollAspProofPublished(note.label, {
          onTick: (_e, stage) =>
            setCashoutDetail(
              stage === 'approval'
                ? 'Waiting for pool approval (~15s)…'
                : 'Finalizing the privacy root on-chain…'
            ),
        })

        // Step 3 — prove the withdrawal to MAIN.
        setCashoutStatus('proving')
        setCashoutDetail('Generating the withdrawal proof…')
        await prefetchArtifacts(setArtifactProgress)
        const proven = await proveNoteWithdrawal({
          keys: secrets.keys,
          note,
          recipient: mainAddress,
          onStatus: (s) => setCashoutDetail(`Generating the withdrawal proof… (${s})`),
        })

        // Step 4 — relay (scope selects the pool).
        setCashoutStatus('relaying')
        setCashoutDetail('Withdrawing to your main wallet…')
        try {
          hash = await relayWithdrawal({
            withdrawal: proven.withdrawal,
            proof: proven.proof,
            scope: proven.scope,
          })
          break
        } catch (e) {
          if (isAspRootMismatch(e) && attempt < MAX_RELAY_ATTEMPTS) {
            // Postman published a newer root mid-flight. Loop: refetch +
            // regenerate against the new root. Note stays unspent.
            continue
          }
          throw e
        }
      }
      if (!hash) throw new Error('cash out failed — gave up after publish-root retries')
      await waitForReceipt(hash)
      setNotes(markSpent(mainAddress, note.label))
      await refresh()
      setCashoutStatus('done')
      setCashoutDetail('')
    } catch (e) {
      // The cashout note (if the deposit landed) stays unspent — funds are
      // safe in the pool and a retry resumes from the approval step.
      setCashoutStatus('error')
      setError(e instanceof Error ? e.message : 'cash out failed')
      throw e
    }
  }, [mainAddress, refresh])

  const retry = useCallback(() => {
    setError(null)
    setStatus('idle')
    setStatusDetail('')
    // A cashout error is resumable from the approval step; reset to idle so
    // the panel re-arms its action (the unspent cashout note drives resume).
    if (cashoutStatus === 'error') {
      setCashoutStatus('idle')
      setCashoutDetail('')
    }
  }, [cashoutStatus])

  /**
   * Build the backup file contents (subaccount key + address + instructions).
   * Pure — the caller (panel) triggers the actual browser download, so no DOM
   * side effects or secret leakage beyond the in-memory return value.
   */
  const exportPrivateKey = useCallback((): { fileName: string; content: string } => {
    const secrets = secretsRef.current
    if (!mainAddress || !secrets) throw new Error('enable private mode first')
    const sub = secrets.account.address
    const content = [
      'BEAN Protocol — Private Account Backup',
      '======================================',
      '',
      'KEEP THIS FILE SECRET. Anyone with this key can take your private funds.',
      '',
      `Main wallet:      ${mainAddress.toLowerCase()}`,
      `Private account:  ${sub}`,
      `Private key:      ${secrets.privateKey}`,
      '',
      'How to use:',
      '- Import this private key into any wallet (e.g. MetaMask, Import Account)',
      '  to access your private account on another device.',
      '- Or just reconnect the same main wallet in the BEAN app to re-derive it.',
    ].join('\n')
    return { fileName: `bean-private-account-${sub.slice(0, 10)}.txt`, content }
  }, [mainAddress])

  const confirmExported = useCallback(() => {
    if (!mainAddress) return
    markExported(mainAddress)
    setHasExported(true)
  }, [mainAddress])

  const rescan = useCallback(async () => {
    const secrets = secretsRef.current
    if (!mainAddress || !secrets) throw new Error('enable private mode first')
    setError(null)
    setStatusDetail('Rescanning deposits from chain…')
    try {
      const { rescanNotes } = await import('./rescan')
      const recovered = await rescanNotes({
        keys: secrets.keys,
        main: mainAddress,
        subaccount: secrets.account.address,
      })
      setNotes(recovered)
      clearProof(mainAddress)
      setProofState('none')
      setStatusDetail('')
    } catch (e) {
      setStatusDetail('')
      fail(e, 'rescan failed')
      throw e
    }
  }, [mainAddress, fail])

  // Keep the subaccount balance reasonably fresh while enabled.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      refresh()
    }, 30_000)
    return () => clearInterval(id)
  }, [enabled, refresh])

  const value = useMemo<PrivacyContextValue>(
    () => ({
      enabled,
      status,
      statusDetail,
      error,
      subaccountAddress,
      effectiveAddress: enabled && subaccountAddress ? subaccountAddress : mainAddress,
      notes,
      unspentNote,
      subBalance,
      proofState,
      artifactProgress,
      determinismWarning,
      isSmartAccount,
      hasExported,
      vettingFeeBps,
      minDepositWei,
      subBeanBalance,
      cashoutStatus,
      cashoutDetail,
      cashoutAsset,
      ethCashoutInFlight: !!ethCashoutNote,
      beanCashoutInFlight: !!beanCashoutNote,
      enablePrivateMode,
      disablePrivateMode,
      exportPrivateKey,
      confirmExported,
      depositToPool,
      ensureFunded,
      sendPrivateTx,
      cashOut,
      retry,
      refresh,
      rescan,
    }),
    [
      enabled,
      status,
      statusDetail,
      error,
      subaccountAddress,
      mainAddress,
      notes,
      unspentNote,
      subBalance,
      proofState,
      artifactProgress,
      determinismWarning,
      isSmartAccount,
      hasExported,
      vettingFeeBps,
      minDepositWei,
      subBeanBalance,
      cashoutStatus,
      cashoutDetail,
      cashoutAsset,
      ethCashoutNote,
      beanCashoutNote,
      enablePrivateMode,
      disablePrivateMode,
      exportPrivateKey,
      confirmExported,
      depositToPool,
      ensureFunded,
      sendPrivateTx,
      cashOut,
      retry,
      refresh,
      rescan,
    ]
  )

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}
