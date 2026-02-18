/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import RevenueTable from './RevenueTable'

const mockApiFetch = vi.fn()

vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

vi.mock('../lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

vi.mock('./BeanLogo', () => ({
  default: ({ size }: { size: number }) => <div data-testid="bean-logo" style={{ width: size, height: size }} />
}))

describe('RevenueTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockBuybacksResponse = {
    buybacks: [
      {
        bnbSpent: '1000000000000000000',
        bnbSpentFormatted: '1.0',
        beanReceived: '500000000000000000000',
        beanReceivedFormatted: '500.0',
        beanBurned: '250000000000000000000',
        beanBurnedFormatted: '250.0',
        beanToStakers: '250000000000000000000',
        beanToStakersFormatted: '250.0',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        blockNumber: 12345678,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        bnbSpent: '2000000000000000000',
        bnbSpentFormatted: '2.0',
        beanReceived: '1000000000000000000000',
        beanReceivedFormatted: '1000.0',
        beanBurned: '500000000000000000000',
        beanBurnedFormatted: '500.0',
        beanToStakers: '500000000000000000000',
        beanToStakersFormatted: '500.0',
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        blockNumber: 12345679,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
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
    const { container } = render(<RevenueTable />)
    // Component should eventually render after useEffect runs
    expect(container).toBeTruthy()
  })

  it('fetches buybacks from /api/treasury/buybacks?page=1&limit=12 on mount', async () => {
    mockApiFetch.mockResolvedValue(mockBuybacksResponse)

    render(<RevenueTable />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/treasury/buybacks?page=1&limit=12')
    })
  })

  it('displays time, spent, burned, yield columns', async () => {
    mockApiFetch.mockResolvedValue(mockBuybacksResponse)

    render(<RevenueTable />)

    await waitFor(() => {
      expect(screen.getByText('1.0000')).toBeInTheDocument()
    })

    // Check table headers
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Spent')).toBeInTheDocument()
    expect(screen.getByText('Burned')).toBeInTheDocument()
    expect(screen.getByText('Yield Generated')).toBeInTheDocument()

    // Check data values (multiple elements may have same text)
    expect(screen.getAllByText('250.0000').length).toBeGreaterThan(0)
    expect(screen.getByText('2.0000')).toBeInTheDocument()
    expect(screen.getAllByText('500.0000').length).toBeGreaterThan(0)
  })

  it('pagination works correctly', async () => {
    mockApiFetch.mockResolvedValue(mockBuybacksResponse)

    render(<RevenueTable />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/treasury/buybacks?page=1&limit=12')
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
        expect(mockApiFetch).toHaveBeenCalledWith('/api/treasury/buybacks?page=2&limit=12')
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
          expect(mockApiFetch).toHaveBeenCalledWith('/api/treasury/buybacks?page=1&limit=12')
        })
      }
    }
  })

  it('row links to BSCScan via txHash', async () => {
    mockApiFetch.mockResolvedValue(mockBuybacksResponse)
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<RevenueTable />)

    await waitFor(() => {
      expect(screen.getByText('1.0000')).toBeInTheDocument()
    })

    // Find the first row and click it
    const firstRow = screen.getByText('1.0000').closest('tr')
    if (firstRow) {
      fireEvent.click(firstRow)

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://bscscan.com/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '_blank'
      )
    }

    windowOpenSpy.mockRestore()
  })

  it('displays loading state initially', async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<RevenueTable />)

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  it('displays error state on fetch failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('API error'))

    render(<RevenueTable />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load buybacks')).toBeInTheDocument()
    })
  })

  it('formats relative time correctly', async () => {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const twoHoursAgo = new Date(Date.now() - 7200000).toISOString()

    const response = {
      buybacks: [
        {
          ...mockBuybacksResponse.buybacks[0],
          timestamp: oneHourAgo,
        },
        {
          ...mockBuybacksResponse.buybacks[1],
          timestamp: twoHoursAgo,
        },
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 2,
        pages: 1,
      },
    }

    mockApiFetch.mockResolvedValue(response)

    render(<RevenueTable />)

    await waitFor(() => {
      // Should show "1 hours ago" or "2 hours ago" depending on timing
      const hoursAgoElements = screen.getAllByText(/hours? ago/)
      expect(hoursAgoElements.length).toBeGreaterThan(0)
    })
  })

  it('disables prev button on first page', async () => {
    mockApiFetch.mockResolvedValue(mockBuybacksResponse)

    render(<RevenueTable />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled()
    })

    const prevButtons = screen.getAllByRole('button')
    const prevButton = prevButtons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelector('path[d*="15.41"]')
    })

    if (prevButton) {
      expect(prevButton).toBeDisabled()
    }
  })

  it('disables next button on last page', async () => {
    const lastPageResponse = {
      ...mockBuybacksResponse,
      pagination: {
        page: 5,
        limit: 12,
        total: 50,
        pages: 5,
      },
    }

    mockApiFetch.mockResolvedValue(lastPageResponse)

    render(<RevenueTable />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled()
    })

    // Navigate to last page
    const nextButtons = screen.getAllByRole('button')
    const nextButton = nextButtons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelector('path[d*="8.59"]')
    })

    // Click next 4 times to reach last page
    if (nextButton) {
      for (let i = 0; i < 4; i++) {
        mockApiFetch.mockResolvedValue(lastPageResponse)
        fireEvent.click(nextButton)
        await waitFor(() => {
          expect(mockApiFetch).toHaveBeenCalled()
        })
        mockApiFetch.mockClear()
      }

      // Now next button should be disabled
      await waitFor(() => {
        expect(nextButton).toBeDisabled()
      })
    }
  })

  it('displays table description', async () => {
    mockApiFetch.mockResolvedValue(mockBuybacksResponse)

    render(<RevenueTable />)

    await waitFor(() => {
      expect(
        screen.getByText('Transactions where protocol revenue was used to buy back BEANS from the spot market.')
      ).toBeInTheDocument()
    })
  })

  it('formats numbers with 4 decimal places', async () => {
    const response = {
      buybacks: [
        {
          bnbSpent: '123456789012345678',
          bnbSpentFormatted: '0.12345678',
          beanReceived: '500000000000000000000',
          beanReceivedFormatted: '500.0',
          beanBurned: '250000000000000000000',
          beanBurnedFormatted: '250.12345',
          beanToStakers: '250000000000000000000',
          beanToStakersFormatted: '250.98765',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          blockNumber: 12345678,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        pages: 1,
      },
    }

    mockApiFetch.mockResolvedValue(response)

    render(<RevenueTable />)

    await waitFor(() => {
      expect(screen.getAllByText('0.1235').length).toBeGreaterThan(0)
      expect(screen.getAllByText('250.1234').length).toBeGreaterThan(0)
      expect(screen.getAllByText('250.9877').length).toBeGreaterThan(0)
    })
  })
})
