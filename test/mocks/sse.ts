import { vi } from 'vitest'

type Callback = (data: unknown) => void

export function createMockSSE() {
  const globalSubs = new Map<string, Set<Callback>>()
  const userSubs = new Map<string, Set<Callback>>()

  const subscribeGlobal = vi.fn((event: string, cb: Callback) => {
    if (!globalSubs.has(event)) globalSubs.set(event, new Set())
    globalSubs.get(event)!.add(cb)
    return () => { globalSubs.get(event)?.delete(cb) }
  })

  const subscribeUser = vi.fn((event: string, cb: Callback) => {
    if (!userSubs.has(event)) userSubs.set(event, new Set())
    userSubs.get(event)!.add(cb)
    return () => { userSubs.get(event)?.delete(cb) }
  })

  return {
    subscribeGlobal,
    subscribeUser,
    emitGlobal: (event: string, data: unknown) => {
      globalSubs.get(event)?.forEach(cb => cb(data))
    },
    emitUser: (event: string, data: unknown) => {
      userSubs.get(event)?.forEach(cb => cb(data))
    },
    getGlobalSubCount: (event: string) => globalSubs.get(event)?.size ?? 0,
    getUserSubCount: (event: string) => userSubs.get(event)?.size ?? 0,
  }
}

export function setupSSEMock(mockSSE: ReturnType<typeof createMockSSE>) {
  vi.mock('@/lib/SSEContext', () => ({
    useSSE: () => ({
      subscribeGlobal: mockSSE.subscribeGlobal,
      subscribeUser: mockSSE.subscribeUser,
    }),
    SSEProvider: ({ children }: any) => children,
  }))
}
