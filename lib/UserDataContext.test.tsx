import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { UserDataProvider, useUserData } from './UserDataContext'
import type { RewardsData, UserStakeInfo, ProfileData } from './UserDataContext'
import { createMockSSE } from '../test/mocks/sse'

// ── Mocks ────────────────────────────────────────────────────────────

const mockSSE = createMockSSE()

vi.mock('@/lib/SSEContext', () => ({
  useSSE: () => ({
    subscribeGlobal: mockSSE.subscribeGlobal,
    subscribeUser: mockSSE.subscribeUser,
  }),
  SSEProvider: ({ children }: any) => children,
}))

const mockApiFetch = vi.fn()
vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

// ── Test data ────────────────────────────────────────────────────────

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

const mockRewards: RewardsData = {
  pendingBNB: '1000000000000000000',
  pendingBNBFormatted: '1.0',
  pendingBEAN: {
    unrefined: '500000000000000000',
    unrefinedFormatted: '0.5',
    refined: '200000000000000000',
    refinedFormatted: '0.2',
    gross: '700000000000000000',
    grossFormatted: '0.7',
    fee: '50000000000000000',
    feeFormatted: '0.05',
    net: '650000000000000000',
    netFormatted: '0.65',
  },
  uncheckpointedRound: '0',
}

const mockStakeInfo: UserStakeInfo = {
  balance: '10000000000000000000',
  balanceFormatted: '10.0',
  pendingRewards: '500000000000000000',
  pendingRewardsFormatted: '0.5',
  compoundFeeReserve: '6000000000000000',
  compoundFeeReserveFormatted: '0.006',
  canCompound: true,
}

const mockProfile: ProfileData & { address: string } = {
  address: TEST_ADDRESS,
  username: 'testuser',
  bio: 'Hello',
  pfpUrl: 'https://example.com/pic.png',
  discord: 'testuser#1234',
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <UserDataProvider userAddress={TEST_ADDRESS}>{children}</UserDataProvider>
}

function wrapperNoAddress({ children }: { children: React.ReactNode }) {
  return <UserDataProvider>{children}</UserDataProvider>
}

