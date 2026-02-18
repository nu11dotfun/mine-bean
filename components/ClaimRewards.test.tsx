/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import ClaimRewards from './ClaimRewards'
import type { RewardsData } from '@/lib/UserDataContext'

// ── Mock UserDataContext ────────────────────────────────────────────

const mockRewards: RewardsData = {
  pendingETH: '1000000000000000000',
  pendingETHFormatted: '1.0',
  pendingBEAN: {
    unroasted: '500000000000000000',
    unroastedFormatted: '0.5',
    roasted: '200000000000000000',
    roastedFormatted: '0.2',
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
  const onClaimETH = vi.fn()
  const onClaimBEAN = vi.fn()

  beforeEach(() => {
    onClaimETH.mockClear()
    onClaimBEAN.mockClear()
    currentRewards = mockRewards
  })

  it('returns null when userAddress is undefined', () => {
    const { container } = render(
      <ClaimRewards onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('returns null when rewards is null', () => {
    currentRewards = null
    const { container } = render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('returns null when all rewards are zero', () => {
    currentRewards = {
      pendingETH: '0',
      pendingETHFormatted: '0',
      pendingBEAN: {
        unroasted: '0', unroastedFormatted: '0',
        roasted: '0', roastedFormatted: '0',
        gross: '0', grossFormatted: '0',
        fee: '0', feeFormatted: '0',
        net: '0', netFormatted: '0',
      },
      uncheckpointedRound: '0',
    }
    const { container } = render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('displays ETH rewards amount when non-zero', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    expect(screen.getByText(/1\.000000 ETH/)).toBeInTheDocument()
  })

  it('displays unroasted and roasted BEAN amounts', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    expect(screen.getByText(/0\.5000 BEAN/)).toBeInTheDocument()
    expect(screen.getByText(/0\.2000 BEAN/)).toBeInTheDocument()
  })

  it('Claim BEAN button is enabled when hasBEAN is true', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    const claimBeanBtn = screen.getByText('Claim BEAN')
    expect(claimBeanBtn).not.toBeDisabled()
  })

  it('Claim ETH button is enabled when hasETH is true', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    const claimEthBtn = screen.getByText('Claim ETH')
    expect(claimEthBtn).not.toBeDisabled()
  })

  it('Claim BEAN button is disabled when no BEAN rewards', () => {
    currentRewards = {
      ...mockRewards,
      pendingBEAN: {
        unroasted: '0', unroastedFormatted: '0',
        roasted: '0', roastedFormatted: '0',
        gross: '0', grossFormatted: '0',
        fee: '0', feeFormatted: '0',
        net: '0', netFormatted: '0',
      },
    }
    render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    const claimBeanBtn = screen.getByText('Claim BEAN')
    expect(claimBeanBtn).toBeDisabled()
  })

  it('clicking Claim BEAN calls onClaimBEAN', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    fireEvent.click(screen.getByText('Claim BEAN'))
    expect(onClaimBEAN).toHaveBeenCalledTimes(1)
  })

  it('clicking Claim ETH calls onClaimETH', () => {
    render(
      <ClaimRewards userAddress="0xABC" onClaimETH={onClaimETH} onClaimBEAN={onClaimBEAN} />
    )
    fireEvent.click(screen.getByText('Claim ETH'))
    expect(onClaimETH).toHaveBeenCalledTimes(1)
  })
})
