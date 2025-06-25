'use client'

import { Globe } from 'lucide-react'
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
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold flex items-center">
            <Globe className="w-6 h-6 mr-2" />
            VisaLegatio
          </span>
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