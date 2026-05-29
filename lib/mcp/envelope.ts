import { NextResponse } from 'next/server'

// Shared envelope helpers for Base MCP prepare endpoints.
// Every endpoint returns the same shape; centralising here keeps the contract
// consistent and makes route handlers ~30 lines instead of ~60.
//
// Success: { ok: true, data: { to, from, data, value, chainId, description, meta } }
// Error:   { ok: false, error: { code, message, details? } }
//
// All errors are returned with HTTP 200 + ok:false (per Litcoin convention),
// so agents only have one parser. Non-2xx responses indicate transport failures.

export const BASE_CHAIN_ID = 8453

export interface PrepareSuccess {
  to: `0x${string}`
  from: `0x${string}`
  data: `0x${string}`
  value?: bigint
  description: string
  meta?: Record<string, unknown>
}

export function successEnvelope(s: PrepareSuccess) {
  return NextResponse.json(
    {
      ok: true,
      data: {
        to: s.to,
        from: s.from,
        data: s.data,
        value: '0x' + (s.value ?? BigInt(0)).toString(16),
        chainId: BASE_CHAIN_ID,
        description: s.description,
        meta: s.meta ?? {},
      },
    },
    {
      headers: {
        // Prepare endpoints reflect on-chain state at request time. Don't cache.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}

// NOT_FOUND is included for middleware-level routing rejections (e.g. an
// unrecognised /api/v1/x402/* sibling route). All other error envelopes from
// route handlers stay within the original four codes.
export type ErrorCode = 'BAD_REQUEST' | 'VALIDATION_ERROR' | 'UPSTREAM_ERROR' | 'INTERNAL_ERROR' | 'NOT_FOUND'

export function errorEnvelope(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}

// Convenience wrappers for the two most common error shapes.

export function badRequest(message: string, details?: Record<string, unknown>) {
  return errorEnvelope('BAD_REQUEST', message, details)
}

export function validationError(message: string, subCode: string, details?: Record<string, unknown>) {
  // subCode (e.g. NOTHING_TO_CLAIM, INSUFFICIENT_BALANCE) lives in details so
  // agents can branch on a specific reason while the top-level code stays one of
  // the documented four (BAD_REQUEST / VALIDATION_ERROR / UPSTREAM_ERROR / INTERNAL_ERROR).
  return errorEnvelope('VALIDATION_ERROR', message, { code: subCode, ...(details ?? {}) })
}

export function upstreamError(message: string, details?: Record<string, unknown>) {
  return errorEnvelope('UPSTREAM_ERROR', message, details)
}

export function internalError(message: string, details?: Record<string, unknown>) {
  return errorEnvelope('INTERNAL_ERROR', message, details)
}
