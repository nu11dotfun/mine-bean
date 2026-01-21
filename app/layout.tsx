import type { Metadata } from 'next'
import { Web3Provider } from '@/lib/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'MineBean',
  description: 'Decentralized mining protocol on BSC',
  icons: {
    icon: '/favicon.svg',
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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  )
}
