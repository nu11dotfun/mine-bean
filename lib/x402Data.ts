// x402 mining stats, served by the Next.js route at /api/x402/stats (same origin,
// so a relative fetch, not apiFetch which targets the Express backend).
export interface X402Stats {
    totalCalls: number
    volumeUsd: number
    boughtBackUsd: number
    perCallUsd: number
    updatedAt: string
}

export async function fetchX402Stats(): Promise<X402Stats | null> {
    try {
        const res = await fetch('/api/x402/stats')
        if (!res.ok) return null
        const json = await res.json()
        if (!json || typeof json.totalCalls !== 'number') return null
        return json as X402Stats
    } catch {
        return null
    }
}
