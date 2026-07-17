import { createHmac, timingSafeEqual } from 'crypto'

// Chat auth: the user signs ONE message per day (wallet popup once, not per
// message). The verified wallet is stored in an HMAC-signed HTTP-only cookie;
// send/report routes read the wallet from the cookie, never from the body.

export const CHAT_COOKIE = 'bean_chat_session'
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000

// Must match the client exactly (ChatPanel builds the same string).
export const loginMessage = (addressLower: string, timestamp: number) =>
  `BEAN Protocol Chat Login\nAddress: ${addressLower}\nTimestamp: ${timestamp}`

const secret = (): string | null => process.env.CHAT_SESSION_SECRET || null

export function signSession(walletLower: string): string {
  const s = secret()
  if (!s) throw new Error('CHAT_SESSION_SECRET is not set — generate one with `openssl rand -hex 32`')
  const payload = Buffer.from(
    JSON.stringify({ w: walletLower, exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url')
  const sig = createHmac('sha256', s).update(payload).digest().toString('base64url')
  return `${payload}.${sig}`
}

/** Returns the lowercase wallet address, or null for missing/invalid/expired cookies. */
export function verifySession(value: string | undefined): string | null {
  const s = secret()
  if (!s || !value) return null
  const dot = value.indexOf('.')
  if (dot <= 0) return null
  const payload = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = createHmac('sha256', s).update(payload).digest()
  let got: Buffer
  try {
    got = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      w?: unknown
      exp?: unknown
    }
    if (typeof parsed.w !== 'string' || typeof parsed.exp !== 'number') return null
    if (parsed.exp < Date.now()) return null
    if (!/^0x[a-f0-9]{40}$/.test(parsed.w)) return null
    return parsed.w
  } catch {
    return null
  }
}
