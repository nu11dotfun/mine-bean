/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import Home from './page'
import { createMockSSE } from '@/test/mocks/sse'
import { CONTRACTS } from '@/lib/contracts'
import { parseEther } from 'viem'

// Create mock SSE
const mockSSE = createMockSSE()

// Mock SSE Context
vi.mock('@/lib/SSEContext', () => ({
  useSSE: () => ({
    subscribeGlobal: mockSSE.subscribeGlobal,
    subscribeUser: mockSSE.subscribeUser,
  }),
  SSEProvider: ({ children }: any) => children,
}))

// Mock wagmi hooks
const mockWriteContract = vi.fn()
const mockUseAccount = vi.fn(() => ({ address: undefined, isConnected: false, isConnecting: false, isDisconnected: true, connector: undefined, chain: undefined, status: 'disconnected' }))
const mockUseBalance = vi.fn(() => ({ data: undefined, isLoading: false, refetch: vi.fn() }))
const mockUseWriteContract = vi.fn(() => ({ writeContract: mockWriteContract, writeContractAsync: vi.fn(), data: undefined, isPending: false, isSuccess: false, error: null, reset: vi.fn() }))

vi.mock('wagmi', () => ({
  useAccount: (...args: any[]) => mockUseAccount(...args),
  useBalance: (...args: any[]) => mockUseBalance(...args),
  useWriteContract: (...args: any[]) => mockUseWriteContract(...args),
  useWaitForTransactionReceipt: () => ({ isSuccess: false, isLoading: false, data: undefined }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
  WagmiProvider: ({ children }: any) => children,
}))

// Mock RainbowKit
const mockOpenConnectModal = vi.fn()
vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: mockOpenConnectModal }),
  ConnectButton: () => null,
  RainbowKitProvider: ({ children }: any) => children,
}))

// Mock Next.js
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return React.createElement('a', { href, ...props }, children)
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock RoundTimerContext
vi.mock('@/lib/RoundTimerContext', () => ({
  useRoundTimer: () => ({
    timeRemaining: 45,
    endTime: Math.floor(Date.now() / 1000) + 45,
    roundId: '100',
  }),
  RoundTimerProvider: ({ children }: any) => children,
}))

// Mock UserDataContext
vi.mock('@/lib/UserDataContext', () => ({
  useUserData: () => ({
    address: undefined,
    profile: null,
    isLoading: false,
  }),
  UserDataProvider: ({ children }: any) => children,
}))

// Mock PrivacyContext — defaults to private mode OFF (public deploy path).
const mockEnsureFunded = vi.fn(async () => undefined)
const mockSendPrivateTx = vi.fn(async () => '0xprivatetx')
const privacyState: any = {
  enabled: false,
  effectiveAddress: undefined,
  subBalance: 0n,
  proofState: 'none',
  ensureFunded: mockEnsureFunded,
  sendPrivateTx: mockSendPrivateTx,
}
vi.mock('@/lib/privacy/PrivacyContext', () => ({
  usePrivacy: () => privacyState,
  PrivacyProvider: ({ children }: any) => children,
}))

// Mock all child components and capture their props
let capturedLandingPageProps: any = null
let capturedMiningGridProps: any = null
let capturedSidebarControlsProps: any = null
let _capturedMobileControlsProps: any = null
let capturedClaimRewardsProps: any = null
let _capturedHeaderProps: any = null
let _capturedMobileStatsBarProps: any = null
let _capturedBottomNavProps: any = null

vi.mock('@/components/LandingPage', () => ({
  default: (props: any) => {
    capturedLandingPageProps = props
    return <div data-testid="landing-page">Landing Page</div>
  },
}))

vi.mock('@/components/MiningGrid', () => ({
  default: (props: any) => {
    capturedMiningGridProps = props
    return <div data-testid="mining-grid">Mining Grid</div>
  },
}))

vi.mock('@/components/AgentConfigDrawer', () => ({
  default: () => null,
}))

vi.mock('@/components/SidebarControls', () => ({
  default: (props: any) => {
    capturedSidebarControlsProps = props
    return <div data-testid="sidebar-controls">Sidebar Controls</div>
  },
}))

