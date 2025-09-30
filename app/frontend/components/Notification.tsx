'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react'

type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newNotification = { ...notification, id }
    
    setNotifications(prev => [...prev, newNotification])

    // Auto remove after duration (default 5 seconds)
    const duration = notification.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

function NotificationContainer() {
  const { notifications } = useNotifications()

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  )
}

function NotificationItem({ notification }: { notification: Notification }) {
  const { removeNotification } = useNotifications()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 50)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => removeNotification(notification.id), 300)
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-success" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-error" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />
      case 'info':
        return <Info className="w-5 h-5 text-info" />
    }
  }

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-l-success'
      case 'error':
        return 'border-l-error'
      case 'warning':
        return 'border-l-warning'
      case 'info':
        return 'border-l-info'
    }
  }

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        bg-base-100 border-l-4 ${getBorderColor()} shadow-lg rounded-lg p-4 min-w-80
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-base-content">
            {notification.title}
          </h4>
          {notification.message && (
            <p className="text-sm text-base-content/70 mt-1">
              {notification.message}
            </p>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="text-sm text-primary hover:text-primary/80 font-medium mt-2 underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleClose}
          className="flex-shrink-0 text-base-content/40 hover:text-base-content/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Convenience hooks for different notification types
export function useSuccessNotification() {
  const { addNotification } = useNotifications()
  
  return (title: string, message?: string) => {
    addNotification({ type: 'success', title, message })
  }
}

export function useErrorNotification() {
  const { addNotification } = useNotifications()
  
  return (title: string, message?: string) => {
    addNotification({ type: 'error', title, message })
  }
}

export function useWarningNotification() {
  const { addNotification } = useNotifications()
  
  return (title: string, message?: string) => {
    addNotification({ type: 'warning', title, message })
  }
}

export function useInfoNotification() {
  const { addNotification } = useNotifications()
  
  return (title: string, message?: string) => {
    addNotification({ type: 'info', title, message })
  }
}

// Alert component for inline notifications
export function Alert({ 
  type, 
  title, 
  message, 
  onClose,
  className = ''
}: {
  type: NotificationType
  title: string
  message?: string
  onClose?: () => void
  className?: string
}) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-success" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-error" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />
      case 'info':
        return <Info className="w-5 h-5 text-info" />
    }
  }

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-success/10 border-success/20'
      case 'error':
        return 'bg-error/10 border-error/20'
      case 'warning':
        return 'bg-warning/10 border-warning/20'
      case 'info':
        return 'bg-info/10 border-info/20'
    }
  }

  return (
    <div className={`border rounded-lg p-4 ${getBgColor()} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-base-content">
            {title}
          </h4>
          {message && (
            <p className="text-sm text-base-content/70 mt-1">
              {message}
            </p>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-base-content/40 hover:text-base-content/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Banner component for important site-wide notifications
export function Banner({ 
  type, 
  message, 
  action,
  onClose 
}: {
  type: NotificationType
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  onClose?: () => void
}) {
  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-success'
      case 'error':
        return 'bg-error'
      case 'warning':
        return 'bg-warning'
      case 'info':
        return 'bg-info'
    }
  }

  return (
    <div className={`${getBgColor()} text-white`}>
      <div className="max-w-7xl mx-auto py-3 px-4">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {type === 'error' && <AlertCircle className="w-5 h-5" />}
              {type === 'warning' && <AlertTriangle className="w-5 h-5" />}
              {type === 'info' && <Info className="w-5 h-5" />}
            </div>
            <p className="text-sm font-medium">{message}</p>
          </div>
          
          <div className="flex items-center gap-3">
            {action && (
              <button
                onClick={action.onClick}
                className="text-sm underline hover:no-underline font-medium"
              >
                {action.label}
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-white hover:text-white/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}