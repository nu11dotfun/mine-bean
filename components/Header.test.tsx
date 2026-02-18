/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React from 'react'
import Header from './Header'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return React.createElement('a', { href, ...props }, children)
  },
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock RainbowKit
vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
  ConnectButton: () => <div data-testid="connect-button">Connect</div>,
  RainbowKitProvider: ({ children }: any) => children,
  darkTheme: () => ({}),
  getDefaultConfig: vi.fn(() => ({})),
}))

// Mock WalletButton component
vi.mock('@/components/WalletButton', () => ({
  default: () => <div data-testid="wallet-button">Wallet</div>
}))

vi.mock('./WalletButton', () => ({
  default: () => <div data-testid="wallet-button">Wallet</div>
}))

// Mock BeanLogo components
vi.mock('@/components/BeanLogo', () => ({
  default: ({ size }: { size: number }) => <div data-testid="bean-logo" style={{ width: size, height: size }} />,
  BeansTextLogo: ({ height }: { height: number }) => <div data-testid="beans-text-logo" style={{ height }} />
}))

vi.mock('./BeanLogo', () => ({
  default: ({ size }: { size: number }) => <div data-testid="bean-logo" style={{ width: size, height: size }} />,
  BeansTextLogo: ({ height }: { height: number }) => <div data-testid="beans-text-logo" style={{ height }} />
}))

// Mock BottomNav component
vi.mock('@/components/BottomNav', () => ({
  default: () => <div data-testid="bottom-nav">BottomNav</div>
}))

