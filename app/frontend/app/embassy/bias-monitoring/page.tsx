'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import BiasMonitoringPanel from '@/components/Embassy/BiasMonitoringPanel'
import { Officer } from '@/types/embassy.types'

const ALLOWED_ROLES = ['Senior Consular Officer', 'System Administrator']

export default function BiasMonitoringPage() {
  const router = useRouter()
  const [officer, setOfficer] = useState<Officer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedOfficer = localStorage.getItem('embassy_officer')
    if (!storedOfficer) {
      router.push('/embassy')
      return
    }

    try {
      const parsedOfficer = JSON.parse(storedOfficer)
      if (!ALLOWED_ROLES.includes(parsedOfficer.role)) {
        alert('Access denied. Bias monitoring is restricted to senior officers.')
        router.push('/embassy')
        return
      }
      setOfficer(parsedOfficer)
    } catch (error) {
      console.error('Failed to parse stored officer', error)
      router.push('/embassy')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-base-content/70">Loading monitoring workspace…</p>
        </div>
      </div>
    )
  }

  if (!officer) {
    return null
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow">
        <div className="flex-1">
          <button className="btn btn-ghost" onClick={() => router.push('/embassy')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to dashboard
          </button>
        </div>
        <div className="flex-none">
          <div className="badge badge-warning gap-2">
            <AlertTriangle className="w-4 h-4" />
            Senior oversight area
          </div>
        </div>
      </div>

      <BiasMonitoringPanel officer={officer} />
    </div>
  )
}
