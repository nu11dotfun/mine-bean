import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AGENT_HOST = 'agent.minebean.com'
const MAIN_HOST = 'www.minebean.com'

// Paths that belong on the agent subdomain
const AGENT_PATHS = ['/agents', '/beanbook', '/integrations']

// Paths that should pass through on any domain (API, assets, etc.)
const PASSTHROUGH_PREFIXES = ['/api/', '/_next/', '/favicon', '/images/', '/.well-known/']

// Note: the x402 paywall used to live here. It now lives on the dev's
// backend at api.minebean.com/api/strategy/decide — see lib/x402Client.ts.

function isAgentPath(pathname: string): boolean {
  return AGENT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isPassthrough(pathname: string): boolean {
  return PASSTHROUGH_PREFIXES.some(p => pathname.startsWith(p))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Always allow passthrough paths
  if (isPassthrough(pathname)) {
    return NextResponse.next()
  }

  const isAgentSubdomain = hostname.startsWith('agent.')
  const isLocalAgent = hostname.startsWith('agent.localhost')

  // On agent subdomain (production or local dev)
  if (isAgentSubdomain) {
    if (!isAgentPath(pathname) && pathname !== '/') {
      // Local dev: redirect to localhost (main)
      if (isLocalAgent) {
        const port = hostname.split(':')[1] || '3000'
        return NextResponse.redirect(new URL(`http://localhost:${port}${pathname}${request.nextUrl.search}`))
      }
      const url = new URL(pathname, `https://${MAIN_HOST}`)
      url.search = request.nextUrl.search
      return NextResponse.redirect(url)
    }
    // Root on agent subdomain → redirect to /agents
    if (pathname === '/') {
      const url = new URL('/agents', request.url)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // On main domain: redirect agent paths to agent subdomain
  if (hostname === MAIN_HOST || hostname === `www.${MAIN_HOST}`) {
    if (isAgentPath(pathname)) {
      const url = new URL(pathname, `https://${AGENT_HOST}`)
      url.search = request.nextUrl.search
      return NextResponse.redirect(url)
    }
  }

  // Local dev / other domains: pass through everything
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
