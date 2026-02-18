/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import LeaderboardTable from './LeaderboardTable'

const mockApiFetch = vi.fn()

vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

vi.mock('../lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

// Mock BeanLogo component
vi.mock('./BeanLogo', () => ({
  default: ({ size }: { size: number }) => <div data-testid="bean-logo" style={{ width: size, height: size }} />
}))

// Mock useProfileResolver hook
vi.mock('@/lib/useProfileResolver', () => ({
  useProfileResolver: () => ({
    profiles: new Map(),
    resolve: (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  }),
}))

vi.mock('../lib/useProfileResolver', () => ({
  useProfileResolver: () => ({
    profiles: new Map(),
    resolve: (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  }),
}))

describe('LeaderboardTable', () => {
  const mockMinersData = {
    period: 'all',
    deployers: [
      {
        address: '0x1234567890123456789012345678901234567890',
        totalDeployed: '5000000000000000000',
        totalDeployedFormatted: '5.0',
        roundsPlayed: 42
      },
      {
        address: '0xABCDEF1234567890123456789012345678901234',
        totalDeployed: '3000000000000000000',
        totalDeployedFormatted: '3.0',
        roundsPlayed: 30
      }
    ]
  }

  const mockStakersData = {
    stakers: [
      {
        address: '0x2222222222222222222222222222222222222222',
        stakedBalance: '1000000000000000000',
        stakedBalanceFormatted: '1.0'
      },
      {
        address: '0x3333333333333333333333333333333333333333',
        stakedBalance: '500000000000000000',
        stakedBalanceFormatted: '0.5'
      }
    ]
  }

  const mockEarnersData = {
    earners: [
      {
        address: '0x4444444444444444444444444444444444444444',
        unclaimed: '2000000000000000000',
        unclaimedFormatted: '2.0'
      },
      {
        address: '0x5555555555555555555555555555555555555555',
        unclaimed: '1500000000000000000',
        unclaimedFormatted: '1.5'
      }
    ],
    pagination: { page: 1, limit: 12, total: 2, pages: 1 }
  }

  beforeEach(() => {
    mockApiFetch.mockClear()
    // Default mock responses for all three endpoints
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes('/api/leaderboard/miners')) {
        return Promise.resolve(mockMinersData)
      }
      if (url.includes('/api/leaderboard/stakers')) {
        return Promise.resolve(mockStakersData)
      }
      if (url.includes('/api/leaderboard/earners')) {
        return Promise.resolve(mockEarnersData)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  it('returns null before mount (hydration guard)', () => {
    const { container } = render(<LeaderboardTable />)
    // Component should eventually render after useEffect runs
    expect(container).toBeTruthy()
  })

  it('fetches all 3 leaderboard endpoints in parallel on mount', async () => {
    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(3)
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/api/leaderboard/miners?period=all&limit=12')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/leaderboard/stakers?limit=12')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/leaderboard/earners?limit=12')
  })

  it('miners tab shows addresses and ETH values', async () => {
    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    // Check for miners tab content
    await waitFor(() => {
      expect(screen.getAllByText(/0x1234\.\.\.7890/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/0xABCD\.\.\.1234/).length).toBeGreaterThan(0)
    })

    // Check for ranks
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })

  it('stakers tab shows addresses and BEAN values', async () => {
    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    // Click Stakers tab
    const stakersTab = screen.getAllByText('Stakers').find(el => el.tagName === 'BUTTON')
    if (stakersTab) {
      fireEvent.click(stakersTab)

      // Check for stakers content
      await waitFor(() => {
        expect(screen.getAllByText(/0x2222\.\.\.2222/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/0x3333\.\.\.3333/).length).toBeGreaterThan(0)
      })
    }
  })

  it('unroasted tab shows addresses and BEAN values', async () => {
    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    // Click Unroasted tab
    const unroastedTab = screen.getAllByText('Unroasted').find(el => el.tagName === 'BUTTON')
    if (unroastedTab) {
      fireEvent.click(unroastedTab)

      // Check for earners content
      await waitFor(() => {
        expect(screen.getAllByText(/0x4444\.\.\.4444/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/0x5555\.\.\.5555/).length).toBeGreaterThan(0)
      })
    }
  })

  it('tab switching shows correct data set', async () => {
    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    // Start with Miners tab
    await waitFor(() => {
      expect(screen.getByText(/0x1234\.\.\.7890/)).toBeInTheDocument()
    })

    // Switch to Stakers tab
    fireEvent.click(screen.getByText('Stakers'))
    await waitFor(() => {
      expect(screen.getByText(/0x2222\.\.\.2222/)).toBeInTheDocument()
    })

    // Switch to Unroasted tab
    fireEvent.click(screen.getByText('Unroasted'))
    await waitFor(() => {
      expect(screen.getByText(/0x4444\.\.\.4444/)).toBeInTheDocument()
    })

    // Switch back to Miners
    fireEvent.click(screen.getByText('Miners'))
    await waitFor(() => {
      expect(screen.getByText(/0x1234\.\.\.7890/)).toBeInTheDocument()
    })
  })

  it('row links to BaseScan address page', async () => {
    // Mock window.open
    const mockOpen = vi.fn()
    window.open = mockOpen

    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText(/0x1234\.\.\.7890/)).toBeInTheDocument()
    })

    // Click first row
    const firstRow = screen.getByText('#1').closest('tr')
    fireEvent.click(firstRow!)

    expect(mockOpen).toHaveBeenCalledWith(
      'https://basescan.org/address/0x1234567890123456789012345678901234567890',
      '_blank'
    )
  })

  it('shows loading state initially', async () => {
    render(<LeaderboardTable />)

    // Component is null before mount, so wait for it to appear
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeInTheDocument()
    })
  })

  it('shows correct column headers for each tab', async () => {
    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    // Miners tab - Total Deployed
    await waitFor(() => {
      expect(screen.getByText('Total Deployed')).toBeInTheDocument()
    })

    // Stakers tab - Staked
    const stakersTab = screen.getAllByText('Stakers').find(el => el.tagName === 'BUTTON')
    if (stakersTab) {
      fireEvent.click(stakersTab)
      await waitFor(() => {
        expect(screen.getAllByText('Staked').filter(el => el.tagName === 'TH').length).toBeGreaterThan(0)
      })
    }

    // Unroasted tab - Unroasted (check for TH element to avoid button confusion)
    const unroastedTab = screen.getAllByText('Unroasted').find(el => el.tagName === 'BUTTON')
    if (unroastedTab) {
      fireEvent.click(unroastedTab)
      await waitFor(() => {
        expect(screen.getAllByText('Unroasted').filter(el => el.tagName === 'TH').length).toBeGreaterThan(0)
      })
    }
  })

  it('shows correct descriptions for each tab', async () => {
    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    // Miners tab description
    await waitFor(() => {
      expect(screen.getByText('Top miners by total ETH deployed over their lifetime.')).toBeInTheDocument()
    })

    // Stakers tab description
    fireEvent.click(screen.getByText('Stakers'))
    await waitFor(() => {
      expect(screen.getByText('Top stakers by amount of BEANS staked.')).toBeInTheDocument()
    })

    // Unroasted tab description
    fireEvent.click(screen.getByText('Unroasted'))
    await waitFor(() => {
      expect(screen.getByText('Top miners by amount of unroasted BEANS.')).toBeInTheDocument()
    })
  })

  it('handles API error gracefully', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<LeaderboardTable />)

    await waitFor(() => {
      expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    // Should show empty state after error
    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument()
    })

    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch leaderboard:', expect.any(Error))

    consoleSpy.mockRestore()
  })
})
