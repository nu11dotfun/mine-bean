'use client'

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, useAccount } from 'wagmi'
import { config } from '@/lib/wagmi'
import { useState } from 'react'
import { SSEProvider } from './SSEContext'

import '@rainbow-me/rainbowkit/styles.css'

function SSEWrapper({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  return <SSEProvider userAddress={address}>{children}</SSEProvider>
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#F0B90B',
            accentColorForeground: '#000',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          modalSize="compact"
        >
          <SSEWrapper>{children}</SSEWrapper>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
