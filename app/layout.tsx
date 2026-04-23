import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Web3Provider } from '@/lib/providers'
import HelpButton from '@/components/HelpButton'
import './globals.css'

// Derive the miniapp launch URL from the host serving the page so the
// agent subdomain advertises itself (with its own signed manifest) and
// the main domain continues to advertise www.minebean.com.
export function generateMetadata(): Metadata {
  const host = (headers().get('host') || 'www.minebean.com').toLowerCase()
  const isAgent = host === 'agent.minebean.com' || host.startsWith('agent.')
  const origin = isAgent ? 'https://agent.minebean.com' : 'https://www.minebean.com'

  return {
    title: 'MineBean',
    description: 'Decentralized mining protocol on Base',
    icons: {
      icon: '/favicon.png',
    },
    other: {
      'base:app_id': '69a86e353dc3043730868cd5',
      'fc:miniapp': JSON.stringify({
        version: 'next',
        imageUrl: `${origin}/miniapp.png`,
        button: {
          title: 'Start Mining',
          action: {
            type: 'launch_miniapp',
            name: 'MineBean',
            url: origin,
            splashImageUrl: `${origin}/favicon.png`,
            splashBackgroundColor: '#0a0a0a',
          },
        },
      }),
    },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Web3Provider>
          {children}
          <HelpButton />
        </Web3Provider>
      </body>
    </html>
  )
}
