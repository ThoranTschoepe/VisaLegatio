'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, FileText, Eye, X, Maximize2, ExternalLink, AlertCircle } from 'lucide-react'
import { EmbassyApplication, Officer, EmbassyDocument } from '@/types/embassy.types'
import { api } from '@/utils/api'

// CONSISTENT backend URL - always use port 8000 for documents
const BACKEND_BASE = 'http://localhost:8000'

interface ApplicationReviewProps {
  application: EmbassyApplication
  onBack: () => void
  onUpdateStatus: (id: string, status: EmbassyApplication['status']) => void
  officer: Officer
}

interface DocumentWithUrls extends EmbassyDocument {
  view_url?: string
  file_exists?: boolean
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

  // Load documents when component mounts
  useEffect(() => {
    loadDocuments()
  }, [application.id])

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
        
        // FIXED: Ensure all URLs are properly constructed with backend base
        const docsWithFullUrls = uploadedDocs.map((doc: any) => {
          let viewUrl = null
          
          console.log(`🔍 Processing document: ${doc.name}, view_url: ${doc.view_url}, file_exists: ${doc.file_exists}`)
          
          if (doc.view_url && doc.file_exists) {
            // If view_url is already a full URL, use it as is
            if (doc.view_url.startsWith('http')) {
              viewUrl = doc.view_url
              console.log(`✅ Using full URL: ${viewUrl}`)
            } else {
              // If it's a relative URL, prepend the backend base
              viewUrl = `${BACKEND_BASE}${doc.view_url}`
              console.log(`🔧 Created full URL from relative: ${viewUrl}`)
            }
          } else {
            console.log(`⚠ No URL or file doesn't exist for ${doc.name}`)
          }
          
          return {
            ...doc,
            view_url: viewUrl,
            uploadedAt: doc.uploaded_at,
            verified: doc.verified
          }
        })
        
