import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import ClaimRewards from './ClaimRewards'
import type { RewardsData } from '@/lib/UserDataContext'

// ── Mock UserDataContext ────────────────────────────────────────────

const mockRewards: RewardsData = {
  pendingBNB: '1000000000000000000',
  pendingBNBFormatted: '1.0',
  pendingBEAN: {
    unrefined: '500000000000000000',
    unrefinedFormatted: '0.5',
    refined: '200000000000000000',
    refinedFormatted: '0.2',
    gross: '700000000000000000',
    grossFormatted: '0.7',
    fee: '50000000000000000',
    feeFormatted: '0.05',
    net: '650000000000000000',
    netFormatted: '0.65',
  },
  uncheckpointedRound: '0',
}

let currentRewards: RewardsData | null = mockRewards

vi.mock('@/lib/UserDataContext', () => ({
  useUserData: () => ({
    rewards: currentRewards,
    stakeInfo: null,
    profile: null,
    refetchRewards: vi.fn(),
    refetchStakeInfo: vi.fn(),
    refetchProfile: vi.fn(),
  }),
}))

describe('ClaimRewards', () => {
  const onClaimBNB = vi.fn()
  const onClaimBEAN = vi.fn()

  beforeEach(() => {
    onClaimBNB.mockClear()
    onClaimBEAN.mockClear()
    currentRewards = mockRewards
  })

  it('returns null when userAddress is undefined', () => {
    const { container } = render(
      <ClaimRewards onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('returns null when rewards is null', () => {
    currentRewards = null
    const { container } = render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('returns null when all rewards are zero', () => {
    currentRewards = {
      pendingBNB: '0',
      pendingBNBFormatted: '0',
      pendingBEAN: {
        unrefined: '0', unrefinedFormatted: '0',
        refined: '0', refinedFormatted: '0',
        gross: '0', grossFormatted: '0',
        fee: '0', feeFormatted: '0',
        net: '0', netFormatted: '0',
      },
      uncheckpointedRound: '0',
    }
    const { container } = render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('displays BNB rewards amount when non-zero', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    expect(screen.getByText(/1\.000000 BNB/)).toBeInTheDocument()
  })

  it('displays unrefined and refined BEAN amounts', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    expect(screen.getByText(/0\.5000 BEAN/)).toBeInTheDocument()
    expect(screen.getByText(/0\.2000 BEAN/)).toBeInTheDocument()
  })

  it('Claim BEAN button is enabled when hasBEAN is true', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    const claimBeanBtn = screen.getByText('Claim BEAN')
    expect(claimBeanBtn).not.toBeDisabled()
  })

  it('Claim BNB button is enabled when hasBNB is true', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    const claimBnbBtn = screen.getByText('Claim BNB')
    expect(claimBnbBtn).not.toBeDisabled()
  })

  it('Claim BEAN button is disabled when no BEAN rewards', () => {
    currentRewards = {
      ...mockRewards,
      pendingBEAN: {
        unrefined: '0', unrefinedFormatted: '0',
        refined: '0', refinedFormatted: '0',
        gross: '0', grossFormatted: '0',
        fee: '0', feeFormatted: '0',
        net: '0', netFormatted: '0',
      },
    }
    render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    const claimBeanBtn = screen.getByText('Claim BEAN')
    expect(claimBeanBtn).toBeDisabled()
  })

  it('clicking Claim BEAN calls onClaimBEAN', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    fireEvent.click(screen.getByText('Claim BEAN'))
    expect(onClaimBEAN).toHaveBeenCalledTimes(1)
  })

  it('clicking Claim BNB calls onClaimBNB', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimBNB={onClaimBNB} onClaimBEAN={onClaimBEAN} />
    )
    fireEvent.click(screen.getByText('Claim BNB'))
    expect(onClaimBNB).toHaveBeenCalledTimes(1)
  })
})
