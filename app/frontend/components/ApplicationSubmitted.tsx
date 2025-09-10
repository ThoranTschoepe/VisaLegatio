import React, { useState, useEffect } from 'react'
import { CheckCircle2, Copy, Download, Upload, ArrowRight, QrCode, Lock, Eye, EyeOff, AlertTriangle, Clock, Shield, FileText } from 'lucide-react'
import GradientHeader from './UI/GradientHeader'

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
    <div className="max-w-4xl mx-auto card bg-base-100 shadow-xl overflow-hidden">
      {/* Success Header */}
      <GradientHeader
        icon={CheckCircle2}
        title="Application Submitted Successfully!"
        subtitle="Your visa application has been received and is in our system"
        gradient="from-success to-success"
        iconWrapperClassName="bg-base-100"
      >
        <div className="bg-base-100/20 rounded-lg p-4">
          <p className="text-sm text-success-content/80 mb-1">Application ID</p>
          <p className="text-2xl font-mono font-bold">{applicationId}</p>
        </div>
      </GradientHeader>

      {/* Processing Status Alert */}
      <div className="bg-warning/10 border-b-4 border-warning/20 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-sm mb-2">
              Processing On Hold - Documents Required
            </h3>
            <p className="text-sm mb-3">
              Your application has been successfully submitted and assigned a unique ID. However, 
              <strong> processing cannot begin until you upload the required documents</strong>.
            </p>
            <div className="bg-warning/20 rounded-lg p-3 mb-3">
              <h4 className="font-semibold text-sm text-sm mb-2">Current Status:</h4>
              <ul className="text-sm text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  Application received and ID assigned
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  QR code and access credentials generated
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Waiting for required documents to start processing
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-base-content/50" />
                  Processing timer will start after document upload
                </li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onContinueToDocuments}
                className="btn btn-warning"
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Upload Required Documents Now
              </button>
              <button
                onClick={onSkipToTracking}
                className="btn btn-outline btn-warning"
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
              <QrCode className="w-6 h-6 text-primary" />
              Quick Access QR Code
            </h3>
            
            <div className="bg-base-200 border border-base-300 rounded-lg p-6">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code for Application Access"
                  className="w-48 h-48 mx-auto mb-4"
                />
              ) : (
                <div className="w-48 h-48 bg-base-300 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <div className="loading loading-spinner loading-lg text-primary"></div>
                </div>
              )}
              
              <p className="text-sm text-base-content/70 mb-4">
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
              <Lock className="w-6 h-6 text-primary" />
              Access Information
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content mb-2">
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
                <label className="block text-sm font-medium text-base-content mb-2">
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

              <div className="bg-info/10 border border-info/20 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">📱 QR Code Usage</h4>
                <ul className="text-sm space-y-1">
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

        {/* Timeline Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-base-100 border border-base-300 rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-info" />
              Document Requirements
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Required Documents</span>
                <span className="font-bold text-error">0/3 uploaded</span>
              </div>
              <div className="flex justify-between">
                <span>Optional Documents</span>
                <span className="font-bold text-info">0/2 uploaded</span>
              </div>
              <div className="flex justify-between">
                <span>Processing Status</span>
                <span className="font-bold text-warning">On Hold</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span>Next Action Required</span>
                <span className="font-bold text-error">Upload Documents</span>
              </div>
            </div>
          </div>

          <div className="bg-base-100 border border-base-300 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Estimated Timeline (After Documents)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Document Review</span>
                <span className="text-info font-medium">1-2 days</span>
              </div>
              <div className="flex justify-between">
                <span>Background Check</span>
                <span className="text-info font-medium">3-5 days</span>
              </div>
              <div className="flex justify-between">
                <span>Officer Review</span>
                <span className="text-info font-medium">2-3 days</span>
              </div>
              <div className="flex justify-between">
                <span>Final Decision</span>
                <span className="text-info font-medium">1-2 days</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span>Total Time</span>
                  <span className="text-success font-bold">7-12 days</span>
                </div>
                <p className="text-xs text-base-content/60 mt-1">
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
          <p className="text-sm text-base-content/70">
            <strong>Important:</strong> You can upload documents later using your QR code, 
            but processing cannot begin until all required documents are provided.
          </p>
        </div>

        {/* Important Notes */}
        <div className="mt-8 bg-error/10 border border-error/20 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">🚨 Critical Information</h4>
          <ul className="text-sm text-sm space-y-1">
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