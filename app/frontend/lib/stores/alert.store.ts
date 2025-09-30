import { create } from 'zustand'

export type AlertType = 'success' | 'error' | 'warning' | 'info'

export interface Alert {
  id: string
  type: AlertType
  message: string
  duration?: number
}

interface AlertState {
  alerts: Alert[]
}

interface AlertActions {
  addAlert: (alert: Omit<Alert, 'id'>) => void
  removeAlert: (id: string) => void
  clearAlerts: () => void
  showSuccess: (message: string, duration?: number) => void
  showError: (message: string, duration?: number) => void
  showWarning: (message: string, duration?: number) => void
  showInfo: (message: string, duration?: number) => void
}

type AlertStore = AlertState & AlertActions

const generateId = () => Math.random().toString(36).substr(2, 9)

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],

  addAlert: (alertData) => {
    const alert: Alert = {
      id: generateId(),
      ...alertData,
    }

    set((state) => ({
      alerts: [...state.alerts, alert],
    }))

    const duration = alert.duration || 5000
    if (duration > 0) {
      setTimeout(() => {
        get().removeAlert(alert.id)
      }, duration)
    }
  },

  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((alert) => alert.id !== id),
    })),

  clearAlerts: () => set({ alerts: [] }),

  showSuccess: (message, duration) =>
    get().addAlert({ type: 'success', message, duration }),

  showError: (message, duration = 7000) =>
    get().addAlert({ type: 'error', message, duration }),

  showWarning: (message, duration) =>
    get().addAlert({ type: 'warning', message, duration }),

  showInfo: (message, duration) =>
    get().addAlert({ type: 'info', message, duration }),
}))