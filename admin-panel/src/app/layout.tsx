import type { Metadata } from 'next'
import { Syne } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const syne = Syne({ subsets: ['latin'], weight: ['500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'MyKBS Admin Panel',
  description: 'MyKBS Admin Yönetim Paneli'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className={syne.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}

