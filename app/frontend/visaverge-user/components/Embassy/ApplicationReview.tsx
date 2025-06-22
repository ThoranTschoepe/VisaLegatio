'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, FileText, Eye, X, Maximize2, ExternalLink, AlertCircle, Brain, FileWarning, Flag } from 'lucide-react'
import { EmbassyApplication, Officer, EmbassyDocument } from '@/types/embassy.types'
import { api } from '@/utils/api'
import { useAlertStore } from '@/lib/stores/alert.store'

// CONSISTENT backend URL - always use port 8000 for documents
const BACKEND_BASE = 'http://localhost:8000'

// John Doe AI Analysis Data
const JOHN_DOE_ANALYSIS = {
  passport: {
    summary: "The passport shows the name John Doe, passport number U12345678, and date of birth 16 OCT 1986, and all details appear consistent and correctly formatted, indicating the document is valid.",
    status: "verified",
    concerns: []
  },
  bank_statement: {
    summary: "John Doe has -$72.47 in his account by the end of the statement period. He receives regular payroll deposits but consistently overspends through web bill payments, card use, and fixed expenses like mortgage and insurance, leading to a negative balance.",
    status: "warning",
    concerns: ["Negative account balance", "Pattern of overspending", "Financial instability"]
  },
  invitation_letter: {
    summary: "The letter indicates a friendly, non-familial relationship between Maria Schneider and John Doe, with a short touristic visit planned; while the invitation is sincere and financially supportive, the lack of clearly defined personal ties may prompt further scrutiny regarding the applicant's incentive to return.",
    status: "warning",
    concerns: ["Weak personal ties", "Unclear return incentive", "Non-familial relationship"]
  },
  flight_itinerary: {
    summary: "John Doe has a confirmed one-way economy flight from Istanbul (IST) to Munich (MUC) on 28 June 2021, departing at 08:45 with flight TK1639 and seat 14A.",
    status: "critical",
    concerns: ["ONE-WAY TICKET ONLY", "No return flight booked", "High overstay risk"]
  }
}

const JOHN_DOE_WARNINGS = [
  "Applicant shows financial instability with a negative account balance despite regular income.",
  "One-way flight and weak personal ties raise concerns about return intention."
]

interface ApplicationReviewProps {
  application: EmbassyApplication
  onBack: () => void
  onUpdateStatus: (id: string, status: EmbassyApplication['status']) => void
  officer: Officer
}

