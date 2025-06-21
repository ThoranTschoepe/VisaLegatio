'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, FileText, Download, Eye, X, Maximize2, ExternalLink, AlertCircle } from 'lucide-react'
import { EmbassyApplication, Officer, EmbassyDocument } from '@/types/embassy.types'
import { api } from '@/utils/api'

interface ApplicationReviewProps {
  application: EmbassyApplication
  onBack: () => void
  onUpdateStatus: (id: string, status: EmbassyApplication['status']) => void
  officer: Officer
}

interface DocumentWithUrls extends EmbassyDocument {
  view_url?: string
  download_url?: string
  file_exists?: boolean
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
      
      // Get documents with view/download URLs from backend
      const response = await fetch(`http://localhost:8000/api/documents/list/${application.id}`)
      
      if (response.ok) {
        const docs = await response.json()
        console.log('📄 Loaded documents from backend:', docs)
        
        // Convert relative URLs to full URLs and ensure proper format
        const docsWithFullUrls = docs.map((doc: any) => ({
          ...doc,
          view_url: doc.view_url ? `http://localhost:8000${doc.view_url}` : null,
          download_url: doc.download_url ? `http://localhost:8000${doc.download_url}` : null,
          uploadedAt: doc.uploaded_at,
          verified: doc.verified
        }))
        
        setDocuments(docsWithFullUrls)
        console.log('✅ Documents processed with full URLs:', docsWithFullUrls)
      } else {
        console.warn('⚠ Failed to load documents from backend, using API fallback')
        
        // Fallback to basic document list with correct URL construction
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
            // Correct URL format: /api/documents/view/{application_id}/{document_name}
            view_url: `http://localhost:8000/api/documents/view/${application.id}/${doc.name}`,
            download_url: `http://localhost:8000/api/documents/download/${application.id}/${doc.name}`,
            file_exists: true
          }))
          setDocuments(docsWithUrls)
          console.log('✅ Documents loaded via API fallback:', docsWithUrls)
        } catch (apiError) {
          console.error('❌ API fallback also failed:', apiError)
          setDocumentError('Failed to load documents via API')
          setDocuments(createMockDocuments())
        }
      }
    } catch (error) {
      console.error('❌ Error loading documents:', error)
      setDocumentError('Failed to load documents')
      
      // Create mock documents for demo with proper URLs
      setDocuments(createMockDocuments())
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
        view_url: `http://localhost:8000/api/documents/view/${application.id}/passport.pdf`,
        download_url: `http://localhost:8000/api/documents/download/${application.id}/passport.pdf`,
        file_exists: true
      },
      {
        id: '2',
        name: 'photo.jpg',
        type: 'photo',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 512000,
        view_url: `http://localhost:8000/api/documents/view/${application.id}/photo.jpg`,
        download_url: `http://localhost:8000/api/documents/download/${application.id}/photo.jpg`,
        file_exists: true
      },
      {
        id: '3',
        name: 'bank_statement.pdf',
        type: 'bank_statement',
        verified: true,
        uploadedAt: '2024-01-15',
        size: 1024000,
        view_url: `http://localhost:8000/api/documents/view/${application.id}/bank_statement.pdf`,
        download_url: `http://localhost:8000/api/documents/download/${application.id}/bank_statement.pdf`,
        file_exists: true
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

  const handleMakeDecision = () => {
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

    console.log('👁 Opening document:', document.view_url)
    
    // Open in modal directly - no need to test URL first
    setCurrentDocumentUrl(document.view_url)
    setShowDocumentModal(true)
  }

  const handleDownloadDocument = (document: DocumentWithUrls) => {
    if (!document.download_url) {
      alert('Download URL not available')
      return
    }

    console.log('⬇ Downloading document:', document.download_url)
    
    // Create a temporary link to trigger download
    const link = document.createElement('a')
    link.href = document.download_url
    link.download = document.name
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenInNewTab = (document: DocumentWithUrls) => {
    if (!document.view_url) {
      alert('Document URL not available')
      return
    }

    console.log('🔗 Opening document in new tab:', document.view_url)
    window.open(document.view_url, '_blank')
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
              <div className="card-body">
                <h3 className="card-title">Documents ({documents.length})</h3>
                
                {/* Document Error */}
                {documentError && (
                  <div className="alert alert-warning">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <h4 className="font-semibold">Document Loading Issue</h4>
                      <p className="text-sm">{documentError} - Using demo documents for review</p>
                    </div>
                  </div>
                )}
                
                {isLoadingDocuments ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="loading loading-spinner loading-md"></div>
                    <span className="ml-2">Loading documents...</span>
                  </div>
                ) : (
                  <>
                    {/* Document List */}
                    <div className="space-y-2 mb-4">
                      {documents.map((doc, index) => (
                        <div 
                          key={doc.id}
                          className={`p-3 rounded border cursor-pointer transition-colors ${selectedDocumentIndex === index ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => setSelectedDocumentIndex(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{getDocumentIcon(doc.type)}</span>
                              <div>
                                <p className="font-semibold text-sm">{doc.name}</p>
                                <p className="text-xs text-gray-600">
                                  {doc.size ? formatFileSize(doc.size) : 'Unknown size'} • {doc.uploadedAt}
                                </p>
                                {!doc.file_exists && (
                                  <p className="text-xs text-red-600">File not accessible</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.verified ? (
                                <CheckCircle2 className="w-5 h-5 text-success" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-warning" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Document Actions */}
                    {documents.length > 0 && (
                      <div className="space-y-3">
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <h4 className="font-semibold mb-3">
                            {getDocumentIcon(documents[selectedDocumentIndex].type)} {documents[selectedDocumentIndex].name}
                          </h4>
                          
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => handleViewDocument(documents[selectedDocumentIndex])}
                              className="btn btn-primary btn-sm flex-1"
                              disabled={!documents[selectedDocumentIndex].view_url}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </button>
                            

                            
                            <button
                              onClick={() => handleOpenInNewTab(documents[selectedDocumentIndex])}
                              className="btn btn-ghost btn-sm"
                              title="Open in new tab"
                              disabled={!documents[selectedDocumentIndex].view_url}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-xs text-gray-600 space-y-1">
                            <p><strong>Type:</strong> {documents[selectedDocumentIndex].type.replace('_', ' ')}</p>
                            <p><strong>Status:</strong> {documents[selectedDocumentIndex].verified ? 'Verified ✓' : 'Pending Verification'}</p>
                            <p><strong>Uploaded:</strong> {documents[selectedDocumentIndex].uploadedAt}</p>
                            {documents[selectedDocumentIndex].view_url && (
                              <p className="break-all"><strong>URL:</strong> 
                                <span className="text-blue-600 ml-1 text-xs">
                                  {documents[selectedDocumentIndex].view_url}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {documents.length === 0 && (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">No documents uploaded yet</p>
                      </div>
                    )}
                  </>
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
                  {/* Decision Buttons */}
                  <div className="space-y-2">
                    <button 
                      className={`btn w-full ${decision === 'approve' ? 'btn-success' : 'btn-outline btn-success'}`}
                      onClick={() => setDecision('approve')}
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Approve Application
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
                    className="btn btn-primary w-full"
                    disabled={!decision}
                    onClick={handleMakeDecision}
                  >
                    Submit Decision
                  </button>
                </div>

                {/* AI Insights */}
                <div className="mt-6 p-4 bg-info/10 rounded">
                  <h4 className="font-semibold text-info mb-2">🤖 AI Insights</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Strong financial documentation</li>
                    <li>• Clear business purpose stated</li>
                    <li>• No previous visa violations</li>
                    <li>• All required documents present</li>
                  </ul>
                  <div className="mt-2">
                    <span className="badge badge-success">85% Approval Confidence</span>
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