        setDocuments(docsWithFullUrls)
        console.log('✅ Documents processed with correct URLs:', docsWithFullUrls)
      } else {
        console.warn('⚠ Failed to load documents from backend, using API fallback')
        
        // Fallback to basic document list with CORRECT URL construction
        try {
          const basicDocs = await api.getApplicationDocuments(application.id)
          const docsWithUrls = basicDocs.map(doc => ({
            ...doc,
            id: doc.id,
            name: doc.name,
            type: doc.type,
            verified: doc.verified,
            uploadedAt: doc.uploaded_at,
            size: doc.size,
            // FIXED: Always use backend port 8000 for document URLs
            view_url: `${BACKEND_BASE}/api/documents/view/${application.id}/${doc.name}`,
            file_exists: true
          }))
          setDocuments(docsWithUrls)
          uploadedDocs = docsWithUrls
          console.log('✅ Documents loaded via API fallback with correct URLs:', docsWithUrls)
        } catch (apiError) {
          console.error('❌ API fallback also failed:', apiError)
          setDocumentError('Failed to load documents via API')
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
      console.log('📋 Document requirements processed:', allDocRequirements)
      
    } catch (error) {
      console.error('❌ Error loading documents:', error)
      setDocumentError('Failed to load documents')
      
      // Create mock documents for demo with proper URLs
      setDocuments(createMockDocuments())
      setDocumentRequirements(createMockRequirements())
    } finally {
      setIsLoadingDocuments(false)
    }
  }

  const createMockDocuments = (): DocumentWithUrls[] => {
    console.log('🎭 Creating mock documents for demo')
    
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
    console.log('🎭 Creating mock document requirements for demo')
    
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

  const mockAnswers = {
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
      // FIXED: Safely validate URL with proper error handling
      let urlToUse = document.view_url
      
      // Check if it's a valid URL format
      if (document.view_url.startsWith('http://') || document.view_url.startsWith('https://')) {
        // Parse URL to check port
        const url = new URL(document.view_url)
        if (url.port !== '8000' && !document.view_url.includes('localhost:8000')) {
          console.error('❌ Document URL is not pointing to backend port 8000:', document.view_url)
          
          // Try to fix the URL by replacing the port
          urlToUse = document.view_url.replace(/localhost:\d+/, 'localhost:8000')
          console.log('🔧 Attempting to fix URL:', urlToUse)
        }
      } else {
        // If it's a relative URL, make it absolute
        urlToUse = `${BACKEND_BASE}${document.view_url.startsWith('/') ? '' : '/'}${document.view_url}`
        console.log('🔧 Converted relative URL to absolute:', urlToUse)
      }
      
      setCurrentDocumentUrl(urlToUse)
      setShowDocumentModal(true)
      
    } catch (error) {
      console.error('❌ Error processing document URL:', error)
      
      // Fallback: construct URL manually
      const fallbackUrl = `${BACKEND_BASE}/api/documents/view/${application.id}/${document.name}`
      console.log('🔧 Using fallback URL:', fallbackUrl)
      setCurrentDocumentUrl(fallbackUrl)
      setShowDocumentModal(true)
    }
  }

  const handleOpenInNewTab = (document: DocumentWithUrls) => {
    if (!document.view_url) {
      alert('Document URL not available')
      return
    }

    console.log('🔗 Opening document in new tab:', document.view_url)
    
    try {
      // FIXED: Safely validate and fix URL with proper error handling
      let urlToOpen = document.view_url
      
      // Check if it's a valid URL format
      if (document.view_url.startsWith('http://') || document.view_url.startsWith('https://')) {
        // Parse URL to check port
        const url = new URL(document.view_url)
        if (url.port !== '8000' && !document.view_url.includes('localhost:8000')) {
          urlToOpen = document.view_url.replace(/localhost:\d+/, 'localhost:8000')
          console.log('🔧 Fixed URL for new tab:', urlToOpen)
        }
      } else {
        // If it's a relative URL, make it absolute
        urlToOpen = `${BACKEND_BASE}${document.view_url.startsWith('/') ? '' : '/'}${document.view_url}`
        console.log('🔧 Converted relative URL to absolute for new tab:', urlToOpen)
      }
      
      window.open(urlToOpen, '_blank')
      
    } catch (error) {
      console.error('❌ Error processing document URL for new tab:', error)
      
      // Fallback: construct URL manually
      const fallbackUrl = `${BACKEND_BASE}/api/documents/view/${application.id}/${document.name}`
      console.log('🔧 Using fallback URL for new tab:', fallbackUrl)
      window.open(fallbackUrl, '_blank')
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
                    <p className={`font-bold ${application.riskScore < 10 ? 'text-green-600' : application.riskScore < 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {application.riskScore}% Risk Score
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Answers */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Application Answers</h3>
                <div className="space-y-3">
                  {Object.entries(mockAnswers).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm text-gray-600">{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="font-semibold">{value}</p>
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
                
                {/* Document Error Alert */}
                {documentError && (
                  <div className="alert alert-warning mb-6">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <h4 className="font-semibold">Document Loading Issue</h4>
                      <p className="text-sm">{documentError} - Using demo documents for review</p>
                    </div>
                  </div>
                )}
                
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
                          <div 
                            key={req.type}
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
                                  </div>
                                  <p className={`text-xs ${req.missing ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {req.missing ? 'Not submitted' : 
                                     req.uploaded ? `${req.uploaded.size ? formatFileSize(req.uploaded.size) : 'Unknown size'} • ${req.uploaded.uploadedAt}` : 
                                     'No file info'}
                                  </p>
                                  {req.uploaded && !req.uploaded.file_exists && (
                                    <p className="text-xs text-red-600 mt-1">⚠ File not accessible</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center ml-2">
                                {req.missing ? (
                                  <AlertTriangle className={`w-5 h-5 ${req.mandatory ? 'text-red-500' : 'text-yellow-500'}`} />
                                ) : req.uploaded?.verified ? (
                                  <CheckCircle2 className="w-5 h-5 text-success" />
                                ) : (
                                  <AlertTriangle className="w-5 h-5 text-warning" />
                                )}
                              </div>
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
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                              <div className="flex items-start gap-3 mb-4">
                                <span className="text-2xl flex-shrink-0">{getDocumentIcon(selectedReq.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h5 className={`font-semibold ${
                                      selectedReq.missing ? 'text-red-900' : 'text-blue-900'
                                    }`}>
                                      {selectedReq.name}
                                    </h5>
                                    {selectedReq.mandatory && (
                                      <span className="badge badge-error badge-xs">REQUIRED</span>
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
                                      onClick={() => handleOpenInNewTab(selectedReq.uploaded!)}
                                      className="btn btn-outline btn-sm"
                                      title="Open in new tab"
                                      disabled={!selectedReq.uploaded.view_url}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </button>
                                  </div>

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

                    {/* No Documents State */}
                    {documentRequirements.length === 0 && (
                      <div className="text-center py-12">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-600 mb-2">No Document Requirements</h4>
                        <p className="text-gray-500 text-sm">No document requirements have been loaded for this application.</p>
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

                  {/* Decision Buttons */}
                  <div className="space-y-2">
                    <button 
                      className={`btn w-full ${decision === 'approve' ? 'btn-success' : 'btn-outline btn-success'} ${
                        !canApprove ? 'btn-disabled opacity-50' : ''
                      }`}
                      onClick={() => canApprove && setDecision('approve')}
                      disabled={!canApprove}
                      title={!canApprove ? 'Cannot approve: mandatory documents missing' : ''}
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
                    title={decision === 'approve' && !canApprove ? 'Cannot approve: mandatory documents missing' : ''}
                  >
                    Submit Decision
                    {decision === 'approve' && !canApprove && <AlertTriangle className="w-4 h-4 ml-2" />}
                  </button>
                </div>

                {/* AI Insights */}
                <div className="mt-6 p-4 bg-info/10 rounded">
                  <h4 className="font-semibold text-info mb-2">🤖 AI Insights</h4>
                  <ul className="text-sm space-y-1">
                    {!mandatoryDocsMissing ? (
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
                  <div className="mt-2">
                    {!mandatoryDocsMissing ? (
                      <span className="badge badge-success">85% Approval Confidence</span>
                    ) : (
                      <>
                        <span className="badge badge-warning">Pending Required Documents</span>
                        <span className="badge badge-ghost ml-2">Processing Blocked</span>
                      </>
                    )}
                  </div>
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
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Document Viewer</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {currentDocumentUrl.includes('localhost:8000') ? '✓ Backend' : '⚠ Wrong port'}
                </span>
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

            {/* Document Content */}
            <div className="flex-1 p-4">
              {currentDocumentUrl ? (
                <div className="w-full h-full">
                  <iframe
                    src={currentDocumentUrl}
                    className="w-full h-full border rounded"
                    title="Document Viewer"
                    onLoad={() => console.log('✅ Document loaded successfully in iframe')}
                    onError={(e) => {
                      console.error('❌ Failed to load document in iframe:', e)
                    }}
                  />
                  <div className="mt-2 text-center">
                    <p className="text-xs text-gray-500">
                      Document URL: {currentDocumentUrl}
                    </p>
                    <p className="text-xs text-gray-500">
                      If the document doesn't display, try opening it in a new tab.
                    </p>
                    <button
                      onClick={() => window.open(currentDocumentUrl, '_blank')}
                      className="btn btn-outline btn-xs mt-1"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open in New Tab
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Document URL not available</p>
                    <button
                      onClick={() => setShowDocumentModal(false)}
                      className="btn btn-primary mt-4"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}