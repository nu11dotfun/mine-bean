'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { apiFetch } from './api'

interface ProfileInfo {
    username: string | null
    pfpUrl: string | null
}

interface BatchResponse {
    profiles: Record<string, ProfileInfo>
}

// Module-level cache shared across all component instances
const profileCache = new Map<string, ProfileInfo>()

const formatAddress = (addr: string): string => {
    if (!addr || addr.length < 10) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/**
 * Hook that resolves wallet addresses to profile info (username, pfpUrl).
 * Fetches uncached addresses in batches of 50 via GET /api/profiles/batch.
 * Module-level Map cache means repeated renders / tab switches don't re-fetch.
 *
 * Concurrency rules: a run id guards against an older in-flight fetch
 * clobbering a newer address set; a failed batch leaves the key unmarked so
 * the next address change retries it instead of degrading permanently.
 */
export function useProfileResolver(addresses: string[]) {
    const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map())
    const prevKeyRef = useRef<string>('')
    const runIdRef = useRef(0)

    // Stable sorted key for dependency comparison
    const addressKey = useMemo(() => {
        const unique = Array.from(new Set(addresses.map(a => a.toLowerCase()).filter(Boolean)))
        unique.sort()
        return unique.join(',')
    }, [addresses])

    useEffect(() => {
        if (!addressKey || addressKey === prevKeyRef.current) return
        const runId = ++runIdRef.current
        const all = addressKey.split(',')
        const uncached = all.filter(a => !profileCache.has(a))

        const finish = (success: boolean) => {
            if (runIdRef.current !== runId) return // superseded by a newer set
            if (success) prevKeyRef.current = addressKey // done — don't refetch this key
            const map = new Map<string, ProfileInfo>()
            all.forEach(a => {
                const cached = profileCache.get(a)
                if (cached) map.set(a, cached)
            })
            setProfiles(map)
        }

        if (uncached.length === 0) {
            finish(true)
            return
        }

        ;(async () => {
            let ok = true
            try {
                for (let i = 0; i < uncached.length; i += 50) {
                    if (runIdRef.current !== runId) return
                    const batch = uncached.slice(i, i + 50)
                    const data = await apiFetch<BatchResponse>(
                        `/api/profiles/batch?addresses=${batch.join(',')}`
                    )
                    for (const [addr, info] of Object.entries(data.profiles)) {
                        profileCache.set(addr.toLowerCase(), info)
                    }
                    // Negative-cache addresses the endpoint omitted (no profile
                    // exists) so they aren't re-requested on every key change.
                    for (const addr of batch) {
                        if (!profileCache.has(addr)) {
                            profileCache.set(addr, { username: null, pfpUrl: null })
                        }
                    }
                }
            } catch {
                ok = false // partial results stay cached; key stays retryable
            }
            finish(ok)
        })()
    }, [addressKey])

    /** Returns username if available, otherwise truncated address */
    const resolve = (address: string): string => {
        const info = profiles.get(address.toLowerCase())
        return info?.username || formatAddress(address)
    }

    return { profiles, resolve }
}