describe('UserDataContext', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockSSE.subscribeGlobal.mockClear()
    mockSSE.subscribeUser.mockClear()
    sessionStorage.clear()
  })

  describe('useUserData', () => {
    it('throws when used outside UserDataProvider', () => {
      expect(() => {
        renderHook(() => useUserData())
      }).toThrow('useUserData must be used within UserDataProvider')
    })
  })

  describe('initial fetch', () => {
    it('fetches rewards, stakeInfo, and profile on mount when address present', async () => {
      mockApiFetch.mockImplementation((path: string) => {
        if (path.includes('/rewards')) return Promise.resolve(mockRewards)
        if (path.includes('/staking/')) return Promise.resolve(mockStakeInfo)
        if (path.includes('/profile')) return Promise.resolve(mockProfile)
        return Promise.resolve({})
      })

      const { result } = renderHook(() => useUserData(), { wrapper })

      await waitFor(() => {
        expect(result.current.rewards).not.toBeNull()
      })

      expect(mockApiFetch).toHaveBeenCalledWith(`/api/user/${TEST_ADDRESS}/rewards`)
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/staking/${TEST_ADDRESS}`)
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/user/${TEST_ADDRESS}/profile`)
    })

    it('does not fetch when no address', () => {
      renderHook(() => useUserData(), { wrapper: wrapperNoAddress })

      expect(mockApiFetch).not.toHaveBeenCalled()
    })
  })

  describe('wallet disconnect', () => {
    it('clears all state when address becomes undefined', async () => {
      mockApiFetch.mockImplementation((path: string) => {
        if (path.includes('/rewards')) return Promise.resolve(mockRewards)
        if (path.includes('/staking/')) return Promise.resolve(mockStakeInfo)
        if (path.includes('/profile')) return Promise.resolve(mockProfile)
        return Promise.resolve({})
      })

      const { result, rerender } = renderHook(() => useUserData(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <UserDataProvider userAddress={TEST_ADDRESS}>{children}</UserDataProvider>
        ),
      })

      await waitFor(() => {
        expect(result.current.rewards).not.toBeNull()
      })

      // Disconnect wallet
      rerender()
      // Re-render with no address by changing wrapper
      const { result: result2 } = renderHook(() => useUserData(), {
        wrapper: wrapperNoAddress,
      })

      expect(result2.current.rewards).toBeNull()
      expect(result2.current.stakeInfo).toBeNull()
      expect(result2.current.profile).toBeNull()
    })
  })

  describe('sessionStorage caching', () => {
    it('writes to sessionStorage after successful fetch', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      mockApiFetch.mockImplementation((path: string) => {
        if (path.includes('/rewards')) return Promise.resolve(mockRewards)
        if (path.includes('/staking/')) return Promise.resolve(mockStakeInfo)
        if (path.includes('/profile')) return Promise.resolve(mockProfile)
        return Promise.resolve({})
      })

      renderHook(() => useUserData(), { wrapper })

      await waitFor(() => {
        expect(setItemSpy).toHaveBeenCalled()
      })

      setItemSpy.mockRestore()
    })

    it('reads from sessionStorage on mount', async () => {
      // Pre-populate cache
      sessionStorage.setItem(
        `beans_rewards_${TEST_ADDRESS}`,
        JSON.stringify(mockRewards)
      )

      // Mock fetch to fail so we can verify cache was used
      mockApiFetch.mockRejectedValue(new Error('network error'))

      const { result } = renderHook(() => useUserData(), { wrapper })

      // Should have cached data immediately
      await waitFor(() => {
        expect(result.current.rewards).not.toBeNull()
      })
    })

    it('preserves cached state on fetch failure', async () => {
      // Pre-populate cache
      sessionStorage.setItem(
        `beans_rewards_${TEST_ADDRESS}`,
        JSON.stringify(mockRewards)
      )

      mockApiFetch.mockRejectedValue(new Error('429 Too Many Requests'))

      const { result } = renderHook(() => useUserData(), { wrapper })

      await waitFor(() => {
        expect(result.current.rewards).not.toBeNull()
      })

      // Should still have cached data after fetch failure
      expect(result.current.rewards?.pendingBNBFormatted).toBe('1.0')
    })
  })

  describe('SSE event handlers', () => {
    async function renderWithData() {
      mockApiFetch.mockImplementation((path: string) => {
        if (path.includes('/rewards')) return Promise.resolve(mockRewards)
        if (path.includes('/staking/')) return Promise.resolve(mockStakeInfo)
        if (path.includes('/profile')) return Promise.resolve(mockProfile)
        return Promise.resolve({})
      })

      const hook = renderHook(() => useUserData(), { wrapper })

      await waitFor(() => {
        expect(hook.result.current.rewards).not.toBeNull()
        expect(hook.result.current.stakeInfo).not.toBeNull()
      })

      return hook
    }

    it('stakeDeposited updates balance via formatEther', async () => {
      const { result } = await renderWithData()

      act(() => {
        // Emit stakeDeposited with newBalance as hex
        mockSSE.emitUser('stakeDeposited', {
          newBalance: '0x1BC16D674EC80000', // 2e18 = 2.0
        })
      })

      expect(result.current.stakeInfo?.balanceFormatted).toBe('2')
    })

    it('stakeWithdrawn updates balance via formatEther', async () => {
      const { result } = await renderWithData()

      act(() => {
        mockSSE.emitUser('stakeWithdrawn', {
          newBalance: '0xDE0B6B3A7640000', // 1e18 = 1.0
        })
      })

      expect(result.current.stakeInfo?.balanceFormatted).toBe('1')
    })

    it('yieldCompounded increments balance and resets pendingRewards', async () => {
      const { result } = await renderWithData()

      act(() => {
        mockSSE.emitUser('yieldCompounded', {
          amount: '500000000000000000', // 0.5
        })
      })

      // Balance should increase: 10.0 + 0.5 = 10.5
      expect(parseFloat(result.current.stakeInfo!.balanceFormatted)).toBeCloseTo(10.5)
      expect(result.current.stakeInfo?.pendingRewardsFormatted).toBe('0')
    })

    it('yieldClaimed resets pendingRewards to 0', async () => {
      const { result } = await renderWithData()

      act(() => {
        mockSSE.emitUser('yieldClaimed', {})
      })

      expect(result.current.stakeInfo?.pendingRewardsFormatted).toBe('0')
      expect(result.current.stakeInfo?.pendingRewards).toBe('0')
    })

    it('claimedBEAN zeroes all BEAN reward fields', async () => {
      const { result } = await renderWithData()

      act(() => {
        mockSSE.emitUser('claimedBEAN', {})
      })

      const bean = result.current.rewards!.pendingBEAN
      expect(bean.unrefinedFormatted).toBe('0')
      expect(bean.refinedFormatted).toBe('0')
      expect(bean.grossFormatted).toBe('0')
      expect(bean.feeFormatted).toBe('0')
      expect(bean.netFormatted).toBe('0')
    })

    it('claimedBNB zeroes BNB reward', async () => {
      const { result } = await renderWithData()

      act(() => {
        mockSSE.emitUser('claimedBNB', {})
      })

      expect(result.current.rewards?.pendingBNBFormatted).toBe('0')
      expect(result.current.rewards?.pendingBNB).toBe('0')
    })

    it('profileUpdated updates profile fields selectively', async () => {
      const { result } = await renderWithData()

      act(() => {
        mockSSE.emitUser('profileUpdated', {
          username: 'newname',
          // bio and pfpUrl not included — should keep previous values
        })
      })

      expect(result.current.profile?.username).toBe('newname')
      expect(result.current.profile?.bio).toBe('Hello')
      expect(result.current.profile?.pfpUrl).toBe('https://example.com/pic.png')
    })
  })

  describe('settlementComplete window event', () => {
    it('triggers rewards re-fetch', async () => {
      mockApiFetch.mockImplementation((path: string) => {
        if (path.includes('/rewards')) return Promise.resolve(mockRewards)
        if (path.includes('/staking/')) return Promise.resolve(mockStakeInfo)
        if (path.includes('/profile')) return Promise.resolve(mockProfile)
        return Promise.resolve({})
      })

      renderHook(() => useUserData(), { wrapper })

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(`/api/user/${TEST_ADDRESS}/rewards`)
      })

      const callCountBefore = mockApiFetch.mock.calls.filter(
        (c: any[]) => c[0].includes('/rewards')
      ).length

      act(() => {
        window.dispatchEvent(new CustomEvent('settlementComplete'))
      })

      await waitFor(() => {
        const callCountAfter = mockApiFetch.mock.calls.filter(
          (c: any[]) => c[0].includes('/rewards')
        ).length
        expect(callCountAfter).toBeGreaterThan(callCountBefore)
      })
    })
  })
})
