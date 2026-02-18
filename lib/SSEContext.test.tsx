/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { MockEventSource } from '../test/setup'
import { SSEProvider, useSSE } from './SSEContext'

// Mock the API_BASE import
vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:3001',
}))

function wrapper({ children, userAddress }: { children: React.ReactNode; userAddress?: string }) {
  return <SSEProvider userAddress={userAddress}>{children}</SSEProvider>
}

describe('SSEContext', () => {
  describe('useSSE', () => {
    it('throws when used outside SSEProvider', () => {
      expect(() => {
        renderHook(() => useSSE())
      }).toThrow('useSSE must be used within SSEProvider')
    })

    it('returns subscribeGlobal and subscribeUser', () => {
      const { result } = renderHook(() => useSSE(), {
        wrapper: ({ children }) => <SSEProvider>{children}</SSEProvider>,
      })
      expect(result.current.subscribeGlobal).toBeInstanceOf(Function)
      expect(result.current.subscribeUser).toBeInstanceOf(Function)
    })
  })

  describe('SSEProvider', () => {
    it('opens global EventSource on mount', () => {
      render(<SSEProvider><div /></SSEProvider>)

      expect(MockEventSource.instances.length).toBe(1)
      expect(MockEventSource.instances[0].url).toBe('http://localhost:3001/api/events/rounds')
    })

    it('opens user EventSource when userAddress is provided', () => {
      render(<SSEProvider userAddress="0xABC"><div /></SSEProvider>)

      expect(MockEventSource.instances.length).toBe(2)
      expect(MockEventSource.instances[1].url).toBe('http://localhost:3001/api/user/0xABC/events')
    })

    it('does not open user EventSource when userAddress is undefined', () => {
      render(<SSEProvider><div /></SSEProvider>)

      expect(MockEventSource.instances.length).toBe(1)
    })

    it('closes user EventSource when userAddress changes to undefined', () => {
      const { rerender } = render(<SSEProvider userAddress="0xABC"><div /></SSEProvider>)

      expect(MockEventSource.instances.length).toBe(2)
      const userSource = MockEventSource.instances[1]

      rerender(<SSEProvider userAddress={undefined}><div /></SSEProvider>)

      expect(userSource.readyState).toBe(2) // CLOSED
    })

    it('opens new user EventSource when userAddress changes', () => {
      const { rerender } = render(<SSEProvider userAddress="0xABC"><div /></SSEProvider>)

      const firstUserSource = MockEventSource.instances[1]

      rerender(<SSEProvider userAddress="0xDEF"><div /></SSEProvider>)

      expect(firstUserSource.readyState).toBe(2) // old one closed
      expect(MockEventSource.instances.length).toBe(3) // global + old user + new user
      expect(MockEventSource.instances[2].url).toBe('http://localhost:3001/api/user/0xDEF/events')
    })

    it('closes all EventSources on unmount', () => {
      const { unmount } = render(<SSEProvider userAddress="0xABC"><div /></SSEProvider>)

      const globalSource = MockEventSource.instances[0]
      const userSource = MockEventSource.instances[1]

      unmount()

      expect(globalSource.readyState).toBe(2) // CLOSED
      expect(userSource.readyState).toBe(2) // CLOSED
    })
  })

  describe('subscribeGlobal', () => {
    it('registers callback that receives parsed JSON data', () => {
      const callback = vi.fn()

      const { result } = renderHook(() => useSSE(), {
        wrapper: ({ children }) => <SSEProvider>{children}</SSEProvider>,
      })

      act(() => {
        result.current.subscribeGlobal('deployed', callback)
      })

      // Simulate SSE event
      const globalSource = MockEventSource.instances[0]
      act(() => {
        globalSource.simulateEvent('deployed', { roundId: '123', blocks: [1, 2] })
      })

      expect(callback).toHaveBeenCalledWith({ roundId: '123', blocks: [1, 2] })
    })

    it('returns unsubscribe function that removes callback', () => {
      const callback = vi.fn()

      const { result } = renderHook(() => useSSE(), {
        wrapper: ({ children }) => <SSEProvider>{children}</SSEProvider>,
      })

      let unsub: () => void
      act(() => {
        unsub = result.current.subscribeGlobal('deployed', callback)
      })

      act(() => {
        unsub()
      })

      const globalSource = MockEventSource.instances[0]
      act(() => {
        globalSource.simulateEvent('deployed', { roundId: '456' })
      })

      expect(callback).not.toHaveBeenCalled()
    })

    it('supports multiple subscribers to the same event', () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      const { result } = renderHook(() => useSSE(), {
        wrapper: ({ children }) => <SSEProvider>{children}</SSEProvider>,
      })

      act(() => {
        result.current.subscribeGlobal('roundSettled', cb1)
        result.current.subscribeGlobal('roundSettled', cb2)
      })

      const globalSource = MockEventSource.instances[0]
      act(() => {
        globalSource.simulateEvent('roundSettled', { winningBlock: 5 })
      })

      expect(cb1).toHaveBeenCalledWith({ winningBlock: 5 })
      expect(cb2).toHaveBeenCalledWith({ winningBlock: 5 })
    })

    it('passes raw data when JSON parse fails', () => {
      const callback = vi.fn()

      const { result } = renderHook(() => useSSE(), {
        wrapper: ({ children }) => <SSEProvider>{children}</SSEProvider>,
      })

      act(() => {
        result.current.subscribeGlobal('deployed', callback)
      })

      // Simulate event with non-JSON data
      const globalSource = MockEventSource.instances[0]
      const listeners = globalSource.listeners.get('deployed')
      if (listeners) {
        act(() => {
          listeners.forEach(cb => cb({ data: 'not-valid-json' }))
        })
      }

      expect(callback).toHaveBeenCalledWith('not-valid-json')
    })
  })

  describe('subscribeUser', () => {
    it('registers callback for user events', () => {
      const callback = vi.fn()

      const { result } = renderHook(() => useSSE(), {
        wrapper: ({ children }) => <SSEProvider userAddress="0xABC">{children}</SSEProvider>,
      })

      act(() => {
        result.current.subscribeUser('claimedETH', callback)
      })

      const userSource = MockEventSource.instances[1]
      act(() => {
        userSource.simulateEvent('claimedETH', { amount: '1000' })
      })

      expect(callback).toHaveBeenCalledWith({ amount: '1000' })
    })

    it('returns unsubscribe function for user events', () => {
      const callback = vi.fn()

      const { result } = renderHook(() => useSSE(), {
        wrapper: ({ children }) => <SSEProvider userAddress="0xABC">{children}</SSEProvider>,
      })

      let unsub: () => void
      act(() => {
        unsub = result.current.subscribeUser('claimedETH', callback)
      })

      act(() => {
        unsub()
      })

      const userSource = MockEventSource.instances[1]
      act(() => {
        userSource.simulateEvent('claimedETH', { amount: '2000' })
      })

      expect(callback).not.toHaveBeenCalled()
    })
  })
})
