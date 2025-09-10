import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Script from 'next/script'
import Header from '@/components/Layout/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VisaLegatio - AI-Powered Visa Applications',
  description: 'The future of visa applications. Smart, transparent, and designed for the digital age.',
  keywords: ['visa', 'application', 'AI', 'embassy', 'travel', 'immigration'],
  authors: [{ name: 'VisaLegatio Team' }],
  robots: 'index, follow',
  openGraph: {
    title: 'VisaLegatio - AI-Powered Visa Applications',
    description: 'Experience the future of visa applications with AI guidance, real-time tracking, and smart forms.',
    type: 'website',
    siteName: 'VisaLegatio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VisaLegatio - AI-Powered Visa Applications',
    description: 'Experience the future of visa applications with AI guidance, real-time tracking, and smart forms.',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Theme initialization script - runs before hydration */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function() {
              try {
                const STORAGE_KEY = 'theme';
                const LIGHT = 'cupcake';
                const DARK = 'dracula';
                const saved = localStorage.getItem(STORAGE_KEY);
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                let applied = LIGHT;
                if (saved === DARK || (saved === 'default' && prefersDark)) applied = DARK;
                if (saved === LIGHT) applied = LIGHT;
                document.documentElement.dataset.theme = applied;
                document.body.dataset.theme = applied;
              } catch (e) {
                document.documentElement.dataset.theme = 'cupcake';
                document.body.dataset.theme = 'cupcake';
              }
            })();
          `}
        </Script>
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <div className="min-h-screen bg-base-100 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40" style={{background:'radial-gradient(circle at 30% 20%, rgba(120,150,255,0.25), transparent 60%), radial-gradient(circle at 70% 60%, rgba(255,150,200,0.18), transparent 65%)'}} />
          <Header />
          <main className="relative z-10">{children}</main>
        </div>
      </body>
    </html>
  )
}