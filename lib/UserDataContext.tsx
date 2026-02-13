'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import { formatEther } from 'viem'
import { apiFetch } from './api'
import { useSSE } from './SSEContext'

// ── Shared interfaces ──────────────────────────────────────────────

export interface UserStakeInfo {
    balance: string
    balanceFormatted: string
    pendingRewards: string
    pendingRewardsFormatted: string
    compoundFeeReserve: string
    compoundFeeReserveFormatted: string
    canCompound: boolean
}

export interface RewardsData {
    pendingBNB: string
    pendingBNBFormatted: string
    pendingBEAN: {
        unrefined: string
        unrefinedFormatted: string
        refined: string
        refinedFormatted: string
        gross: string
        grossFormatted: string
        fee: string
        feeFormatted: string
        net: string
        netFormatted: string
    }
    uncheckpointedRound: string
}

export interface ProfileData {
    username: string | null
    bio: string | null
    pfpUrl: string | null
    discord: string | null
}

// ── SessionStorage helpers (survive page refresh) ──────────────────

const REWARDS_KEY = (addr: string) => `beans_rewards_${addr}`
const STAKE_KEY = (addr: string) => `beans_stake_${addr}`
const PROFILE_KEY = (addr: string) => `beans_profile_${addr}`

function readCache<T>(key: string): T | null {
    try {
        const raw = sessionStorage.getItem(key)
        return raw ? JSON.parse(raw) as T : null
    } catch {
        return null
    }
}

function writeCache<T>(key: string, data: T): void {
    try {
        sessionStorage.setItem(key, JSON.stringify(data))
    } catch { /* quota exceeded or unavailable — ignore */ }
}

// ── Context ────────────────────────────────────────────────────────

interface UserDataContextValue {
    rewards: RewardsData | null
    stakeInfo: UserStakeInfo | null
    profile: ProfileData | null
    refetchRewards: () => void
    refetchStakeInfo: () => void
    refetchProfile: () => void
}

const UserDataContext = createContext<UserDataContextValue | null>(null)

// ── Provider ───────────────────────────────────────────────────────

