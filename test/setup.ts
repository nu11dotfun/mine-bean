import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

// ── Mock fetch globally ──────────────────────────────────────────────
global.fetch = vi.fn()

// ── Mock EventSource ─────────────────────────────────────────────────
export class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  readyState: number = 0
  listeners: Map<string, ((...args: any[]) => void)[]> = new Map()
  onerror: ((...args: any[]) => void) | null = null

  constructor(url: string) {
    this.url = url
    this.readyState = 1 // OPEN
    MockEventSource.instances.push(this)
  }

  addEventListener(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event)!.push(callback)
  }

  removeEventListener(event: string, callback: (...args: any[]) => void) {
    const cbs = this.listeners.get(event)
    if (cbs) {
      const idx = cbs.indexOf(callback)
      if (idx > -1) cbs.splice(idx, 1)
    }
  }

  close() {
    this.readyState = 2 // CLOSED
  }

  /** Test helper: simulate an SSE event arriving */
  simulateEvent(event: string, data: unknown) {
    const callbacks = this.listeners.get(event) || []
    const messageEvent = { data: JSON.stringify(data) }
    callbacks.forEach(cb => cb(messageEvent))
  }

  static reset() {
    MockEventSource.instances = []
  }
}

;(global as any).EventSource = MockEventSource

// ── Mock matchMedia ──────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ── Reset mocks between tests ────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  MockEventSource.reset()
  sessionStorage.clear()
})
