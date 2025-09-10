'use client'

import { Globe } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import DarkModeSwitcher from '@/components/Layout/DarkModeSwitcher/DarkModeSwitcher'

interface HeaderProps {
  showBackButton?: boolean
  onBackClick?: () => void
  backLabel?: string
  showAdditionalButtons?: React.ReactNode
}

export default function Header({ 
  showBackButton = false, 
  onBackClick, 
  backLabel = '← Back',
  showAdditionalButtons 
}: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleHomeClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    // Always prevent default to control behavior
    e.preventDefault()
    // If already on root, force a hard reload to clear any client state
    if (pathname === '/') {
      window.location.href = '/'
    } else {
      // Navigate to root; any per-page state (like multi-step form) resets
      router.push('/')
    }
  }
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Link 
            href="/" 
            onClick={handleHomeClick}
            className="text-xl font-bold flex items-center hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring focus-visible:ring-primary rounded px-1"
            aria-label="Go to VisaLegatio homepage (reset)"
            title="Go to homepage"
          >
            <Globe className="w-6 h-6 mr-2" />
            <span>VisaLegatio</span>
          </Link>
          {showBackButton && onBackClick && (
            <button 
              onClick={onBackClick}
              className="btn btn-ghost btn-sm ml-4"
            >
              {backLabel}
            </button>
          )}
        </div>
      </div>
      <div className="flex-none">
        {showAdditionalButtons}
        <DarkModeSwitcher />
      </div>
    </div>
  )
}