vi.mock('./BottomNav', () => ({
  default: () => <div data-testid="bottom-nav">BottomNav</div>
}))

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    ;(global.fetch as any).mockClear()
  })

  it('renders logo', async () => {
    render(<Header isMobile={false} />)

    await waitFor(() => {
      const beanLogos = screen.getAllByTestId('bean-logo')
      expect(beanLogos.length).toBeGreaterThan(0)
      expect(screen.getByTestId('beans-text-logo')).toBeInTheDocument()
    })
  })

  it('renders navigation links (About, Global, Stake)', async () => {
    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument()
      expect(screen.getByText('Global')).toBeInTheDocument()
      expect(screen.getByText('Stake')).toBeInTheDocument()
    })

    // Check that links have correct href attributes
    const aboutLink = screen.getByText('About').closest('a')
    const globalLink = screen.getByText('Global').closest('a')
    const stakeLink = screen.getByText('Stake').closest('a')

    expect(aboutLink).toHaveAttribute('href', '/about')
    expect(globalLink).toHaveAttribute('href', '/global')
    expect(stakeLink).toHaveAttribute('href', '/stake')
  })

  it('fetches BNB price from external API', async () => {
    const mockBinanceResponse = {
      price: '595.50'
    }

    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('binance.com')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockBinanceResponse)
        })
      }
      // DexScreener fallback
      return Promise.resolve({
        json: () => Promise.resolve({ pair: { priceUsd: '0.0264' } })
      })
    })

    render(<Header />)

    // Wait for BNB price to be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText(/595\.50/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify fetch was called with Binance API
    expect(global.fetch).toHaveBeenCalledWith('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
  })

  it('fetches BEAN price from DexScreener', async () => {
    const mockDexScreenerResponse = {
      pair: {
        priceUsd: '0.0275'
      }
    }

    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('dexscreener.com')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockDexScreenerResponse)
        })
      }
      // Binance fallback
      return Promise.resolve({
        json: () => Promise.resolve({ price: '580.00' })
      })
    })

    render(<Header />)

    // Wait for BEANS price to be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText(/0\.0275/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify fetch was called with DexScreener API
    expect(global.fetch).toHaveBeenCalledWith('https://api.dexscreener.com/latest/dex/pairs/bsc/0x7e58f160b5b77b8b24cd9900c09a3e730215ac47')
  })

  it('shows price values when loaded', async () => {
    const mockBinanceResponse = { price: '600.00' }
    const mockDexScreenerResponse = { pair: { priceUsd: '0.0300' } }

    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('binance.com')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockBinanceResponse)
        })
      }
      if (url.includes('dexscreener.com')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockDexScreenerResponse)
        })
      }
      return Promise.reject(new Error('Unknown API'))
    })

    render(<Header />)

    // Wait for both prices to load
    await waitFor(() => {
      expect(screen.getByText(/600\.00/)).toBeInTheDocument()
      expect(screen.getByText(/0\.0300/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check for price labels
    expect(screen.getByText('BNB')).toBeInTheDocument()
    expect(screen.getByText('BEANS')).toBeInTheDocument()
  })

  it('shows fallback prices on API error', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

    render(<Header />)

    // Wait for fallback prices to be displayed
    await waitFor(() => {
      expect(screen.getByText(/580\.00/)).toBeInTheDocument()
      expect(screen.getByText(/0\.0264/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('renders social links', async () => {
    render(<Header />)

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument()
    })

    // Find all social links (Twitter, GitHub, Discord)
    const socialLinks = document.querySelectorAll('a[href*="x.com"], a[href*="github.com"]')
    expect(socialLinks.length).toBeGreaterThan(0)
  })

  it('renders WalletButton component', async () => {
    render(<Header />)

    await waitFor(() => {
      expect(screen.getByTestId('wallet-button')).toBeInTheDocument()
    })
  })

  it('highlights active tab when currentPage is set', async () => {
    render(<Header currentPage="about" />)

    await waitFor(() => {
      const aboutLink = screen.getByText('About').closest('a')
      expect(aboutLink).toHaveStyle({ color: '#fff' })
    })
  })

  it('renders mobile layout when isMobile prop is true', async () => {
    const { container } = render(<Header isMobile={true} />)

    await waitFor(() => {
      expect(screen.getByTestId('bean-logo')).toBeInTheDocument()
    })

    // Mobile layout should have different structure - no navigation links visible in mobile header
    const nav = container.querySelector('nav')
    expect(nav).not.toBeInTheDocument()
  })

  it('renders desktop layout by default', async () => {
    const { container } = render(<Header isMobile={false} />)

    await waitFor(() => {
      const beanLogos = screen.getAllByTestId('bean-logo')
      expect(beanLogos.length).toBeGreaterThan(0)
    })

    // Desktop layout should have navigation
    const nav = container.querySelector('nav')
    expect(nav).toBeInTheDocument()
  })

  it('displays price tags with correct icons', async () => {
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('binance.com')) {
        return Promise.resolve({
          json: () => Promise.resolve({ price: '580.00' })
        })
      }
      if (url.includes('dexscreener.com')) {
        return Promise.resolve({
          json: () => Promise.resolve({ pair: { priceUsd: '0.0264' } })
        })
      }
      return Promise.reject(new Error('Unknown API'))
    })

    render(<Header isMobile={false} />)

    await waitFor(() => {
      const beanLogos = screen.getAllByTestId('bean-logo')
      expect(beanLogos.length).toBeGreaterThan(0)
      expect(screen.getByText('BNB')).toBeInTheDocument()
      expect(screen.getByText('BEANS')).toBeInTheDocument()
    })
  })

  it('updates BNB price on interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    let callCount = 0
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('binance.com')) {
        callCount++
        return Promise.resolve({
          json: () => Promise.resolve({ price: `${580 + callCount}.00` })
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({ pair: { priceUsd: '0.0264' } })
      })
    })

    render(<Header isMobile={false} />)

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(screen.getByText(/581\.00/)).toBeInTheDocument()
    })

    // Advance timers by 10 seconds and flush promises
    await act(async () => {
      vi.advanceTimersByTime(10000)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Second fetch should happen
    await waitFor(() => {
      expect(screen.getByText(/582\.00/)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('updates BEAN price on interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    let callCount = 0
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('dexscreener.com')) {
        callCount++
        return Promise.resolve({
          json: () => Promise.resolve({ pair: { priceUsd: `0.0${260 + callCount}` } })
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({ price: '580.00' })
      })
    })

    render(<Header isMobile={false} />)

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(screen.getByText(/0\.0261/)).toBeInTheDocument()
    })

    // Advance timers by 30 seconds and flush promises
    await act(async () => {
      vi.advanceTimersByTime(30000)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Second fetch should happen
    await waitFor(() => {
      expect(screen.getByText(/0\.0262/)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })
})
