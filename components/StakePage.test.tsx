/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import StakePage from './StakePage'
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

vi.mock('../lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

const mockOpenConnectModal = vi.fn()
vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: mockOpenConnectModal }),
}))

const mockUserData = {
  stakeInfo: {
    balance: '10000000000000000000',
    balanceFormatted: '10.0',
    pendingRewards: '500000000000000000',
    pendingRewardsFormatted: '0.5',
    compoundFeeReserve: '6000000000000000',
    compoundFeeReserveFormatted: '0.006',
    canCompound: true,
  },
  refetchStakeInfo: vi.fn(),
  rewards: null,
  profile: null,
  refetchRewards: vi.fn(),
  refetchProfile: vi.fn(),
}

vi.mock('@/lib/UserDataContext', () => ({
  useUserData: () => mockUserData,
}))

vi.mock('../lib/UserDataContext', () => ({
  useUserData: () => mockUserData,
}))

// ── Test data ────────────────────────────────────────────────────────

const mockStakingStats = {
  totalStaked: '100000000000000000000',
  totalStakedFormatted: '100.0',
  apr: '25.5',
  tvlUsd: '2500',
}

describe('StakePage', () => {
  const onDeposit = vi.fn()
  const onWithdraw = vi.fn()
  const onClaimYield = vi.fn()
  const onCompound = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiFetch.mockReset()
    // Mock fetch for DexScreener price
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pair: { priceUsd: '0.03' } }),
    } as Response)
  })

  function renderStakePage(overrides = {}) {
    const defaultProps = {
      isConnected: true,
      userAddress: '0x1234567890abcdef1234567890abcdef12345678',
      userBalance: 50.0,
      onDeposit,
      onWithdraw,
      onClaimYield,
      onCompound,
      ...overrides,
    }
    return render(<StakePage {...defaultProps} />)
  }

  it('fetches staking stats from /api/staking/stats on mount', async () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/staking/stats')
    })
  })

  it('displays the Stake header and subtitle', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    expect(screen.getByText('Stake')).toBeInTheDocument()
    expect(screen.getByText(/Earn a share of protocol revenue/)).toBeInTheDocument()
  })

  it('displays summary metrics from API when loaded', async () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument() // total staked (Math.floor + toLocaleString)
      expect(screen.getByText(/25\.50%/)).toBeInTheDocument() // APR (formatted as .toFixed(2))
    })
  })

  it('shows deposit and withdraw tabs', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    // Both tab labels should be present (there may be duplicates from tab + button)
    expect(screen.getAllByText('Deposit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Withdraw').length).toBeGreaterThanOrEqual(1)
  })

  it('shows BEAN balance in deposit tab', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    expect(screen.getByText(/50\.0000/)).toBeInTheDocument()
  })

  it('ALL button sets input to full balance in deposit tab', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    const allBtn = screen.getByText('ALL')
    fireEvent.click(allBtn)

    const input = screen.getByDisplayValue('50.0000')
    expect(input).toBeInTheDocument()
  })

  it('HALF button sets input to half balance', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    const halfBtn = screen.getByText('HALF')
    fireEvent.click(halfBtn)

    const input = screen.getByDisplayValue('25.0000')
    expect(input).toBeInTheDocument()
  })

  it('deposit button calls onDeposit with parsed bigint amount', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    // Set amount
    const input = screen.getByPlaceholderText('0.0')
    fireEvent.change(input, { target: { value: '5' } })

    // Click deposit action button (last "Deposit" button — the tab is first, action button is second)
    const depositBtns = screen.getAllByText('Deposit').filter(el => el.tagName === 'BUTTON')
    const actionBtn = depositBtns[depositBtns.length - 1]
    fireEvent.click(actionBtn!)

    expect(onDeposit).toHaveBeenCalledWith(
      BigInt('5000000000000000000'), // 5 ether in wei
      undefined // no compound fee
    )
  })

  it('withdraw tab shows staked balance and calls onWithdraw', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    // Switch to withdraw tab (first "Withdraw" button is the tab)
    const withdrawBtns = screen.getAllByText('Withdraw').filter(el => el.tagName === 'BUTTON')
    fireEvent.click(withdrawBtns[0]!)

    // Should show staked balance
    expect(screen.getByText(/10\.0000/)).toBeInTheDocument()

    // Set amount and withdraw
    const input = screen.getByPlaceholderText('0.0')
    fireEvent.change(input, { target: { value: '3' } })

    // Click withdraw action button (last "Withdraw" button)
    const withdrawBtnsAfter = screen.getAllByText('Withdraw').filter(el => el.tagName === 'BUTTON')
    const actionBtn = withdrawBtnsAfter[withdrawBtnsAfter.length - 1]
    fireEvent.click(actionBtn!)

    expect(onWithdraw).toHaveBeenCalledWith(BigInt('3000000000000000000'))
  })

  it('user position card is visible when staked > 0', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    // Should show pending rewards
    expect(screen.getByText(/0\.5/)).toBeInTheDocument()
  })

  it('Claim button calls onClaimYield', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    const claimBtn = screen.getByText('Claim')
    fireEvent.click(claimBtn)

    expect(onClaimYield).toHaveBeenCalledTimes(1)
  })

  it('Claim & Deposit button calls onCompound', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    const compoundBtn = screen.getByText('Claim & Deposit')
    fireEvent.click(compoundBtn)

    expect(onCompound).toHaveBeenCalledTimes(1)
  })

  it('shows connect wallet button when not connected', () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage({ isConnected: false })

    const connectBtn = screen.getByText('Connect Wallet')
    fireEvent.click(connectBtn)

    expect(mockOpenConnectModal).toHaveBeenCalledTimes(1)
  })

  it('yieldDistributed SSE event triggers stats re-fetch', async () => {
    mockApiFetch.mockResolvedValue(mockStakingStats)
    renderStakePage()

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/staking/stats')
    })

    const callsBefore = mockApiFetch.mock.calls.length

    // Emit yieldDistributed
    mockSSE.emitGlobal('yieldDistributed', { amount: '1000' })

    await waitFor(() => {
      expect(mockApiFetch.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })
})
