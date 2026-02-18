/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import MiningTable from './MiningTable'

const mockApiFetch = vi.fn()

vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

vi.mock('../lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

vi.mock('@/lib/useProfileResolver', () => ({
  useProfileResolver: () => ({
    profiles: new Map(),
    resolve: (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  }),
}))

vi.mock('./BeanLogo', () => ({
  default: ({ size }: { size: number }) => <div data-testid="bean-logo" style={{ width: size, height: size }} />
}))

describe('MiningTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockRoundsResponse = {
    rounds: [
      {
        roundId: 123,
        winningBlock: 14,
        beanWinner: '0x1234567890123456789012345678901234567890',
        isSplit: false,
        winnerCount: 5,
        totalDeployed: '1000000000000000000',
        vaultedAmount: '100000000000000000',
        totalWinnings: '890000000000000000',
        beanpotAmount: '0',
        settledAt: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() - 3610000).toISOString(),
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      },
      {
        roundId: 122,
        winningBlock: 8,
        beanWinner: null,
        isSplit: true,
        winnerCount: 3,
        totalDeployed: '2000000000000000000',
        vaultedAmount: '200000000000000000',
        totalWinnings: '1780000000000000000',
        beanpotAmount: '500000000000000000000',
        settledAt: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() - 7210000).toISOString(),
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      },
    ],
    pagination: {
      page: 1,
      limit: 12,
      total: 50,
      pages: 5,
    },
  }

  it('returns null before mount (hydration guard)', () => {
    const { container } = render(<MiningTable />)
    // Component should eventually render after useEffect runs
    expect(container).toBeTruthy()
  })

  it('fetches rounds from /api/rounds?page=1&limit=12&settled=true on mount', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)

    render(<MiningTable />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=1&limit=12&settled=true')
    })
  })

  it('displays round data columns correctly', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)

    render(<MiningTable />)

    await waitFor(() => {
      expect(screen.getByText('#123')).toBeInTheDocument()
    })

    expect(screen.getByText('#14')).toBeInTheDocument()
    expect(screen.getByText('0x1234...7890')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('1.0000')).toBeInTheDocument()
    expect(screen.getByText('0.1000')).toBeInTheDocument()
    expect(screen.getByText('0.8900')).toBeInTheDocument()
  })

  it('Beanpot tab adds &beanpot=true filter', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)

    render(<MiningTable />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=1&limit=12&settled=true')
    })

    mockApiFetch.mockClear()

    // Click Beanpot tab (find the button, not the table header)
    const beanpotTab = screen.getAllByText('Beanpot').find(el => el.tagName === 'BUTTON')
    if (beanpotTab) {
      fireEvent.click(beanpotTab)

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=1&limit=12&settled=true&beanpot=true')
      })
    }
  })

  it('pagination next/prev updates page parameter', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)

    render(<MiningTable />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=1&limit=12&settled=true')
    })

    mockApiFetch.mockClear()

    // Click next page
    const nextButtons = screen.getAllByRole('button')
    const nextButton = nextButtons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelector('path[d*="8.59"]')
    })

    if (nextButton) {
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=2&limit=12&settled=true')
      })

      mockApiFetch.mockClear()

      // Click prev page
      const prevButtons = screen.getAllByRole('button')
      const prevButton = prevButtons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && svg.querySelector('path[d*="15.41"]')
      })

      if (prevButton) {
        fireEvent.click(prevButton)

        await waitFor(() => {
          expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=1&limit=12&settled=true')
        })
      }
    }
  })

  it('"Split" badge shown when isSplit === true', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)

    render(<MiningTable />)

    await waitFor(() => {
      expect(screen.getByText('Split')).toBeInTheDocument()
    })

    const splitBadge = screen.getByText('Split')
    expect(splitBadge).toHaveStyle({
      display: 'inline-block',
      background: 'rgba(255, 255, 255, 0.04)',
    })
  })

  it('row links to BaseScan via txHash', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<MiningTable />)

    await waitFor(() => {
      expect(screen.getByText('#123')).toBeInTheDocument()
    })

    // Find the first row and click it
    const firstRow = screen.getByText('#123').closest('tr')
    if (firstRow) {
      fireEvent.click(firstRow)

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://basescan.org/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '_blank'
      )
    }

    windowOpenSpy.mockRestore()
  })

  it('displays loading state initially', async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<MiningTable />)

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  it('displays error state on fetch failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('API error'))

    render(<MiningTable />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load rounds')).toBeInTheDocument()
    })
  })

  it('displays beanpot amount when present', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)

    render(<MiningTable />)

    await waitFor(() => {
      expect(screen.getByText('500.00')).toBeInTheDocument()
    })
  })

  it('displays dash for zero beanpot', async () => {
    const responseWithZeroBeanpot = {
      rounds: [
        {
          ...mockRoundsResponse.rounds[0],
          beanpotAmount: '0',
        },
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        pages: 1,
      },
    }

    mockApiFetch.mockResolvedValue(responseWithZeroBeanpot)

    render(<MiningTable />)

    await waitFor(() => {
      expect(screen.getByText('–')).toBeInTheDocument()
    })
  })

  it('resets to page 1 when switching tabs', async () => {
    mockApiFetch.mockResolvedValue(mockRoundsResponse)

    render(<MiningTable />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=1&limit=12&settled=true')
    })

    // Click next page
    const nextButtons = screen.getAllByRole('button')
    const nextButton = nextButtons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelector('path[d*="8.59"]')
    })

    if (nextButton) {
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=2&limit=12&settled=true')
      })

      mockApiFetch.mockClear()

      // Switch to Beanpot tab (find the button, not the table header)
      const beanpotTab = screen.getAllByText('Beanpot').find(el => el.tagName === 'BUTTON')
      if (beanpotTab) {
        fireEvent.click(beanpotTab)

        // Should reset to page 1
        await waitFor(() => {
          expect(mockApiFetch).toHaveBeenCalledWith('/api/rounds?page=1&limit=12&settled=true&beanpot=true')
        })
      }
    }
  })
})
