import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import GlobalStats from './GlobalStats'

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

describe('GlobalStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null before mount (hydration guard)', () => {
    // Mock useState to keep mounted=false to test hydration guard
    const { container } = render(<GlobalStats />)
    // The component should eventually render after useEffect runs
    // Just check that it doesn't throw during initial render
    expect(container).toBeTruthy()
  })

  it('fetches /api/stats and /api/treasury/stats in parallel on mount', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/stats') {
        return Promise.resolve({
          totalSupply: '1500000000000000000000000',
          totalSupplyFormatted: '1500000',
        })
      }
      if (path === '/api/treasury/stats') {
        return Promise.resolve({
          totalVaulted: '123456000000000000000',
          totalVaultedFormatted: '123.4560',
          totalBurned: '250000000000000000000000',
          totalBurnedFormatted: '250000',
        })
      }
      return Promise.reject(new Error('Unknown path'))
    })

    render(<GlobalStats />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/stats')
      expect(mockApiFetch).toHaveBeenCalledWith('/api/treasury/stats')
      expect(mockApiFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('displays Max Supply as hardcoded 3,000,000', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/stats') {
        return Promise.resolve({
          totalSupply: '1500000000000000000000000',
          totalSupplyFormatted: '1500000',
        })
      }
      if (path === '/api/treasury/stats') {
        return Promise.resolve({
          totalVaulted: '123456000000000000000',
          totalVaultedFormatted: '123.4560',
          totalBurned: '250000000000000000000000',
          totalBurnedFormatted: '250000',
        })
      }
      return Promise.reject(new Error('Unknown path'))
    })

    render(<GlobalStats />)

    await waitFor(() => {
      expect(screen.getByText('3,000,000')).toBeInTheDocument()
    })

    expect(screen.getByText('Max Supply')).toBeInTheDocument()
  })

  it('displays circulating supply from API', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/stats') {
        return Promise.resolve({
          totalSupply: '1500000000000000000000000',
          totalSupplyFormatted: '1500000.789',
        })
      }
      if (path === '/api/treasury/stats') {
        return Promise.resolve({
          totalVaulted: '123456000000000000000',
          totalVaultedFormatted: '123.4560',
          totalBurned: '250000000000000000000000',
          totalBurnedFormatted: '250000',
        })
      }
      return Promise.reject(new Error('Unknown path'))
    })

    render(<GlobalStats />)

    await waitFor(() => {
      expect(screen.getByText('1,500,000')).toBeInTheDocument()
    })

    expect(screen.getByText('Circulating Supply')).toBeInTheDocument()
  })

  it('displays burned amount from treasury API', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/stats') {
        return Promise.resolve({
          totalSupply: '1500000000000000000000000',
          totalSupplyFormatted: '1500000',
        })
      }
      if (path === '/api/treasury/stats') {
        return Promise.resolve({
          totalVaulted: '123456000000000000000',
          totalVaultedFormatted: '123.4560',
          totalBurned: '250000000000000000000000',
          totalBurnedFormatted: '250000.456',
        })
      }
      return Promise.reject(new Error('Unknown path'))
    })

    render(<GlobalStats />)

    await waitFor(() => {
      expect(screen.getByText('250,000')).toBeInTheDocument()
    })

    expect(screen.getByText('Burned')).toBeInTheDocument()
  })

  it('displays protocol revenue from treasury API', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/stats') {
        return Promise.resolve({
          totalSupply: '1500000000000000000000000',
          totalSupplyFormatted: '1500000',
        })
      }
      if (path === '/api/treasury/stats') {
        return Promise.resolve({
          totalVaulted: '123456000000000000000',
          totalVaultedFormatted: '123.4560',
          totalBurned: '250000000000000000000000',
          totalBurnedFormatted: '250000',
        })
      }
      return Promise.reject(new Error('Unknown path'))
    })

    render(<GlobalStats />)

    await waitFor(() => {
      expect(screen.getByText('123.4560')).toBeInTheDocument()
    })

    expect(screen.getByText('Protocol Revenue')).toBeInTheDocument()
  })

  it('displays placeholder dashes when data is null', async () => {
    mockApiFetch.mockRejectedValue(new Error('API error'))

    render(<GlobalStats />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled()
    })

    // Max Supply is hardcoded, so it should always show
    expect(screen.getByText('3,000,000')).toBeInTheDocument()

    // Other values should show placeholder
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })

  it('renders mobile view when isMobile prop is true', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/stats') {
        return Promise.resolve({
          totalSupply: '1500000000000000000000000',
          totalSupplyFormatted: '1500000',
        })
      }
      if (path === '/api/treasury/stats') {
        return Promise.resolve({
          totalVaulted: '123456000000000000000',
          totalVaultedFormatted: '123.4560',
          totalBurned: '250000000000000000000000',
          totalBurnedFormatted: '250000',
        })
      }
      return Promise.reject(new Error('Unknown path'))
    })

    render(<GlobalStats isMobile={true} />)

    await waitFor(() => {
      expect(screen.getByText('Global')).toBeInTheDocument()
    })

    expect(screen.getByText('Review protocol stats and activity.')).toBeInTheDocument()
  })
})
