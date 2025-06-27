import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Embassy Portal - VisaLegatio',
  description: 'Secure portal for embassy officers to manage visa applications',
  robots: 'noindex, nofollow', // Don't index embassy pages
}

export default function EmbassyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="embassy-portal">
      {children}
    </div>
  )
}