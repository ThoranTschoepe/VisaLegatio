'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, X, Camera, Trash2, ArrowRight, Clock, AlertTriangle, Shield } from 'lucide-react'
import { Document, DocumentType, VisaType } from '@/types'

interface DocumentUploadProps {
  visaType: VisaType
  applicationId: string
  onDocumentsChange?: (documents: Document[]) => void
  onComplete?: () => void
  onSkip?: () => void
}

// Updated document requirements with mandatory/optional classification
const DOCUMENT_REQUIREMENTS: Record<VisaType, { mandatory: DocumentType[], optional: DocumentType[] }> = {
  tourist: {
    mandatory: ['passport', 'photo', 'bank_statement'],
    optional: ['travel_insurance', 'flight_itinerary']
  },
  business: {
    mandatory: ['passport', 'photo', 'invitation_letter'],
    optional: ['employment_letter', 'bank_statement']
  },
  student: {
    mandatory: ['passport', 'photo', 'invitation_letter', 'bank_statement'],
    optional: ['employment_letter']
  },
  work: {
    mandatory: ['passport', 'photo', 'employment_letter', 'invitation_letter'],
    optional: ['bank_statement']
  },
  family_visit: {
    mandatory: ['passport', 'photo', 'invitation_letter'],
    optional: ['bank_statement', 'employment_letter']
  },
  transit: {
    mandatory: ['passport', 'photo', 'flight_itinerary'],
    optional: []
  }
}

const DOCUMENT_NAMES: Record<DocumentType, string> = {
  passport: 'Passport (Photo Page)',
  photo: 'Passport Photo',
  bank_statement: 'Bank Statement',
  invitation_letter: 'Invitation Letter',
  travel_insurance: 'Travel Insurance',
  employment_letter: 'Employment Letter',
  flight_itinerary: 'Flight Itinerary'
}

