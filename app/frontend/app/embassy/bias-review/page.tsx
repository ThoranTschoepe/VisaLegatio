'use client'

import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import BiasReview from '@/components/Embassy/BiasReview'
import { Officer } from '@/types/embassy.types'

export default function BiasReviewPage() {
  const router = useRouter()
  const [currentOfficer, setCurrentOfficer] = useState<Officer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const storedOfficer = localStorage.getItem('embassy_officer')
    if (storedOfficer) {
      try {
        const officer = JSON.parse(storedOfficer)
        // Only senior officers and admins can access bias review
        if (officer.role === 'Senior Consular Officer' || officer.role === 'System Administrator') {
          setCurrentOfficer(officer)
        } else {
          alert('Access denied. Only senior officers can access bias review.')
          router.push('/embassy')
        }
      } catch (error) {
        console.error('Error parsing stored officer data:', error)
        router.push('/embassy')
      }
    } else {
      router.push('/embassy')
    }
    setIsLoading(false)
  }, [router])

  const handleBack = () => {
    router.push('/embassy')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">Loading Bias Review System...</p>
        </div>
      </div>
    )
  }

  if (!currentOfficer) {
    return null
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <button className="btn btn-ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <div className="divider divider-horizontal"></div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-warning" />
            <h1 className="text-xl font-bold">AI Bias Review System</h1>
          </div>
        </div>
        <div className="flex-none">
          <div className="badge badge-warning gap-2">
            <AlertTriangle className="w-4 h-4" />
            Sensitive Review
          </div>
        </div>
      </div>

      {/* Main Content */}
      <BiasReview officer={currentOfficer} />
    </div>
  )
}