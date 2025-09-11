'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { debug, error as logError } from '@/lib/log'
import { Upload, FileText, CheckCircle2, AlertCircle, X, Trash2, ArrowRight, Clock, AlertTriangle, Shield, Loader2, RefreshCw, FileX, Camera } from 'lucide-react'
import { Document, DocumentType, VisaType, DocumentAIAnalysis, DocumentProblem } from '@/types'
import { api, apiUtils } from '@/utils/api'
import { uploadService, UploadProgress } from '@/utils/uploadService'
import { useAlertStore } from '@/lib/stores/alert.store'
import { useUploadStore } from '@/lib/stores/upload.store'

interface DocumentUploadProps {
  visaType: VisaType
  applicationId: string
  onDocumentsChange?: (documents: Document[]) => void
  onComplete?: () => void
  onSkip?: () => void
}

const DOCUMENT_NAMES: Record<string, string> = {
  passport: 'Passport (with Photo Page)',
  bank_statement: 'Bank Statement',
  invitation_letter: 'Invitation Letter',
  travel_insurance: 'Travel Insurance',
  employment_letter: 'Employment Letter',
  flight_itinerary: 'Flight Itinerary'
}

const DOCUMENT_DESCRIPTIONS: Record<string, string> = {
  passport: 'Clear scan of your passport including the photo page',
  bank_statement: 'Last 3 months bank statements showing sufficient funds',
  invitation_letter: 'Official invitation letter from host organization',
  travel_insurance: 'Valid travel insurance covering your entire stay',
  employment_letter: 'Letter from employer confirming your employment',
  flight_itinerary: 'Flight booking confirmation or itinerary'
}

