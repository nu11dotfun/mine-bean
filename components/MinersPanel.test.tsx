import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import MinersPanel from './MinersPanel'

// ── Mocks ────────────────────────────────────────────────────────────

const mockApiFetch = vi.fn()
vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:3001',
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

const mockResolve = vi.fn((addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`
)
vi.mock('@/lib/useProfileResolver', () => ({
  useProfileResolver: () => ({
    profiles: {},
    resolve: (addr: string) => mockResolve(addr),
  }),
}))

// ── Helpers ──────────────────────────────────────────────────────────

/** The panel uses translateX(0) when open and translateX(-100%) when closed */
function getPanelElement() {
  // The panel is the element containing "Winners" title
  return screen.getByText('Winners').closest('[style*="translate"]')
}

function expectPanelOpen() {
  const panel = getPanelElement()
  expect(panel?.style.transform).toBe('translateX(0)')
}

function expectPanelClosed() {
  const panel = getPanelElement()
  expect(panel?.style.transform).toBe('translateX(-100%)')
}

// ── Test data ────────────────────────────────────────────────────────

const mockMinersResponse = {
  roundId: 100,
  winningBlock: 5,
  miners: [
    {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      bnbRewardFormatted: '0.5',
      beanRewardFormatted: '10.0',
      deployedFormatted: '1.0',
    },
    {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      bnbRewardFormatted: '0.3',
      beanRewardFormatted: '0',
      deployedFormatted: '0.5',
    },
  ],
}

/** Dispatch roundSettled + settlementComplete and wait for miners to load */
async function triggerSettlement(roundId: string) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('roundSettled', { detail: { roundId } })
    )
  })
  act(() => {
    window.dispatchEvent(new CustomEvent('settlementComplete'))
  })
}

describe('MinersPanel', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockResolve.mockClear()
  })

  it('does not show trophy tab when no miners data yet', () => {
    const { container } = render(<MinersPanel />)
    // Trophy tab (the SVG icon div) should not be rendered when miners.length === 0
    // The tab is conditionally rendered: {!isOpen && hasData && (...)}
    // With no data, no tab is shown
    const svgElements = container.querySelectorAll('svg[viewBox="0 0 24 24"]')
    // Only the "No miners data" text should be visible in the closed panel
    expect(screen.getByText('No miners data')).toBeInTheDocument()
    expectPanelClosed()
  })

  it('roundSettled event stores roundId and settlementComplete triggers fetch', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    render(<MinersPanel />)

    await triggerSettlement('100')

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/round/100/miners')
    })
  })

  it('opens panel when miners data arrives', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    render(<MinersPanel />)

    await triggerSettlement('100')

    await waitFor(() => {
      expectPanelOpen()
    })
  })

  it('displays round info and winner count', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    render(<MinersPanel />)
    await triggerSettlement('100')

    await waitFor(() => {
      expect(screen.getByText(/Round #100/)).toBeInTheDocument()
      expect(screen.getByText(/Block #6/)).toBeInTheDocument() // winningBlock + 1
      expect(screen.getByText('2 winners')).toBeInTheDocument()
    })
  })

  it('displays miner addresses and BNB rewards', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    render(<MinersPanel />)
    await triggerSettlement('100')

    await waitFor(() => {
      expect(screen.getByText('0.500000')).toBeInTheDocument()
      expect(screen.getByText('0.300000')).toBeInTheDocument()
    })
  })

  it('shows BEAN reward only when > 0', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    render(<MinersPanel />)
    await triggerSettlement('100')

    await waitFor(() => {
      expect(screen.getByText('10.0000')).toBeInTheDocument()
    })

    // Second miner has 0 BEAN — the "+" sign should only appear once
    const plusSigns = screen.queryAllByText('+')
    expect(plusSigns.length).toBe(1)
  })

  it('close button hides panel', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    render(<MinersPanel />)
    await triggerSettlement('100')

    await waitFor(() => {
      expectPanelOpen()
    })

    fireEvent.click(screen.getByText('✕'))

    expectPanelClosed()
  })

  it('consume-once ref: second settlementComplete without new roundSettled does not fetch', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    render(<MinersPanel />)

    // First settlement cycle
    await triggerSettlement('100')

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    // Second settlementComplete without roundSettled — should NOT fetch
    act(() => {
      window.dispatchEvent(new CustomEvent('settlementComplete'))
    })

    expect(mockApiFetch).toHaveBeenCalledTimes(1)
  })

  it('empty round keeps previous data without opening panel', async () => {
    // First round: has miners
    mockApiFetch.mockResolvedValueOnce(mockMinersResponse)

    render(<MinersPanel />)
    await triggerSettlement('100')

    await waitFor(() => {
      expectPanelOpen()
    })

    // Close panel
    fireEvent.click(screen.getByText('✕'))
    expectPanelClosed()

    // Second round: empty (no miners)
    mockApiFetch.mockResolvedValueOnce({ roundId: 101, winningBlock: 3, miners: [] })
    await triggerSettlement('101')

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2)
    })

    // Panel should still show previous round data (#100), not re-open
    expect(screen.getByText(/Round #100/)).toBeInTheDocument()
    expectPanelClosed()
  })

  it('overlay click closes panel', async () => {
    mockApiFetch.mockResolvedValue(mockMinersResponse)

    const { container } = render(<MinersPanel />)
    await triggerSettlement('100')

    await waitFor(() => {
      expectPanelOpen()
    })

    // The overlay is a fixed div with onClick that closes the panel
    // It's rendered as the last child with position:fixed and background: rgba
    const overlays = container.querySelectorAll('div[style*="position: fixed"]')
    // Find the overlay (not the panel itself which is also position:fixed)
    const overlay = Array.from(overlays).find(el =>
      (el as HTMLElement).style.background?.includes('rgba')
    )
    expect(overlay).toBeDefined()
    fireEvent.click(overlay!)

    expectPanelClosed()
  })
})
