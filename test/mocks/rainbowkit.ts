import { vi } from 'vitest'

export const mockOpenConnectModal = vi.fn()

export function setupRainbowKitMock() {
  vi.mock('@rainbow-me/rainbowkit', () => ({
    useConnectModal: () => ({ openConnectModal: mockOpenConnectModal }),
    ConnectButton: () => null,
    RainbowKitProvider: ({ children }: any) => children,
    darkTheme: () => ({}),
    getDefaultConfig: vi.fn(() => ({})),
  }))
}
