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

    // Default mock for price fetch
    mockApiFetch.mockResolvedValue({
      prices: {
        bean: { usd: '0.5' },
        bnb: { usd: '600' },
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
          motherlodePoolFormatted: '100',
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
    render(
      <SidebarControls
        isConnected={true}
        userAddress="0x1234567890abcdef1234567890abcdef12345678"
        userBalance={1.0}
        onDeploy={mockOnDeploy}
      />
    )

    // Simulate round data with expired timer
    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '1',
          endTime: Date.now() / 1000 - 10, // Past time
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
    expect(screen.getByText(`${expectedTotal.toFixed(5)} BNB`)).toBeInTheDocument()
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

    const motherlodePool = 123.5
    const totalDeployed = 45.67
    const userDeployed = 1.23

    fireEvent(
      window,
      new CustomEvent('roundData', {
        detail: {
          roundId: '42',
          endTime: Date.now() / 1000 + 60,
          motherlodePoolFormatted: String(motherlodePool),
          totalDeployedFormatted: String(totalDeployed),
          userDeployedFormatted: String(userDeployed),
        },
      })
    )

    expect(screen.getByText(motherlodePool.toFixed(1))).toBeInTheDocument()
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

    // Initial state - should show 0.00000 BNB total
    expect(screen.getByText('0.00000 BNB')).toBeInTheDocument()

    // Simulate block selection
    fireEvent(
      window,
      new CustomEvent('blocksChanged', {
        detail: { blocks: [0, 1, 2], count: 3 },
      })
    )

    // Should update total to 0.01 × 3 = 0.03
    expect(screen.getByText('0.03000 BNB')).toBeInTheDocument()
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
        return Promise.resolve({ prices: { bean: { usd: '0.5' }, bnb: { usd: '600' } } })
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
    const deployButton = screen.getByText('Deploy')
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

    // Set strategy to All (25 blocks)
    expect(screen.getByText('x25')).toBeInTheDocument()

    // Set rounds to 10
    const roundsInputs = screen.getAllByDisplayValue('1')
    const roundsInput = roundsInputs.find(el => (el as HTMLInputElement).type === 'number' && (el as HTMLInputElement).max === '100')
    fireEvent.change(roundsInput!, { target: { value: '10' } })

    // Total blocks = 25 × 10 = 250
    // Deposit = 0.001 × 250 × (10000 + 100) / 10000 = 0.2525
    const expectedTotal = (0.001 * 250 * 10100) / 10000
    expect(screen.getByText(`${expectedTotal.toFixed(5)} BNB`)).toBeInTheDocument()
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

    // Set strategy to All (25 blocks) - should already be default
    expect(screen.getByText('x25')).toBeInTheDocument()

    // Set rounds to 5
    const roundsInputs = screen.getAllByDisplayValue('1')
    const roundsInput = roundsInputs.find(el => (el as HTMLInputElement).type === 'number' && (el as HTMLInputElement).max === '100')
    fireEvent.change(roundsInput!, { target: { value: '5' } })

    // Click Activate AutoMiner
    const activateButton = screen.getByText('Activate AutoMiner')
    fireEvent.click(activateButton)

    // Verify callback was called with correct parameters
    // strategyId = 1 (All), numRounds = 5, numBlocks = 25
    // depositAmount = 0.001 × 25 × 5 × 10100 / 10000 = 0.126125 BNB in wei
    expect(mockOnAutoActivate).toHaveBeenCalledWith(
      1, // strategyId (All)
      5, // numRounds
      25, // numBlocks
      expect.any(BigInt) // depositAmount
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
})
