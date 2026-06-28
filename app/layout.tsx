import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BetterInvest TDS',
  description: 'TDS Filing Status Dashboard — FY 2025-26',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
