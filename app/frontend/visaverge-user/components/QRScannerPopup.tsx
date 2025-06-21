import React, { useState } from 'react'
import { QrCode, Camera, X, FileText, GraduationCap, Briefcase, Upload } from 'lucide-react'

interface QRScannerPopupProps {
  onScanResult: (applicationId: string, password: string) => void
  onClose: () => void
}

export default function QRScannerPopup({ onScanResult, onClose }: QRScannerPopupProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [manualEntry, setManualEntry] = useState('')

  const handleDemoScan = (appId: string, password: string, type: string) => {
    setIsScanning(true)
    
    // Simulate scanning delay
    setTimeout(() => {
      onScanResult(appId, password)
      setIsScanning(false)
    }, 1500)
  }

  const handleManualEntry = () => {
    if (!manualEntry.trim()) {
      alert('Please enter a QR code URL')
      return
    }

    try {
      const url = new URL(manualEntry)
      const appId = url.searchParams.get('id')
      
      if (appId) {
        setIsScanning(true)
        setTimeout(() => {
          onScanResult(appId, '')
          setIsScanning(false)
        }, 1000)
      } else {
        alert('Invalid QR code URL - no application ID found')
      }
    } catch (error) {
      alert('Invalid URL format. Please enter a valid VisaVerge QR code URL.')
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // In a real app, this would process the QR code image
      // For demo, we'll simulate reading it
      setIsScanning(true)
      setTimeout(() => {
        // Simulate extracting data from QR code image - use existing demo ID
        const demoId = 'VSV-240104-G7H8'
        onScanResult(demoId, 'DEMO999')
        setIsScanning(false)
      }, 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6" />
            <h2 className="text-lg font-semibold">QR Code Scanner</h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Scanner Area */}
          <div className="relative mb-6">
            <div className="w-80 h-80 border-4 border-dashed border-blue-300 rounded-lg bg-blue-50 flex items-center justify-center mx-auto relative overflow-hidden">
              {isScanning ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-blue-600 font-medium">Scanning QR Code...</p>
                  <p className="text-sm text-gray-600">Please wait</p>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Position QR code here</p>
                  <p className="text-sm text-gray-500">Camera would activate in real app</p>
                </div>
              )}
              
              {/* Scanning overlay effect */}
              {isScanning && (
                <div className="absolute inset-0">
                  <div className="w-full h-1 bg-red-500 opacity-80 animate-pulse absolute top-1/2 transform -translate-y-1/2"></div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Entry Section */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Manual Entry Options
            </h3>
            
            <div className="space-y-3">
              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste QR Code URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://visaverge.com/?step=status-login&id=..."
                    className="input input-bordered input-sm flex-1 text-xs"
                    value={manualEntry}
                    onChange={(e) => setManualEntry(e.target.value)}
                    disabled={isScanning}
                  />
                  <button
                    onClick={handleManualEntry}
                    disabled={isScanning || !manualEntry.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    Scan
                  </button>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload QR Code Image:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isScanning}
                  className="file-input file-input-bordered file-input-sm w-full"
                />
              </div>
            </div>
          </div>

          {/* Demo Buttons */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-900">Demo QR Codes</h3>
            </div>
            <p className="text-yellow-800 text-sm mb-3">
              In a real implementation, you would scan actual QR codes. For demo purposes, try these:
            </p>
            
            <div className="space-y-2">
              <button
                onClick={() => handleDemoScan('VSV-240101-A1B2', 'DEMO123', 'business')}
                disabled={isScanning}
                className="w-full p-3 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors text-left flex items-center gap-3"
              >
                <Briefcase className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Business Visa Application</p>
                  <p className="text-sm text-gray-600">VSV-240101-A1B2</p>
                </div>
              </button>

              <button
                onClick={() => handleDemoScan('VSV-240102-C3D4', 'DEMO456', 'tourist')}
                disabled={isScanning}
                className="w-full p-3 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors text-left flex items-center gap-3"
              >
                <FileText className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Tourist Visa Application</p>
                  <p className="text-sm text-gray-600">VSV-240102-C3D4</p>
                </div>
              </button>

              <button
                onClick={() => handleDemoScan('VSV-240103-E5F6', 'DEMO789', 'student')}
                disabled={isScanning}
                className="w-full p-3 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors text-left flex items-center gap-3"
              >
                <GraduationCap className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Student Visa Application</p>
                  <p className="text-sm text-gray-600">VSV-240103-E5F6</p>
                </div>
              </button>

              <button
                onClick={() => handleDemoScan('VSV-240104-G7H8', 'DEMO999', 'work')}
                disabled={isScanning}
                className="w-full p-3 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors text-left flex items-center gap-3"
              >
                <Briefcase className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="font-medium text-gray-900">Work Visa Application</p>
                  <p className="text-sm text-gray-600">VSV-240104-G7H8</p>
                </div>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 text-sm mb-2">📱 QR Code Instructions</h4>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• <strong>Camera Scanning:</strong> Real app would request camera permission</li>
              <li>• <strong>Manual Entry:</strong> Paste the URL from your QR code above</li>
              <li>• <strong>File Upload:</strong> Upload a saved QR code image</li>
              <li>• <strong>Demo Mode:</strong> Use the demo buttons for testing</li>
              <li>• <strong>Auto-Extract:</strong> Application ID extracted automatically</li>
              <li>• <strong>Security:</strong> All QR codes are validated before processing</li>
            </ul>
          </div>

          {/* Additional Features Info */}
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-900 text-sm mb-2">✨ Features</h4>
            <div className="text-green-800 text-xs space-y-1">
              <p>• Works with any VisaVerge QR code</p>
              <p>• Validates URL format and application ID</p>
              <p>• Supports both URL and image scanning</p>
              <p>• Secure processing with error handling</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}