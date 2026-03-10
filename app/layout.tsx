import type { Metadata } from 'next'
import { Web3Provider } from '@/lib/providers'
import HelpButton from '@/components/HelpButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'MineBean',
  description: 'Decentralized mining protocol on Base',
  icons: {
    icon: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="69a86e353dc3043730868cd5" />
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
