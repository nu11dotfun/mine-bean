import { NextRequest, NextResponse } from 'next/server'

// Per-host manifests. Farcaster miniapp account associations are signed for a specific
// domain, so each subdomain needs its own accountAssociation. Serve the right one based
// on the Host header of the incoming request.
//
// www.minebean.com   - main mining interface
// agent.minebean.com - agent subdomain (agents carousel / profiles / beanbook)

const WWW_ORIGIN = 'https://www.minebean.com'
const AGENT_ORIGIN = 'https://agent.minebean.com'

const baseAppConfig = {
  version: '1',
  name: 'MineBean',
  splashBackgroundColor: '#0a0a0a',
  subtitle: 'MineBean on Base',
  description:
    'Gamified mining protocol on Base. Compete in 60-second rounds, deploy ETH to a 5x5 grid, and earn BEAN tokens and ETH rewards.',
  primaryCategory: 'games',
  tags: ['defi', 'mining', 'base', 'gaming'],
  tagline: 'MineBean on Base',
  ogTitle: 'MineBean',
  ogDescription: 'Gamified mining protocol on Base. Deploy ETH, earn BEAN.',
  noindex: false,
}

// Images stay on the main origin - no need to duplicate assets per subdomain.
const sharedAssets = {
  iconUrl: `${WWW_ORIGIN}/favicon.png`,
  splashImageUrl: `${WWW_ORIGIN}/favicon.png`,
  screenshotUrls: [`${WWW_ORIGIN}/miniapp.png`],
  heroImageUrl: `${WWW_ORIGIN}/miniapp.png`,
  ogImageUrl: `${WWW_ORIGIN}/miniapp.png`,
}

function buildAppConfig(homeUrl: string) {
  return {
    ...baseAppConfig,
    ...sharedAssets,
    homeUrl,
  }
}

const wwwAccountAssociation = {
  header:
    'eyJmaWQiOjI4Njk5NzIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2NWMxNThkNjk2N0EyMjk2MkUzOUE4RkIwZjkyMmZjY0I4MzNjMjYzIn0',
  payload: 'eyJkb21haW4iOiJ3d3cubWluZWJlYW4uY29tIn0',
  signature:
    'WgOopCAlOs1IRxWRXwarmyFM3G5PaF8evJiskkhDbMEQyVXNhfM0xOPQHj+CRiDXpSMQhhN+INcKUBhr2nLG4hs=',
}

const agentAccountAssociation = {
  header:
    'eyJmaWQiOjI4Njk5NzIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2NWMxNThkNjk2N0EyMjk2MkUzOUE4RkIwZjkyMmZjY0I4MzNjMjYzIn0',
  payload: 'eyJkb21haW4iOiJhZ2VudC5taW5lYmVhbi5jb20ifQ',
  signature:
    'bHPQ2UMLAjxr+DClLHq3g9olQthuIESAdzyU1Tp/MXF9228/thjsIKMTlKHVSlxgRu/wud19OQSxZpz92MeNNBw=',
}

export async function GET(request: NextRequest) {
  const host = (request.headers.get('host') || '').toLowerCase()
  const isAgent = host === 'agent.minebean.com' || host.startsWith('agent.')

  const appConfig = buildAppConfig(isAgent ? AGENT_ORIGIN : WWW_ORIGIN)

  const manifest = {
    accountAssociation: isAgent ? agentAccountAssociation : wwwAccountAssociation,
    frame: appConfig,
    miniapp: appConfig,
  }

  return NextResponse.json(manifest)
}
