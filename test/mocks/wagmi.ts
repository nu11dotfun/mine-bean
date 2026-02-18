/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest'

export const mockUseAccount = vi.fn(() => ({
  address: undefined as `0x${string}` | undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  connector: undefined,
  chain: undefined,
  status: 'disconnected' as const,
}))

export const mockUseBalance = vi.fn(() => ({
  data: undefined as { value: bigint; formatted: string; decimals: number; symbol: string } | undefined,
  isLoading: false,
  refetch: vi.fn(),
}))

export const mockWriteContract = vi.fn()
export const mockUseWriteContract = vi.fn(() => ({
  writeContract: mockWriteContract,
  writeContractAsync: vi.fn(),
  data: undefined as `0x${string}` | undefined,
  isPending: false,
  isSuccess: false,
  error: null,
  reset: vi.fn(),
}))

export const mockUseWaitForTransactionReceipt = vi.fn(() => ({
  isSuccess: false,
  isLoading: false,
  data: undefined,
}))

export const mockUseReadContract = vi.fn(() => ({
  data: undefined,
  isLoading: false,
  refetch: vi.fn(),
}))

export const mockUseDisconnect = vi.fn(() => ({
  disconnect: vi.fn(),
}))

export const mockUseSignMessage = vi.fn(() => ({
  signMessageAsync: vi.fn(),
  isPending: false,
}))

export function setupWagmiMock() {
  vi.mock('wagmi', () => ({
    useAccount: () => mockUseAccount(),
    useBalance: () => mockUseBalance(),
    useWriteContract: () => mockUseWriteContract(),
    useWaitForTransactionReceipt: () => mockUseWaitForTransactionReceipt(),
    useReadContract: () => mockUseReadContract(),
    useDisconnect: () => mockUseDisconnect(),
    useSignMessage: () => mockUseSignMessage(),
    WagmiProvider: ({ children }: any) => children,
  }))
}
