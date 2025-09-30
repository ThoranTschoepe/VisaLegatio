'use client'

import { useState, useEffect, useMemo } from 'react'
import { debug, error as logError, warn as logWarn } from '@/lib/log'
import { CheckCircle2, AlertTriangle, Eye, Maximize2, ExternalLink, AlertCircle, Brain, FileWarning, Flag, ShieldCheck } from 'lucide-react'
import { EmbassyApplication, Officer, EmbassyDocument, FlaggedDocument } from '@/types/embassy.types'
import { api } from '@/utils/api'
import { useAlertStore } from '@/lib/stores/alert.store'
import { JOHN_DOE_ANALYSIS, JOHN_DOE_WARNINGS, DOCUMENT_NAMES, DOCUMENT_DESCRIPTIONS } from '@/lib/constants/mock-data.constants'
import { getDocumentIcon, getAIStatusIcon, formatFileSize } from '@/utils/document.utils'
import DocumentViewer from './DocumentViewer'
import DocumentAnalysisPanel from './DocumentAnalysisPanel'
import DocumentFlagging from './DocumentFlagging'

// Use configured API URL with a localhost fallback and strip trailing slash for consistency
const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

interface ApplicationReviewProps {
  application: EmbassyApplication
  onBack: () => void
  onUpdateStatus: (id: string, status: EmbassyApplication['status']) => void
  officer: Officer
  onRefreshApplication?: (applicationId: string) => Promise<EmbassyApplication | void>
}

interface DocumentWithUrls extends EmbassyDocument {
  view_url?: string
  file_exists?: boolean
  ai_analysis?: {
    classification: {
      document_type: string
      confidence: number
      is_correct_type: boolean
    }
    extracted_data: {
      text_content: string
      dates: string[]
      amounts: string[]
      names: string[]
    }
    problems: Array<{
      problem_type: string
      severity: string
      description: string
      suggestion: string
    }>
    overall_confidence: number
    is_authentic: boolean
    processing_time_ms: number
    analyzed_at: string
    ai_model_version?: string
  }
}

interface DocumentRequirement {
  type: string
  name: string
  description: string
  mandatory: boolean
  uploaded?: DocumentWithUrls
  missing: boolean
}