vi.mock('@/components/MobileControls', () => ({
  default: (props: any) => {
    _capturedMobileControlsProps = props
    return <div data-testid="mobile-controls">Mobile Controls</div>
  },
}))

vi.mock('@/components/ClaimRewards', () => ({
  default: (props: any) => {
    capturedClaimRewardsProps = props
    return <div data-testid="claim-rewards">Claim Rewards</div>
  },
}))

vi.mock('@/components/Header', () => ({
  default: (props: any) => {
    _capturedHeaderProps = props
    return <div data-testid="header">Header</div>
  },
}))

vi.mock('@/components/MobileStatsBar', () => ({
  default: (props: any) => {
    _capturedMobileStatsBarProps = props
    return <div data-testid="mobile-stats-bar">Mobile Stats Bar</div>
  },
}))

vi.mock('@/components/BottomNav', () => ({
  default: (props: any) => {
    _capturedBottomNavProps = props
    return <div data-testid="bottom-nav">Bottom Nav</div>
  },
}))

describe('Home Page', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    // page.tsx persists 'bean_visited' in localStorage; clear so every test
    // starts at the landing page.
    window.localStorage.clear()
    // Private mode off by default.
    privacyState.enabled = false
    privacyState.effectiveAddress = undefined
    privacyState.subBalance = 0n
    privacyState.proofState = 'none'
    capturedLandingPageProps = null
    capturedMiningGridProps = null
    capturedSidebarControlsProps = null
    _capturedMobileControlsProps = null
    capturedClaimRewardsProps = null
    _capturedHeaderProps = null
    _capturedMobileStatsBarProps = null
    _capturedBottomNavProps = null

    // Default mock values
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      connector: undefined,
      chain: undefined,
      status: 'disconnected',
    })

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    })

    mockUseWriteContract.mockReturnValue({
      writeContract: mockWriteContract,
      writeContractAsync: vi.fn(),
      data: undefined,
      isPending: false,
      isSuccess: false,
      error: null,
      reset: vi.fn(),
    })

    // Set window innerWidth to desktop for default
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows LandingPage initially when showMining is false', () => {
    render(<Home />)

    expect(screen.getByTestId('landing-page')).toBeInTheDocument()
    expect(screen.queryByTestId('mining-grid')).not.toBeInTheDocument()
  })

  it('shows mining interface after onStartMining callback is called', async () => {
    const { rerender } = render(<Home />)

    expect(screen.getByTestId('landing-page')).toBeInTheDocument()

    // Simulate click on "Start Mining" by calling the callback
    capturedLandingPageProps.onStartMining()

    // Re-render to reflect state change
    rerender(<Home />)

    await waitFor(() => {
      expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument()
      expect(screen.getByTestId('mining-grid')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
      expect(screen.getByTestId('claim-rewards')).toBeInTheDocument()
    })
  })

  it('calls writeContract with correct GridMining.deploy args when handleDeploy is called', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    // Wait for re-render
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleDeploy via captured props
    const amount = 0.5
    const blockIds = [0, 5, 10, 15, 20]

    capturedSidebarControlsProps.onDeploy(amount, blockIds)

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACTS.GridMining.address,
        abi: CONTRACTS.GridMining.abi,
        functionName: 'deploy',
        args: [blockIds],
        value: parseEther(amount.toString()),
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    )
  })

  it('dispatches userDeployed window event on deploy transaction success', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    const eventListener = vi.fn()
    window.addEventListener('userDeployed', eventListener)

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleDeploy
    const amount = 0.5
    const blockIds = [0, 5, 10, 15, 20]

    capturedSidebarControlsProps.onDeploy(amount, blockIds)

    // Get the onSuccess callback and call it
    const writeContractCall = mockWriteContract.mock.calls[0]
    const onSuccess = writeContractCall[1].onSuccess
    onSuccess()

    // Check that the event was dispatched
    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { blockIds },
      })
    )

    window.removeEventListener('userDeployed', eventListener)
  })

  it('does not call writeContract when handleDeploy is called without connection', async () => {
    // Setup disconnected wallet
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      connector: undefined,
      chain: undefined,
      status: 'disconnected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleDeploy
    const amount = 0.5
    const blockIds = [0, 5, 10]

    capturedSidebarControlsProps.onDeploy(amount, blockIds)

    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('calls writeContract with claimETH when handleClaimETH is called', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('claim-rewards')).toBeInTheDocument()
    })

    // Call handleClaimETH via captured props
    capturedClaimRewardsProps.onClaimETH()

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACTS.GridMining.address,
        abi: CONTRACTS.GridMining.abi,
        functionName: 'claimETH',
        args: [],
      })
    )
  })

  it('calls writeContract with claimBEAN when handleClaimBEAN is called', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('claim-rewards')).toBeInTheDocument()
    })

    // Call handleClaimBEAN via captured props
    capturedClaimRewardsProps.onClaimBEAN()

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACTS.GridMining.address,
        abi: CONTRACTS.GridMining.abi,
        functionName: 'claimBEAN',
        args: [],
      })
    )
  })

  it('calls writeContract with AutoMiner.setConfig when handleAutoActivate is called', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleAutoActivate via captured props
    const strategyId = 1
    const numRounds = 10
    const numBlocks = 5
    const depositAmount = parseEther('1.0')

    capturedSidebarControlsProps.onAutoActivate(strategyId, numRounds, numBlocks, depositAmount, 0)

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACTS.AutoMiner.address,
        abi: CONTRACTS.AutoMiner.abi,
        functionName: 'setConfig',
        args: [strategyId, numRounds, numBlocks, 0],
        value: depositAmount,
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    )
  })

  it('dispatches autoMinerActivated window event on AutoMiner activation success', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    const eventListener = vi.fn()
    window.addEventListener('autoMinerActivated', eventListener)

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleAutoActivate
    const strategyId = 1
    const numRounds = 10
    const numBlocks = 5
    const depositAmount = parseEther('1.0')

    capturedSidebarControlsProps.onAutoActivate(strategyId, numRounds, numBlocks, depositAmount)

    // Get the onSuccess callback and call it
    const writeContractCall = mockWriteContract.mock.calls[0]
    const onSuccess = writeContractCall[1].onSuccess
    onSuccess()

    // Check that the event was dispatched
    expect(eventListener).toHaveBeenCalled()

    window.removeEventListener('autoMinerActivated', eventListener)
  })

  it('calls writeContract with AutoMiner.stop when handleAutoStop is called', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleAutoStop via captured props
    capturedSidebarControlsProps.onAutoStop()

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACTS.AutoMiner.address,
        abi: CONTRACTS.AutoMiner.abi,
        functionName: 'stop',
        args: [],
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    )
  })

  it('dispatches autoMinerStopped window event on AutoMiner stop success', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    const eventListener = vi.fn()
    window.addEventListener('autoMinerStopped', eventListener)

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleAutoStop
    capturedSidebarControlsProps.onAutoStop()

    // Get the onSuccess callback and call it
    const writeContractCall = mockWriteContract.mock.calls[0]
    const onSuccess = writeContractCall[1].onSuccess
    onSuccess()

    // Check that the event was dispatched
    expect(eventListener).toHaveBeenCalled()

    window.removeEventListener('autoMinerStopped', eventListener)
  })

  it('renders mobile layout when window width is <= 768px', async () => {
    // Set mobile width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('mobile-stats-bar')).toBeInTheDocument()
      expect(screen.getByTestId('mobile-controls')).toBeInTheDocument()
      expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
      expect(screen.queryByTestId('sidebar-controls')).not.toBeInTheDocument()
      expect(screen.queryByTestId('miners-panel')).not.toBeInTheDocument()
    })
  })

  it('passes userAddress prop to child components', async () => {
    const testAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`

    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: testAddress,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('mining-grid')).toBeInTheDocument()
    })

    expect(capturedMiningGridProps.userAddress).toBe(testAddress)
    expect(capturedSidebarControlsProps.userAddress).toBe(testAddress)
    expect(capturedClaimRewardsProps.userAddress).toBe(testAddress)
  })

  it('calculates userBalance from useBalance hook correctly', async () => {
    // Setup connected wallet with balance
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    mockUseBalance.mockReturnValue({
      data: {
        value: BigInt('2500000000000000000'), // 2.5 ETH
        formatted: '2.5',
        decimals: 18,
        symbol: 'ETH',
      },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    expect(capturedSidebarControlsProps.userBalance).toBe(2.5)
  })

  it('does not call writeContract when handleDeploy is called with empty blockIds', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleDeploy with empty blockIds
    capturedSidebarControlsProps.onDeploy(0.5, [])

    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('does not call writeContract when handleDeploy is called with zero amount', async () => {
    // Setup connected wallet
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      connector: undefined,
      chain: undefined,
      status: 'connected',
    })

    render(<Home />)

    // Start mining
    capturedLandingPageProps.onStartMining()

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
    })

    // Call handleDeploy with zero amount
    capturedSidebarControlsProps.onDeploy(0, [0, 1, 2])

    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  describe('private mode', () => {
    const SUB = '0x9999999999999999999999999999999999999999' as `0x${string}`

    beforeEach(() => {
      privacyState.enabled = true
      privacyState.effectiveAddress = SUB
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        isConnected: true,
        isConnecting: false,
        isDisconnected: false,
        connector: undefined,
        chain: undefined,
        status: 'connected',
      })
    })

    async function startMining() {
      render(<Home />)
      capturedLandingPageProps.onStartMining()
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-controls')).toBeInTheDocument()
      })
    }

    it('threads the subaccount as userAddress to child components', async () => {
      await startMining()
      expect(capturedMiningGridProps.userAddress).toBe(SUB)
      expect(capturedSidebarControlsProps.userAddress).toBe(SUB)
      expect(capturedClaimRewardsProps.userAddress).toBe(SUB)
    })

    it('routes deploy through ensureFunded + sendPrivateTx, not wagmi', async () => {
      await startMining()
      capturedSidebarControlsProps.onDeploy(0.001, [1, 2, 3])

      await waitFor(() => {
        expect(mockSendPrivateTx).toHaveBeenCalledWith(
          expect.objectContaining({
            address: CONTRACTS.GridMining.address,
            functionName: 'deploy',
            args: [[1, 2, 3]],
            value: parseEther('0.001'),
          })
        )
      })
      expect(mockEnsureFunded).toHaveBeenCalledWith(parseEther('0.001'))
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('dispatches userDeployed after a private deploy', async () => {
      const eventListener = vi.fn()
      window.addEventListener('userDeployed', eventListener)
      await startMining()
      capturedSidebarControlsProps.onDeploy(0.001, [4])

      await waitFor(() => {
        expect(eventListener).toHaveBeenCalled()
      })
      expect(eventListener.mock.calls[0][0].detail).toEqual({ blockIds: [4] })
      window.removeEventListener('userDeployed', eventListener)
    })

    it('does not deploy when funding fails', async () => {
      mockEnsureFunded.mockRejectedValueOnce(new Error('relayer down'))
      await startMining()
      capturedSidebarControlsProps.onDeploy(0.001, [1])

      await waitFor(() => {
        expect(mockEnsureFunded).toHaveBeenCalled()
      })
      expect(mockSendPrivateTx).not.toHaveBeenCalled()
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('routes claims through the subaccount with a gas-only funding check', async () => {
      await startMining()
      capturedClaimRewardsProps.onClaimETH()
      await waitFor(() => {
        expect(mockSendPrivateTx).toHaveBeenCalledWith(
          expect.objectContaining({ functionName: 'claimETH' })
        )
      })
      expect(mockEnsureFunded).toHaveBeenCalledWith(0n)

      capturedClaimRewardsProps.onClaimBEAN()
      await waitFor(() => {
        expect(mockSendPrivateTx).toHaveBeenCalledWith(
          expect.objectContaining({ functionName: 'claimBEAN' })
        )
      })
      expect(mockWriteContract).not.toHaveBeenCalled()
    })
  })
})
