import { NextResponse } from 'next/server'
import { CONTRACTS } from '@/lib/contracts'

// Base MCP plugin endpoint: BEAN buy venue discovery.
// Static dump of canonical buy paths (DEX swap URLs + Coinbase Onramp deeplink).
// Direct swap calldata (prepare/buy-bean) lives on the v0.2 roadmap; until then
// agents hand the user a venue URL to complete the swap themselves.

export async function GET(req: Request) {
  const url = new URL(req.url)
  // Optional ?from=0x... is folded into the Onramp deep link if provided.
  const fromParam = url.searchParams.get('from')
  const beanAddress = CONTRACTS.Bean.address

  const onrampUrl = fromParam
    ? `https://pay.coinbase.com/buy/select-asset?destinationWallets=${encodeURIComponent(
        JSON.stringify([{ address: fromParam, blockchains: ['base'] }])
      )}&defaultAsset=ETH`
    : 'https://pay.coinbase.com/buy/select-asset?defaultAsset=ETH'

  return NextResponse.json(
    {
      venues: [
        {
          name: 'Uniswap',
          url: `https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${beanAddress}&chain=base`,
          kind: 'dex',
          note: 'BEAN/ETH liquidity lives on Uniswap V4. The swap UI auto-routes to V4.',
        },
        {
          name: 'DexScreener',
          url: `https://dexscreener.com/base/${beanAddress}`,
          kind: 'discovery',
        },
        {
          name: 'BaseScan',
          url: `https://basescan.org/token/${beanAddress}`,
          kind: 'explorer',
        },
      ],
      onramp: {
        url: onrampUrl,
        kind: 'fiat-to-eth',
        note: 'User onramps ETH first, then swaps to BEAN via Uniswap.',
      },
      note: 'Direct swap calldata (prepare/buy-bean) is on the v0.2 roadmap. For now, hand the user a venue URL.',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    }
  )
}
