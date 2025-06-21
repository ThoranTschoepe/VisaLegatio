'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, X, Camera, Trash2 } from 'lucide-react'
import { Document, DocumentType, VisaType } from '@/types'

interface DocumentUploadProps {
  visaType: VisaType
  onDocumentsChange?: (documents: Document[]) => void
  onComplete?: () => void
}

const REQUIRED_DOCUMENTS: Record<VisaType, DocumentType[]> = {
  tourist: ['passport', 'photo', 'bank_statement', 'travel_insurance'],
  business: ['passport', 'photo', 'invitation_letter', 'employment_letter'],
  student: ['passport', 'photo', 'bank_statement', 'invitation_letter'],
  work: ['passport', 'photo', 'employment_letter', 'invitation_letter'],
  family_visit: ['passport', 'photo', 'invitation_letter', 'bank_statement'],
  transit: ['passport', 'photo', 'flight_itinerary']
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

export default function DocumentUpload({ visaType, onDocumentsChange, onComplete }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadingDocs, setUploadingDocs] = useState<Set<string>>(new Set())
  const [draggedOver, setDraggedOver] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const requiredDocs = REQUIRED_DOCUMENTS[visaType] || []

  // Simulate document verification
  const verifyDocument = async (file: File, docType: DocumentType): Promise<boolean> => {
    // Simulate upload and verification time
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000))
    
    // Simulate verification results (90% success rate)
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
        url: URL.createObjectURL(file) // For preview
      }

      setDocuments(prev => {
        // Remove any existing document of the same type
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

  const allRequiredUploaded = requiredDocs.every(docType => 
    getDocumentForType(docType)?.verified
  )

  const uploadProgress = (documents.filter(doc => doc.verified).length / requiredDocs.length) * 100

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
        <h2 className="text-xl font-bold mb-2">Upload Required Documents</h2>
        <p className="text-green-100 text-sm">
          Please upload the following documents for your {visaType} visa application
        </p>
        
        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-green-100 mb-2">
            <span>Upload Progress</span>
            <span>{Math.round(uploadProgress)}% complete</span>
          </div>
          <div className="w-full bg-green-500 bg-opacity-30 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Document grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requiredDocs.map(docType => {
            const document = getDocumentForType(docType)
            const uploading = isUploading(docType)
            
            return (
              <div
                key={docType}
                className={`border-2 border-dashed rounded-lg p-6 transition-all ${
                  draggedOver === docType
                    ? 'border-blue-500 bg-blue-50'
                    : document?.verified
                    ? 'border-green-500 bg-green-50'
                    : document && !document.verified
                    ? 'border-red-500 bg-red-50'
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
                        <h3 className="font-medium text-gray-800 mb-1">
                          {DOCUMENT_NAMES[docType]}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {DOCUMENT_DESCRIPTIONS[docType]}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <button
                          onClick={() => fileInputRefs.current[docType]?.click()}
                          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          <FileText className="w-4 h-4 inline mr-2" />
                          Choose File
                        </button>
                        
                        <button
                          onClick={() => fileInputRefs.current[docType]?.click()}
                          className="w-full px-4 py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors"
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
          })}
        </div>

        {/* Tips */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">📝 Document Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Ensure documents are clear and all text is readable</li>
            <li>• Photos should be in color with good lighting</li>
            <li>• Bank statements must be recent (within 3 months)</li>
            <li>• All documents should be in high resolution</li>
            <li>• Upload official documents only - no screenshots</li>
          </ul>
        </div>

        {/* Complete button */}
        {allRequiredUploaded && (
          <div className="mt-6 text-center">
            <button
              onClick={onComplete}
              className="px-8 py-3 bg-green-500 text-white text-lg font-medium rounded-lg hover:bg-green-600 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5 inline mr-2" />
              All Documents Verified - Continue
            </button>
          </div>
        )}

        {/* Status summary */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">Upload Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {requiredDocs.map(docType => {
              const document = getDocumentForType(docType)
              const uploading = isUploading(docType)
              
              return (
                <div key={docType} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{DOCUMENT_NAMES[docType]}</span>
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
                        <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
                        <span className="text-xs text-gray-500">Pending</span>
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