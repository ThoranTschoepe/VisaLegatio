import React from 'react'
import { LucideIcon } from 'lucide-react'

interface GradientHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  gradient?: string // tailwind gradient classes
  children?: React.ReactNode
  className?: string
  iconWrapperClassName?: string
}

// Reusable gradient header section for success / primary etc.
// Provides consistent spacing, typography, and theme-aware surface overlays.
export const GradientHeader: React.FC<GradientHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  gradient = 'from-primary to-secondary',
  children,
  className = '',
  iconWrapperClassName = ''
}) => {
  return (
    <div className={`bg-gradient-to-r ${gradient} text-white p-6 md:p-8 text-center relative ${className}`}>
      <div className="flex justify-center mb-4">
        {Icon && (
          <div className={`w-16 h-16 bg-base-100 rounded-full flex items-center justify-center shadow-inner ${iconWrapperClassName}`}>
            <Icon className="w-10 h-10 text-primary" />
          </div>
        )}
      </div>
      <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>
      {subtitle && (
        <p className="text-base md:text-lg text-primary-content/80 max-w-2xl mx-auto">{subtitle}</p>
      )}
      {children && (
        <div className="mt-4 inline-block">{children}</div>
      )}
    </div>
  )
}

export default GradientHeader
