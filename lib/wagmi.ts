'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { bsc, bscTestnet } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'BEANS Protocol',
  projectId: '666aa4c4e1ee459d4697a07bcf2f1ec6',
  chains: [bsc, bscTestnet],
  ssr: true,
})
