import React from 'react'
import { CheckCircle2, AlertTriangle, FileWarning, FileText } from 'lucide-react'

export const getDocumentIcon = (type: string): string => {
  switch (type) {
    case 'passport':
      return '📘'
    case 'photo':
      return '📷'
    case 'bank_statement':
      return '💳'
    case 'invitation_letter':
      return '✉️'
    case 'travel_insurance':
      return '🛡️'
    case 'employment_letter':
      return '💼'
    case 'flight_itinerary':
      return '✈️'
    default:
      return '📄'
  }
}

export const getAIStatusIcon = (status: string) => {
  switch (status) {
    case 'verified':
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-warning" />
    case 'critical':
      return <FileWarning className="w-4 h-4 text-error" />
    default:
      return <FileText className="w-4 h-4 text-base-content/50" />
  }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'verified':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'critical':
      return 'text-error'
    default:
      return 'text-base-content'
  }
}

export const processDocumentUrl = (baseUrl: string, viewUrl: string): string => {
  if (!viewUrl) return ''
  
  try {
    let urlToUse = viewUrl
    
    if (viewUrl.startsWith('http://') || viewUrl.startsWith('https://')) {
      // If it's already a full URL, use it as-is
      urlToUse = viewUrl
    } else {
      // If it's a relative URL, prepend the base URL
      urlToUse = `${baseUrl}${viewUrl.startsWith('/') ? '' : '/'}${viewUrl}`
    }
    
    return urlToUse
  } catch (error) {
    console.error('Error processing document URL:', error)
    return `${baseUrl}/api/documents/view/fallback`
  }
}