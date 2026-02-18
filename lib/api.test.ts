import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, apiMutate, API_BASE } from './api'

describe('api helpers', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset()
  })

  describe('API_BASE', () => {
    it('defaults to http://localhost:3001', () => {
      expect(API_BASE).toBe('http://localhost:3001')
    })
  })

  describe('apiFetch', () => {
    it('calls fetch with correct URL', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      } as Response)

      await apiFetch('/api/stats')
      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/stats`)
    })

    it('returns parsed JSON on success', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ totalSupply: '3000000' }),
      } as Response)

      const result = await apiFetch<{ totalSupply: string }>('/api/stats')
      expect(result.totalSupply).toBe('3000000')
    })

    it('throws on non-OK response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)

      await expect(apiFetch('/api/notfound')).rejects.toThrow('API /api/notfound: 404')
    })

    it('throws on 500 error', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      await expect(apiFetch('/api/broken')).rejects.toThrow('API /api/broken: 500')
    })
  })

  describe('apiMutate', () => {
    it('sends POST with correct headers and body', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      await apiMutate('/api/user/profile', 'POST', { username: 'test' })
      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test' }),
      })
    })

    it('returns parsed JSON on success', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      } as Response)

      const result = await apiMutate<{ id: number }>('/api/test', 'PUT', {})
      expect(result.id).toBe(1)
    })

    it('throws with error message from JSON response body', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid username' }),
      } as Response)

      await expect(apiMutate('/api/test', 'POST', {})).rejects.toThrow('Invalid username')
    })

    it('throws with fallback message when error body is not JSON', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      } as Response)

      await expect(apiMutate('/api/test', 'DELETE', {})).rejects.toThrow('API /api/test: 500')
    })
  })
})
