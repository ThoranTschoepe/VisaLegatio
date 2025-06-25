import React from 'react'
import LoadingSpinner from './LoadingSpinner'

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: React.ReactNode
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isLoading, 
  message = 'Loading...', 
  children 
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-base-100/80 backdrop-blur-sm flex flex-col justify-center items-center z-50">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-lg">{message}</p>
        </div>
      )}
    </div>
  )
}

export default LoadingOverlay