const DOCUMENT_DESCRIPTIONS: Record<DocumentType, string> = {
  passport: 'Clear photo of your passport information page',
  photo: 'Recent passport-sized photo (white background)',
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
  const [uploadingDocs, setUploadingDocs] = useState<Set<string>>(new Set())
  const [draggedOver, setDraggedOver] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const requirements = DOCUMENT_REQUIREMENTS[visaType] || { mandatory: [], optional: [] }
  const allDocTypes = [...requirements.mandatory, ...requirements.optional]

  // Simulate document verification
  const verifyDocument = async (file: File, docType: DocumentType): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000))
    return Math.random() > 0.1
  }

  const handleFileUpload = useCallback(async (file: File, docType: DocumentType) => {
    const docId = `${docType}_${Date.now()}`
    
    setUploadingDocs(prev => new Set([...prev, docId]))

    try {
      const verified = await verifyDocument(file, docType)
      
      const newDocument: Document = {
        id: docId,
        name: file.name,
        type: docType,
        size: file.size,
        uploadedAt: new Date(),
        verified,
        url: URL.createObjectURL(file)
      }

      setDocuments(prev => {
        const filtered = prev.filter(doc => doc.type !== docType)
        const updated = [...filtered, newDocument]
        onDocumentsChange?.(updated)
        return updated
      })
    } catch (error) {
      console.error('Error uploading document:', error)
    } finally {
      setUploadingDocs(prev => {
        const newSet = new Set(prev)
        newSet.delete(docId)
        return newSet
      })
    }
  }, [onDocumentsChange])

  const handleDrop = useCallback((e: React.DragEvent, docType: DocumentType) => {
    e.preventDefault()
    setDraggedOver(null)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0], docType)
    }
  }, [handleFileUpload])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, docType: DocumentType) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0], docType)
    }
  }

  const removeDocument = (docType: DocumentType) => {
    setDocuments(prev => {
      const updated = prev.filter(doc => doc.type !== docType)
      onDocumentsChange?.(updated)
      return updated
    })
  }

  const getDocumentForType = (docType: DocumentType) => {
    return documents.find(doc => doc.type === docType)
  }

  const isUploading = (docType: DocumentType) => {
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
  const processingBlocked = !mandatoryComplete

  const DocumentUploadCard = ({ docType, isMandatory }: { docType: DocumentType, isMandatory: boolean }) => {
    const document = getDocumentForType(docType)
    const uploading = isUploading(docType)
    
    return (
      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-all ${
          draggedOver === docType
            ? 'border-blue-500 bg-blue-50'
            : document?.verified
            ? 'border-green-500 bg-green-50'
            : document && !document.verified
            ? 'border-red-500 bg-red-50'
            : isMandatory
            ? 'border-red-300 bg-red-50 hover:border-red-400'
            : 'border-gray-300 hover:border-blue-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDraggedOver(docType)
        }}
        onDragLeave={() => setDraggedOver(null)}
        onDrop={(e) => handleDrop(e, docType)}
      >
        <input
          ref={el => fileInputRefs.current[docType] = el}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => handleFileInput(e, docType)}
          className="hidden"
        />

        {/* Header with mandatory/optional indicator */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-800">
            {DOCUMENT_NAMES[docType]}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-blue-600 font-medium">Uploading & Verifying...</p>
              <p className="text-sm text-gray-600">Please wait while we process your document</p>
            </div>
          ) : document ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                {document.verified ? (
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-red-500" />
                )}
              </div>
              
              <div>
                <p className="font-medium text-gray-800">{document.name}</p>
                <p className="text-sm text-gray-600">{formatFileSize(document.size)}</p>
                <p className={`text-sm font-medium ${
                  document.verified ? 'text-green-600' : 'text-red-600'
                }`}>
                  {document.verified ? 'Verified ✓' : 'Verification Failed ✗'}
                </p>
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => fileInputRefs.current[docType]?.click()}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Replace
                </button>
                <button
                  onClick={() => removeDocument(docType)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 text-gray-400 mx-auto" />
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  {DOCUMENT_DESCRIPTIONS[docType]}
                </p>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => fileInputRefs.current[docType]?.click()}
                  className={`w-full px-4 py-2 rounded-lg transition-colors ${
                    isMandatory 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Choose File
                </button>
                
                <button
                  onClick={() => fileInputRefs.current[docType]?.click()}
                  className="w-full px-4 py-2 border border-gray-400 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Camera className="w-4 h-4 inline mr-2" />
                  Take Photo
                </button>
              </div>
              
              <p className="text-xs text-gray-500">
                Drag & drop or click to upload<br />
                Supports: JPG, PNG, PDF (max 10MB)
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className={`text-white p-6 ${
        processingBlocked 
          ? 'bg-gradient-to-r from-red-600 to-orange-600' 
          : 'bg-gradient-to-r from-blue-600 to-purple-600'
      }`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-2">Upload Required Documents</h2>
            <p className="text-white/90 text-sm">
              Application ID: <span className="font-mono">{applicationId}</span>
            </p>
            <p className="text-white/90 text-sm">
              {processingBlocked ? 'Processing is blocked until required documents are uploaded' : 'Ready for processing'}
            </p>
          </div>
          <div className="text-right">
            <div className={`rounded-lg p-3 ${
              processingBlocked ? 'bg-white/20' : 'bg-white/20'
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
        {processingBlocked ? (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Processing Currently Blocked</h3>
                <p className="text-red-800 text-sm mb-2">
                  Your application has been received, but processing cannot continue until all required documents are uploaded and verified.
                </p>
                <div className="text-sm text-red-700">
                  <p><strong>Required documents missing:</strong> {mandatoryTotal - mandatoryUploaded} of {mandatoryTotal}</p>
                  <p><strong>Processing status:</strong> Waiting for required documents</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">All Required Documents Uploaded!</h3>
                <p className="text-green-800 text-sm mb-2">
                  Your application now has all required documents and can proceed with full processing.
                </p>
                <div className="flex gap-3 text-xs text-green-700">
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
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Required Documents</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Progress</span>
                <span className="font-bold text-red-600">{mandatoryUploaded}/{mandatoryTotal}</span>
              </div>
              <div className="w-full bg-red-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(mandatoryUploaded / mandatoryTotal) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">
                {processingBlocked ? 'Upload required documents to enable processing' : 'All required documents uploaded'}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Optional Documents</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Progress</span>
                <span className="font-bold text-blue-600">{optionalUploaded}/{requirements.optional.length}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: requirements.optional.length > 0 ? `${(optionalUploaded / requirements.optional.length) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-600">
                Optional documents may improve approval chances
              </p>
            </div>
          </div>
        </div>

        {/* Required Documents Section */}
        {requirements.mandatory.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-xl font-semibold text-gray-800">Required Documents</h3>
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
              <FileText className="w-5 h-5 text-blue-500" />
              <h3 className="text-xl font-semibold text-gray-800">Optional Documents</h3>
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
          {mandatoryComplete && (
            <button
              onClick={onComplete}
              className="px-8 py-3 bg-green-500 text-white text-lg font-medium rounded-lg hover:bg-green-600 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5 inline mr-2" />
              Continue Processing
            </button>
          )}
          
          <button
            onClick={onSkip}
            className={`px-8 py-3 text-lg font-medium rounded-lg transition-colors ${
              processingBlocked
                ? 'border-2 border-red-300 text-red-700 hover:bg-red-50'
                : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ArrowRight className="w-5 h-5 inline mr-2" />
            {processingBlocked ? 'Skip For Now (Processing Blocked)' : 'Continue to Status'}
          </button>
        </div>

        {/* Information Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Processing Information */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2">🚨 Processing Requirements</h4>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• <strong>Required documents are mandatory</strong> for processing</li>
              <li>• Application will remain on hold until uploaded</li>
              <li>• Processing time starts after all required docs verified</li>
              <li>• Optional documents may improve approval odds</li>
              <li>• You can upload documents anytime using your QR code</li>
            </ul>
          </div>

          {/* Upload Benefits */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">📄 Document Benefits</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Required:</strong> Enables processing to continue</li>
              <li>• <strong>Optional:</strong> May reduce processing time</li>
              <li>• Provides evidence supporting your application</li>
              <li>• Shows preparedness and attention to detail</li>
              <li>• Can be uploaded later if not available now</li>
            </ul>
          </div>
        </div>

        {/* Status summary */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">Document Upload Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {allDocTypes.map(docType => {
              const document = getDocumentForType(docType)
              const uploading = isUploading(docType)
              const isMandatory = requirements.mandatory.includes(docType)
              
              return (
                <div key={docType} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    {DOCUMENT_NAMES[docType]}
                    <span className={`badge badge-xs ${isMandatory ? 'badge-error' : 'badge-warning'}`}>
                      {isMandatory ? 'REQ' : 'OPT'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-blue-600">Processing...</span>
                      </>
                    ) : document?.verified ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-600">Verified</span>
                      </>
                    ) : document ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-red-600">Failed</span>
                      </>
                    ) : (
                      <>
                        <div className={`w-4 h-4 border-2 rounded-full ${
                          isMandatory ? 'border-red-300' : 'border-gray-300'
                        }`}></div>
                        <span className={`text-xs ${
                          isMandatory ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {isMandatory ? 'Required' : 'Optional'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}