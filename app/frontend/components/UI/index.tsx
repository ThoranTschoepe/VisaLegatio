import React from 'react'

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'success' | 'warning' | 'error' | 'info'
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
    error: 'btn-error',
    info: 'btn-info'
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
    compact ? 'card-sm' : '',
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

// Input Component
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  success?: boolean
  variant?: 'bordered' | 'ghost' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  success = false,
  variant = 'bordered',
  size = 'md',
  className = '',
  ...props
}) => {
  const variantClasses = {
    bordered: 'input-bordered',
    ghost: 'input-ghost',
    primary: 'input-primary',
    secondary: 'input-secondary',
    accent: 'input-accent',
    success: 'input-success',
    warning: 'input-warning',
    error: 'input-error',
    info: 'input-info'
  }

  const sizeClasses = {
    xs: 'input-xs',
    sm: 'input-sm',
    md: '',
    lg: 'input-lg'
  }

  const inputClasses = [
    'input',
    'w-full',
    variantClasses[variant],
    sizeClasses[size],
    error ? 'input-error' : success ? 'input-success' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className="form-control w-full">
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}
      <input className={inputClasses} {...props} />
      {(error || success) && (
        <label className="label">
          <span className={`label-text-alt ${error ? 'text-error' : 'text-success'}`}>
            {error || (success && 'Valid input')}
          </span>
        </label>
      )}
    </div>
  )
}

// Textarea Component
interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string
  error?: string
  success?: boolean
  variant?: 'bordered' | 'ghost' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  success = false,
  variant = 'bordered',
  size = 'md',
  className = '',
  ...props
}) => {
  const variantClasses = {
    bordered: 'textarea-bordered',
    ghost: 'textarea-ghost',
    primary: 'textarea-primary',
    secondary: 'textarea-secondary',
    accent: 'textarea-accent',
    success: 'textarea-success',
    warning: 'textarea-warning',
    error: 'textarea-error',
    info: 'textarea-info'
  }

  const sizeClasses = {
    xs: 'textarea-xs',
    sm: 'textarea-sm',
    md: '',
    lg: 'textarea-lg'
  }

  const textareaClasses = [
    'textarea',
    'w-full',
    variantClasses[variant],
    sizeClasses[size],
    error ? 'textarea-error' : success ? 'textarea-success' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className="form-control w-full">
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}
      <textarea className={textareaClasses} {...props} />
      {(error || success) && (
        <label className="label">
          <span className={`label-text-alt ${error ? 'text-error' : 'text-success'}`}>
            {error || (success && 'Valid input')}
          </span>
        </label>
      )}
    </div>
  )
}

// Alert Component
interface AlertProps {
  children: React.ReactNode
  variant?: 'info' | 'success' | 'warning' | 'error'
  className?: string
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  className = ''
}) => {
  const variantClasses = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error'
  }

  const alertClasses = [
    'alert',
    variantClasses[variant],
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={alertClasses}>
      {children}
    </div>
  )
}