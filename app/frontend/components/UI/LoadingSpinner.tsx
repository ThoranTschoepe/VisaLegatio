import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
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

export default LoadingSpinner