export function UserDataProvider({
    children,
    userAddress,
}: {
    children: ReactNode
    userAddress?: string
}) {
    const { subscribeUser } = useSSE()

    // State — initialized from sessionStorage on first render
    const [rewards, setRewards] = useState<RewardsData | null>(() =>
        userAddress ? readCache<RewardsData>(REWARDS_KEY(userAddress)) : null
    )
    const [stakeInfo, setStakeInfo] = useState<UserStakeInfo | null>(() =>
        userAddress ? readCache<UserStakeInfo>(STAKE_KEY(userAddress)) : null
    )
    const [profile, setProfile] = useState<ProfileData | null>(() =>
        userAddress ? readCache<ProfileData>(PROFILE_KEY(userAddress)) : null
    )

    // Ref to track current address for sessionStorage writes
    const addressRef = useRef(userAddress)
    addressRef.current = userAddress

    // Wrapper: set state + persist to sessionStorage
    const setRewardsAndCache = useCallback((data: RewardsData | null) => {
        setRewards(data)
        if (data && addressRef.current) {
            writeCache(REWARDS_KEY(addressRef.current), data)
        }
    }, [])

    const setStakeInfoAndCache = useCallback((data: UserStakeInfo | null) => {
        setStakeInfo(data)
        if (data && addressRef.current) {
            writeCache(STAKE_KEY(addressRef.current), data)
        }
    }, [])

    const setProfileAndCache = useCallback((data: ProfileData | null) => {
        setProfile(data)
        if (data && addressRef.current) {
            writeCache(PROFILE_KEY(addressRef.current), data)
        }
    }, [])

    // ── Fetch functions ────────────────────────────────────────────

    const fetchRewards = useCallback(async () => {
        if (!userAddress) return
        try {
            const data = await apiFetch<RewardsData>(`/api/user/${userAddress}/rewards`)
            setRewardsAndCache(data)
        } catch {
            // 429 or network error — state keeps current value (from sessionStorage or previous fetch)
        }
    }, [userAddress, setRewardsAndCache])

    const fetchStakeInfo = useCallback(async () => {
        if (!userAddress) return
        try {
            const info = await apiFetch<UserStakeInfo>(`/api/staking/${userAddress}`)
            setStakeInfoAndCache(info)
        } catch {
            // 429 or network error — state keeps current value (from sessionStorage or previous fetch)
        }
    }, [userAddress, setStakeInfoAndCache])

    const fetchProfile = useCallback(async () => {
        if (!userAddress) return
        try {
            const data = await apiFetch<ProfileData & { address: string }>(`/api/user/${userAddress}/profile`)
            setProfileAndCache({
                username: data.username,
                bio: data.bio,
                pfpUrl: data.pfpUrl,
                discord: data.discord,
            })
        } catch {
            // 429 or network error — state keeps current value (from sessionStorage or previous fetch)
        }
    }, [userAddress, setProfileAndCache])

    // ── Fetch on mount / address change ────────────────────────────

    useEffect(() => {
        if (!userAddress) {
            // Wallet disconnected — clear state
            setRewards(null)
            setStakeInfo(null)
            setProfile(null)
            return
        }
        // Load from sessionStorage for this address (may already be set via useState initializer,
        // but handles address changes after initial mount)
        const cachedRewards = readCache<RewardsData>(REWARDS_KEY(userAddress))
        const cachedStake = readCache<UserStakeInfo>(STAKE_KEY(userAddress))
        const cachedProfile = readCache<ProfileData>(PROFILE_KEY(userAddress))
        if (cachedRewards) setRewards(cachedRewards)
        if (cachedStake) setStakeInfo(cachedStake)
        if (cachedProfile) setProfile(cachedProfile)

        // Then fetch fresh data (will overwrite cache on success, or keep cached on 429)
        fetchRewards()
        fetchStakeInfo()
        fetchProfile()
    }, [userAddress, fetchRewards, fetchStakeInfo, fetchProfile])

    // ── SSE subscriptions — update state from event payloads ───────

    useEffect(() => {
        // stakeDeposited/stakeWithdrawn: newBalance is hex string (BigInt)
        const unsub1 = subscribeUser('stakeDeposited', (data: unknown) => {
            const d = data as { newBalance?: string }
            if (d.newBalance) {
                try {
                    const newBal = formatEther(BigInt(d.newBalance))
                    setStakeInfo(prev => {
                        const updated = prev ? { ...prev, balanceFormatted: newBal } : prev
                        if (updated && addressRef.current) writeCache(STAKE_KEY(addressRef.current), updated)
                        return updated
                    })
                } catch { /* ignore parse errors */ }
            }
        })

        const unsub2 = subscribeUser('stakeWithdrawn', (data: unknown) => {
            const d = data as { newBalance?: string }
            if (d.newBalance) {
                try {
                    const newBal = formatEther(BigInt(d.newBalance))
                    setStakeInfo(prev => {
                        const updated = prev ? { ...prev, balanceFormatted: newBal } : prev
                        if (updated && addressRef.current) writeCache(STAKE_KEY(addressRef.current), updated)
                        return updated
                    })
                } catch { /* ignore parse errors */ }
            }
        })

        // yieldCompounded: staked balance goes up by amount, pendingRewards resets
        const unsub3 = subscribeUser('yieldCompounded', (data: unknown) => {
            const d = data as { amount: string }
            const compoundedAmount = Number(d.amount) / 1e18
            setStakeInfo(prev => {
                if (!prev) return prev
                const newBal = (parseFloat(prev.balanceFormatted) + compoundedAmount).toString()
                const updated = { ...prev, balanceFormatted: newBal, pendingRewardsFormatted: '0' }
                if (addressRef.current) writeCache(STAKE_KEY(addressRef.current), updated)
                return updated
            })
        })

        // yieldClaimed: pendingRewards resets to 0
        const unsub4 = subscribeUser('yieldClaimed', () => {
            setStakeInfo(prev => {
                if (!prev) return prev
                const updated = { ...prev, pendingRewardsFormatted: '0', pendingRewards: '0' }
                if (addressRef.current) writeCache(STAKE_KEY(addressRef.current), updated)
                return updated
            })
        })

        // claimedBEAN: mining rewards claimed — refined and unrefined go to 0
        const unsub5 = subscribeUser('claimedBEAN', () => {
            setRewards(prev => {
                if (!prev) return prev
                const updated = {
                    ...prev,
                    pendingBEAN: {
                        ...prev.pendingBEAN,
                        unrefined: '0',
                        unrefinedFormatted: '0',
                        refined: '0',
                        refinedFormatted: '0',
                        gross: '0',
                        grossFormatted: '0',
                        fee: '0',
                        feeFormatted: '0',
                        net: '0',
                        netFormatted: '0',
                    }
                }
                if (addressRef.current) writeCache(REWARDS_KEY(addressRef.current), updated)
                return updated
            })
        })

        // claimedBNB: BNB rewards cleared
        const unsub6 = subscribeUser('claimedBNB', () => {
            setRewards(prev => {
                if (!prev) return prev
                const updated = { ...prev, pendingBNB: '0', pendingBNBFormatted: '0' }
                if (addressRef.current) writeCache(REWARDS_KEY(addressRef.current), updated)
                return updated
            })
        })

        // profileUpdated: user updated their profile
        const unsub7 = subscribeUser('profileUpdated', (data: unknown) => {
            const d = data as { username?: string | null; bio?: string | null; pfpUrl?: string | null }
            setProfile(prev => {
                const updated: ProfileData = {
                    username: d.username !== undefined ? d.username : (prev?.username ?? null),
                    bio: d.bio !== undefined ? d.bio : (prev?.bio ?? null),
                    pfpUrl: d.pfpUrl !== undefined ? d.pfpUrl : (prev?.pfpUrl ?? null),
                    discord: prev?.discord ?? null,
                }
                if (addressRef.current) writeCache(PROFILE_KEY(addressRef.current), updated)
                return updated
            })
        })

        return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7() }
    }, [subscribeUser])

    // settlementComplete window event — new mining rewards may be available
    useEffect(() => {
        const handler = () => fetchRewards()
        window.addEventListener('settlementComplete', handler)
        return () => window.removeEventListener('settlementComplete', handler)
    }, [fetchRewards])

    // ── Context value ──────────────────────────────────────────────

    return (
        <UserDataContext.Provider value={{
            rewards,
            stakeInfo,
            profile,
            refetchRewards: fetchRewards,
            refetchStakeInfo: fetchStakeInfo,
            refetchProfile: fetchProfile,
        }}>
            {children}
        </UserDataContext.Provider>
    )
}

// ── Hook ───────────────────────────────────────────────────────────

export function useUserData() {
    const context = useContext(UserDataContext)
    if (!context) throw new Error('useUserData must be used within UserDataProvider')
    return context
}