interface DocumentWithUrls extends EmbassyDocument {
  view_url?: string
  file_exists?: boolean
  ai_analysis?: {
    summary: string
    status: string
    concerns: string[]
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
  officer 
}: ApplicationReviewProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState(0)
  const [documents, setDocuments] = useState<DocumentWithUrls[]>([])
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState('')
  const [documentError, setDocumentError] = useState('')
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [currentAIAnalysis, setCurrentAIAnalysis] = useState<any>(null)
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set())
  
  // Flag document states
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flaggingDocument, setFlaggingDocument] = useState<DocumentWithUrls | null>(null)
  const [flagReason, setFlagReason] = useState('')
  const [currentFlaggedDocId, setCurrentFlaggedDocId] = useState<string | null>(null)
  
  const { showSuccess, showError } = useAlertStore()

  // Check if this is John Doe's application
  const isJohnDoe = application.applicantName === 'John Doe' || application.id === 'VSV-240105-JDOE'

  // Load documents when component mounts
  useEffect(() => {
    loadDocuments()
  }, [application.id])

  // Load current flagged document
  useEffect(() => {
    if (application.flaggedDocumentId) {
      setCurrentFlaggedDocId(application.flaggedDocumentId)
    }
  }, [application])

  const loadDocuments = async () => {
    try {
      setIsLoadingDocuments(true)
      setDocumentError('')
      
      console.log(`🔍 Loading documents for application: ${application.id}`)
      
      // Load document requirements first
      const requirements = await api.getDocumentRequirements(application.visaType as any)
      console.log('📋 Document requirements loaded:', requirements)
      
      // Get documents with view URLs from backend
      const response = await fetch(`${BACKEND_BASE}/api/documents/list/${application.id}`)
      
      let uploadedDocs: any[] = []
      
      if (response.ok) {
        uploadedDocs = await response.json()
        console.log('📄 Loaded documents from backend:', uploadedDocs)
        
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
              aiAnalysis = JOHN_DOE_ANALYSIS.passport
            } else if (doc.type === 'bank_statement') {
              aiAnalysis = JOHN_DOE_ANALYSIS.bank_statement
            } else if (doc.type === 'invitation_letter') {
              aiAnalysis = JOHN_DOE_ANALYSIS.invitation_letter
            } else if (doc.type === 'flight_itinerary') {
              aiAnalysis = JOHN_DOE_ANALYSIS.flight_itinerary
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
      } else {
        // Fallback or create John Doe demo documents
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

      // Create comprehensive document requirements list
      const documentNames = {
        passport: 'Passport (Photo Page)',
        photo: 'Passport Photo',
        bank_statement: 'Bank Statement',
        invitation_letter: 'Invitation Letter',
        travel_insurance: 'Travel Insurance',
        employment_letter: 'Employment Letter',
        flight_itinerary: 'Flight Itinerary'
      }

      const documentDescriptions = {
        passport: 'Clear photo of your passport information page',
        photo: 'Recent passport-sized photo (white background)',
        bank_statement: 'Last 3 months bank statements showing sufficient funds',
        invitation_letter: 'Official invitation letter from host organization',
        travel_insurance: 'Valid travel insurance covering your entire stay',
        employment_letter: 'Letter from employer confirming your employment',
        flight_itinerary: 'Flight booking confirmation or itinerary'
      }

      // Create comprehensive document list
      const allDocRequirements: DocumentRequirement[] = []

      // Add mandatory documents
      requirements.mandatory_documents.forEach(docType => {
        const uploadedDoc = uploadedDocs.find(doc => doc.type === docType)
        allDocRequirements.push({
          type: docType,
          name: documentNames[docType] || docType,
          description: documentDescriptions[docType] || `Required ${docType.replace('_', ' ')}`,
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
          name: documentNames[docType] || docType,
          description: documentDescriptions[docType] || `Optional ${docType.replace('_', ' ')}`,
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
        const url = new URL(document.view_url)
        if (url.port !== '8000' && !document.view_url.includes('localhost:8000')) {
          urlToUse = document.view_url.replace(/localhost:\d+/, 'localhost:8000')
        }
      } else {
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
        const url = new URL(document.view_url)
        if (url.port !== '8000' && !document.view_url.includes('localhost:8000')) {
          urlToOpen = document.view_url.replace(/localhost:\d+/, 'localhost:8000')
        }
      } else {
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

  const submitFlagDocument = async () => {
    if (!flaggingDocument) return
    
    try {
      await api.flagDocument(application.id, {
        document_id: flaggingDocument.id,
        reason: flagReason,
        officer_id: officer.id
      })
      
      setCurrentFlaggedDocId(flaggingDocument.id)
      showSuccess(`Document "${flaggingDocument.name}" flagged for applicant review`)
      setShowFlagModal(false)
      setFlagReason('')
      // Reload application data to get updated flag info
      loadDocuments()
    } catch (error) {
      showError('Failed to flag document')
    }
  }

  const handleUnflagDocument = async () => {
    try {
      await api.flagDocument(application.id, {
        officer_id: officer.id
      })
      
      setCurrentFlaggedDocId(null)
      showSuccess('Document flag removed')
      // Reload application data
      loadDocuments()
    } catch (error) {
      showError('Failed to remove flag')
    }
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'passport':
        return '📘'
      case 'photo':
        return '📷'
      case 'bank_statement':
        return '💰'
      case 'invitation_letter':
        return '✉️'
      case 'employment_letter':
        return '💼'
      case 'travel_insurance':
        return '🛡️'
      case 'flight_itinerary':
        return '✈️'
      default:
        return '📄'
    }
  }

  const getAIStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'critical':
        return <FileWarning className="w-4 h-4 text-red-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <button className="btn btn-ghost" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <div className="divider divider-horizontal"></div>
          <h1 className="text-xl font-bold">Application Review</h1>
          {isJohnDoe && (
            <span className="badge badge-warning ml-4">
              <Brain className="w-4 h-4 mr-1" />
              AI Risk Analysis Available
            </span>
          )}
        </div>
        <div className="flex-none">
          <span className="text-sm text-gray-600">Reviewing as: {officer.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Application Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Applicant Info */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Applicant Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold">{application.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Application ID</p>
                    <p className="font-mono text-sm">{application.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Visa Type</p>
                    <span className="badge badge-primary">{application.visaType}</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Country of Origin</p>
                    <p className="font-semibold">{application.country}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Risk Assessment</p>
                    <p className={`font-bold ${
                      isJohnDoe ? 'text-red-600' : 
                      application.riskScore < 10 ? 'text-green-600' : 
                      application.riskScore < 20 ? 'text-yellow-600' : 'text-red-600'
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
                      <p className="text-sm text-gray-600">{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className={`font-semibold ${
                        key === 'return_flight' && value === 'Not booked' ? 'text-red-600' : ''
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
                      <span className="text-sm text-gray-600">Loading documents...</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Document List Section */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Document Requirements</h4>
                      <div className="space-y-3">
                        {documentRequirements.map((req, index) => (
                          <div key={req.type}>
                            <div 
                              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                                selectedDocumentIndex === index 
                                  ? 'border-primary bg-primary/10 shadow-sm' 
                                  : req.missing 
                                  ? 'border-gray-200 bg-gray-50/50' 
                                  : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                              }`}
                              onClick={() => setSelectedDocumentIndex(index)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-xl flex-shrink-0">{getDocumentIcon(req.type)}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className={`font-medium text-sm truncate ${req.missing ? 'text-gray-400' : 'text-gray-900'}`}>
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
                                      {currentFlaggedDocId === req.uploaded?.id && (
                                        <span className="badge badge-warning badge-xs flex-shrink-0">
                                          <Flag className="w-3 h-3 mr-1" />
                                          Flagged
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-xs ${req.missing ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {req.missing ? 'Not submitted' : 
                                       req.uploaded ? `${req.uploaded.size ? formatFileSize(req.uploaded.size) : 'Unknown size'} • ${req.uploaded.uploadedAt}` : 
                                       'No file info'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  {req.uploaded?.ai_analysis ? (
                                    getAIStatusIcon(req.uploaded.ai_analysis.status)
                                  ) : req.missing ? (
                                    <AlertTriangle className={`w-5 h-5 ${req.mandatory ? 'text-red-500' : 'text-yellow-500'}`} />
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
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="text-sm">
                                    <h5 className="font-medium text-gray-700 mb-2">Document Summary</h5>
                                    <div className={`p-3 rounded-md ${
                                      req.uploaded.ai_analysis?.status === 'critical' 
                                        ? 'bg-red-50 border border-red-200' 
                                        : req.uploaded.ai_analysis?.status === 'warning'
                                        ? 'bg-yellow-50 border border-yellow-200'
                                        : 'bg-gray-50 border border-gray-200'
                                    }`}>
                                      <p className="text-gray-700">
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
                                          return req.uploaded.ai_analysis?.summary || 
                                                 `This is a verified ${req.name} document for ${application.applicantName}. The document has been successfully uploaded and verified by the system.`;
                                        })()}
                                      </p>
                                      {/* Show concerns for John Doe based on document type */}
                                      {isJohnDoe && (
                                        <div>
                                          {req.type === 'bank_statement' && (
                                            <div className="mt-2">
                                              <p className="font-medium text-red-800 text-xs mb-1">Concerns:</p>
                                              <ul className="list-disc list-inside text-xs text-red-700">
                                                <li>Negative account balance</li>
                                                <li>Pattern of overspending</li>
                                                <li>Financial instability</li>
                                              </ul>
                                            </div>
                                          )}
                                          {req.type === 'invitation_letter' && (
                                            <div className="mt-2">
                                              <p className="font-medium text-red-800 text-xs mb-1">Concerns:</p>
                                              <ul className="list-disc list-inside text-xs text-red-700">
                                                <li>Weak personal ties</li>
                                                <li>Unclear return incentive</li>
                                                <li>Non-familial relationship</li>
                                              </ul>
                                            </div>
                                          )}
                                          {req.type === 'flight_itinerary' && (
                                            <div className="mt-2">
                                              <p className="font-medium text-red-800 text-xs mb-1">Concerns:</p>
                                              <ul className="list-disc list-inside text-xs text-red-700">
                                                <li>ONE-WAY TICKET ONLY</li>
                                                <li>No return flight booked</li>
                                                <li>High overstay risk</li>
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {/* For non-John Doe applications with AI analysis */}
                                      {!isJohnDoe && req.uploaded.ai_analysis?.concerns && req.uploaded.ai_analysis.concerns.length > 0 && (
                                        <div className="mt-2">
                                          <p className="font-medium text-red-800 text-xs mb-1">Concerns:</p>
                                          <ul className="list-disc list-inside text-xs text-red-700">
                                            {req.uploaded.ai_analysis.concerns.map((concern, idx) => (
                                              <li key={idx}>{concern}</li>
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
                        <h4 className="text-sm font-medium text-gray-700 mb-4">Document Details</h4>
                        {(() => {
                          const selectedReq = documentRequirements[selectedDocumentIndex]
                          if (!selectedReq) return null

                          return (
                            <div className={`rounded-lg p-5 border-2 ${
                              selectedReq.missing 
                                ? 'bg-red-50 border-red-200' 
                                : selectedReq.uploaded?.ai_analysis?.status === 'critical'
                                ? 'bg-red-50 border-red-200'
                                : selectedReq.uploaded?.ai_analysis?.status === 'warning'
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                              <div className="flex items-start gap-3 mb-4">
                                <span className="text-2xl flex-shrink-0">{getDocumentIcon(selectedReq.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h5 className={`font-semibold ${
                                      selectedReq.missing ? 'text-red-900' : 
                                      selectedReq.uploaded?.ai_analysis?.status === 'critical' ? 'text-red-900' :
                                      selectedReq.uploaded?.ai_analysis?.status === 'warning' ? 'text-yellow-900' :
                                      'text-blue-900'
                                    }`}>
                                      {selectedReq.name}
                                    </h5>
                                    {selectedReq.mandatory && (
                                      <span className="badge badge-error badge-xs">REQUIRED</span>
                                    )}
                                    {currentFlaggedDocId === selectedReq.uploaded?.id && (
                                      <span className="badge badge-warning badge-xs">
                                        <Flag className="w-3 h-3 mr-1" />
                                        FLAGGED
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-sm ${
                                    selectedReq.missing ? 'text-red-700' : 'text-blue-700'
                                  }`}>
                                    {selectedReq.description}
                                  </p>
                                </div>
                              </div>
                              
                              {selectedReq.missing ? (
                                <div className={`p-3 rounded-md border ${
                                  selectedReq.mandatory 
                                    ? 'bg-red-100 border-red-300' 
                                    : 'bg-yellow-100 border-yellow-300'
                                }`}>
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                                      selectedReq.mandatory ? 'text-red-600' : 'text-yellow-600'
                                    }`} />
                                    <div>
                                      <p className={`text-sm font-medium ${
                                        selectedReq.mandatory ? 'text-red-900' : 'text-yellow-900'
                                      }`}>
                                        {selectedReq.mandatory ? 'Required Document Missing' : 'Optional Document Not Provided'}
                                      </p>
                                      <p className={`text-xs mt-1 ${
                                        selectedReq.mandatory ? 'text-red-800' : 'text-yellow-800'
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
                                      selectedReq.uploaded.ai_analysis.status === 'critical' 
                                        ? 'bg-red-100 border-red-300' 
                                        : selectedReq.uploaded.ai_analysis.status === 'warning'
                                        ? 'bg-yellow-100 border-yellow-300'
                                        : 'bg-green-100 border-green-300'
                                    }`}>
                                      <div className="flex items-start gap-2">
                                        <Brain className={`w-4 h-4 mt-0.5 ${
                                          selectedReq.uploaded.ai_analysis.status === 'critical' 
                                            ? 'text-red-600' 
                                            : selectedReq.uploaded.ai_analysis.status === 'warning'
                                            ? 'text-yellow-600'
                                            : 'text-green-600'
                                        }`} />
                                        <div className="flex-1">
                                          <p className="text-sm font-medium mb-1">AI Analysis</p>
                                          <p className="text-xs">{selectedReq.uploaded.ai_analysis.summary}</p>
                                          {selectedReq.uploaded.ai_analysis.concerns.length > 0 && (
                                            <div className="mt-2">
                                              <p className="text-xs font-medium">Concerns:</p>
                                              <ul className="text-xs list-disc list-inside">
                                                {selectedReq.uploaded.ai_analysis.concerns.map((concern, idx) => (
                                                  <li key={idx}>{concern}</li>
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
                                        currentFlaggedDocId === selectedReq.uploaded.id 
                                          ? 'btn-warning' 
                                          : 'btn-outline'
                                      } btn-sm`}
                                      title={currentFlaggedDocId === selectedReq.uploaded.id 
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

                                  {/* Currently Flagged Info */}
                                  {currentFlaggedDocId === selectedReq.uploaded.id && (
                                    <div className="bg-yellow-100 border border-yellow-300 rounded-md p-3">
                                      <div className="flex items-start gap-2">
                                        <Flag className="w-4 h-4 text-yellow-600 mt-0.5" />
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-yellow-900">Document Flagged</p>
                                          {application.flaggedDocumentReason && (
                                            <p className="text-xs text-yellow-800 mt-1">
                                              Reason: {application.flaggedDocumentReason}
                                            </p>
                                          )}
                                          {application.flaggedAt && (
                                            <p className="text-xs text-yellow-700 mt-1">
                                              Flagged on: {new Date(application.flaggedAt).toLocaleDateString()}
                                            </p>
                                          )}
                                          <button
                                            onClick={handleUnflagDocument}
                                            className="text-xs text-yellow-700 underline hover:no-underline mt-2"
                                          >
                                            Remove flag
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Document Information */}
                                  <div className="bg-white rounded-md p-3 border border-blue-300">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div>
                                        <span className="font-medium text-gray-700">Type:</span>
                                        <span className="ml-1 text-gray-600">{selectedReq.type.replace('_', ' ')}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Status:</span>
                                        <span className={`ml-1 ${selectedReq.uploaded.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                                          {selectedReq.uploaded.verified ? 'Verified ✓' : 'Pending'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Uploaded:</span>
                                        <span className="ml-1 text-gray-600">{selectedReq.uploaded.uploadedAt}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Size:</span>
                                        <span className="ml-1 text-gray-600">
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
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-red-900 text-sm">Cannot Approve</h4>
                          <p className="text-red-800 text-sm mt-1">
                            {documentRequirements.filter(req => req.mandatory && req.missing).length} required document(s) missing
                          </p>
                          <ul className="text-red-700 text-xs mt-2 space-y-1">
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

                  {/* Currently Flagged Document Warning */}
                  {currentFlaggedDocId && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Flag className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-yellow-900 text-sm">Document Flagged</h4>
                          <p className="text-yellow-800 text-sm mt-1">
                            You have flagged a document for applicant attention
                          </p>
                          {application.flaggedDocumentReason && (
                            <p className="text-yellow-700 text-xs mt-2">
                              Reason: {application.flaggedDocumentReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* John Doe Risk Warning */}
                  {isJohnDoe && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FileWarning className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-red-900 text-sm">High Risk Application</h4>
                          <p className="text-red-800 text-sm mt-1">
                            AI analysis has identified critical risk factors
                          </p>
                          <ul className="text-red-700 text-xs mt-2 space-y-1">
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
                </div>

                {/* AI Insights */}
                <div className="mt-6 p-4 bg-info/10 rounded">
                  <h4 className="font-semibold text-info mb-2">🤖 AI Insights</h4>
                  <ul className="text-sm space-y-1">
                    {isJohnDoe ? (
                      <>
                        <li className="text-red-600">• Critical: {JOHN_DOE_WARNINGS[0]}</li>
                        <li className="text-red-600">• Critical: {JOHN_DOE_WARNINGS[1]}</li>
                        <li className="text-yellow-600">• Warning: No travel insurance provided</li>
                        <li className="text-red-600">• High overstay risk detected (85% risk score)</li>
                        <li className="text-green-600">• Valid passport and invitation letter</li>
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
                        <li className="text-red-600">• {documentRequirements.filter(req => req.mandatory && req.missing).length} required document(s) missing</li>
                        <li className="text-yellow-600">• Cannot process until documents submitted</li>
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
      {showDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Document Viewer</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(currentDocumentUrl, '_blank')}
                  className="btn btn-ghost btn-sm"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDocumentModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <iframe
                src={currentDocumentUrl}
                className="w-full h-full border rounded"
                title="Document Viewer"
              />
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAIAnalysis && currentAIAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="w-5 h-5 text-yellow-600" />
                AI Document Analysis
              </h3>
              <button
                onClick={() => setShowAIAnalysis(false)}
                className="btn btn-ghost btn-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className={`p-4 rounded-lg border-2 ${
                currentAIAnalysis.status === 'critical' 
                  ? 'bg-red-50 border-red-200' 
                  : currentAIAnalysis.status === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start gap-3">
                  {getAIStatusIcon(currentAIAnalysis.status)}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Analysis Summary</h4>
                    <p className="text-sm mb-4">{currentAIAnalysis.summary}</p>
                    
                    {currentAIAnalysis.concerns.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-sm mb-2">Identified Concerns:</h5>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {currentAIAnalysis.concerns.map((concern, idx) => (
                            <li key={idx} className={
                              currentAIAnalysis.status === 'critical' ? 'text-red-700' :
                              currentAIAnalysis.status === 'warning' ? 'text-yellow-700' :
                              'text-green-700'
                            }>{concern}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This AI analysis is provided as a decision support tool. 
                  Officers should use their judgment and consider all factors when making final decisions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flag Document Modal */}
      {showFlagModal && flaggingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Flag className="w-5 h-5 text-warning" />
                Flag Document for Applicant
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Flagging: <strong>{flaggingDocument.name}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  The applicant will see this flag in their status tracker.
                </p>
              </div>
              
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Reason for flagging</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder="e.g., Document unclear, please provide a clearer scan..."
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="alert alert-warning mb-4">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">
                  Only one document can be flagged at a time. Flagging this will replace any previously flagged document.
                </span>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={submitFlagDocument}
                  disabled={!flagReason.trim()}
                  className="btn btn-warning flex-1"
                >
                  Flag Document
                </button>
                <button
                  onClick={() => {
                    setShowFlagModal(false)
                    setFlagReason('')
                  }}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}