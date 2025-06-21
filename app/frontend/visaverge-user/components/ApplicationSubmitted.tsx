import React, { useState, useEffect } from 'react'
import { CheckCircle2, Copy, Download, Upload, ArrowRight, QrCode, Lock, Eye, EyeOff, AlertTriangle, Clock, Shield, FileText } from 'lucide-react'

interface ApplicationSubmittedProps {
  applicationId: string
  onContinueToDocuments: () => void
  onSkipToTracking: () => void
}

export default function ApplicationSubmitted({ 
  applicationId, 
  onContinueToDocuments, 
  onSkipToTracking 
}: ApplicationSubmittedProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Generate access URL and QR code with correct format
  const accessUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?step=status-login&id=${applicationId}`
  const documentUploadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?step=status-login&id=${applicationId}&action=upload-documents`
  const password = localStorage.getItem(`app_${applicationId}_password`) || 'TEMP123'

  useEffect(() => {
    // Generate QR code using a free QR code API with the document upload URL
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(documentUploadUrl)}`
    setQrCodeUrl(qrApiUrl)
  }, [documentUploadUrl])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadQRCode = () => {
    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `visa-application-${applicationId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Test QR code by opening it
  const testQRCode = () => {
    window.open(documentUploadUrl, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Success Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Application Submitted Successfully!</h1>
        <p className="text-green-100 text-lg">
          Your visa application has been received and is in our system
        </p>
        
        <div className="mt-4 bg-white/20 rounded-lg p-4 inline-block">
          <p className="text-sm text-green-100 mb-1">Application ID</p>
          <p className="text-2xl font-mono font-bold">{applicationId}</p>
        </div>
      </div>

      {/* Processing Status Alert */}
      <div className="bg-orange-50 border-b-4 border-orange-200 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-900 mb-2">
              Processing On Hold - Documents Required
            </h3>
            <p className="text-orange-800 mb-3">
              Your application has been successfully submitted and assigned a unique ID. However, 
              <strong> processing cannot begin until you upload the required documents</strong>.
            </p>
            <div className="bg-orange-100 rounded-lg p-3 mb-3">
              <h4 className="font-semibold text-orange-900 text-sm mb-2">Current Status:</h4>
              <ul className="text-orange-800 text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Application received and ID assigned
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  QR code and access credentials generated
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  Waiting for required documents to start processing
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  Processing timer will start after document upload
                </li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onContinueToDocuments}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Upload Required Documents Now
              </button>
              <button
                onClick={onSkipToTracking}
                className="px-6 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Skip For Now (Processing Blocked)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* QR Code and Access Info */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4 flex items-center justify-center gap-2">
              <QrCode className="w-6 h-6 text-blue-600" />
              Quick Access QR Code
            </h3>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code for Application Access"
                  className="w-48 h-48 mx-auto mb-4"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              )}
              
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code to quickly access your application and upload required documents
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={testQRCode}
                  className="btn btn-primary btn-sm w-full"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Test QR Code Link
                </button>
                <button
                  onClick={downloadQRCode}
                  className="btn btn-outline btn-sm w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Lock className="w-6 h-6 text-blue-600" />
              Access Information
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Application URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={accessUrl}
                    readOnly
                    className="input input-bordered flex-1 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(accessUrl)}
                    className={`btn ${copied ? 'btn-success' : 'btn-outline'}`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Password
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    readOnly
                    className="input input-bordered flex-1 font-mono"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-outline btn-square"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(password)}
                    className={`btn ${copied ? 'btn-success' : 'btn-outline'}`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 text-sm mb-2">📱 QR Code Usage</h4>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• Save the QR code image to your phone</li>
                  <li>• Scan it with any QR code scanner app</li>
                  <li>• It will take you directly to the status page</li>
                  <li>• Enter your password to access your application</li>
                  <li>• Upload documents directly from your phone</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Processing Pipeline */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Processing Pipeline
          </h3>
          
          <div className="space-y-4">
            {/* Step 1 - Complete */}
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900">Step 1: Application Submitted</h4>
                <p className="text-green-800 text-sm">
                  Your application has been received and assigned ID {applicationId}
                </p>
              </div>
              <span className="text-green-600 font-semibold text-sm">✓ Complete</span>
            </div>

            {/* Step 2 - Blocked */}
            <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-900">Step 2: Required Documents</h4>
                <p className="text-red-800 text-sm">
                  Upload mandatory documents to enable processing to continue
                </p>
              </div>
              <span className="text-red-600 font-semibold text-sm">⚠ Blocked</span>
            </div>

            {/* Step 3 - Waiting */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg opacity-60">
              <div className="w-10 h-10 bg-gray-300 text-white rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-700">Step 3: Document Review</h4>
                <p className="text-gray-600 text-sm">
                  Embassy officers will verify your documents
                </p>
              </div>
              <span className="text-gray-500 font-semibold text-sm">Waiting</span>
            </div>

            {/* Step 4 - Waiting */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg opacity-60">
              <div className="w-10 h-10 bg-gray-300 text-white rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-700">Step 4: Processing & Decision</h4>
                <p className="text-gray-600 text-sm">
                  Background checks and final decision making
                </p>
              </div>
              <span className="text-gray-500 font-semibold text-sm">Waiting</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-orange-100 border border-orange-200 rounded-lg">
            <p className="text-orange-800 text-sm">
              <strong>⚠ Processing Note:</strong> Your application will remain in "Document Collection" 
              status until all required documents are uploaded and verified. The processing timeline 
              only begins after document requirements are satisfied.
            </p>
          </div>
        </div>

        {/* Timeline Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Document Requirements
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Required Documents</span>
                <span className="font-bold text-red-600">0/3 uploaded</span>
              </div>
              <div className="flex justify-between">
                <span>Optional Documents</span>
                <span className="font-bold text-blue-600">0/2 uploaded</span>
              </div>
              <div className="flex justify-between">
                <span>Processing Status</span>
                <span className="font-bold text-orange-600">On Hold</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span>Next Action Required</span>
                <span className="font-bold text-red-600">Upload Documents</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Estimated Timeline (After Documents)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Document Review</span>
                <span className="text-blue-600 font-medium">1-2 days</span>
              </div>
              <div className="flex justify-between">
                <span>Background Check</span>
                <span className="text-blue-600 font-medium">3-5 days</span>
              </div>
              <div className="flex justify-between">
                <span>Officer Review</span>
                <span className="text-blue-600 font-medium">2-3 days</span>
              </div>
              <div className="flex justify-between">
                <span>Final Decision</span>
                <span className="text-blue-600 font-medium">1-2 days</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span>Total Time</span>
                  <span className="text-green-600 font-bold">7-12 days</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  *Timeline starts after required documents uploaded
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onContinueToDocuments}
            className="btn btn-error btn-lg text-white"
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload Required Documents Now
          </button>
          
          <button
            onClick={onSkipToTracking}
            className="btn btn-outline btn-lg"
          >
            View Status (Processing Blocked)
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            <strong>Important:</strong> You can upload documents later using your QR code, 
            but processing cannot begin until all required documents are provided.
          </p>
        </div>

        {/* Important Notes */}
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 mb-2">🚨 Critical Information</h4>
          <ul className="text-red-800 text-sm space-y-1">
            <li>• <strong>Processing is currently blocked</strong> until required documents are uploaded</li>
            <li>• Your application will remain in "Document Collection" status</li>
            <li>• The official processing timeline begins after document verification</li>
            <li>• Required documents are mandatory - optional documents may improve approval chances</li>
            <li>• You can check status anytime, but processing won't advance without documents</li>
            <li>• Keep your QR code and password secure for future access</li>
          </ul>
        </div>
      </div>
    </div>
  )
}