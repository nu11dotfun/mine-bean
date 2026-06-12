import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RelayerError,
  getRelayerInfo,
  getStateLeaves,
  getAspProof,
  pollAspProof,
  pollAspProofPublished,
  relayWithdrawal,
} from './relayerClient'
import { RELAYER_BASE } from './config'

const mockFetch = vi.fn()

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('getRelayerInfo', () => {
  it('GETs /relayer/info and returns the body', async () => {
    const info = {
      entrypoint: '0xF1310bB55EA962C56Ed67D15c79C7b0f5055d370',
      pool: '0x92e40747f567D1d172f9A6f1d4F974640358e3f1',
      scope: '123',
      aspRoot: '0',
      approved: 0,
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(info))
    await expect(getRelayerInfo()).resolves.toEqual(info)
    expect(mockFetch).toHaveBeenCalledWith(`${RELAYER_BASE}/info`, undefined)
  })

  it('wraps network failure in RelayerError', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getRelayerInfo()).rejects.toBeInstanceOf(RelayerError)
  })
})

describe('getStateLeaves', () => {
  it('maps leaf strings to bigints, defaults to the eth pool', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ pool: 'eth', leaves: ['1', '22', '333'] })
    )
    await expect(getStateLeaves()).resolves.toEqual([1n, 22n, 333n])
    expect(mockFetch).toHaveBeenCalledWith(`${RELAYER_BASE}/state/leaves?pool=eth`, undefined)
  })

  it('routes to the BEAN pool when asked', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ pool: 'bean', leaves: ['5'] }))
    await expect(getStateLeaves('bean')).resolves.toEqual([5n])
    expect(mockFetch).toHaveBeenCalledWith(`${RELAYER_BASE}/state/leaves?pool=bean`, undefined)
  })
})

describe('getAspProof', () => {
  it('GETs with the label query param', async () => {
    const proof = { root: '9', depth: 1, index: 0, siblings: ['0'] }
    mockFetch.mockResolvedValueOnce(jsonResponse(proof))
    await expect(getAspProof('42')).resolves.toEqual(proof)
    expect(mockFetch).toHaveBeenCalledWith(`${RELAYER_BASE}/asp/proof?label=42`, undefined)
  })

  it('surfaces the relayer error message with status', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'label not approved yet (postman...)' }, 400)
    )
    const err = await getAspProof('42').catch((e) => e)
    expect(err).toBeInstanceOf(RelayerError)
    expect(err.status).toBe(400)
    expect(err.message).toMatch(/not approved/)
  })
})

describe('pollAspProof', () => {
  it('retries on "not approved" then resolves', async () => {
    vi.useFakeTimers()
    const proof = { root: '9', depth: 1, index: 0, siblings: ['0'] }
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'label not approved yet' }, 400))
      .mockResolvedValueOnce(jsonResponse({ error: 'label not approved yet' }, 400))
      .mockResolvedValueOnce(jsonResponse(proof))

    const onTick = vi.fn()
    const promise = pollAspProof('42', { intervalMs: 1000, onTick })
    await vi.advanceTimersByTimeAsync(2500)
    await expect(promise).resolves.toEqual(proof)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('propagates non-approval errors immediately', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
    await expect(pollAspProof('42')).rejects.toThrow('boom')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('times out with a postman hint', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(
      jsonResponse({ error: 'label not approved yet' }, 400)
    )
    const promise = pollAspProof('42', { intervalMs: 1000, timeoutMs: 2500 })
    const result = promise.catch((e) => e)
    await vi.advanceTimersByTimeAsync(5000)
    const err = await result
    expect(err).toBeInstanceOf(RelayerError)
    expect(err.message).toMatch(/postman/)
  })
})

describe('pollAspProofPublished', () => {
  const proof = { root: 'R1', depth: 1, index: 0, siblings: ['0'] }

  it('returns immediately when publishedRoot already matches the proof root', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(proof)) // /asp/proof
      .mockResolvedValueOnce(jsonResponse({ entrypoint: '0x', aspRoot: 'R1', publishedRoot: 'R1', approved: 1 })) // /info
    await expect(pollAspProofPublished('42')).resolves.toEqual(proof)
  })

  it('waits for publishedRoot to catch up to the proof root', async () => {
    vi.useFakeTimers()
    mockFetch
      .mockResolvedValueOnce(jsonResponse(proof)) // approval proof (root R1)
      .mockResolvedValueOnce(jsonResponse({ entrypoint: '0x', aspRoot: 'R1', publishedRoot: 'R0', approved: 1 })) // lagging
      .mockResolvedValueOnce(jsonResponse(proof)) // refetch
      .mockResolvedValueOnce(jsonResponse({ entrypoint: '0x', aspRoot: 'R1', publishedRoot: 'R1', approved: 1 })) // caught up

    const p = pollAspProofPublished('42', { intervalMs: 1000 })
    await vi.advanceTimersByTimeAsync(1500)
    await expect(p).resolves.toEqual(proof)
  })

  it('back-compat: returns the proof when the relayer omits publishedRoot', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(proof))
      .mockResolvedValueOnce(jsonResponse({ entrypoint: '0x', aspRoot: 'R1', approved: 1 }))
    await expect(pollAspProofPublished('42')).resolves.toEqual(proof)
  })
})

describe('relayWithdrawal', () => {
  const req = {
    withdrawal: {
      processooor: '0xF1310bB55EA962C56Ed67D15c79C7b0f5055d370' as const,
      data: '0xdead' as const,
    },
    proof: {
      proof: {
        pi_a: ['1', '2'],
        pi_b: [
          ['3', '4'],
          ['5', '6'],
        ],
        pi_c: ['7', '8'],
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: ['9', '10'],
    },
    scope: '123',
  }

  it('POSTs a BigInt-free JSON body and returns the tx hash', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ hash: '0xhash' }))
    await expect(relayWithdrawal(req)).resolves.toBe('0xhash')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${RELAYER_BASE}/relay`)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    // Round-trips as pure JSON (would have thrown at stringify if a BigInt
    // had leaked in).
    expect(JSON.parse(init.body)).toEqual(req)
  })

  it('surfaces relay failures', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'simulation reverted' }, 400))
    await expect(relayWithdrawal(req)).rejects.toThrow('simulation reverted')
  })
})
