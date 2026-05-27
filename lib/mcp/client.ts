import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

// Shared viem PublicClient for all Base MCP routes that need on-chain reads.
// Routes use this for: balance checks, allowance reads, pending-rewards reads,
// any view function on MineBean contracts.
//
// Default RPC is the public Base endpoint. For production scale, set
// `BASE_RPC_URL` to a paid provider (Alchemy / Quicknode) in Vercel env.

export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
})
