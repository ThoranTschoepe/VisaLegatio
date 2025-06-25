'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, AlertCircle, FileText, Shield, Eye, Award, AlertTriangle, Upload, X, CreditCard, Fingerprint, Flag } from 'lucide-react'
import { VisaApplication, ApplicationStatus } from '@/types'
import { api } from '@/utils/api'
import { useAlertStore } from '@/lib/stores/alert.store'

interface StatusTrackerProps {
  applicationId: string
  onNewApplication?: () => void
  onNavigateToDocuments?: () => void
}

interface StatusStep {
  status: ApplicationStatus | 'document_collection' | 'fingerprint_scan' | 'payment'
  title: string
  description: string
  icon: React.ReactNode
  estimatedDays?: number
  completed: boolean
  current: boolean
  blocked?: boolean
  timestamp?: Date
  clickable?: boolean
}

interface DocumentStatus {
  mandatory_required: string[]
  mandatory_uploaded: string[]
  mandatory_missing: string[]
  optional_available: string[]
  optional_uploaded: string[]
  requirements_met: boolean
  total_mandatory: number
  total_mandatory_uploaded: number
}

export default function StatusTracker({ applicationId, onNewApplication, onNavigateToDocuments }: StatusTrackerProps) {
  const [application, setApplication] = useState<VisaApplication | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus | null>(null)
  const [error, setError] = useState<string>('')
  const [flaggedDocument, setFlaggedDocument] = useState<any>(null)
  const { showSuccess, showError } = useAlertStore()

  useEffect(() => {
    loadApplicationStatus()
    
    // Poll for updates every 30 seconds for demo
    const interval = setInterval(loadApplicationStatus, 30000)
    return () => clearInterval(interval)
  }, [applicationId])

  const loadApplicationStatus = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      // Load application data from backend
      const data = await api.getApplicationStatus(applicationId)
      setApplication(data)
      
      // Check for flagged document
      if (data.flaggedDocumentId && data.flaggedDocument) {
        setFlaggedDocument({
          document: data.flaggedDocument,
          reason: data.flaggedDocumentReason,
          flagged_by: data.flaggedByOfficer,
          flagged_at: data.flaggedAt
        })
      } else {
        setFlaggedDocument(null)
      }
      
      // Get document requirements and status from backend
      const docRequirements = await api.getDocumentRequirements(data.visaType)
      const uploadedDocs = await api.getApplicationDocuments(applicationId)
      
      // Calculate document status
      const mandatory = docRequirements.mandatory_documents || []
      const optional = docRequirements.optional_documents || []
      
      const uploadedTypes = uploadedDocs.filter(doc => doc.verified).map(doc => doc.type)
      const mandatoryUploaded = mandatory.filter(type => uploadedTypes.includes(type))
      const mandatoryMissing = mandatory.filter(type => !uploadedTypes.includes(type))
      const optionalUploaded = optional.filter(type => uploadedTypes.includes(type))
      
      const docStatus: DocumentStatus = {
        mandatory_required: mandatory,
        mandatory_uploaded: mandatoryUploaded,
        mandatory_missing: mandatoryMissing,
        optional_available: optional,
        optional_uploaded: optionalUploaded,
        requirements_met: mandatoryMissing.length === 0,
        total_mandatory: mandatory.length,
        total_mandatory_uploaded: mandatoryUploaded.length
      }
      
      setDocumentStatus(docStatus)
      setLastUpdate(new Date())
      
    } catch (error) {
      console.error('Error loading application status:', error)
      setError('Failed to load application status')
      showError('Failed to load application status. Using cached data.')
      
      // Fallback for demo - create consistent mock data based on applicationId
      const mockApp = createMockApplication(applicationId)
      setApplication(mockApp)
      setDocumentStatus(createMockDocumentStatus(applicationId))
      setLastUpdate(new Date())
    } finally {
      setIsLoading(false)
    }
  }

  // Create consistent mock data based on application ID (no randomness)
  const createMockApplication = (appId: string): VisaApplication => {
    const hash = appId.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
    const names = ['Sarah Johnson', 'Miguel Rodriguez', 'Anna Chen', 'James Wilson']
    const types = ['business', 'tourist', 'student', 'work']
    const statuses = ['submitted', 'document_review', 'background_check', 'officer_review']
    
    return {
      id: appId,
      userId: `user-${appId}`,
      visaType: types[Math.abs(hash) % types.length],
      status: statuses[Math.abs(hash) % statuses.length] as ApplicationStatus,
      answers: { applicant_name: names[Math.abs(hash) % names.length] },
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: new Date(),
      approvalProbability: 75 + (Math.abs(hash) % 20)
    }
  }

  const createMockDocumentStatus = (appId: string): DocumentStatus => {
    const hash = appId.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
    
    // Consistent document status based on app ID
    const hasAllDocs = Math.abs(hash) % 3 === 0  // 1/3 of apps have all docs
    
    return {
      mandatory_required: ['passport', 'photo', 'bank_statement'],
      mandatory_uploaded: hasAllDocs ? ['passport', 'photo', 'bank_statement'] : ['passport'],
      mandatory_missing: hasAllDocs ? [] : ['photo', 'bank_statement'],
      optional_available: ['travel_insurance', 'employment_letter'],
      optional_uploaded: hasAllDocs ? ['travel_insurance'] : [],
      requirements_met: hasAllDocs,
      total_mandatory: 3,
      total_mandatory_uploaded: hasAllDocs ? 3 : 1
    }
  }

  const navigateToDocuments = () => {
    if (onNavigateToDocuments) {
      onNavigateToDocuments()
    } else {
      showError('Document upload navigation not available')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-base-content/70">Loading application status...</p>
        </div>
      </div>
    )
  }

  if (!application || !documentStatus) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-base-content mb-2">Application not found</h3>
        <p className="text-base-content/70 mb-4">{error || 'Unable to load application status.'}</p>
        <button
          onClick={onNewApplication}
          className="btn btn-primary"
        >
          Start New Application
        </button>
      </div>
    )
  }

  // Check if processing is blocked by documents
  const isDocumentBlocked = !documentStatus.requirements_met
  
  // Check completion status from localStorage (for demo)
  const fingerprintCompleted = localStorage.getItem(`fingerprint_${applicationId}`) === 'true'
  const paymentCompleted = localStorage.getItem(`payment_${applicationId}`) === 'true'
  
  // Check if processing is blocked by fingerprints or payment
  const isFingerprintBlocked = !isDocumentBlocked && !fingerprintCompleted
  const isPaymentBlocked = !isDocumentBlocked && fingerprintCompleted && !paymentCompleted
  const anyBlockage = isDocumentBlocked || isFingerprintBlocked || isPaymentBlocked

  // Define status steps with document collection, fingerprint, and payment
  const statusSteps: StatusStep[] = [
    {
      status: 'submitted',
      title: 'Application Submitted',
      description: 'Your application has been received and assigned a unique ID',
      icon: <FileText className="w-6 h-6" />,
      completed: true,
      current: application.status === 'submitted' && !anyBlockage
    },
    {
      status: 'document_collection',
      title: 'Document Collection',
      description: isDocumentBlocked 
        ? `Required documents must be uploaded before processing can continue (${documentStatus.total_mandatory_uploaded}/${documentStatus.total_mandatory} uploaded)`
        : 'All required documents have been collected and verified',
      icon: <Upload className="w-6 h-6" />,
      completed: !isDocumentBlocked,
      current: isDocumentBlocked,
      blocked: isDocumentBlocked,
      estimatedDays: isDocumentBlocked ? undefined : 0
    },
    {
      status: 'fingerprint_scan',
      title: 'Biometric Collection',
      description: isFingerprintBlocked
        ? 'Visit the embassy terminal to complete fingerprint scanning'
        : 'Fingerprints have been successfully captured and verified',
      icon: <Fingerprint className="w-6 h-6" />,
      completed: fingerprintCompleted,
      current: isFingerprintBlocked,
      blocked: isFingerprintBlocked,
      estimatedDays: isFingerprintBlocked ? undefined : 0,
      clickable: isFingerprintBlocked // Make it clickable for demo
    },
    {
      status: 'payment',
      title: 'Fee Payment',
      description: isPaymentBlocked
        ? 'Complete visa application fee payment to proceed'
        : 'Payment has been successfully processed',
      icon: <CreditCard className="w-6 h-6" />,
      completed: paymentCompleted,
      current: isPaymentBlocked,
      blocked: isPaymentBlocked,
      estimatedDays: isPaymentBlocked ? undefined : 0,
      clickable: isPaymentBlocked // Make it clickable for demo
    },
    {
      status: 'officer_review',
      title: 'Officer Review',
      description: 'A consular officer is reviewing your application for final decision',
      icon: <Eye className="w-6 h-6" />,
      estimatedDays: 3,
      completed: ['officer_review', 'approved', 'rejected'].includes(application.status) && !anyBlockage,
      current: application.status === 'officer_review' && !anyBlockage
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

  const handleMarkStepComplete = (stepType: string) => {
    if (stepType === 'fingerprint_scan') {
      localStorage.setItem(`fingerprint_${applicationId}`, 'true')
      showSuccess('Fingerprint scanning marked as complete (Demo)')
      loadApplicationStatus() // Reload to update status
    } else if (stepType === 'payment') {
      localStorage.setItem(`payment_${applicationId}`, 'true')
      showSuccess('Payment marked as complete (Demo)')
      loadApplicationStatus() // Reload to update status
    }
  }

  const getStatusColor = (status: ApplicationStatus) => {
    if (isDocumentBlocked && status === 'submitted') return 'text-error'
    if (isFingerprintBlocked && status === 'submitted') return 'text-warning'
    if (isPaymentBlocked && status === 'submitted') return 'text-warning'
    
    switch (status) {
      case 'approved': return 'text-success'
      case 'rejected': return 'text-error'
      case 'requires_interview': return 'text-warning'
      default: return 'text-info'
    }
  }

  const getStatusBg = (status: ApplicationStatus) => {
    if (isDocumentBlocked && status === 'submitted') return 'bg-error/10 border-error/20'
    if (isFingerprintBlocked && status === 'submitted') return 'bg-warning/10 border-warning/20'
    if (isPaymentBlocked && status === 'submitted') return 'bg-warning/10 border-warning/20'
    
    switch (status) {
      case 'approved': return 'bg-success/10 border-success/20'
      case 'rejected': return 'bg-error/10 border-error/20'
      case 'requires_interview': return 'bg-warning/10 border-warning/20'
      default: return 'bg-info/10 border-info/20'
    }
  }

  const getDisplayStatus = () => {
    if (isDocumentBlocked) {
      return 'Document Collection Required'
    }
    if (isFingerprintBlocked) {
      return 'Biometric Collection Required'
    }
    if (isPaymentBlocked) {
      return 'Payment Required'
    }
    return application.status.replace('_', ' ')
  }

  return (
    <div className="max-w-4xl mx-auto card bg-base-100 shadow-xl overflow-hidden">
      {/* Header */}
      <div className={`p-6 border-b ${getStatusBg(application.status)}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-base-content mb-2">Application Status</h2>
            <p className="text-base-content/70">Application ID: <span className="font-mono">{application.id}</span></p>
            <p className="text-base-content/70">Visa Type: <span className="capitalize font-medium">{application.visaType}</span></p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-semibold capitalize ${getStatusColor(application.status)}`}>
              {getDisplayStatus()}
            </p>
            <p className="text-sm text-base-content/50">
              Last updated: {lastUpdate.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Flagged Document Alert */}
      {flaggedDocument && (
        <div className="bg-warning/10 border-b-4 border-warning/30 p-6">
          <div className="flex items-start gap-4">
            <Flag className="w-8 h-8 text-warning mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-warning-content mb-2">
                Document Requires Your Attention
              </h3>
              <p className="text-warning-content/90 mb-3">
                An embassy officer has flagged one of your documents for review:
              </p>
              
              <div className="bg-warning/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-warning-content" />
                  <span className="font-semibold text-warning-content">
                    {flaggedDocument.document.name || 'Document'}
                  </span>
                </div>
                
                <div className="bg-base-100 rounded p-3 mb-3">
                  <p className="text-sm font-medium text-base-content/70 mb-1">Officer's Note:</p>
                  <p className="text-base-content">{flaggedDocument.reason}</p>
                </div>
                
                <p className="text-xs text-warning-content/70">
                  Flagged on {new Date(flaggedDocument.flagged_at).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => navigateToDocuments()}
                  className="btn btn-warning font-medium"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Upload Revised Document
                </button>
                
                <button
                  onClick={() => window.open(`/api/documents/view/${application.id}/${flaggedDocument.document.name}`, '_blank')}
                  className="btn btn-outline btn-warning"
                >
                  <Eye className="w-4 h-4 inline mr-2" />
                  View Current Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Collection Alert */}
      {isDocumentBlocked && (
        <div className="bg-error/10 border-b-4 border-error/30 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-error mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-error-content mb-2">
                Processing Blocked - Documents Required
              </h3>
              <p className="text-error-content/90 mb-3">
                Your application is currently on hold because <strong>required documents have not been uploaded</strong>. 
                Processing cannot continue until all mandatory documents are provided and verified.
              </p>
              <div className="bg-error/20 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold text-error-content mb-1">Document Status:</h4>
                    <p className="text-error-content/90">Required: {documentStatus.total_mandatory_uploaded}/{documentStatus.total_mandatory} uploaded</p>
                    <p className="text-error-content/90">Missing: {documentStatus.mandatory_missing.join(', ')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-error-content mb-1">Processing Status:</h4>
                    <p className="text-error-content/90">Current: Document Collection</p>
                    <p className="text-error-content/90">Next: {documentStatus.requirements_met ? 'Biometric Collection' : 'Upload Required Documents'}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onNavigateToDocuments}
                  className="btn btn-error font-medium"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Upload Documents Now
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="btn btn-outline btn-error"
                >
                  Share Status Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fingerprint Scanning Alert */}
      {isFingerprintBlocked && (
        <div className="bg-warning/10 border-b-4 border-warning/30 p-6">
          <div className="flex items-start gap-4">
            <Fingerprint className="w-8 h-8 text-warning mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-sm mb-2">
                Processing Blocked - Biometric Collection Required
              </h3>
              <p className="text-sm mb-3">
                Your application requires <strong>fingerprint scanning at the embassy terminal</strong>. 
                Please visit the embassy during business hours to complete this step.
              </p>
              <div className="bg-warning/20 rounded-lg p-3 mb-4">
                <div className="text-sm">
                  <h4 className="font-semibold text-sm mb-1">Terminal Location:</h4>
                  <p className="text-sm">Embassy Building, Ground Floor</p>
                  <p className="text-sm">Open: Monday-Friday, 9:00 AM - 4:00 PM</p>
                  <p className="text-sm mt-2">Bring: Application ID and valid photo ID</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleMarkStepComplete('fingerprint_scan')}
                  className="btn btn-warning font-medium"
                >
                  <Fingerprint className="w-4 h-4 inline mr-2" />
                  Mark as Complete (Demo)
                </button>
                <button
                  onClick={() => window.open('https://maps.google.com', '_blank')}
                  className="btn btn-outline btn-warning"
                >
                  Get Directions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Alert */}
      {isPaymentBlocked && (
        <div className="bg-warning/10 border-b-4 border-warning/30 p-6">
          <div className="flex items-start gap-4">
            <CreditCard className="w-8 h-8 text-warning mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-sm mb-2">
                Processing Blocked - Payment Required
              </h3>
              <p className="text-sm mb-3">
                Please complete the <strong>visa application fee payment</strong> to proceed with processing.
              </p>
              <div className="bg-warning/20 rounded-lg p-3 mb-4">
                <div className="text-sm">
                  <h4 className="font-semibold text-sm mb-1">Payment Details:</h4>
                  <p className="text-sm">Application Fee: $160.00</p>
                  <p className="text-sm">Processing Fee: $35.00</p>
                  <p className="text-sm font-semibold mt-2">Total: $195.00</p>
                  <p className="text-sm text-xs mt-2">Accepted: Credit/Debit Cards, Bank Transfer</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleMarkStepComplete('payment')}
                  className="btn btn-warning font-medium"
                >
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  Mark as Paid (Demo)
                </button>
                <button
                  onClick={() => alert('Payment gateway would open here')}
                  className="btn btn-outline btn-warning"
                >
                  Pay Online
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Overview */}
      <div className="p-6 bg-base-200 border-b">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-base-content">Processing Progress</h3>
          <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
        </div>
        
        <div className="w-full bg-base-300 rounded-full h-3 mb-4">
          <div 
            className={`h-3 rounded-full transition-all duration-1000 ${
              isDocumentBlocked ? 'bg-error' :
              isFingerprintBlocked ? 'bg-warning' :
              isPaymentBlocked ? 'bg-warning' :
              application.status === 'approved' ? 'bg-success' :
              application.status === 'rejected' ? 'bg-error' : 'bg-primary'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-base-100 rounded-lg p-4">
            <p className="text-2xl font-bold text-primary">{completedSteps}</p>
            <p className="text-sm text-base-content/70">Steps Completed</p>
          </div>
          {application.approvalProbability && (
            <div className="bg-base-100 rounded-lg p-4">
              <p className="text-2xl font-bold text-success">{application.approvalProbability}%</p>
              <p className="text-sm text-base-content/70">Approval Probability</p>
            </div>
          )}
          {isDocumentBlocked && (
            <div className="bg-base-100 rounded-lg p-4">
              <p className="text-2xl font-bold text-error">{documentStatus.mandatory_missing.length}</p>
              <p className="text-sm text-base-content/70">Documents Missing</p>
            </div>
          )}
          {isFingerprintBlocked && (
            <div className="bg-base-100 rounded-lg p-4">
              <p className="text-2xl font-bold text-warning">1</p>
              <p className="text-sm text-base-content/70">Fingerprint Pending</p>
            </div>
          )}
          {isPaymentBlocked && (
            <div className="bg-base-100 rounded-lg p-4">
              <p className="text-2xl font-bold text-warning">$195</p>
              <p className="text-sm text-base-content/70">Payment Due</p>
            </div>
          )}
        </div>

        {anyBlockage && (
          <div className="mt-4 p-3 bg-warning/20 border border-warning/30 rounded-lg">
            <p className="text-sm text-sm text-center">
              <strong>⚠ Processing Note:</strong> Your application will remain in its current status until all requirements are satisfied:
              {isDocumentBlocked && ' documents uploaded,'}
              {isFingerprintBlocked && ' fingerprints scanned,'}
              {isPaymentBlocked && ' payment completed.'}
              {' '}The processing timeline only begins after all requirements are met.
            </p>
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <div className="p-6">
        <h3 className="font-semibold text-base-content mb-6">Application Timeline</h3>
        
        <div className="space-y-6">
          {statusSteps.map((step, index) => (
            <div key={step.status} className="flex gap-4">
              {/* Icon */}
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.blocked
                    ? 'bg-error text-error-content'
                    : step.completed 
                    ? application.status === 'approved' && step.status === 'approved'
                      ? 'bg-success text-success-content'
                      : application.status === 'rejected' && step.status === 'approved'
                      ? 'bg-error text-error-content'
                      : 'bg-primary text-primary-content'
                    : step.current
                    ? step.blocked
                      ? 'bg-error/20 text-error border-2 border-error'
                      : 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-base-300 text-base-content/40'
                } ${step.clickable ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
                onClick={() => step.clickable && handleMarkStepComplete(step.status)}
                title={step.clickable ? 'Click to mark as complete (Demo)' : ''}
              >
                {step.blocked ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : step.completed ? (
                  application.status === 'rejected' && step.status === 'approved' ? (
                    <X className="w-6 h-6" />
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
                    step.completed || step.current ? 'text-base-content' : 'text-base-content/50'
                  }`}>
                    {step.title}
                  </h4>
                  {step.current && step.estimatedDays && !step.blocked && (
                    <span className="text-sm text-primary font-medium">
                      ~{step.estimatedDays} days
                    </span>
                  )}
                  {step.blocked && (
                    <span className="text-sm text-error font-medium">
                      Action Required
                    </span>
                  )}
                </div>
                
                <p className={`text-sm ${
                  step.completed || step.current ? 'text-base-content/70' : 'text-base-content/40'
                }`}>
                  {step.description}
                </p>

                {step.blocked && step.current && (
                  <div className="mt-3 p-3 bg-error/10 border border-error/30 rounded-lg">
                    <p className="text-sm text-sm">
                      <strong>Action Required:</strong> This step is blocked and requires your action to continue. 
                      {step.status === 'document_collection' && 'Please upload the required documents to proceed.'}
                      {step.status === 'fingerprint_scan' && 'Please visit the embassy to complete fingerprint scanning.'}
                      {step.status === 'payment' && 'Please complete the payment to proceed with processing.'}
                    </p>
                    {step.status === 'document_collection' && (
                      <button 
                        onClick={onNavigateToDocuments}
                        className="btn btn-error btn-sm mt-2"
                      >
                        <Upload className="w-4 h-4 inline mr-1" />
                        Upload Documents
                      </button>
                    )}
                    {step.status === 'fingerprint_scan' && (
                      <button 
                        onClick={() => handleMarkStepComplete('fingerprint_scan')}
                        className="btn btn-warning btn-sm mt-2"
                      >
                        <Fingerprint className="w-4 h-4 inline mr-1" />
                        Mark Complete (Demo)
                      </button>
                    )}
                    {step.status === 'payment' && (
                      <button 
                        onClick={() => handleMarkStepComplete('payment')}
                        className="btn btn-warning btn-sm mt-2"
                      >
                        <CreditCard className="w-4 h-4 inline mr-1" />
                        Mark as Paid (Demo)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Connecting line */}
              {index < statusSteps.length - 1 && (
                <div className="absolute left-[68px] mt-12 w-px h-6 bg-base-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 bg-base-200 border-t">
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={loadApplicationStatus}
            className="btn btn-primary"
          >
            Refresh Status
          </button>
          
          {(isDocumentBlocked || flaggedDocument) && (
            <button
              onClick={onNavigateToDocuments}
              className="btn btn-error"
            >
              <Upload className="w-4 h-4 inline mr-1" />
              Upload Documents
            </button>
          )}
          
          {isFingerprintBlocked && (
            <button
              onClick={() => handleMarkStepComplete('fingerprint_scan')}
              className="btn btn-warning"
            >
              <Fingerprint className="w-4 h-4 inline mr-1" />
              Complete Fingerprints (Demo)
            </button>
          )}
          
          {isPaymentBlocked && (
            <button
              onClick={() => handleMarkStepComplete('payment')}
              className="btn btn-warning"
            >
              <CreditCard className="w-4 h-4 inline mr-1" />
              Complete Payment (Demo)
            </button>
          )}
          
          <button
            onClick={onNewApplication}
            className="btn btn-outline"
          >
            New Application
          </button>
        </div>
      </div>
    </div>
  )
}