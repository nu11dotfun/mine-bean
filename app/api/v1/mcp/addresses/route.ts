import { NextResponse } from 'next/server'
import { CONTRACTS } from '@/lib/contracts'

// Base MCP plugin endpoint: chain config + canonical MineBean contract addresses.
// Matches the manifest's documented response shape.
// Cache aggressively — addresses only change on contract migration.

export async function GET() {
  return NextResponse.json(
    {
      chainId: 8453,
      chainName: 'base',
      contracts: {
        BEAN: CONTRACTS.Bean.address,
        GRID_MINING: CONTRACTS.GridMining.address,
        AUTO_MINER: CONTRACTS.AutoMiner.address,
        STAKING: CONTRACTS.Staking.address,
        TREASURY: CONTRACTS.Treasury.address,
      },
      docs: 'https://minebean.com/about',
      protocol_api: 'https://api.minebean.com',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    }
  )
}
