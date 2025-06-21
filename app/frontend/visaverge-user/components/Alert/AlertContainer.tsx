import React from 'react'
import { useAlertStore, AlertType } from '@/lib/stores/alert.store'

interface AlertItemProps {
  id: string
  type: AlertType
  message: string
  onRemove: (id: string) => void
}

const AlertItem: React.FC<AlertItemProps> = ({ id, type, message, onRemove }) => {
  const getAlertClasses = (type: AlertType) => {
    const baseClasses = "alert w-auto max-w-md shadow-lg transition-all duration-300"
    
    switch (type) {
      case 'success':
        return `${baseClasses} alert-success`
      case 'error':
        return `${baseClasses} alert-error`
      case 'warning':
        return `${baseClasses} alert-warning`
      case 'info':
      default:
        return `${baseClasses} alert-info`
    }
  }

  const getIcon = (type: AlertType) => {
    switch (type) {
      case 'success':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'info':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <div className={getAlertClasses(type)}>
      {getIcon(type)}
      <span>{message}</span>
      <button 
        className="btn btn-sm btn-ghost btn-circle ml-2"
        onClick={() => onRemove(id)}
      >
        ✕
      </button>
    </div>
  )
}

const AlertContainer: React.FC = () => {
  const { alerts, removeAlert } = useAlertStore()

  if (alerts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 pointer-events-none z-50">
      <div className="flex flex-col space-y-2">
        {alerts.map((alert, index) => (
          <div 
            key={alert.id}
            className="pointer-events-auto transform transition-all duration-300 ease-in-out"
            style={{ 
              zIndex: 1000 - index 
            }}
          >
            <AlertItem
              id={alert.id}
              type={alert.type}
              message={alert.message}
              onRemove={removeAlert}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default AlertContainer