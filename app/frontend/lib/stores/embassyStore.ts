import { create } from 'zustand'
import { Officer } from '@/types/embassy.types'

interface EmbassyState {
  currentOfficer: Officer | null
  setCurrentOfficer: (officer: Officer | null) => void
  login: (officer: Officer) => void
  logout: () => void
}

export const useEmbassyStore = create<EmbassyState>((set) => ({
  currentOfficer: null,
  setCurrentOfficer: (officer) => set({ currentOfficer: officer }),
  login: (officer) => {
    localStorage.setItem('embassy_officer', JSON.stringify(officer))
    set({ currentOfficer: officer })
  },
  logout: () => {
    localStorage.removeItem('embassy_officer')
    set({ currentOfficer: null })
  },
}))
