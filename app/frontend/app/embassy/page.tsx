'use client'

import { useEffect } from 'react'
import { EmbassyLogin, EmbassyDashboard } from '@/components/Embassy'
import { useEmbassyStore } from '@/lib/stores/embassyStore'

export default function EmbassyPage() {
  const { currentOfficer, login, logout, setCurrentOfficer } = useEmbassyStore()

  useEffect(() => {
    const storedOfficer = localStorage.getItem('embassy_officer')
    if (storedOfficer) {
      try {
        setCurrentOfficer(JSON.parse(storedOfficer))
      } catch (error) {
        console.error('Error parsing stored officer data:', error)
        logout()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!currentOfficer) {
    return <EmbassyLogin onLogin={login} />
  }

  return <EmbassyDashboard officer={currentOfficer} onLogout={logout} />
}