export default function DocumentUpload({ 
  visaType, 
  applicationId, 
  onDocumentsChange, 
  onComplete, 
  onSkip 
}: DocumentUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({})
  const [uploadingDocs, setUploadingDocs] = useState<Set<string>>(new Set())
  const [requirements, setRequirements] = useState<{
    mandatory: string[]
    optional: string[]
  }>({ mandatory: [], optional: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [backendAvailable, setBackendAvailable] = useState(true)
  const { showSuccess, showError, showWarning } = useAlertStore()
  const uploadStore = useUploadStore()
  const prevDocumentsRef = useRef<Document[]>([])

  // Load document requirements and existing documents
  useEffect(() => {
    loadDocumentData()
  }, [visaType, applicationId])

  // Call onDocumentsChange when documents change
  useEffect(() => {
    if (documents !== prevDocumentsRef.current) {
      prevDocumentsRef.current = documents
      onDocumentsChange?.(documents)
    }
  }, [documents, onDocumentsChange])

  const loadDocumentData = async () => {
    try {
      setIsLoading(true)
      
      // Check if backend is available
      const available = await apiUtils.isBackendAvailable()
      setBackendAvailable(available)
      
      if (!available) {
        showError('Backend not available. Please ensure the server is running.')
        setIsLoading(false)
        return
      }
      
      // Load document requirements for this visa type
      const docRequirements = await api.getDocumentRequirements(visaType)
      setRequirements({
        mandatory: docRequirements.mandatory_documents,
        optional: docRequirements.optional_documents
      })
      
      // Load existing documents for this application
      const existingDocs = await api.getApplicationDocuments(applicationId)
      
      // Transform to frontend format
      const transformedDocs: Document[] = existingDocs.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type as DocumentType,
        size: doc.size,
        uploadedAt: new Date(doc.uploaded_at),
        verified: doc.verified,
        url: `http://localhost:8000/api/documents/view/${applicationId}/${doc.name}`
      }))
      
      setDocuments(transformedDocs)
      
    } catch (error) {
      console.error('Error loading document data:', error)
      showError(`Failed to load document requirements: ${apiUtils.formatErrorMessage(error)}`)
      setBackendAvailable(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = useCallback(async (file: File, docType: string) => {
    if (!backendAvailable) {
      showError('Backend not available. Cannot upload documents.')
      return
    }

    // Validate file with preview generation
    const validation = await uploadService.validateFileWithPreview(file)
    if (!validation.valid) {
      showError(validation.error!)
      return
    }

    const uploadId = `${docType}_${Date.now()}`
    setUploadingDocs(prev => new Set([...prev, uploadId]))
    setUploadProgress(prev => ({ ...prev, [uploadId]: { loaded: 0, total: file.size, percentage: 0 } }))

    try {
      debug(`🚀 Starting upload: ${file.name} (${uploadService.formatFileSize(file.size)}) as ${docType}`)
      
      // Use the new upload service with progress tracking
      const uploadedDoc = await uploadService.uploadDocument(
        applicationId,
        file,
        docType,
        {
          onProgress: (progress) => {
            setUploadProgress(prev => ({ ...prev, [uploadId]: progress }))
          },
          onSuccess: (result) => {
            debug(`✅ Upload successful: ${result.name}`)
          },
          onError: (error) => {
            logError('Upload error:', error)
          },
          maxRetries: 3,
          retryDelay: 1000
        }
      )
      
      const newDocument: Document = {
        id: uploadedDoc.id,
        name: uploadedDoc.name,
        type: docType as DocumentType,
        size: uploadedDoc.size,
        uploadedAt: new Date(uploadedDoc.uploaded_at),
        verified: uploadedDoc.verified,
        url: `http://localhost:8000/api/documents/view/${applicationId}/${uploadedDoc.name}`,
        ai_analysis: uploadedDoc.ai_analysis ? {
          ...uploadedDoc.ai_analysis,
          analyzed_at: new Date(uploadedDoc.ai_analysis.analyzed_at)
        } : undefined
      }

      setDocuments(prev => {
        const filtered = prev.filter(doc => doc.type !== docType)
        return [...filtered, newDocument]
      })
      
      showSuccess(`${file.name} uploaded successfully!`)
      
    } catch (error) {
      logError('Error uploading document:', error)
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      showError(`Failed to upload ${file.name}: ${errorMessage}`)
      
      // Check backend availability on network errors
      if (errorMessage.includes('Network') || errorMessage.includes('connection')) {
        const available = await apiUtils.isBackendAvailable()
        setBackendAvailable(available)
        if (!available) {
          showError('Lost connection to server. Please check if the backend is running.')
        }
      }
    } finally {
      setUploadingDocs(prev => {
        const newSet = new Set(prev)
        newSet.delete(uploadId)
        return newSet
      })
      setUploadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[uploadId]
        return newProgress
      })
    }
  }, [applicationId, onDocumentsChange, showSuccess, showError, backendAvailable])

  // Handle file drop (without using hooks)
  const handleFileDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[], docType: string) => {
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0]
      if (error.code === 'file-too-large') {
        showError('File too large. Maximum size is 10MB')
      } else if (error.code === 'file-invalid-type') {
        showError('Invalid file type. Please upload PDF, JPG, or PNG files')
      } else {
        showError(error.message)
      }
      return
    }
    
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0], docType)
    }
  }, [handleFileUpload, showError])

  const removeDocument = async (docType: string) => {
    if (!backendAvailable) {
      showWarning('Backend not available. Cannot delete documents.')
      return
    }

    try {
      await api.deleteDocument(applicationId, docType)
      
      setDocuments(prev => prev.filter(doc => doc.type !== docType))
      
      showSuccess('Document removed successfully')
    } catch (error) {
  logError('Error removing document:', error)
      showError(`Failed to remove document: ${apiUtils.formatErrorMessage(error)}`)
    }
  }

  const getDocumentForType = (docType: string) => {
    return documents.find(doc => doc.type === docType)
  }

  const isUploading = (docType: string) => {
    return Array.from(uploadingDocs).some(id => id.startsWith(docType))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Calculate completion status
  const mandatoryUploaded = requirements.mandatory.filter(docType => 
    documents.find(doc => doc.type === docType && doc.verified)
  ).length
  const mandatoryTotal = requirements.mandatory.length
  const optionalUploaded = requirements.optional.filter(docType => 
    documents.find(doc => doc.type === docType && doc.verified)
  ).length
  
  const mandatoryComplete = mandatoryUploaded === mandatoryTotal
  const processingBlocked = !mandatoryComplete || !backendAvailable

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-base-content/60">Loading document requirements...</p>
        </div>
      </div>
    )
  }

  // Backend unavailable state
  if (!backendAvailable) {
    return (
      <div className="max-w-2xl mx-auto bg-base-100 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-error mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-base-content mb-4">Backend Unavailable</h2>
          <p className="text-base-content/60 mb-6">
            The document upload service is currently unavailable. Please ensure the backend server is running.
          </p>
          <div className="space-y-3">
            <button
              onClick={loadDocumentData}
              className="btn btn-primary"
            >
              <Loader2 className="w-4 h-4 inline mr-2" />
              Retry Connection
            </button>
            <button
              onClick={onSkip}
              className="btn btn-outline ml-3"
            >
              Skip For Now
            </button>
          </div>
          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg text-left">
            <h4 className="font-semibold text-primary mb-2">For Developers:</h4>
            <ul className="text-primary/80 text-sm space-y-1">
              <li>• Make sure the backend server is running on http://localhost:8000</li>
              <li>• Check that the /api/health endpoint is accessible</li>
              <li>• Verify CORS settings allow frontend connections</li>
              <li>• Check console for detailed error messages</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const DocumentUploadCard = ({ docType, isMandatory }: { docType: string, isMandatory: boolean }) => {
    const document = getDocumentForType(docType)
    const uploading = isUploading(docType)
    const currentUploadId = Array.from(uploadingDocs).find(id => id.startsWith(docType))
    const progress = currentUploadId ? uploadProgress[currentUploadId] : null
    
    // Use dropzone hook properly at component level
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
      accept: {
        'application/pdf': ['.pdf'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png']
      },
      maxSize: 10 * 1024 * 1024, // 10MB
      multiple: false,
      disabled: !backendAvailable || uploading,
      onDrop: (acceptedFiles, rejectedFiles) => handleFileDrop(acceptedFiles, rejectedFiles, docType)
    })
    
    return (
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer ${
          isDragActive
            ? 'border-primary bg-primary/10 scale-105'
            : document?.verified
            ? 'border-success bg-success/10'
            : document && !document.verified
            ? 'border-warning bg-warning/10'
            : isMandatory
            ? 'border-error/50 bg-error/10 hover:border-error'
            : 'border-base-300 hover:border-primary'
        }`}
        onClick={(e) => {
          // Prevent dropzone click when clicking buttons
          if ((e.target as HTMLElement).tagName === 'BUTTON') {
            e.stopPropagation()
          }
        }}
      >
        <input {...getInputProps()} />

        {/* Header with mandatory/optional indicator */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-base-content">
            {DOCUMENT_NAMES[docType] || docType}
          </h3>
          <span className={`badge badge-sm ${
            isMandatory ? 'badge-error' : 'badge-warning'
          }`}>
            {isMandatory ? 'REQUIRED' : 'Optional'}
          </span>
        </div>

        <div className="text-center">
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-primary font-medium">Uploading & Verifying...</p>
              
              {/* Progress bar */}
              {progress && (
                <div className="space-y-2">
                  <div className="w-full bg-base-300 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-base-content/60">
                    <span>{progress.percentage}%</span>
                    {progress.speed && (
                      <span>{uploadService.formatSpeed(progress.speed)}</span>
                    )}
                    {progress.timeRemaining && (
                      <span>{uploadService.formatTimeRemaining(progress.timeRemaining)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : document ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                {document.verified ? (
                  <CheckCircle2 className="w-12 h-12 text-success" />
                ) : (
                  <Clock className="w-12 h-12 text-warning" />
                )}
              </div>
              
              <div>
                <p className="font-medium text-base-content">{document.name}</p>
                <p className="text-sm text-base-content/60">{formatFileSize(document.size)}</p>
                <p className={`text-sm font-medium ${
                  document.verified ? 'text-success' : 'text-warning'
                }`}>
                  {document.verified ? 'Verified ✓' : 'Pending Verification ⏳'}
                </p>
              </div>

              {/* AI Analysis removed - only visible to officers */}

              <div className="flex gap-2 justify-center mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    open()
                  }}
                  className="btn btn-primary btn-sm"
                  disabled={!backendAvailable}
                >
                  Replace
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeDocument(docType)
                  }}
                  className="btn btn-error btn-sm"
                  disabled={!backendAvailable}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {document.url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(document.url, '_blank')
                    }}
                    className="btn btn-neutral btn-sm"
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {isDragActive ? (
                <div className="animate-pulse">
                  <Upload className="w-16 h-16 text-primary mx-auto" />
                  <p className="text-primary font-medium mt-2">Drop file here...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-base-content/40 mx-auto" />
                  <div>
                    <p className="text-sm text-base-content/60 mb-3">
                      {DOCUMENT_DESCRIPTIONS[docType] || `Upload your ${docType.replace('_', ' ')}`}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        open()
                      }}
                      disabled={!backendAvailable}
                      className={`btn w-full disabled:opacity-50 disabled:cursor-not-allowed ${
                        isMandatory 
                          ? 'btn-error' 
                          : 'btn-primary'
                      }`}
                    >
                      <FileText className="w-4 h-4 inline mr-2" />
                      Choose File
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        open()
                      }}
                      disabled={!backendAvailable}
                      className="btn btn-outline w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Camera className="w-4 h-4 inline mr-2" />
                      Take Photo
                    </button>
                  </div>
                  
                  <p className="text-xs text-base-content/50">
                    Drag & drop or click to upload<br />
                    Supports: JPG, PNG, PDF (max 10MB)
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto bg-base-100 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className={`text-primary-content p-6 ${
        processingBlocked 
          ? 'bg-gradient-to-r from-error to-warning' 
          : 'bg-gradient-to-r from-primary to-secondary'
      }`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-2">Upload Required Documents</h2>
            <p className="text-primary-content/90 text-sm">
              Application ID: <span className="font-mono">{applicationId}</span>
            </p>
            <p className="text-primary-content/90 text-sm">
              {processingBlocked ? 'Processing is blocked until required documents are uploaded' : 'Ready for processing'}
            </p>
          </div>
          <div className="text-right">
            <div className={`rounded-lg p-3 ${
              processingBlocked ? 'bg-primary-content/20' : 'bg-primary-content/20'
            }`}>
              {processingBlocked ? (
                <AlertTriangle className="w-6 h-6 mx-auto mb-1" />
              ) : (
                <Shield className="w-6 h-6 mx-auto mb-1" />
              )}
              <p className="text-xs">
                {processingBlocked ? 'Processing Blocked' : 'Ready to Process'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Processing Status Alert */}
        {processingBlocked && backendAvailable && (
          <div className="mb-6 bg-error/10 border border-error/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-error mt-0.5" />
              <div>
                <h3 className="font-semibold text-error mb-1">Processing Currently Blocked</h3>
                <p className="text-error/80 text-sm mb-2">
                  Your application has been received, but processing cannot continue until all required documents are uploaded and verified.
                </p>
                <div className="text-sm text-error">
                  <p><strong>Required documents missing:</strong> {mandatoryTotal - mandatoryUploaded} of {mandatoryTotal}</p>
                  <p><strong>Processing status:</strong> Waiting for required documents</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {mandatoryComplete && backendAvailable && (
          <div className="mb-6 bg-success/10 border border-success/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-success mt-0.5" />
              <div>
                <h3 className="font-semibold text-success mb-1">All Required Documents Uploaded!</h3>
                <p className="text-success/80 text-sm mb-2">
                  Your application now has all required documents and can proceed with full processing.
                </p>
                <div className="flex gap-3 text-xs text-success">
                  <span>✓ All required documents verified</span>
                  <span>✓ Processing can continue</span>
                  <span>✓ Faster review possible</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Summary */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="font-medium text-base-content mb-3">Required Documents</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Progress</span>
                <span className="font-bold text-error">{mandatoryUploaded}/{mandatoryTotal}</span>
              </div>
              <div className="w-full bg-error/20 rounded-full h-2">
                <div 
                  className="bg-error h-2 rounded-full transition-all duration-500"
                  style={{ width: `${mandatoryTotal > 0 ? (mandatoryUploaded / mandatoryTotal) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-base-content/60">
                {processingBlocked ? 'Upload required documents to enable processing' : 'All required documents uploaded'}
              </p>
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="font-medium text-base-content mb-3">Optional Documents</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Progress</span>
                <span className="font-bold text-primary">{optionalUploaded}/{requirements.optional.length}</span>
              </div>
              <div className="w-full bg-primary/20 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: requirements.optional.length > 0 ? `${(optionalUploaded / requirements.optional.length) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-base-content/60">
                Optional documents may improve approval chances
              </p>
            </div>
          </div>
        </div>

        {/* Required Documents Section */}
        {requirements.mandatory.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-error" />
              <h3 className="text-xl font-semibold text-base-content">Required Documents</h3>
              <span className="badge badge-error">Processing Blocked Without These</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {requirements.mandatory.map(docType => (
                <DocumentUploadCard key={docType} docType={docType} isMandatory={true} />
              ))}
            </div>
          </div>
        )}

        {/* Optional Documents Section */}
        {requirements.optional.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-semibold text-base-content">Optional Documents</h3>
              <span className="badge badge-warning">May Improve Approval Chances</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {requirements.optional.map(docType => (
                <DocumentUploadCard key={docType} docType={docType} isMandatory={false} />
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          {mandatoryComplete && backendAvailable && (
            <button
              onClick={onComplete}
              className="btn btn-success btn-lg"
            >
              <CheckCircle2 className="w-5 h-5 inline mr-2" />
              Continue Processing
            </button>
          )}
          
          <button
            onClick={onSkip}
            className={`btn btn-lg ${
              processingBlocked
                ? 'btn-outline btn-error'
                : 'btn-outline'
            }`}
          >
            <ArrowRight className="w-5 h-5 inline mr-2" />
            {processingBlocked ? 'Skip For Now (Processing Blocked)' : 'Continue to Status'}
          </button>
        </div>
      </div>
    </div>
  )
}