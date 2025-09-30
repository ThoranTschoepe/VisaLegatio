'use client'

import { Loader2, Bot, FileText, Upload, CheckCircle2 } from 'lucide-react'

// Generic loading spinner
export function LoadingSpinner({ size = 'md', className = '' }: { 
  size?: 'sm' | 'md' | 'lg', 
  className?: string 
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <Loader2 
      className={`animate-spin ${sizeClasses[size]} ${className}`} 
    />
  )
}

// Loading skeleton for text
export function TextSkeleton({ lines = 3, className = '' }: { 
  lines?: number, 
  className?: string 
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-base-300 rounded animate-pulse ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  )
}

// Loading card skeleton
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-base-100 rounded-lg shadow p-6 ${className}`}>
      <div className="space-y-4">
        <div className="h-6 bg-base-300 rounded w-1/3 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-base-300 rounded animate-pulse" />
          <div className="h-4 bg-base-300 rounded w-5/6 animate-pulse" />
        </div>
        <div className="flex space-x-2">
          <div className="h-8 bg-base-300 rounded w-20 animate-pulse" />
          <div className="h-8 bg-base-300 rounded w-16 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// Chat loading animation
export function ChatLoading() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
        <Bot className="w-5 h-5 text-white" />
      </div>
      <div className="bg-base-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border border-base-300">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce" />
          <div 
            className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce" 
            style={{ animationDelay: '0.1s' }} 
          />
          <div 
            className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce" 
            style={{ animationDelay: '0.2s' }} 
          />
        </div>
      </div>
    </div>
  )
}

// Form loading overlay
export function FormLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-base-100 bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-primary mx-auto mb-4" />
        <p className="text-base-content/70 font-medium">{message}</p>
      </div>
    </div>
  )
}

// Document upload loading
export function DocumentLoading({ fileName }: { fileName: string }) {
  return (
    <div className="space-y-3">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      <div className="text-center">
        <p className="text-primary font-medium">Uploading & Verifying...</p>
        <p className="text-sm text-base-content/70">{fileName}</p>
      </div>
      <div className="w-full bg-base-300 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full animate-pulse w-3/4" />
      </div>
    </div>
  )
}

// Progress loading with steps
export function StepLoading({ 
  steps, 
  currentStep 
}: { 
  steps: string[], 
  currentStep: number 
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-primary mx-auto mb-4" />
        <p className="text-lg font-medium text-base-content">Processing...</p>
      </div>
      
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 p-2 rounded ${
              index < currentStep
                ? 'text-success'
                : index === currentStep
                ? 'text-primary bg-primary/10'
                : 'text-base-content/40'
            }`}
          >
            {index < currentStep ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : index === currentStep ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="w-5 h-5 border-2 border-base-300 rounded-full" />
            )}
            <span className="text-sm">{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Page loading screen
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-200 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary/20 rounded-full animate-spin" />
          <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-primary rounded-full animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-base-content mt-6 mb-2">VisaLegatio</h2>
        <p className="text-base-content/70">{message}</p>
      </div>
    </div>
  )
}

// Application submission loading
export function SubmissionLoading() {
  const steps = [
    'Validating your information',
    'Uploading documents',
    'Running security checks',
    'Generating application ID',
    'Submitting to embassy'
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin mx-auto mb-4">
            <div className="w-16 h-16 border-4 border-transparent border-t-primary rounded-full animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-base-content">Submitting Application</h3>
          <p className="text-base-content/70 text-sm mt-2">This may take a few moments...</p>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center">
                {index < 2 ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : index === 2 ? (
                  <LoadingSpinner size="sm" className="text-primary" />
                ) : (
                  <div className="w-3 h-3 border-2 border-base-300 rounded-full" />
                )}
              </div>
              <span className={`text-sm ${
                index < 2 ? 'text-success' : 
                index === 2 ? 'text-primary' : 
                'text-base-content/40'
              }`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}