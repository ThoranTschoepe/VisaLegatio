'use client'

import { useState, useEffect } from 'react'
import { EmbassyLogin, EmbassyDashboard } from '@/components/Embassy'
import { Officer } from '@/types/embassy.types'

export default function EmbassyPage() {
  const [currentOfficer, setCurrentOfficer] = useState<Officer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const storedOfficer = localStorage.getItem('embassy_officer')
    if (storedOfficer) {
      try {
        setCurrentOfficer(JSON.parse(storedOfficer))
      } catch (error) {
        console.error('Error parsing stored officer data:', error)
        localStorage.removeItem('embassy_officer')
      }
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (officer: Officer) => {
    setCurrentOfficer(officer)
    localStorage.setItem('embassy_officer', JSON.stringify(officer))
  }

  const handleLogout = () => {
    setCurrentOfficer(null)
    localStorage.removeItem('embassy_officer')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-base-content/70">Loading Embassy Portal...</p>
        </div>
      </div>
    )
  }

  if (!currentOfficer) {
    return <EmbassyLogin onLogin={handleLogin} />
  }

  return <EmbassyDashboard officer={currentOfficer} onLogout={handleLogout} />
}