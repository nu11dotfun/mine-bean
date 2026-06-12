/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SidebarControls from './SidebarControls'
import { createMockSSE } from '../test/mocks/sse'
import { MIN_DEPLOY_PER_BLOCK } from '@/lib/contracts'

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

vi.mock('../lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

const mockOpenConnectModal = vi.fn()
vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: mockOpenConnectModal }),
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    isConnected: true,
    connector: { id: 'metaMask' },
  }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/useIsOnBase', () => ({
  useIsOnBase: () => ({ isOnBase: true, isSwitching: false, switchToBase: vi.fn() }),
}))

// Privacy context — mutable state object, reset in beforeEach.
const mockEnablePrivateMode = vi.fn(async () => undefined)
const mockDisablePrivateMode = vi.fn()
const privacyState: any = {}
const defaultPrivacyState = () => ({
  enabled: false,
  status: 'idle',
  statusDetail: '',
  error: null,
  subaccountAddress: null,
  effectiveAddress: undefined,
  notes: [],
  unspentNote: undefined,
  subBalance: 0n,
  proofState: 'none',
  artifactProgress: null,
  determinismWarning: false,
  isSmartAccount: false,
  hasExported: true,
  vettingFeeBps: 50,
  minDepositWei: 1000000000000000n,
  subBeanBalance: 0n,
  cashoutStatus: 'idle',
  cashoutDetail: '',
  cashoutAsset: null,
  ethCashoutInFlight: false,
  beanCashoutInFlight: false,
  enablePrivateMode: mockEnablePrivateMode,
  disablePrivateMode: mockDisablePrivateMode,
  exportPrivateKey: vi.fn(() => ({ fileName: 'k.txt', content: 'key' })),
  confirmExported: vi.fn(),
  depositToPool: vi.fn(async () => undefined),
  ensureFunded: vi.fn(async () => undefined),
  sendPrivateTx: vi.fn(async () => '0xhash'),
  cashOut: vi.fn(async () => undefined),
  retry: vi.fn(),
  refresh: vi.fn(async () => undefined),
  rescan: vi.fn(async () => undefined),
})
vi.mock('@/lib/privacy/PrivacyContext', () => ({
  usePrivacy: () => privacyState,
}))

const mockTimerValue = { timeRemaining: 45, endTime: Math.floor(Date.now() / 1000) + 45, roundId: '100' }

vi.mock('@/lib/RoundTimerContext', () => ({
  useRoundTimer: () => mockTimerValue,
  RoundTimerProvider: ({ children }: any) => children,
}))

vi.mock('../lib/RoundTimerContext', () => ({
  useRoundTimer: () => mockTimerValue,
  RoundTimerProvider: ({ children }: any) => children,
}))

vi.mock('@/lib/UserDataContext', () => ({
  useUserData: () => ({
    rewards: null,
    stakeInfo: null,
    profile: null,
    refetchRewards: vi.fn(),
    refetchStakeInfo: vi.fn(),
    refetchProfile: vi.fn(),
  }),
}))

vi.mock('../lib/UserDataContext', () => ({
  useUserData: () => ({
    rewards: null,
    stakeInfo: null,
    profile: null,
    refetchRewards: vi.fn(),
    refetchStakeInfo: vi.fn(),
    refetchProfile: vi.fn(),
  }),
}))

// ── Tests ────────────────────────────────────────────────────────────

