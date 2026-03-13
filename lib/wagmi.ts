'use client'

import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  phantomWallet,
  rainbowWallet,
  zerionWallet,
  rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http, createConnector } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import sdk from '@farcaster/miniapp-sdk'

function farcasterConnector() {
  return createConnector((config) => ({
    id: 'farcaster',
    name: 'Farcaster Wallet',
    type: 'farcaster',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async connect(): Promise<any> {
      const provider = await sdk.wallet.getEthereumProvider()
      if (!provider) throw new Error('No Farcaster wallet provider')
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as readonly `0x${string}`[]
      const chainId = Number(await provider.request({ method: 'eth_chainId' }))
      return { accounts, chainId }
    },
    async disconnect() {},
    async getAccounts() {
      const provider = await sdk.wallet.getEthereumProvider()
      if (!provider) return []
      const accounts = (await provider.request({ method: 'eth_accounts' })) as `0x${string}`[]
      return accounts
    },
    async getChainId() {
      const provider = await sdk.wallet.getEthereumProvider()
      if (!provider) return base.id
      return Number(await provider.request({ method: 'eth_chainId' }))
    },
    async getProvider() {
      return (await sdk.wallet.getEthereumProvider()) ?? undefined
    },
    async isAuthorized() {
      try {
        const inMiniApp = await Promise.race([
          sdk.isInMiniApp(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
        ])
        if (!inMiniApp) return false
        const provider = await sdk.wallet.getEthereumProvider()
        if (!provider) return false
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
        return accounts.length > 0
      } catch {
        return false
      }
    },
    onAccountsChanged(accounts: string[]) {
      config.emitter.emit('change', { accounts: accounts as `0x${string}`[] })
    },
    onChainChanged(chainId: string) {
      config.emitter.emit('change', { chainId: Number(chainId) })
    },
    onDisconnect() {
      config.emitter.emit('disconnect')
    },
  }))
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        metaMaskWallet,
        phantomWallet,
        rabbyWallet,
        zerionWallet,
        coinbaseWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: 'BEANS Protocol',
    projectId: '666aa4c4e1ee459d4697a07bcf2f1ec6',
  }
)

export const farcasterWalletConnector = farcasterConnector()

export const config = createConfig({
  connectors: [farcasterWalletConnector, ...connectors],
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
})
