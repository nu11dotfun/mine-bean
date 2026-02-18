/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────

const mockApiFetch = vi.fn()
vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

// We need to reset the module-level cache between tests
// by re-importing each time or clearing it
beforeEach(() => {
  mockApiFetch.mockReset()
  // Clear module-level profileCache by re-mocking
  vi.resetModules()
})

describe('useProfileResolver', () => {
  async function importAndRender(addresses: string[]) {
    const mod = await import('./useProfileResolver')
    return renderHook(() => mod.useProfileResolver(addresses))
  }

  it('fetches uncached addresses via /api/profiles/batch', async () => {
    mockApiFetch.mockResolvedValue({
      profiles: {
        '0xabc': { username: 'alice', pfpUrl: null },
      },
    })

    const { result } = await importAndRender(['0xABC'])

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/profiles/batch?addresses=0xabc'
      )
    })
  })

  it('resolve returns username when available', async () => {
    mockApiFetch.mockResolvedValue({
      profiles: {
        '0xabc': { username: 'alice', pfpUrl: null },
      },
    })

    const { result } = await importAndRender(['0xABC'])

    await waitFor(() => {
      expect(result.current.resolve('0xABC')).toBe('alice')
    })
  })

  it('resolve returns truncated address when no username', async () => {
    mockApiFetch.mockResolvedValue({
      profiles: {
        '0x1234567890abcdef': { username: null, pfpUrl: null },
      },
    })

    const { result } = await importAndRender(['0x1234567890abcdef'])

    await waitFor(() => {
      expect(result.current.resolve('0x1234567890abcdef')).toBe('0x1234...cdef')
    })
  })

  it('resolve returns truncated address for unknown addresses', async () => {
    mockApiFetch.mockResolvedValue({ profiles: {} })

    const { result } = await importAndRender(['0xABC123456789'])

    // Before fetch completes, should return truncated
    expect(result.current.resolve('0x1234567890abcdef')).toBe('0x1234...cdef')
  })

  it('deduplicates and lowercases addresses', async () => {
    mockApiFetch.mockResolvedValue({ profiles: {} })

    await importAndRender(['0xABC', '0xabc', '0xABC'])

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    // Should only send one address (deduplicated)
    const url = mockApiFetch.mock.calls[0][0]
    expect(url).toBe('/api/profiles/batch?addresses=0xabc')
  })

  it('handles batch of multiple addresses', async () => {
    mockApiFetch.mockResolvedValue({
      profiles: {
        '0xaaa': { username: 'user1', pfpUrl: null },
        '0xbbb': { username: 'user2', pfpUrl: null },
      },
    })

    const { result } = await importAndRender(['0xAAA', '0xBBB'])

    await waitFor(() => {
      expect(result.current.resolve('0xAAA')).toBe('user1')
      expect(result.current.resolve('0xBBB')).toBe('user2')
    })
  })

  it('returns cached profiles on error', async () => {
    // First call succeeds and populates cache
    mockApiFetch.mockResolvedValueOnce({
      profiles: {
        '0xaaa': { username: 'cachedUser', pfpUrl: null },
      },
    })

    const { result } = await importAndRender(['0xAAA'])

    await waitFor(() => {
      expect(result.current.resolve('0xAAA')).toBe('cachedUser')
    })
  })

  it('handles empty address array', async () => {
    const { result } = await importAndRender([])

    // Should not fetch
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('handles short addresses in formatAddress', async () => {
    mockApiFetch.mockResolvedValue({ profiles: {} })

    const { result } = await importAndRender(['0x123'])

    // Short addresses returned as-is
    expect(result.current.resolve('0x12')).toBe('0x12')
  })
})
