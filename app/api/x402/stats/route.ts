import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// x402 receiving / buyback wallet — agents pay $0.10 USDC per call here, and the
// same wallet spends that USDC on BEAN buybacks. Every incoming USDC transfer is
// one paid call; bought back = total received minus what's still sitting in USDC.
//
// Data comes from Base's Blockscout explorer (free, keyless, Base-native). The
// v2 counters endpoint gives the total transfer count in a single call, so we
// never paginate ~120k records. The token-transfer total is dominated by the
// $0.10 payments; the few buyback/spam transfers are a sub-0.1% rounding error.
const WALLET = '0x78f993378ff7890daac1689f79e7db2291e73928'
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const BLOCKSCOUT = 'https://base.blockscout.com'
const PER_CALL_USD = 0.1
const TTL_MS = 15 * 60 * 1000

interface X402Stats {
    totalCalls: number
    volumeUsd: number
    boughtBackUsd: number
    perCallUsd: number
    updatedAt: string
}

let cache: { data: X402Stats; ts: number } | null = null

async function getJson(url: string): Promise<any> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`blockscout http ${res.status}`)
    return res.json()
}

async function compute(): Promise<X402Stats> {
    const [counters, bal] = await Promise.all([
        getJson(`${BLOCKSCOUT}/api/v2/addresses/${WALLET}/counters`),
        getJson(
            `${BLOCKSCOUT}/api?module=account&action=tokenbalance&contractaddress=${USDC}&address=${WALLET}&tag=latest`
        ),
    ])

    const totalCalls = Number(counters.token_transfers_count || 0)
    const usdcBalance = /^\d+$/.test(String(bal.result)) ? Number(bal.result) / 1e6 : 0
    const volumeUsd = totalCalls * PER_CALL_USD

    return {
        totalCalls,
        volumeUsd,
        boughtBackUsd: Math.max(0, volumeUsd - usdcBalance),
        perCallUsd: PER_CALL_USD,
        updatedAt: new Date().toISOString(),
    }
}

export async function GET() {
    if (cache && Date.now() - cache.ts < TTL_MS) {
        return NextResponse.json(cache.data)
    }
    try {
        const data = await compute()
        cache = { data, ts: Date.now() }
        return NextResponse.json(data)
    } catch (e: any) {
        console.error('[x402/stats]', e?.message || e)
        if (cache) return NextResponse.json(cache.data)
        return NextResponse.json({ error: String(e?.message || e) }, { status: 503 })
    }
}
