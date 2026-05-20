'use client'

import { useAccount, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'

/**
 * Reports whether the connected wallet is on Base mainnet, and exposes a
 * one-call switcher. Used by every primary tx CTA to render a "SWITCH TO BASE"
 * recovery button when the wallet is on the wrong chain.
 *
 * IMPORTANT: We read `useAccount().chainId`, NOT `useChainId()`.
 * `useChainId()` returns the *configured* chain id (defaults to the first
 * configured chain — base.id — when the wallet is on an unsupported chain like
 * Ethereum mainnet), which caused `isOnBase` to incorrectly evaluate to `true`
 * for users on the wrong network. `useAccount().chainId` returns the wallet's
 * *actual* current chain id, including unsupported ones.
 *
 * Layer 2 of the wrong-network safety system. Layer 1 is per-call
 * `chainId: base.id` on every `writeContract({...})` invocation, which causes
 * wagmi/viem to throw `ChainMismatchError` before sending if the wallet is on
 * the wrong chain. That throw is silent without an onError handler, so Layer 2
 * is the real user-facing guard.
 */
export function useIsOnBase() {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  // When not connected, treat as "on Base" so the connect-wallet branch in
  // each component renders normally (it gates earlier in the conditional).
  const isOnBase = !isConnected || chainId === base.id
  const switchToBase = () => switchChain({ chainId: base.id })

  return { isOnBase, isSwitching, switchToBase, currentChainId: chainId }
}
