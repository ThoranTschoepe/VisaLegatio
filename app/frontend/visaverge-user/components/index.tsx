import React from 'react'

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'success' | 'warning' | 'error'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'btn'
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    outline: 'btn-outline',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-error'
  }
  
  const sizeClasses = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  }

  const buttonClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ')

  return (
    <button 
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="loading loading-spinner loading-sm mr-2"></span>}
      {children}
    </button>
  )
}

// Card Component
interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  compact?: boolean
  bordered?: boolean
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  title, 
  compact = false,
  bordered = false 
}) => {
  const cardClasses = [
    'card',
    'bg-base-100',
    'shadow-lg',
    bordered ? 'card-bordered' : '',
    compact ? 'card-compact' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClasses}>
      <div className="card-body">
        {title && <h3 className="card-title">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'loading-sm',
    md: 'loading-md', 
    lg: 'loading-lg'
  }

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <span className={`loading loading-spinner ${sizeClasses[size]}`}></span>
    </div>
  )
}

// Loading Overlay Component
interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: React.ReactNode
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isLoading, 
  message = 'Loading...', 
  children 
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="loading-overlay">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-lg">{message}</p>
        </div>
      )}
    </div>
  )
}

// Stats Components
interface StatProps {
  title: string
  value: string | number
  description?: string
  className?: string
}

export const Stat: React.FC<StatProps> = ({ title, value, description, className = '' }) => {
  return (
    <div className={`stat ${className}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {description && <div className="stat-desc">{description}</div>}
    </div>
  )
}

interface StatsProps {
  children: React.ReactNode
  className?: string
  vertical?: boolean
}

export const Stats: React.FC<StatsProps> = ({ children, className = '', vertical = false }) => {
  const statsClass = vertical 
    ? 'stats stats-vertical shadow bg-base-200' 
    : 'stats stats-vertical lg:stats-horizontal shadow bg-base-200'

  return (
    <div className={`${statsClass} ${className}`}>
      {children}
    </div>
  )
}

// Badge Component
interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'success' | 'warning' | 'error' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = ''
}) => {
  const variantClasses = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    ghost: 'badge-ghost',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info'
  }
  
  const sizeClasses = {
    xs: 'badge-xs',
    sm: 'badge-sm',
    md: '',
    lg: 'badge-lg'
  }

  const badgeClasses = [
    'badge',
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={badgeClasses}>
      {children}
    </div>
  )
}