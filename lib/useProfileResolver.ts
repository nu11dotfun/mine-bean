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
 * Fetches uncached addresses in batch via GET /api/profiles/batch.
 * Module-level Map cache means repeated renders / tab switches don't re-fetch.
 */
export function useProfileResolver(addresses: string[]) {
    const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map())
    const prevKeyRef = useRef<string>('')

    // Stable sorted key for dependency comparison
    const addressKey = useMemo(() => {
        const unique = Array.from(new Set(addresses.map(a => a.toLowerCase()).filter(Boolean)))
        unique.sort()
        return unique.join(',')
    }, [addresses])

    useEffect(() => {
        if (addressKey === prevKeyRef.current || !addressKey) return
        prevKeyRef.current = addressKey

        const all = addressKey.split(',')

        // Check which addresses are not in the module-level cache
        const uncached = all.filter(a => !profileCache.has(a))

        if (uncached.length === 0) {
            // All cached — build result from cache
            const map = new Map<string, ProfileInfo>()
            all.forEach(a => {
                const cached = profileCache.get(a)
                if (cached) map.set(a, cached)
            })
            setProfiles(map)
            return
        }

        // Fetch uncached addresses (max 50 per request)
        const batch = uncached.slice(0, 50)
        apiFetch<BatchResponse>(`/api/profiles/batch?addresses=${batch.join(',')}`)
            .then(data => {
                // Update module-level cache
                for (const [addr, info] of Object.entries(data.profiles)) {
                    profileCache.set(addr.toLowerCase(), info)
                }

                // Build result map from cache (now includes newly fetched)
                const map = new Map<string, ProfileInfo>()
                all.forEach(a => {
                    const cached = profileCache.get(a)
                    if (cached) map.set(a, cached)
                })
                setProfiles(map)
            })
            .catch(() => {
                // On error, return whatever we have cached
                const map = new Map<string, ProfileInfo>()
                all.forEach(a => {
                    const cached = profileCache.get(a)
                    if (cached) map.set(a, cached)
                })
                if (map.size > 0) setProfiles(map)
            })
    }, [addressKey])

    /** Returns username if available, otherwise truncated address */
    const resolve = (address: string): string => {
        const info = profiles.get(address.toLowerCase())
        return info?.username || formatAddress(address)
    }

    return { profiles, resolve }
}
