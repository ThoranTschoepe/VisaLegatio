import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VisaLegatio - AI-Powered Visa Applications',
  description: 'The future of visa applications. Smart, transparent, and designed for the digital age.',
  keywords: ['visa', 'application', 'AI', 'embassy', 'travel', 'immigration'],
  authors: [{ name: 'VisaLegatio Team' }],
  viewport: 'width=device-width, initial-scale=1',
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
                const theme = localStorage.getItem('theme');
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                
                let appliedTheme = 'cupcake'; // default light theme
                
                if (theme === 'dark') {
                  appliedTheme = 'dracula';
                } else if (theme === 'light') {
                  appliedTheme = 'cupcake';
                } else if (!theme || theme === 'default') {
                  // Always default to light theme, ignore system preference
                  appliedTheme = 'cupcake';
                }
                
                document.documentElement.setAttribute('data-theme', appliedTheme);
                document.body.setAttribute('data-theme', appliedTheme);
              } catch (e) {
                // Fallback to light theme
                document.documentElement.setAttribute('data-theme', 'cupcake');
                document.body.setAttribute('data-theme', 'cupcake');
              }
            })();
          `}
        </Script>
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <div className="min-h-screen bg-base-200">
          {children}
        </div>
      </body>
    </html>
  )
}