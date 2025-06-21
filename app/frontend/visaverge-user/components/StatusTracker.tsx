'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, AlertCircle, FileText, Shield, Eye, Award } from 'lucide-react'
import { VisaApplication, ApplicationStatus } from '@/types'
import { api } from '@/utils/api'

interface StatusTrackerProps {
  applicationId: string
  onNewApplication?: () => void
}

interface StatusStep {
  status: ApplicationStatus
  title: string
  description: string
  icon: React.ReactNode
  estimatedDays?: number
  completed: boolean
  current: boolean
  timestamp?: Date
}

export default function StatusTracker({ applicationId, onNewApplication }: StatusTrackerProps) {
  const [application, setApplication] = useState<VisaApplication | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    loadApplicationStatus()
    
    // Poll for updates every 30 seconds for demo
    const interval = setInterval(loadApplicationStatus, 30000)
    return () => clearInterval(interval)
  }, [applicationId])

  const loadApplicationStatus = async () => {
    try {
      const data = await api.getApplicationStatus(applicationId)
      setApplication(data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error loading application status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application status...</p>
        </div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Application not found</h3>
        <p className="text-gray-600 mb-4">Unable to load application status.</p>
        <button
          onClick={onNewApplication}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Start New Application
        </button>
      </div>
    )
  }

  // Define status steps
  const statusSteps: StatusStep[] = [
    {
      status: 'submitted',
      title: 'Application Submitted',
      description: 'Your application has been received and is in the queue for processing',
      icon: <FileText className="w-6 h-6" />,
      completed: ['submitted', 'document_review', 'background_check', 'officer_review', 'approved', 'rejected'].includes(application.status),
      current: application.status === 'submitted'
    },
    {
      status: 'document_review',
      title: 'Document Review',
      description: 'Our team is verifying your documents and checking for completeness',
      icon: <Eye className="w-6 h-6" />,
      estimatedDays: 2,
      completed: ['document_review', 'background_check', 'officer_review', 'approved', 'rejected'].includes(application.status),
      current: application.status === 'document_review'
    },
    {
      status: 'background_check',
      title: 'Background Verification',
      description: 'Security and background checks are being conducted',
      icon: <Shield className="w-6 h-6" />,
      estimatedDays: 5,
      completed: ['background_check', 'officer_review', 'approved', 'rejected'].includes(application.status),
      current: application.status === 'background_check'
    },
    {
      status: 'officer_review',
      title: 'Officer Review',
      description: 'A consular officer is reviewing your application for final decision',
      icon: <Eye className="w-6 h-6" />,
      estimatedDays: 3,
      completed: ['officer_review', 'approved', 'rejected'].includes(application.status),
      current: application.status === 'officer_review'
    },
    {
      status: 'approved',
      title: 'Decision Made',
      description: application.status === 'approved' ? 'Congratulations! Your visa has been approved' : 'A decision has been made on your application',
      icon: application.status === 'approved' ? <Award className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />,
      completed: ['approved', 'rejected'].includes(application.status),
      current: ['approved', 'rejected'].includes(application.status)
    }
  ]

  const currentStep = statusSteps.find(step => step.current)
  const completedSteps = statusSteps.filter(step => step.completed).length
  const progress = (completedSteps / statusSteps.length) * 100

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'approved': return 'text-green-600'
      case 'rejected': return 'text-red-600'
      case 'requires_interview': return 'text-yellow-600'
      default: return 'text-blue-600'
    }
  }

  const getStatusBg = (status: ApplicationStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-50 border-green-200'
      case 'rejected': return 'bg-red-50 border-red-200'
      case 'requires_interview': return 'bg-yellow-50 border-yellow-200'
      default: return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className={`p-6 border-b ${getStatusBg(application.status)}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Application Status</h2>
            <p className="text-gray-600">Application ID: <span className="font-mono">{application.id}</span></p>
            <p className="text-gray-600">Visa Type: <span className="capitalize font-medium">{application.visaType}</span></p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-semibold capitalize ${getStatusColor(application.status)}`}>
              {application.status.replace('_', ' ')}
            </p>
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="p-6 bg-gray-50 border-b">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Processing Progress</h3>
          <span className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className={`h-3 rounded-full transition-all duration-1000 ${
              application.status === 'approved' ? 'bg-green-500' :
              application.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-600">{completedSteps}</p>
            <p className="text-sm text-gray-600">Steps Completed</p>
          </div>
          {application.estimatedDecision && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600">
                {Math.ceil((application.estimatedDecision.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
              </p>
              <p className="text-sm text-gray-600">Days Remaining</p>
            </div>
          )}
          {application.approvalProbability && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600">{application.approvalProbability}%</p>
              <p className="text-sm text-gray-600">Approval Probability</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="p-6">
        <h3 className="font-semibold text-gray-800 mb-6">Application Timeline</h3>
        
        <div className="space-y-6">
          {statusSteps.map((step, index) => (
            <div key={step.status} className="flex gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                step.completed 
                  ? application.status === 'approved' && step.status === 'approved'
                    ? 'bg-green-500 text-white'
                    : application.status === 'rejected' && step.status === 'approved'
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white'
                  : step.current
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-500'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {step.completed ? (
                  application.status === 'rejected' && step.status === 'approved' ? (
                    <AlertCircle className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )
                ) : step.current ? (
                  <Clock className="w-6 h-6 animate-pulse" />
                ) : (
                  step.icon
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`font-medium ${
                    step.completed || step.current ? 'text-gray-800' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </h4>
                  {step.current && step.estimatedDays && (
                    <span className="text-sm text-blue-600 font-medium">
                      ~{step.estimatedDays} days
                    </span>
                  )}
                </div>
                
                <p className={`text-sm ${
                  step.completed || step.current ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {step.description}
                </p>

                {step.completed && step.timestamp && (
                  <p className="text-xs text-green-600 mt-1">
                    Completed on {step.timestamp.toLocaleDateString()}
                  </p>
                )}

                {step.current && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Current Status:</strong> This step is currently being processed. 
                      {step.estimatedDays && ` Expected completion in ${step.estimatedDays} days.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Connecting line */}
              {index < statusSteps.length - 1 && (
                <div className="absolute left-[68px] mt-12 w-px h-6 bg-gray-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="p-6 bg-gray-50 border-t">
        <h3 className="font-semibold text-gray-800 mb-3">What happens next?</h3>
        
        {application.status === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              🎉 <strong>Congratulations!</strong> Your visa has been approved. You should receive your passport with the visa within 5-7 business days.
            </p>
          </div>
        )}

        {application.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">
              <strong>Application Decision:</strong> Unfortunately, your visa application was not approved. You will receive a detailed explanation letter shortly.
            </p>
          </div>
        )}

        {!['approved', 'rejected'].includes(application.status) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">
              <strong>No action required.</strong> We're processing your application and will notify you of any updates. 
              You can check this page anytime for the latest status.
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={loadApplicationStatus}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Refresh Status
          </button>
          
          <button
            onClick={onNewApplication}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            New Application
          </button>
        </div>
      </div>
    </div>
  )
}