export default function ApplicationReview({ 
  application, 
  onBack, 
  onUpdateStatus, 
  officer,
  onRefreshApplication
}: ApplicationReviewProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState(0)
  const [documents, setDocuments] = useState<DocumentWithUrls[]>([])
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [documentError, setDocumentError] = useState('')
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState('')
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [currentAIAnalysis, setCurrentAIAnalysis] = useState<any>(null)
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set())
  
  // Flag document states
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flaggingDocument, setFlaggingDocument] = useState<DocumentWithUrls | null>(null)
  const [flaggedDocumentIds, setFlaggedDocumentIds] = useState<Set<string>>(new Set())
  const [activeFlags, setActiveFlags] = useState<FlaggedDocument[]>(application.flaggedDocuments ?? [])
  const [resolvedFlags, setResolvedFlags] = useState<FlaggedDocument[]>(application.resolvedFlagHistory ?? [])
  const [resolvingFlagDocumentId, setResolvingFlagDocumentId] = useState<string | null>(null)
  
  const { showSuccess, showError } = useAlertStore()

  const auditHistoryByDocumentId = useMemo(() => {
    const map = new Map<string, FlaggedDocument>()

    resolvedFlags.forEach(flag => {
      if (flag.documentId) {
        map.set(flag.documentId, flag)
      }
    })

    activeFlags.forEach(flag => {
      if (flag.documentId && (flag.auditDecisionCode || flag.auditNotes || flag.auditStatus)) {
        map.set(flag.documentId, flag)
      }
    })

    return map
  }, [activeFlags, resolvedFlags])

  const mostRecentAuditEntry = useMemo(() => {
    const activeWithAudit = activeFlags.filter(flag => flag.auditDecisionCode || flag.auditNotes || flag.auditStatus)
    const merged = [...activeWithAudit, ...resolvedFlags]

    if (merged.length === 0) {
      return undefined
    }

    merged.sort((a, b) => {
      const aTime = a.auditedAt?.getTime() ?? a.resolvedAt?.getTime() ?? a.flaggedAt?.getTime() ?? 0
      const bTime = b.auditedAt?.getTime() ?? b.resolvedAt?.getTime() ?? b.flaggedAt?.getTime() ?? 0
      return bTime - aTime
    })

    return merged[0]
  }, [activeFlags, resolvedFlags])

  const auditedHistory = useMemo(
    () => resolvedFlags.filter(flag => flag.auditDecisionCode || flag.auditNotes || flag.auditStatus),
    [resolvedFlags]
  )

  const formatDecisionLabel = (entry?: FlaggedDocument) => {
    if (!entry) return 'Reviewed'
    if (entry.auditDecisionLabel) return entry.auditDecisionLabel
    const decision = entry.auditDecisionCode || entry.auditStatus
    if (!decision) return 'Reviewed'
    return decision
      .split('_')
      .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ')
  }

  const getAuditPalette = (decision?: string) => {
    switch (decision) {
      case 'clear_to_proceed':
        return {
          container: 'bg-success/10 border-success/20',
          icon: 'text-success',
          text: 'text-success'
        }
      case 'overturn_flag':
        return {
          container: 'bg-error/10 border-error/20',
          icon: 'text-error',
          text: 'text-error'
        }
      case 'escalate_to_security':
        return {
          container: 'bg-error/10 border-error/20',
          icon: 'text-error',
          text: 'text-error'
        }
      case 'escalate_to_policy':
      case 'request_additional_docs':
      case 'request_clarification':
      case 'issue_conditional_approval':
        return {
          container: 'bg-warning/10 border-warning/20',
          icon: 'text-warning',
          text: 'text-warning'
        }
      case 'refer_for_training':
        return {
          container: 'bg-info/10 border-info/20',
          icon: 'text-info',
          text: 'text-info'
        }
      default:
        return {
          container: 'bg-info/10 border-info/20',
          icon: 'text-info',
          text: 'text-info'
        }
    }
  }

  const getAuditIcon = (decision?: string) => {
    switch (decision) {
      case 'overturn_flag':
        return AlertCircle
      case 'escalate_to_policy':
      case 'escalate_to_security':
      case 'request_additional_docs':
      case 'request_clarification':
      case 'issue_conditional_approval':
        return AlertTriangle
      default:
        return ShieldCheck
    }
  }

  // Check if this is John Doe's application
  const isJohnDoe = application.applicantName === 'John Doe' || application.id === 'VSV-240105-JDOE'

  // Load documents when component mounts
  useEffect(() => {
    loadDocuments()
    // Delay reloadApplicationData slightly to ensure it runs after initial load
    setTimeout(() => reloadApplicationData(), 100)
  }, [application.id])

  // Load current flagged documents
  useEffect(() => {
  debug('📋 Application data changed, updating flagged documents:', application.flaggedDocuments)
    const currentFlags = application.flaggedDocuments ?? []
    setActiveFlags(currentFlags)

    if (currentFlags.length > 0) {
      const flaggedIds = new Set(currentFlags.map(f => f.documentId))
      setFlaggedDocumentIds(flaggedIds)
  debug('✅ Set flagged document IDs:', flaggedIds)
    } else {
      setFlaggedDocumentIds(new Set())
  debug('🧹 Cleared flagged document IDs')
    }

    setResolvedFlags(application.resolvedFlagHistory ?? [])
  }, [application.flaggedDocuments, application.resolvedFlagHistory])

  // Function to reload fresh application data including flagged documents
  const reloadApplicationData = async () => {
    try {
  debug('🔄 Reloading fresh application data...')
      
      // Try to use parent callback first (to update the parent's application state)
      if (onRefreshApplication) {
        await onRefreshApplication(application.id)
      }
      
      // Also get fresh data directly for flagged documents
      const freshAppData = await api.getApplicationStatus(application.id)
      
      // Update flagged documents state with fresh data
      const refreshedActiveFlags = freshAppData.flaggedDocuments || []
      const refreshedResolvedFlags = freshAppData.resolvedFlagHistory || []

      setActiveFlags(refreshedActiveFlags)
      setResolvedFlags(refreshedResolvedFlags)

      if (refreshedActiveFlags.length > 0) {
        const flaggedIds = new Set(refreshedActiveFlags.map(f => f.documentId))
        setFlaggedDocumentIds(flaggedIds)
  debug('✅ Updated flagged documents:', flaggedIds)
      } else {
        setFlaggedDocumentIds(new Set())
  debug('✅ No flagged documents found')
      }
      
      // Also reload documents to ensure everything is in sync
      await loadDocuments()
    } catch (error) {
  logError('❌ Failed to reload application data:', error)
    }
  }

  const loadDocuments = async () => {
    try {
      setIsLoadingDocuments(true)
      setDocumentError('')
      
  debug(`🔍 Loading documents for application: ${application.id}`)
      
      // Check backend connectivity first
      try {
        const healthResponse = await fetch(`${BACKEND_BASE}/api/health`)
  debug('🏥 Backend health check:', healthResponse.ok ? 'OK' : 'FAILED')
      } catch (healthError) {
  logError('❌ Backend not accessible:', healthError)
        setDocumentError(`Backend server not accessible. Please check if the backend is running on ${BACKEND_BASE}`)
        return
      }
      
      // Load document requirements first
      const requirements = await api.getDocumentRequirements(application.visaType as any)
  debug('📋 Document requirements loaded:', requirements)
      
      // Get documents with view URLs from backend - use the proper API client
      let uploadedDocs: any[] = []
      
      try {
        // First try the dedicated list endpoint
        const response = await fetch(`${BACKEND_BASE}/api/documents/list/${application.id}`)
        
        if (response.ok) {
          uploadedDocs = await response.json()
          debug('📄 Loaded documents from backend (list endpoint):', uploadedDocs)
        } else {
          logWarn(`List endpoint failed (${response.status}), trying application endpoint...`)
          // Fallback to application documents endpoint
          uploadedDocs = await api.getApplicationDocuments(application.id)
          debug('📄 Loaded documents from backend (app endpoint):', uploadedDocs)
        }
      } catch (fetchError) {
  logWarn('Document fetch error:', fetchError)
        // Fallback to application documents endpoint
        try {
          uploadedDocs = await api.getApplicationDocuments(application.id)
          debug('📄 Loaded documents from fallback endpoint:', uploadedDocs)
        } catch (fallbackError) {
          logError('Both document endpoints failed:', fallbackError)
          uploadedDocs = []
        }
      }
      
      if (uploadedDocs.length === 0) {
  logWarn(`⚠️  No documents found for application ${application.id}`)
  debug('📊 Debug info:', {
          applicationId: application.id,
          backendBase: BACKEND_BASE,
          visaType: application.visaType,
          applicantName: application.applicantName
        })
        
        // Process documents and add AI analysis for John Doe
        const docsWithFullUrls = uploadedDocs.map((doc: any) => {
          let viewUrl = null
          
          if (doc.view_url && doc.file_exists) {
            viewUrl = doc.view_url.startsWith('http') ? doc.view_url : `${BACKEND_BASE}${doc.view_url}`
          }
          
          // Add AI analysis for John Doe
          let aiAnalysis = undefined
          if (isJohnDoe) {
            if (doc.type === 'passport') {
              aiAnalysis = { ...JOHN_DOE_ANALYSIS.passport, concerns: [...JOHN_DOE_ANALYSIS.passport.concerns] }
            } else if (doc.type === 'bank_statement') {
              aiAnalysis = { ...JOHN_DOE_ANALYSIS.bank_statement, concerns: [...JOHN_DOE_ANALYSIS.bank_statement.concerns] }
            } else if (doc.type === 'invitation_letter') {
              aiAnalysis = { ...JOHN_DOE_ANALYSIS.invitation_letter, concerns: [...JOHN_DOE_ANALYSIS.invitation_letter.concerns] }
            } else if (doc.type === 'flight_itinerary') {
              aiAnalysis = { ...JOHN_DOE_ANALYSIS.flight_itinerary, concerns: [...JOHN_DOE_ANALYSIS.flight_itinerary.concerns] }
            }
          }
          
          return {
            ...doc,
            view_url: viewUrl,
            uploadedAt: doc.uploaded_at,
            verified: doc.verified,
            ai_analysis: aiAnalysis
          }
        })
        
        setDocuments(docsWithFullUrls)
      }
      
      // If no documents found, use demo/mock data based on application type
      if (uploadedDocs.length === 0) {
        console.log('📝 No documents found, using demo/mock data')
        if (isJohnDoe) {
          const johnDoeDocs = createJohnDoeDemoDocuments()
          setDocuments(johnDoeDocs)
          uploadedDocs = johnDoeDocs
        } else {
          const mockDocs = createMockDocuments()
          setDocuments(mockDocs)
          uploadedDocs = mockDocs
        }
      }

      // Use imported document constants

      // Create comprehensive document list
      const allDocRequirements: DocumentRequirement[] = []

      // Add mandatory documents
      requirements.mandatory_documents.forEach(docType => {
        const uploadedDoc = uploadedDocs.find(doc => doc.type === docType)
        allDocRequirements.push({
          type: docType,
          name: DOCUMENT_NAMES[docType as keyof typeof DOCUMENT_NAMES] || docType,
          description: DOCUMENT_DESCRIPTIONS[docType as keyof typeof DOCUMENT_DESCRIPTIONS] || `Required ${docType.replace('_', ' ')}`,
          mandatory: true,
          uploaded: uploadedDoc,
          missing: !uploadedDoc || !uploadedDoc.verified
        })
      })

      // Add optional documents
      requirements.optional_documents.forEach(docType => {
        const uploadedDoc = uploadedDocs.find(doc => doc.type === docType)
        allDocRequirements.push({
          type: docType,
          name: DOCUMENT_NAMES[docType as keyof typeof DOCUMENT_NAMES] || docType,
          description: DOCUMENT_DESCRIPTIONS[docType as keyof typeof DOCUMENT_DESCRIPTIONS] || `Optional ${docType.replace('_', ' ')}`,
          mandatory: false,
          uploaded: uploadedDoc,
          missing: !uploadedDoc || !uploadedDoc.verified
        })
      })

      setDocumentRequirements(allDocRequirements)
      
    } catch (error) {
      console.error('❌ Error loading documents:', error)
      setDocumentError('Failed to load documents')
      
      // Create John Doe demo documents for fallback
      if (isJohnDoe) {
        setDocuments(createJohnDoeDemoDocuments())
        setDocumentRequirements(createJohnDoeRequirements())
      } else {
        setDocuments(createMockDocuments())
        setDocumentRequirements(createMockRequirements())
      }
    } finally {
      setIsLoadingDocuments(false)
    }
  }

  const createJohnDoeDemoDocuments = (): DocumentWithUrls[] => {
    console.log('🎭 Creating John Doe demo documents')
    
    return [
      {
        id: '1',
        name: 'passport.pdf',
        type: 'passport',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 2048576,
        view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/passport.pdf`,
        file_exists: true,
        ai_analysis: JOHN_DOE_ANALYSIS.passport
      },
      {
        id: '2',
        name: 'bank_statement.pdf',
        type: 'bank_statement',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 1024000,
        view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/bank_statement.pdf`,
        file_exists: true,
        ai_analysis: JOHN_DOE_ANALYSIS.bank_statement
      },
      {
        id: '3',
        name: 'invitation_letter.pdf',
        type: 'invitation_letter',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 512000,
        view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/invitation_letter.pdf`,
        file_exists: true,
        ai_analysis: JOHN_DOE_ANALYSIS.invitation_letter
      },
      {
        id: '4',
        name: 'flight_itinerary.pdf',
        type: 'flight_itinerary',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 256000,
        view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/flight_itinerary.pdf`,
        file_exists: true,
        ai_analysis: JOHN_DOE_ANALYSIS.flight_itinerary
      }
    ]
  }

  const createJohnDoeRequirements = (): DocumentRequirement[] => {
    const docs = createJohnDoeDemoDocuments()
    
    return [
      {
        type: 'passport',
        name: 'Passport (Photo Page)',
        description: 'Clear photo of your passport information page',
        mandatory: true,
        uploaded: docs.find(d => d.type === 'passport'),
        missing: false
      },
      {
        type: 'bank_statement',
        name: 'Bank Statement',
        description: 'Last 3 months bank statements showing sufficient funds',
        mandatory: true,
        uploaded: docs.find(d => d.type === 'bank_statement'),
        missing: false
      },
      {
        type: 'invitation_letter',
        name: 'Invitation Letter',
        description: 'Official invitation letter from host organization',
        mandatory: false,
        uploaded: docs.find(d => d.type === 'invitation_letter'),
        missing: false
      },
      {
        type: 'flight_itinerary',
        name: 'Flight Itinerary',
        description: 'Flight booking confirmation or itinerary',
        mandatory: false,
        uploaded: docs.find(d => d.type === 'flight_itinerary'),
        missing: false
      },
      {
        type: 'travel_insurance',
        name: 'Travel Insurance',
        description: 'Valid travel insurance covering your entire stay',
        mandatory: false,
        uploaded: undefined,
        missing: true
      }
    ]
  }

  const createMockDocuments = (): DocumentWithUrls[] => {
    return [
      {
        id: '1',
        name: 'passport.pdf',
        type: 'passport',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 2048576,
        view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/passport.pdf`,
        file_exists: true
      },
      {
        id: '2',
        name: 'photo.jpg',
        type: 'photo',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 512000,
        view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/photo.jpg`,
        file_exists: true
      },
      {
        id: '3',
        name: 'bank_statement.pdf',
        type: 'bank_statement',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 1024000,
        view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/bank_statement.pdf`,
        file_exists: true
      }
    ]
  }

  const createMockRequirements = (): DocumentRequirement[] => {
    const mockDocs = createMockDocuments()
    
    return [
      {
        type: 'passport',
        name: 'Passport (Photo Page)',
        description: 'Clear photo of your passport information page',
        mandatory: true,
        uploaded: mockDocs.find(d => d.type === 'passport'),
        missing: false
      },
      {
        type: 'photo',
        name: 'Passport Photo',
        description: 'Recent passport-sized photo (white background)',
        mandatory: true,
        uploaded: mockDocs.find(d => d.type === 'photo'),
        missing: false
      },
      {
        type: 'bank_statement',
        name: 'Bank Statement',
        description: 'Last 3 months bank statements showing sufficient funds',
        mandatory: true,
        uploaded: mockDocs.find(d => d.type === 'bank_statement'),
        missing: false
      },
      {
        type: 'invitation_letter',
        name: 'Invitation Letter',
        description: 'Official invitation letter from host organization',
        mandatory: false,
        uploaded: undefined,
        missing: true
      },
      {
        type: 'travel_insurance',
        name: 'Travel Insurance',
        description: 'Valid travel insurance covering your entire stay',
        mandatory: false,
        uploaded: undefined,
        missing: true
      }
    ]
  }

  const mockAnswers = isJohnDoe ? {
    'destination_country': 'Germany',
    'travel_purpose': 'Tourism/Visiting Friends',
    'host_name': 'Maria Schneider',
    'duration': '14',
    'departure_date': '28 June 2021',
    'flight': 'TK1639 (IST to MUC)',
    'return_flight': 'Not booked'
  } : {
    'destination_country': 'Germany',
    'business_purpose': 'Conference/Meeting',
    'company_name': 'Tech Solutions Inc.',
    'invitation_company': 'Berlin Tech Conference',
    'duration': '7'
  }

  // Check if any mandatory documents are missing
  const mandatoryDocsMissing = documentRequirements.filter(req => req.mandatory && req.missing).length > 0
  const canApprove = !mandatoryDocsMissing

  const handleMakeDecision = () => {
    if (decision === 'approve' && mandatoryDocsMissing) {
      alert('Cannot approve application: mandatory documents are missing')
      return
    }
    
    if (decision) {
      const newStatus = decision === 'approve' ? 'approved' : 'rejected'
      onUpdateStatus(application.id, newStatus)
      onBack()
    }
  }

  const handleViewDocument = (document: DocumentWithUrls) => {
    if (!document.view_url) {
      alert('Document URL not available')
      return
    }

    console.log('👁 Opening document with URL:', document.view_url)
    
    try {
      let urlToUse = document.view_url
      
      if (document.view_url.startsWith('http://') || document.view_url.startsWith('https://')) {
        // If it's already a full URL, use it as-is
        urlToUse = document.view_url
      } else {
        // If it's a relative URL, prepend the backend base URL
        urlToUse = `${BACKEND_BASE}${document.view_url.startsWith('/') ? '' : '/'}${document.view_url}`
      }
      
      setCurrentDocumentUrl(urlToUse)
      setShowDocumentModal(true)
      
    } catch (error) {
      console.error('❌ Error processing document URL:', error)
      const fallbackUrl = `${BACKEND_BASE}/api/documents/view/${application.id}/${document.name}`
      setCurrentDocumentUrl(fallbackUrl)
      setShowDocumentModal(true)
    }
  }

  const handleViewAIAnalysis = (document: DocumentWithUrls) => {
    if (document.ai_analysis) {
      setCurrentAIAnalysis(document.ai_analysis)
      setShowAIAnalysis(true)
    }
  }

  // Utility functions to derive status and summary from detailed AI analysis
  const getAIAnalysisStatus = (analysis: DocumentWithUrls['ai_analysis']): 'critical' | 'warning' | 'success' => {
    if (!analysis) return 'success'
    
    const criticalProblems = analysis.problems?.filter(p => p.severity === 'critical').length || 0
    const highProblems = analysis.problems?.filter(p => p.severity === 'high').length || 0
    
    if (criticalProblems > 0 || !analysis.is_authentic) return 'critical'
    if (highProblems > 0 || (analysis.overall_confidence || 0) < 0.7) return 'warning'
    return 'success'
  }

  const getAIAnalysisSummary = (analysis: DocumentWithUrls['ai_analysis']): string => {
    if (!analysis) return 'No AI analysis available'
    
    const confidence = Math.round((analysis.overall_confidence || 0) * 100)
    const documentType = analysis.classification?.document_type || 'document'
    const isCorrectType = analysis.classification?.is_correct_type
    
    let summary = `${confidence}% confidence for ${documentType}`
    if (isCorrectType === false) summary += ' (incorrect document type)'
    if (!analysis.is_authentic) summary += ' - Document authenticity questionable'
    
    return summary
  }

  const toggleDocumentExpanded = (docType: string) => {
    setExpandedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(docType)) {
        newSet.delete(docType)
      } else {
        newSet.add(docType)
      }
      return newSet
    })
  }

  const handleOpenInNewTab = (document: DocumentWithUrls) => {
    if (!document.view_url) {
      alert('Document URL not available')
      return
    }

    try {
      let urlToOpen = document.view_url
      
      if (document.view_url.startsWith('http://') || document.view_url.startsWith('https://')) {
        // If it's already a full URL, use it as-is
        urlToOpen = document.view_url
      } else {
        // If it's a relative URL, prepend the backend base URL
        urlToOpen = `${BACKEND_BASE}${document.view_url.startsWith('/') ? '' : '/'}${document.view_url}`
      }
      
      window.open(urlToOpen, '_blank')
      
    } catch (error) {
      console.error('❌ Error processing document URL for new tab:', error)
      const fallbackUrl = `${BACKEND_BASE}/api/documents/view/${application.id}/${document.name}`
      window.open(fallbackUrl, '_blank')
    }
  }

  // Flag document function
  const handleFlagDocument = async (document: DocumentWithUrls) => {
    setFlaggingDocument(document)
    setShowFlagModal(true)
  }

  const handleUnflagDocument = async (flagId: string, documentId: string) => {
    try {
      setResolvingFlagDocumentId(documentId)
      await api.unflagDocument(application.id, flagId)
      
      setFlaggedDocumentIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(documentId)
        return newSet
      })
      showSuccess('Document flag removed')
      
      // Reload both documents and application data to ensure sync
      await loadDocuments()
      await reloadApplicationData()
    } catch (error) {
      showError('Failed to remove flag')
    } finally {
      setResolvingFlagDocumentId(null)
    }
  }




  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <button className="btn btn-ghost" onClick={onBack}>
            ← Back to Dashboard
          </button>
          {isJohnDoe && (
            <span className="badge badge-warning ml-4">
              <Brain className="w-4 h-4 mr-1" />
              AI Risk Analysis Available
            </span>
          )}
        </div>
        <div className="flex-none flex items-center gap-3">
          <button 
            onClick={reloadApplicationData}
            className="btn btn-ghost btn-sm"
            title="Refresh application data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <span className="text-sm text-base-content/60">Reviewing as: {officer.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="alert alert-info mb-6">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-semibold">AI Content Notice</p>
            <p className="text-sm opacity-80">
              This review includes AI-generated summaries and risk insights. Please verify critical information before making a final decision.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Application Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Applicant Info */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Applicant Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-base-content/60">Name</p>
                    <p className="font-semibold">{application.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60">Application ID</p>
                    <p className="font-mono text-sm">{application.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60">Visa Type</p>
                    <span className="badge badge-primary">{application.visaType}</span>
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60">Country of Origin</p>
                    <p className="font-semibold">{application.country}</p>
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60">Risk Assessment</p>
                    <p className={`font-bold ${
                      isJohnDoe ? 'text-error' : 
                      application.riskScore < 10 ? 'text-success' : 
                      application.riskScore < 20 ? 'text-warning' : 'text-error'
                    }`}>
                      {isJohnDoe ? '85' : application.riskScore}% Risk Score
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Answers */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Application Details</h3>
                <div className="space-y-3">
                  {Object.entries(mockAnswers).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm text-base-content/60">{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className={`font-semibold ${
                        key === 'return_flight' && value === 'Not booked' ? 'text-error' : ''
                      }`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Documents */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow h-full">
              <div className="card-body p-6">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="card-title text-lg font-semibold">Documents Review</h3>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-outline text-xs py-2 px-3 min-h-[2rem]">
                      {documentRequirements.filter(req => !req.missing).length}/{documentRequirements.length} submitted
                    </span>
                    {mandatoryDocsMissing && (
                      <span className="badge badge-error text-xs py-2 px-3 min-h-[1.75rem]">
                        {documentRequirements.filter(req => req.mandatory && req.missing).length} required missing
                      </span>
                    )}
                  </div>
                </div>
                
                {isLoadingDocuments ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="loading loading-spinner loading-md mb-3"></div>
                      <span className="text-sm text-base-content/60">Loading documents...</span>
                    </div>
                  </div>
                ) : documentError ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <AlertTriangle className="w-8 h-8 text-error mb-3 mx-auto" />
                      <p className="text-sm text-error font-medium mb-2">Failed to load documents</p>
                      <p className="text-xs text-base-content/60 mb-4">{documentError}</p>
                      <button 
                        onClick={loadDocuments}
                        className="btn btn-primary btn-sm"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Document List Section */}
                    <div>
                      <h4 className="text-sm font-medium text-base-content/70 mb-3">Document Requirements</h4>
                      <div className="space-y-3">
                        {documentRequirements.map((req, index) => (
                          <div key={req.type}>
                            <div 
                              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                                selectedDocumentIndex === index 
                                  ? 'border-primary bg-primary/10 shadow-sm' 
                                  : req.missing 
                                  ? 'border-base-300 bg-base-200/50' 
                                  : 'border-base-300 hover:border-primary/50 hover:bg-base-200/50'
                              }`}
                              onClick={() => setSelectedDocumentIndex(index)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-xl flex-shrink-0">{getDocumentIcon(req.type)}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className={`font-medium text-sm truncate ${req.missing ? 'text-base-content/40' : 'text-base-content'}`}>
                                        {req.name}
                                      </p>
                                      {req.mandatory && (
                                        <span className="badge badge-error badge-xs flex-shrink-0">REQ</span>
                                      )}
                                      {req.uploaded?.ai_analysis && (
                                        <span className="badge badge-warning badge-xs flex-shrink-0">
                                          <Brain className="w-3 h-3 mr-1" />
                                          AI
                                        </span>
                                      )}
                                      {flaggedDocumentIds.has(req.uploaded?.id || '') && (
                                        <span className="badge badge-warning badge-xs flex-shrink-0">
                                          <Flag className="w-3 h-3 mr-1" />
                                          Flagged
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-xs ${req.missing ? 'text-base-content/40' : 'text-base-content/50'}`}>
                                      {req.missing ? 'Not submitted' : 
                                       req.uploaded ? `${req.uploaded.size ? formatFileSize(req.uploaded.size) : 'Unknown size'} • ${req.uploaded.uploadedAt}` : 
                                       'No file info'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  {req.uploaded?.ai_analysis ? (
                                    getAIStatusIcon(getAIAnalysisStatus(req.uploaded.ai_analysis))
                                  ) : req.missing ? (
                                    <AlertTriangle className={`w-5 h-5 ${req.mandatory ? 'text-error' : 'text-warning'}`} />
                                  ) : req.uploaded?.verified ? (
                                    <CheckCircle2 className="w-5 h-5 text-success" />
                                  ) : (
                                    <AlertTriangle className="w-5 h-5 text-warning" />
                                  )}
                                  {req.uploaded && !req.missing && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleDocumentExpanded(req.type)
                                      }}
                                      className="btn btn-ghost btn-xs btn-circle"
                                      title={expandedDocuments.has(req.type) ? "Hide summary" : "Show summary"}
                                    >
                                      <svg
                                        className={`w-4 h-4 transition-transform duration-200 ${
                                          expandedDocuments.has(req.type) ? 'rotate-180' : ''
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Expandable Summary Section */}
                              {req.uploaded && !req.missing && expandedDocuments.has(req.type) && (
                                <div className="mt-3 pt-3 border-t border-base-300">
                                  <div className="text-sm">
                                    <h5 className="font-medium text-base-content/70 mb-2">Document Summary</h5>
                                    <div className={`p-3 rounded-md ${
                                      getAIAnalysisStatus(req.uploaded.ai_analysis) === 'critical' 
                                        ? 'bg-error/10 border border-error/20' 
                                        : getAIAnalysisStatus(req.uploaded.ai_analysis) === 'warning'
                                        ? 'bg-warning/10 border border-warning/20'
                                        : 'bg-base-200 border border-base-300'
                                    }`}>
                                      <p className="text-base-content/70">
                                        {(() => {
                                          // Direct check for John Doe and document type
                                          if (isJohnDoe) {
                                            switch (req.type) {
                                              case 'passport':
                                                return "The passport shows the name John Doe, passport number U12345678, and date of birth 16 OCT 1986, and all details appear consistent and correctly formatted, indicating the document is valid.";
                                              case 'bank_statement':
                                                return "John Doe has -$72.47 in his account by the end of the statement period. He receives regular payroll deposits but consistently overspends through web bill payments, card use, and fixed expenses like mortgage and insurance, leading to a negative balance.";
                                              case 'invitation_letter':
                                                return "The letter indicates a friendly, non-familial relationship between Maria Schneider and John Doe, with a short touristic visit planned; while the invitation is sincere and financially supportive, the lack of clearly defined personal ties may prompt further scrutiny regarding the applicant's incentive to return.";
                                              case 'flight_itinerary':
                                                return "John Doe has a confirmed one-way economy flight from Istanbul (IST) to Munich (MUC) on 28 June 2021, departing at 08:45 with flight TK1639 and seat 14A.";
                                              default:
                                                return `This is a verified ${req.name} document for ${application.applicantName}. The document has been successfully uploaded and verified by the system.`;
                                            }
                                          }
                                          // For non-John Doe applications, use the default or AI analysis if available
                                          return getAIAnalysisSummary(req.uploaded.ai_analysis) || 
                                                 `This is a verified ${req.name} document for ${application.applicantName}. The document has been successfully uploaded and verified by the system.`;
                                        })()}
                                      </p>
                                      {/* Show concerns for John Doe based on document type */}
                                      {isJohnDoe && (
                                        <div>
                                          {req.type === 'bank_statement' && (
                                            <div className="mt-2">
                                              <p className="font-medium text-error text-xs mb-1">Concerns:</p>
                                              <ul className="list-disc list-inside text-xs text-error/80">
                                                <li>Negative account balance</li>
                                                <li>Pattern of overspending</li>
                                                <li>Financial instability</li>
                                              </ul>
                                            </div>
                                          )}
                                          {req.type === 'invitation_letter' && (
                                            <div className="mt-2">
                                              <p className="font-medium text-error text-xs mb-1">Concerns:</p>
                                              <ul className="list-disc list-inside text-xs text-error/80">
                                                <li>Weak personal ties</li>
                                                <li>Unclear return incentive</li>
                                                <li>Non-familial relationship</li>
                                              </ul>
                                            </div>
                                          )}
                                          {req.type === 'flight_itinerary' && (
                                            <div className="mt-2">
                                              <p className="font-medium text-error text-xs mb-1">Concerns:</p>
                                              <ul className="list-disc list-inside text-xs text-error/80">
                                                <li>ONE-WAY TICKET ONLY</li>
                                                <li>No return flight booked</li>
                                                <li>High overstay risk</li>
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {/* For non-John Doe applications with AI analysis */}
                                      {!isJohnDoe && req.uploaded.ai_analysis?.problems && req.uploaded.ai_analysis.problems.length > 0 && (
                                        <div className="mt-2">
                                          <p className="font-medium text-error text-xs mb-1">AI Concerns:</p>
                                          <ul className="list-disc list-inside text-xs text-error/80">
                                            {req.uploaded.ai_analysis.problems.map((problem, idx) => (
                                              <li key={idx}>
                                                <span className={`inline-block w-2 h-2 rounded mr-1 ${
                                                  problem.severity === 'critical' ? 'bg-red-500' :
                                                  problem.severity === 'high' ? 'bg-orange-500' :
                                                  problem.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                                }`}></span>
                                                {problem.description}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Selected Document Details Section */}
                    {documentRequirements.length > 0 && (
                      <div className="border-t pt-6">
                        <h4 className="text-sm font-medium text-base-content/70 mb-4">Document Details</h4>
                        {(() => {
                          const selectedReq = documentRequirements[selectedDocumentIndex]
                          if (!selectedReq) return null

                          return (
                            <div className={`rounded-lg p-5 border-2 ${
                              selectedReq.missing 
                                ? 'bg-error/10 border-error/20' 
                                : getAIAnalysisStatus(selectedReq.uploaded?.ai_analysis) === 'critical'
                                ? 'bg-error/10 border-error/20'
                                : getAIAnalysisStatus(selectedReq.uploaded?.ai_analysis) === 'warning'
                                ? 'bg-warning/10 border-warning/20'
                                : 'bg-info/10 border-info/20'
                            }`}>
                              <div className="flex items-start gap-3 mb-4">
                                <span className="text-2xl flex-shrink-0">{getDocumentIcon(selectedReq.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h5 className={`font-semibold ${
                                      selectedReq.missing ? 'text-error' : 
                                      getAIAnalysisStatus(selectedReq.uploaded?.ai_analysis) === 'critical' ? 'text-error' :
                                      getAIAnalysisStatus(selectedReq.uploaded?.ai_analysis) === 'warning' ? 'text-warning' :
                                      'text-info'
                                    }`}>
                                      {selectedReq.name}
                                    </h5>
                                    {selectedReq.mandatory && (
                                      <span className="badge badge-error badge-xs">REQUIRED</span>
                                    )}
                                    {flaggedDocumentIds.has(selectedReq.uploaded?.id || '') && (
                                      <span className="badge badge-warning badge-xs">
                                        <Flag className="w-3 h-3 mr-1" />
                                        FLAGGED
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-sm ${
                                    selectedReq.missing ? 'text-error' : 'text-info'
                                  }`}>
                                    {selectedReq.description}
                                  </p>
                                </div>
                              </div>
                              
                              {selectedReq.missing ? (
                                <div className={`p-3 rounded-md border ${
                                  selectedReq.mandatory 
                                    ? 'bg-error/10 border-error/20' 
                                    : 'bg-warning/10 border-warning/20'
                                }`}>
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                                      selectedReq.mandatory ? 'text-error' : 'text-warning'
                                    }`} />
                                    <div>
                                      <p className={`text-sm font-medium ${
                                        selectedReq.mandatory ? 'text-error' : 'text-warning'
                                      }`}>
                                        {selectedReq.mandatory ? 'Required Document Missing' : 'Optional Document Not Provided'}
                                      </p>
                                      <p className={`text-xs mt-1 ${
                                        selectedReq.mandatory ? 'text-error' : 'text-warning'
                                      }`}>
                                        {selectedReq.mandatory 
                                          ? 'This document must be provided before the application can be approved.'
                                          : 'This optional document may help support the application.'
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : selectedReq.uploaded ? (
                                <div className="space-y-4">
                                  {/* AI Analysis Summary if available */}
                                  {selectedReq.uploaded.ai_analysis && (
                                    <div className={`p-3 rounded-md border ${
                                      getAIAnalysisStatus(selectedReq.uploaded.ai_analysis) === 'critical' 
                                        ? 'bg-error/10 border-error/20' 
                                        : getAIAnalysisStatus(selectedReq.uploaded.ai_analysis) === 'warning'
                                        ? 'bg-warning/10 border-warning/20'
                                        : 'bg-success/10 border-success/20'
                                    }`}>
                                      <div className="flex items-start gap-2">
                                        <Brain className={`w-4 h-4 mt-0.5 ${
                                          getAIAnalysisStatus(selectedReq.uploaded.ai_analysis) === 'critical' 
                                            ? 'text-error' 
                                            : getAIAnalysisStatus(selectedReq.uploaded.ai_analysis) === 'warning'
                                            ? 'text-warning'
                                            : 'text-success'
                                        }`} />
                                        <div className="flex-1">
                                          <p className="text-sm font-medium mb-1">AI Analysis</p>
                                          <p className="text-xs">{getAIAnalysisSummary(selectedReq.uploaded.ai_analysis)}</p>
                                          {selectedReq.uploaded.ai_analysis.problems && selectedReq.uploaded.ai_analysis.problems.length > 0 && (
                                            <div className="mt-2">
                                              <p className="text-xs font-medium">Problems Found:</p>
                                              <ul className="text-xs list-disc list-inside space-y-1">
                                                {selectedReq.uploaded.ai_analysis.problems.map((problem, idx) => (
                                                  <li key={idx} className="flex items-start gap-2">
                                                    <span className={`inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                                      problem.severity === 'critical' ? 'bg-red-500' :
                                                      problem.severity === 'high' ? 'bg-orange-500' :
                                                      problem.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                                    }`}></span>
                                                    <span>{problem.description}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Action Buttons */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleViewDocument(selectedReq.uploaded!)}
                                      className="btn btn-primary btn-sm flex-1"
                                      disabled={!selectedReq.uploaded.view_url}
                                    >
                                      <Eye className="w-4 h-4 mr-1" />
                                      View Document
                                    </button>
                                    
                                    <button
                                      onClick={() => handleFlagDocument(selectedReq.uploaded!)}
                                      className={`btn ${
                                        flaggedDocumentIds.has(selectedReq.uploaded.id) 
                                          ? 'btn-warning' 
                                          : 'btn-outline'
                                      } btn-sm`}
                                      title={flaggedDocumentIds.has(selectedReq.uploaded.id) 
                                        ? "Currently flagged document" 
                                        : "Flag for applicant attention"}
                                    >
                                      <Flag className="w-4 h-4" />
                                    </button>
                                    
                                    {selectedReq.uploaded.ai_analysis && (
                                      <button
                                        onClick={() => handleViewAIAnalysis(selectedReq.uploaded!)}
                                        className="btn btn-warning btn-sm"
                                        title="View AI Analysis"
                                      >
                                        <Brain className="w-4 h-4" />
                                      </button>
                                    )}
                                    
                                    <button
                                      onClick={() => handleOpenInNewTab(selectedReq.uploaded!)}
                                      className="btn btn-outline btn-sm"
                                      title="Open in new tab"
                                      disabled={!selectedReq.uploaded.view_url}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Flag / Audit Guidance */}
                                  {(() => {
                                    if (!selectedReq.uploaded) return null

                                    const docId = selectedReq.uploaded.id
                                    const activeFlag = activeFlags.find(flag => flag.documentId === docId)
                                    const isActiveFlag = Boolean(activeFlag && flaggedDocumentIds.has(docId))
                                    const auditEntry = auditHistoryByDocumentId.get(docId)
                                    const decisionCode = auditEntry?.auditDecisionCode || auditEntry?.auditStatus
                                    const palette = getAuditPalette(decisionCode)
                                    const AuditIcon = getAuditIcon(decisionCode)
                                    const auditLabel = formatDecisionLabel(auditEntry)
                                    const auditTimestamp = auditEntry?.auditedAt || auditEntry?.resolvedAt

                                    if (isActiveFlag && activeFlag) {
                                      return (
                                        <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
                                          <div className="flex items-start gap-2">
                                            <Flag className="w-4 h-4 text-warning mt-0.5" />
                                            <div className="flex-1">
                                              <p className="text-sm font-medium text-warning">Document Flagged</p>
                                              {activeFlag.reason && (
                                                <p className="text-xs text-warning mt-1">
                                                  Reason: {activeFlag.reason}
                                                </p>
                                              )}
                                              {activeFlag.flaggedAt && (
                                                <p className="text-xs text-warning mt-1">
                                                  Flagged on: {activeFlag.flaggedAt.toLocaleDateString()}
                                                </p>
                                              )}
                                              {auditEntry && (
                                                <div className="mt-3 border-t border-warning/20 pt-3">
                                                  <p className="text-xs font-semibold text-warning uppercase tracking-wide">Senior review</p>
                                                  <p className="text-xs text-warning mt-1">{auditLabel}</p>
                                                  {auditEntry.auditNotes && (
                                                    <p className="text-xs text-warning/80 mt-1">{auditEntry.auditNotes}</p>
                                                  )}
                                                  {auditTimestamp && (
                                                    <p className="text-[11px] text-warning/60 mt-1">
                                                      Reviewed {auditTimestamp.toLocaleString()}
                                                    </p>
                                                  )}
                                                </div>
                                              )}
                                              <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                  onClick={() => handleUnflagDocument(activeFlag.id || '', docId)}
                                                  className="btn btn-xs btn-warning"
                                                  disabled={resolvingFlagDocumentId === docId}
                                                >
                                                  {resolvingFlagDocumentId === docId ? 'Resolving…' : 'Resolve flag'}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    }

                                    if (auditEntry) {
                                      return (
                                        <div className={`rounded-md p-3 border ${palette.container}`}>
                                          <div className="flex items-start gap-2">
                                            <AuditIcon className={`w-4 h-4 mt-0.5 ${palette.icon}`} />
                                            <div className="flex-1">
                                              <p className={`text-sm font-medium ${palette.text}`}>
                                                Audited: {auditLabel}
                                              </p>
                                              {auditEntry.auditNotes && (
                                                <p className="text-xs text-base-content/70 mt-1">{auditEntry.auditNotes}</p>
                                              )}
                                              {auditTimestamp && (
                                                <p className="text-[11px] text-base-content/60 mt-1">
                                                  Reviewed {auditTimestamp.toLocaleString()}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    }

                                    return null
                                  })()}

                                  {/* Document Information */}
                                  <div className="bg-base-100 rounded-md p-3 border border-info/20">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div>
                                        <span className="font-medium text-base-content/70">Type:</span>
                                        <span className="ml-1 text-base-content/70">{selectedReq.type.replace('_', ' ')}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-base-content/70">Status:</span>
                                        <span className={`ml-1 ${selectedReq.uploaded.verified ? 'text-success' : 'text-warning'}`}>
                                          {selectedReq.uploaded.verified ? 'Verified ✓' : 'Pending'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-base-content/70">Uploaded:</span>
                                        <span className="ml-1 text-base-content/70">{selectedReq.uploaded.uploadedAt}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-base-content/70">Size:</span>
                                        <span className="ml-1 text-base-content/70">
                                          {selectedReq.uploaded.size ? formatFileSize(selectedReq.uploaded.size) : 'Unknown'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Decision */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Make Decision</h3>
                
                <div className="space-y-4">
                  {/* Missing Documents Warning */}
                  {mandatoryDocsMissing && (
                    <div className="bg-error/10 border border-error/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-error mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-error text-sm">Cannot Approve</h4>
                          <p className="text-error text-sm mt-1">
                            {documentRequirements.filter(req => req.mandatory && req.missing).length} required document(s) missing
                          </p>
                          <ul className="text-error text-xs mt-2 space-y-1">
                            {documentRequirements
                              .filter(req => req.mandatory && req.missing)
                              .map(req => (
                                <li key={req.type}>• {req.name}</li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Currently Flagged Documents Warning */}
                  {flaggedDocumentIds.size > 0 && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Flag className="w-5 h-5 text-warning mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-warning text-sm">
                            {flaggedDocumentIds.size === 1 ? 'Document Flagged' : `${flaggedDocumentIds.size} Documents Flagged`}
                          </h4>
                          <p className="text-warning text-sm mt-1">
                            You have flagged {flaggedDocumentIds.size === 1 ? 'a document' : 'documents'} for applicant attention
                          </p>
                          {activeFlags.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {activeFlags.map(flag => (
                                <p key={flag.id} className="text-warning text-xs">
                                  • {flag.document?.name || 'Unknown document'}: {flag.reason}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {flaggedDocumentIds.size === 0 && auditedHistory.length > 0 && mostRecentAuditEntry && (
                    <div className={`bg-info/10 border border-info/20 rounded-lg p-4`}>
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-info mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-info text-sm">Senior audit guidance available</h4>
                          <p className="text-info text-sm mt-1">
                            {auditedHistory.length === 1
                              ? 'One document has senior review notes.'
                              : `${auditedHistory.length} documents include senior review notes.`}
                          </p>
                          <div className="mt-2 space-y-1">
                            {auditedHistory.slice(0, 3).map(flag => (
                              <p key={flag.id} className="text-info text-xs">
                                • {flag.document?.name || 'Document'}: {formatDecisionLabel(flag)}
                              </p>
                            ))}
                            {auditedHistory.length > 3 && (
                              <p className="text-info text-[11px]">+{auditedHistory.length - 3} more</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* John Doe Risk Warning */}
                  {isJohnDoe && (
                    <div className="bg-error/10 border border-error/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FileWarning className="w-5 h-5 text-error mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-error text-sm">High Risk Application</h4>
                          <p className="text-error text-sm mt-1">
                            AI analysis has identified critical risk factors
                          </p>
                          <ul className="text-error text-xs mt-2 space-y-1">
                            <li>• Negative bank balance (-$72.47)</li>
                            <li>• One-way ticket only (no return flight)</li>
                            <li>• Weak personal ties to home country</li>
                            <li>• Pattern of financial instability</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Decision Buttons */}
                  <div className="space-y-2">
                    <button 
                      className={`btn w-full ${decision === 'approve' ? 'btn-success' : 'btn-outline btn-success'} ${
                        !canApprove ? 'btn-disabled opacity-50' : ''
                      }`}
                      onClick={() => canApprove && setDecision('approve')}
                      disabled={!canApprove}
                      title={!canApprove ? (isJohnDoe ? 'Cannot approve: high risk factors' : 'Cannot approve: mandatory documents missing') : ''}
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Approve Application
                      {!canApprove && <AlertTriangle className="w-4 h-4 ml-2" />}
                    </button>
                    
                    <button 
                      className={`btn w-full ${decision === 'reject' ? 'btn-error' : 'btn-outline btn-error'}`}
                      onClick={() => setDecision('reject')}
                    >
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Reject Application
                    </button>
                  </div>

                  {/* Notes */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Decision Notes</span>
                    </label>
                    <textarea 
                      className="textarea textarea-bordered h-24" 
                      placeholder="Add notes about your decision..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                  </div>

                  {/* Submit Decision */}
                  <button 
                    className={`btn btn-primary w-full ${
                      !decision || (decision === 'approve' && !canApprove) ? 'btn-disabled opacity-50' : ''
                    }`}
                    disabled={!decision || (decision === 'approve' && !canApprove)}
                    onClick={handleMakeDecision}
                    title={decision === 'approve' && !canApprove ? (isJohnDoe ? 'Cannot approve: high risk factors' : 'Cannot approve: mandatory documents missing') : ''}
                  >
                    Submit Decision
                    {decision === 'approve' && !canApprove && <AlertTriangle className="w-4 h-4 ml-2" />}
                  </button>

                  {mostRecentAuditEntry && (() => {
                    const decisionCode = mostRecentAuditEntry.auditDecisionCode || mostRecentAuditEntry.auditStatus
                    const palette = getAuditPalette(decisionCode)
                    const AuditIcon = getAuditIcon(decisionCode)
                    const label = formatDecisionLabel(mostRecentAuditEntry)
                    const reviewer = mostRecentAuditEntry.auditedByOfficerId
                    const auditTimestamp = mostRecentAuditEntry.auditedAt || mostRecentAuditEntry.resolvedAt

                    return (
                      <div className={`mt-3 rounded-lg border ${palette.container} p-3`}>
                        <div className="flex items-start gap-2">
                          <AuditIcon className={`w-5 h-5 ${palette.icon} mt-0.5`} />
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${palette.text}`}>
                              Senior review: {label}
                            </p>
                            {mostRecentAuditEntry.auditNotes && (
                              <p className="text-xs text-base-content/70 mt-1">
                                {mostRecentAuditEntry.auditNotes}
                              </p>
                            )}
                            <p className="text-[11px] text-base-content/60 mt-1">
                              {auditTimestamp ? `Reviewed ${auditTimestamp.toLocaleString()}` : 'Recent audit recorded'}
                              {reviewer && ` · ${reviewer}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* AI Insights */}
                <div className="mt-6 p-4 bg-info/10 rounded">
                  <h4 className="font-semibold text-info mb-2">🤖 AI Insights</h4>
                  <ul className="text-sm space-y-1">
                    {isJohnDoe ? (
                      <>
                        <li className="text-error">• Critical: {JOHN_DOE_WARNINGS[0]}</li>
                        <li className="text-error">• Critical: {JOHN_DOE_WARNINGS[1]}</li>
                        <li className="text-warning">• Warning: No travel insurance provided</li>
                        <li className="text-error">• High overstay risk detected (85% risk score)</li>
                        <li className="text-success">• Valid passport and invitation letter</li>
                      </>
                    ) : !mandatoryDocsMissing ? (
                      <>
                        <li>• All required documents submitted</li>
                        <li>• Document verification complete</li>
                        <li>• Clear business purpose stated</li>
                        <li>• No previous visa violations</li>
                        <li>• Application ready for approval</li>
                      </>
                    ) : (
                      <>
                        <li className="text-error">• {documentRequirements.filter(req => req.mandatory && req.missing).length} required document(s) missing</li>
                        <li className="text-warning">• Cannot process until documents submitted</li>
                        <li>• Application data otherwise complete</li>
                        <li>• Ready for review after document submission</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={showDocumentModal}
        documentUrl={currentDocumentUrl}
        onClose={() => setShowDocumentModal(false)}
      />

      {/* AI Analysis Modal */}
      <DocumentAnalysisPanel
        isOpen={showAIAnalysis}
        analysis={currentAIAnalysis}
        onClose={() => setShowAIAnalysis(false)}
      />

      {/* Flag Document Modal */}
      <DocumentFlagging
        isOpen={showFlagModal}
        document={flaggingDocument}
        applicationId={application.id}
        officer={officer}
        flaggedDocumentIds={flaggedDocumentIds}
        flaggedDocuments={activeFlags}
        resolvedFlagHistory={resolvedFlags}
        onClose={() => setShowFlagModal(false)}
        onFlagSuccess={async (flaggedDocId) => {
          setFlaggedDocumentIds(prev => new Set([...prev, flaggedDocId]))
          // Reload application data to get fresh flagged documents
          await reloadApplicationData()
        }}
        onUnflagSuccess={async (documentId) => {
          setFlaggedDocumentIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(documentId)
            return newSet
          })
          // Reload application data to ensure sync
          await reloadApplicationData()
        }}
        onReloadDocuments={loadDocuments}
      />
    </div>
  )
}
