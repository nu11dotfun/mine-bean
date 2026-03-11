'use client'

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, useAccount, useConnect } from 'wagmi'
import { config } from '@/lib/wagmi'
import { useState, useEffect } from 'react'
import sdk from '@farcaster/miniapp-sdk'
import { SSEProvider } from './SSEContext'
import { UserDataProvider } from './UserDataContext'
import { RoundTimerProvider } from './RoundTimerContext'

import '@rainbow-me/rainbowkit/styles.css'

function FarcasterAutoConnect({ children }: { children: React.ReactNode }) {
  const { connect } = useConnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (isConnected) return
    sdk.isInMiniApp().then((inMiniApp) => {
      if (inMiniApp) {
        const fc = config.connectors.find((c) => c.id === 'farcaster')
        if (fc) connect({ connector: fc })
      }
    }).catch(() => {})
  }, [isConnected, connect])

  return <>{children}</>
}

function SSEWrapper({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  return (
    <SSEProvider userAddress={address}>
      <UserDataProvider userAddress={address}>
        <RoundTimerProvider>
          {children}
        </RoundTimerProvider>
      </UserDataProvider>
    </SSEProvider>
  )
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  useEffect(() => {
    sdk.actions.ready().catch(() => {})
    const timeout = setTimeout(() => {
      sdk.actions.ready().catch(() => {})
    }, 3000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#0052FF',
            accentColorForeground: '#fff',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          modalSize="compact"
        >
          <FarcasterAutoConnect>
            <SSEWrapper>{children}</SSEWrapper>
          </FarcasterAutoConnect>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
