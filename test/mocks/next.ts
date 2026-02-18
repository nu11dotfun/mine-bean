import { vi } from 'vitest'

export const mockPush = vi.fn()
export const mockReplace = vi.fn()

export function setupNextMocks() {
  vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: any) => {
      const { createElement } = require('react')
      return createElement('a', { href, ...props }, children)
    },
  }))

  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  }))
}
