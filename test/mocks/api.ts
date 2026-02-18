import { vi } from 'vitest'

export const mockApiFetch = vi.fn()
export const mockApiMutate = vi.fn()

export function setupApiMock() {
  vi.mock('@/lib/api', () => ({
    API_BASE: 'http://localhost:3001',
    apiFetch: (...args: any[]) => mockApiFetch(...args),
    apiMutate: (...args: any[]) => mockApiMutate(...args),
  }))
}