describe('SidebarControls', () => {
  const mockOnDeploy = vi.fn()
  const mockOnAutoActivate = vi.fn()
  const mockOnAutoStop = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiFetch.mockReset()

    // Reset privacy mock to disabled defaults
    Object.keys(privacyState).forEach((k) => delete privacyState[k])
    Object.assign(privacyState, defaultPrivacyState())

    // Component fetches the ETH price from Binance with raw fetch.
    ;(global.fetch as any).mockResolvedValue({ json: async () => ({}) })

    // Reset timer mock
    mockTimerValue.timeRemaining = 45
    mockTimerValue.endTime = Math.floor(Date.now() / 1000) + 45
    mockTimerValue.roundId = '100'

    // Default mock for price fetch
    mockApiFetch.mockResolvedValue({
      prices: {
        bean: { usd: '0.5' },
      },
    })
  })

  it('renders with Manual and Auto tabs', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
        onAutoStop={mockOnAutoStop}
      />
    )

    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByText('Auto')).toBeInTheDocument()
  })

  it('shows Manual mode by default', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    expect(screen.getByText('Deploy')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('deploy button is disabled when no blocks selected', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data with active counting phase
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 + 60,
          beanpotPoolFormatted: '100',
          totalDeployedFormatted: '0',
          userDeployedFormatted: '0',
        },
      })
    )

    // Set per-block amount to valid value
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.001' } })

    const deployButton = screen.getByText('Deploy')
    expect(deployButton).toBeDisabled()
  })

  it('deploy button is disabled when per-block amount is below MIN_DEPLOY_PER_BLOCK', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 + 60,
          totalDeployedFormatted: '0',
          userDeployedFormatted: '0',
        },
      })
    )

    // Simulate block selection
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: [0, 1, 2], count: 3 },
      })
    )

    // Set per-block amount below minimum
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: String(MIN_DEPLOY_PER_BLOCK - 0.000001) } })

    const deployButton = screen.getByText('Deploy')
    expect(deployButton).toBeDisabled()
  })

  it('deploy button is disabled when timer is 0', () => {
    mockTimerValue.timeRemaining = 0

    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate block selection
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: [0, 1], count: 2 },
      })
    )

    // Set valid per-block amount
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.001' } })

    const deployButton = screen.getByText('Deploy')
    expect(deployButton).toBeDisabled()
  })

  it('deploy button is disabled when phase is not "counting"', async () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 + 60,
          totalDeployedFormatted: '0',
          userDeployedFormatted: '0',
        },
      })
    )

    // Simulate block selection
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: [0, 1], count: 2 },
      })
    )

    // Set valid per-block amount
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.001' } })

    // Trigger round settled event to change phase
    fireEvent(window, new CustomEvent('roundSettled', { detail: {} }))

    const deployButton = screen.getByText('Settling...')
    expect(deployButton).toBeDisabled()
  })

  it('deploy button is disabled when user has already deployed', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data with user deployment
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 + 60,
          totalDeployedFormatted: '0.5',
          userDeployedFormatted: '0.1', // User has deployed
        },
      })
    )

    // Simulate block selection
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: [0, 1], count: 2 },
      })
    )

    // Set valid per-block amount
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.001' } })

    const deployButton = screen.getByText('✓ Deployed')
    expect(deployButton).toBeDisabled()
  })

  it('deploy button shows "✓ Deployed" when user has deployed this round', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data with user deployment
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 + 60,
          userDeployedFormatted: '0.1',
        },
      })
    )

    expect(screen.getByText('✓ Deployed')).toBeInTheDocument()
  })

  it('deploy button calls onDeploy with correct total and blockIds when clicked', () => {
    vi.useFakeTimers()

    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 + 60,
          totalDeployedFormatted: '0',
          userDeployedFormatted: '0',
        },
      })
    )

    // Advance timer so countdown tick() fires
    vi.advanceTimersByTime(1000)

    // Simulate block selection
    const blockIds = [0, 1, 2, 3, 4]
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: blockIds, count: blockIds.length },
      })
    )

    // Set per-block amount
    const perBlock = 0.001
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: String(perBlock) } })

    // Click deploy
    const deployButton = screen.getByText('Deploy')
    fireEvent.click(deployButton)

    const expectedTotal = perBlock * blockIds.length
    expect(mockOnDeploy).toHaveBeenCalledWith(expectedTotal, blockIds)

    vi.useRealTimers()
  })

  it('total calculation is perBlock × selectedBlockCount', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Set per-block amount
    const perBlock = 0.02
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: String(perBlock) } })

    // Simulate block selection
    const blockCount = 10
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: Array.from({ length: blockCount }, (_, i) => i), count: blockCount },
      })
    )

    const expectedTotal = perBlock * blockCount
    expect(screen.getByText(`Ξ ${expectedTotal.toFixed(5)}`)).toBeInTheDocument()
  })

  it('roundData window event updates timer, beanpot, totalDeployed, userDeployed', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    const beanpotPool = 123.5
    const totalDeployed = 45.67
    const userDeployed = 1.23

    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '42',
          endTime: Date.now() / 1000 + 60,
          beanpotPoolFormatted: String(beanpotPool),
          totalDeployedFormatted: String(totalDeployed),
          userDeployedFormatted: String(userDeployed),
        },
      })
    )

    expect(screen.getByText(beanpotPool.toFixed(1))).toBeInTheDocument()
    expect(screen.getByText(totalDeployed.toFixed(5))).toBeInTheDocument()
    expect(screen.getByText(userDeployed.toFixed(5))).toBeInTheDocument()
  })

  it('roundDeployed window event updates totalDeployed', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Initial round data
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          totalDeployedFormatted: '10.0',
        },
      })
    )

    expect(screen.getByText('10.00000')).toBeInTheDocument()

    // Round deployed event
    fireEvent(
      window,
      new CustomEvent('roundDeployed', {
        detail: {
          totalDeployedFormatted: '15.5',
        },
      })
    )

    expect(screen.getByText('15.50000')).toBeInTheDocument()
  })

  it('roundDeployed window event updates userDeployed when user matches', () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678'

    render(
      <SidebarControls
        isConnected={true}
        userAddress={userAddress}
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Round deployed event from the connected user
    fireEvent(
      window,
      new CustomEvent('roundDeployed', {
        detail: {
          user: userAddress,
          userDeployedFormatted: '2.5',
        },
      })
    )

    expect(screen.getByText('2.50000')).toBeInTheDocument()
  })

  it('roundSettled window event changes phase to eliminating', async () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Set initial counting phase
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          endTime: Date.now() / 1000 + 60,
        },
      })
    )

    // Trigger round settled
    fireEvent(window, new CustomEvent('roundSettled', { detail: {} }))

    // Should show "Settling..." button text
    expect(screen.getByText('Settling...')).toBeInTheDocument()
  })

  it('blocksChanged window event updates selected block count', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Set per-block amount
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.01' } })

    // Initial state - should show Ξ 0.00000 total
    expect(screen.getByText('Ξ 0.00000')).toBeInTheDocument()

    // Simulate block selection
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: [0, 1, 2], count: 3 },
      })
    )

    // Should update total to 0.01 × 3 = 0.03
    expect(screen.getByText('Ξ 0.03000')).toBeInTheDocument()
  })

  it('shows Connect Wallet button when not connected', () => {
    render(
      <SidebarControls
        isConnected={false}
        userBalance={0}
        onDeploy={mockOnDeploy}
      />
    )

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
  })

  it('Connect Wallet button calls openConnectModal when clicked', () => {
    render(
      <SidebarControls
        isConnected={false}
        userBalance={0}
        onDeploy={mockOnDeploy}
      />
    )

    const connectButton = screen.getByText('Connect Wallet')
    fireEvent.click(connectButton)

    expect(mockOpenConnectModal).toHaveBeenCalled()
  })

  it('switching to Auto tab dispatches autoMinerMode event', () => {
    const eventSpy = vi.fn()
    window.addEventListener('autoMinerMode', eventSpy)

    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
      />
    )

    const autoTab = screen.getByText('Auto')
    fireEvent.click(autoTab)

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          enabled: true,
          strategy: 'all',
        }),
      })
    )

    window.removeEventListener('autoMinerMode', eventSpy)
  })

  it('switching to Manual tab dispatches autoMinerMode event with enabled=false', () => {
    const eventSpy = vi.fn()
    window.addEventListener('autoMinerMode', eventSpy)

    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
      />
    )

    // Switch to Auto first
    const autoTab = screen.getByText('Auto')
    fireEvent.click(autoTab)

    eventSpy.mockClear()

    // Switch back to Manual
    const manualTab = screen.getByText('Manual')
    fireEvent.click(manualTab)

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          enabled: false,
          strategy: null,
        }),
      })
    )

    window.removeEventListener('autoMinerMode', eventSpy)
  })

  it('fetches AutoMiner state from API on mount when connected', async () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678'
    const mockAutoMinerData = {
      config: {
        strategyId: 1,
        numBlocks: 25,
        amountPerBlockFormatted: '0.001',
        active: false,
        numRounds: 10,
        roundsExecuted: 5,
        depositAmountFormatted: '0.25',
      },
      costPerRoundFormatted: '0.025',
      roundsRemaining: 5,
      totalRefundableFormatted: '0.125',
    }

    mockApiFetch.mockResolvedValueOnce(mockAutoMinerData)

    render(
      <SidebarControls
        isConnected={true}
        userAddress={userAddress}
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
      />
    )

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/automine/${userAddress}`)
    })
  })

  it('shows AutoMiner active state when API returns active=true', async () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678'
    const mockAutoMinerData = {
      config: {
        strategyId: 1,
        numBlocks: 25,
        amountPerBlockFormatted: '0.001',
        active: true,
        numRounds: 10,
        roundsExecuted: 5,
        depositAmountFormatted: '0.25',
      },
      costPerRoundFormatted: '0.025',
      roundsRemaining: 5,
      totalRefundableFormatted: '0.125',
    }

    mockApiFetch.mockResolvedValueOnce(mockAutoMinerData)

    render(
      <SidebarControls
        isConnected={true}
        userAddress={userAddress}
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
        onAutoStop={mockOnAutoStop}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('AutoMiner Active')).toBeInTheDocument()
    })

    expect(screen.getByText('Stop AutoMiner')).toBeInTheDocument()
    expect(screen.getByText('5 / 10')).toBeInTheDocument()
  })

  it('hides Manual tab when AutoMiner is active', async () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678'
    const mockAutoMinerData = {
      config: {
        strategyId: 1,
        numBlocks: 25,
        amountPerBlockFormatted: '0.001',
        active: true,
        numRounds: 10,
        roundsExecuted: 5,
        depositAmountFormatted: '0.25',
      },
      costPerRoundFormatted: '0.025',
      roundsRemaining: 5,
      totalRefundableFormatted: '0.125',
    }

    mockApiFetch.mockResolvedValueOnce(mockAutoMinerData)

    render(
      <SidebarControls
        isConnected={true}
        userAddress={userAddress}
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
        onAutoStop={mockOnAutoStop}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('AutoMiner Active')).toBeInTheDocument()
    })

    // Manual and Auto tabs should not be visible
    expect(screen.queryByText('Manual')).not.toBeInTheDocument()
    expect(screen.queryByText('Auto')).not.toBeInTheDocument()
  })

  it('AutoMiner SSE events trigger state refetch', async () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678'
    const initialData = {
      config: {
        strategyId: 1,
        numBlocks: 25,
        amountPerBlockFormatted: '0.001',
        active: true,
        numRounds: 10,
        roundsExecuted: 3,
        depositAmountFormatted: '0.25',
      },
      costPerRoundFormatted: '0.025',
      roundsRemaining: 7,
      totalRefundableFormatted: '0.175',
    }

    const updatedData = {
      config: {
        strategyId: 1,
        numBlocks: 25,
        amountPerBlockFormatted: '0.001',
        active: true,
        numRounds: 10,
        roundsExecuted: 4,
        depositAmountFormatted: '0.25',
      },
      costPerRoundFormatted: '0.025',
      roundsRemaining: 6,
      totalRefundableFormatted: '0.15',
    }

    let autoMineCalls = 0
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes('/api/stats')) {
        return Promise.resolve({ prices: { bean: { usd: '0.5' } } })
      }
      if (url.includes('/api/automine/')) {
        autoMineCalls++
        return Promise.resolve(autoMineCalls === 1 ? initialData : updatedData)
      }
      return Promise.resolve({})
    })

    render(
      <SidebarControls
        isConnected={true}
        userAddress={userAddress}
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
        onAutoStop={mockOnAutoStop}
      />
    )

    // Wait for initial fetch
    await waitFor(() => {
      expect(screen.getByText('3 / 10')).toBeInTheDocument()
    })

    // Emit autoMineExecuted SSE event
    mockSSE.emitUser('autoMineExecuted', {})

    // Should refetch and update
    await waitFor(() => {
      expect(screen.getByText('4 / 10')).toBeInTheDocument()
    })
  })

  it('deploys are disabled when total exceeds balance', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={0.1}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 + 60,
          totalDeployedFormatted: '0',
          userDeployedFormatted: '0',
        },
      })
    )

    // Simulate block selection
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: [0, 1, 2, 3, 4], count: 5 },
      })
    )

    // Set per-block amount that would exceed balance
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.05' } })

    // Total would be 0.05 × 5 = 0.25, which exceeds balance of 0.1
    const deployButton = screen.getByText('Insufficient Funds')
    expect(deployButton).toBeDisabled()
  })

  it('Auto mode calculates total deposit with executor fee', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={10.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
      />
    )

    // Switch to Auto mode
    const autoTab = screen.getByText('Auto')
    fireEvent.click(autoTab)

    // Set per-block amount
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.001' } })

    // Strategy defaults to All (25 blocks)
    expect(screen.getByText('All')).toBeInTheDocument()

    // Set rounds to 10
    const roundsInputs = screen.getAllByDisplayValue('1')
    const roundsInput = roundsInputs.find(el => (el as HTMLInputElement).type === 'number' && (el as HTMLInputElement).max === '100000')
    fireEvent.change(roundsInput!, { target: { value: '10' } })

    // Total blocks = 25 × 10 = 250
    // Deposit = 0.001 × 250 × (10000 + 100) / 10000 = 0.2525
    const expectedTotal = (0.001 * 250 * 10100) / 10000
    expect(screen.getByText(`Ξ ${expectedTotal.toFixed(5)}`)).toBeInTheDocument()
  })

  it('Stop AutoMiner button calls onAutoStop', async () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678'
    const mockAutoMinerData = {
      config: {
        strategyId: 1,
        numBlocks: 25,
        amountPerBlockFormatted: '0.001',
        active: true,
        numRounds: 10,
        roundsExecuted: 5,
        depositAmountFormatted: '0.25',
      },
      costPerRoundFormatted: '0.025',
      roundsRemaining: 5,
      totalRefundableFormatted: '0.125',
    }

    mockApiFetch.mockResolvedValueOnce(mockAutoMinerData)

    render(
      <SidebarControls
        isConnected={true}
        userAddress={userAddress}
        userBalance={1.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
        onAutoStop={mockOnAutoStop}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('AutoMiner Active')).toBeInTheDocument()
    })

    const stopButton = screen.getByText('Stop AutoMiner')
    fireEvent.click(stopButton)

    expect(mockOnAutoStop).toHaveBeenCalled()
  })

  it('Activate AutoMiner button calls onAutoActivate with correct parameters', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={10.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
      />
    )

    // Switch to Auto mode
    const autoTab = screen.getByText('Auto')
    fireEvent.click(autoTab)

    // Set per-block amount
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.001' } })

    // Strategy defaults to All (25 blocks)
    expect(screen.getByText('All')).toBeInTheDocument()

    // Set rounds to 5
    const roundsInputs = screen.getAllByDisplayValue('1')
    const roundsInput = roundsInputs.find(el => (el as HTMLInputElement).type === 'number' && (el as HTMLInputElement).max === '100000')
    fireEvent.change(roundsInput!, { target: { value: '5' } })

    // Click Activate AutoMiner
    const activateButton = screen.getByText('Activate AutoMiner')
    fireEvent.click(activateButton)

    // Verify callback was called with correct parameters
    // strategyId = 1 (All), numRounds = 5, numBlocks = 25
    // depositAmount = 0.001 × 25 × 5 × 10100 / 10000 = 0.126125 ETH in wei
    expect(mockOnAutoActivate).toHaveBeenCalledWith(
      1, // strategyId (All)
      5, // numRounds
      25, // numBlocks
      expect.any(BigInt), // depositAmount
      0 // blockMask (All strategy)
    )
  })

  it('Activate AutoMiner button is disabled when balance is insufficient', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={0.01}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
      />
    )

    // Switch to Auto mode
    const autoTab = screen.getByText('Auto')
    fireEvent.click(autoTab)

    // Set per-block amount that would exceed balance
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.001' } })

    // Total deposit would be 0.001 × 25 × 1 × 1.01 = 0.02525, which exceeds 0.01 balance
    const activateButton = screen.getByText('Activate AutoMiner')
    expect(activateButton).toBeDisabled()
  })

  it('Activate AutoMiner button is disabled when per-block is below minimum', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={10.0}
        onDeploy={mockOnDeploy}
        onAutoActivate={mockOnAutoActivate}
      />
    )

    // Switch to Auto mode
    const autoTab = screen.getByText('Auto')
    fireEvent.click(autoTab)

    // Set per-block amount below minimum
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '0.000001' } })

    const activateButton = screen.getByText('Activate AutoMiner')
    expect(activateButton).toBeDisabled()
  })

  it('quick amount buttons increment per-block value', () => {
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={10.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Initial value
    const input = screen.getByDisplayValue('0')

    // Click +0.01 button
    const quickBtn001 = screen.getAllByText('+0.01')[0]
    fireEvent.click(quickBtn001)
    expect(input).toHaveValue('0.01000')

    // Click +0.1 button
    const quickBtn01 = screen.getAllByText('+0.1')[0]
    fireEvent.click(quickBtn01)
    expect(input).toHaveValue('0.11000')

    // Click +1 button
    const quickBtn1 = screen.getAllByText('+1')[0]
    fireEvent.click(quickBtn1)
    expect(input).toHaveValue('1.11000')
  })

  describe('private mode', () => {
    const renderConnected = () =>
      render(
        <SidebarControls
          isConnected={true}
          userAddress="0x1234567890abcdef1234567890abcdef12345678"
          userBalance={1.0}
          onDeploy={mockOnDeploy}
          onAutoActivate={mockOnAutoActivate}
          onAutoStop={mockOnAutoStop}
        />
      )

    it('renders the private toggle and enables on click', () => {
      renderConnected()
      const toggle = screen.getByTestId('private-toggle')
      expect(toggle).toBeInTheDocument()
      fireEvent.click(toggle)
      expect(mockEnablePrivateMode).toHaveBeenCalled()
    })

    it('disables on click when already enabled', () => {
      privacyState.enabled = true
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      renderConnected()
      fireEvent.click(screen.getByTestId('private-toggle'))
      expect(mockDisablePrivateMode).toHaveBeenCalled()
    })

    it('blocks the toggle for smart accounts and shows the EOA note', () => {
      privacyState.isSmartAccount = true
      renderConnected()
      fireEvent.click(screen.getByTestId('private-toggle'))
      expect(mockEnablePrivateMode).not.toHaveBeenCalled()
      expect(screen.getByText(/requires a standard \(EOA\) wallet/i)).toBeInTheDocument()
    })

    it('shows the key-backup prompt and disables deploy until exported', () => {
      privacyState.enabled = true
      privacyState.hasExported = false
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      renderConnected()

      expect(screen.getByTestId('private-export-prompt')).toBeInTheDocument()

      fireEvent(window, new CustomEvent('roundData', {
        detail: { roundId: '1', endTime: Date.now() / 1000 + 60, totalDeployedFormatted: '0', userDeployedFormatted: '0' },
      }))
      fireEvent(window, new CustomEvent('blocksChanged', { detail: { blocks: [0], count: 1 } }))
      const input = screen.getByDisplayValue('0')
      fireEvent.change(input, { target: { value: '0.01' } })

      const btn = screen.getByText('Back up key first')
      expect(btn).toBeDisabled()
    })

    it('confirms the backup after downloading the key file', () => {
      privacyState.enabled = true
      privacyState.hasExported = false
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      // jsdom lacks URL.createObjectURL — stub it for the download.
      ;(URL as any).createObjectURL = vi.fn(() => 'blob:x')
      ;(URL as any).revokeObjectURL = vi.fn()
      renderConnected()

      // "I've saved it" is disabled until the file is downloaded.
      const done = screen.getByTestId('private-export-done')
      expect(done).toBeDisabled()
      fireEvent.click(screen.getByTestId('private-export-download'))
      expect(privacyState.exportPrivateKey).toHaveBeenCalled()
      expect(screen.getByTestId('private-export-done')).not.toBeDisabled()
      fireEvent.click(screen.getByTestId('private-export-done'))
      expect(privacyState.confirmExported).toHaveBeenCalled()
    })

    it('shows the private panel and locks Auto/Agent tabs while enabled', () => {
      privacyState.enabled = true
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      renderConnected()

      expect(screen.getByTestId('private-mode-panel')).toBeInTheDocument()

      // Clicking Auto must NOT switch modes (manual Deploy button persists)
      fireEvent.click(screen.getByText('Auto'))
      expect(screen.getByText('Deploy Privately')).toBeInTheDocument()
    })

    it('offers Withdraw ETH and Withdraw BEAN; BEAN routes cashOut("bean")', () => {
      privacyState.enabled = true
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      privacyState.subBalance = 10n ** 18n // ETH for gas
      privacyState.subBeanBalance = 5n * 10n ** 18n // 5 BEAN
      renderConnected()

      expect(screen.getByTestId('private-bean-balance')).toHaveTextContent('5.0000 BEAN')
      const beanBtn = screen.getByTestId('private-cashout-bean-btn')
      expect(beanBtn).not.toBeDisabled()
      fireEvent.click(beanBtn)
      // Confirm step → confirm → cashOut('bean')
      fireEvent.click(screen.getByTestId('private-cashout-bean-confirm'))
      expect(privacyState.cashOut).toHaveBeenCalledWith('bean')
    })

    it('warns that withdrawing ETH strands BEAN, but still allows it', () => {
      privacyState.enabled = true
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      privacyState.subBalance = 10n ** 18n
      privacyState.subBeanBalance = 3n * 10n ** 18n
      renderConnected()

      fireEvent.click(screen.getByTestId('private-cashout-eth-btn'))
      expect(screen.getByTestId('private-strand-warning')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('private-cashout-eth-confirm'))
      expect(privacyState.cashOut).toHaveBeenCalledWith('eth')
    })

    it('labels the deploy button "Deploy Privately" and counts the pool note as balance', () => {
      privacyState.enabled = true
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      // Subaccount empty, but a 0.5 ETH note is pooled.
      privacyState.unspentNote = {
        label: '1', value: '500000000000000000', commitment: '2',
        depositIndex: 0, spent: false, txHash: '0x', createdAt: 1,
      }
      render(
        <SidebarControls
          isConnected={true}
          userAddress="0x9999999999999999999999999999999999999999"
          userBalance={0}
          onDeploy={mockOnDeploy}
        />
      )

      fireEvent(window, new CustomEvent('roundData', {
        detail: { roundId: '1', endTime: Date.now() / 1000 + 60, totalDeployedFormatted: '0', userDeployedFormatted: '0' },
      }))
      fireEvent(window, new CustomEvent('blocksChanged', { detail: { blocks: [0, 1], count: 2 } }))
      const input = screen.getByDisplayValue('0')
      fireEvent.change(input, { target: { value: '0.01' } })

      // 0.02 total > 0 wallet balance, but covered by the 0.5 pool note.
      const btn = screen.getByText('Deploy Privately')
      expect(btn).not.toBeDisabled()
    })

    it('shows "Funding…" and disables deploy while the withdrawal is in flight', () => {
      privacyState.enabled = true
      privacyState.subaccountAddress = '0x9999999999999999999999999999999999999999'
      privacyState.status = 'relaying'
      privacyState.statusDetail = 'Funding your private account…'
      renderConnected()

      fireEvent(window, new CustomEvent('roundData', {
        detail: { roundId: '1', endTime: Date.now() / 1000 + 60, totalDeployedFormatted: '0', userDeployedFormatted: '0' },
      }))
      fireEvent(window, new CustomEvent('blocksChanged', { detail: { blocks: [0] , count: 1 } }))
      const input = screen.getByDisplayValue('0')
      fireEvent.change(input, { target: { value: '0.01' } })

      const btn = screen.getByText('Funding…')
      expect(btn).toBeDisabled()
    })
  })
})
