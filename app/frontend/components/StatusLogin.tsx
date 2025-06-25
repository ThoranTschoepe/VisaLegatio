import React, { useState, useEffect } from 'react'
import { Search, Lock, Eye, EyeOff, QrCode, FileText, Shield, AlertCircle } from 'lucide-react'

// QR Scanner Popup Component (inline for demo)
const QRScannerPopup = ({ onScanResult, onClose }) => {
  const [isScanning, setIsScanning] = useState(false)

  const handleDemoScan = (appId, password) => {
    setIsScanning(true)
    setTimeout(() => {
      onScanResult(appId, password)
      setIsScanning(false)
    }, 1500)
  }

  const handleManualQREntry = () => {
    const qrUrl = prompt('Paste your QR code URL here:')
    if (qrUrl) {
      try {
        const url = new URL(qrUrl)
        const appId = url.searchParams.get('id')
        if (appId) {
          onScanResult(appId, '')
        } else {
          alert('Invalid QR code URL - no application ID found')
        }
      } catch (error) {
        alert('Invalid URL format')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold">QR Code Scanner</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">✕</button>
        </div>

        <div className="p-6">
          <div className="w-64 h-64 border-4 border-dashed border-blue-300 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-6">
            {isScanning ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-blue-600 font-medium">Scanning...</p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="w-16 h-16 text-blue-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">Position QR code here</p>
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Test Options</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleDemoScan('VSV-240101-A1B2', 'DEMO123')}
                disabled={isScanning}
                className="w-full p-2 bg-white border rounded text-left text-sm"
              >
                📄 Business Visa (VSV-240101-A1B2)
              </button>
              <button
                onClick={() => handleDemoScan('VSV-240102-C3D4', 'DEMO456')}
                disabled={isScanning}
                className="w-full p-2 bg-white border rounded text-left text-sm"
              >
                🏖️ Tourist Visa (VSV-240102-C3D4)
              </button>
              <button
                onClick={handleManualQREntry}
                disabled={isScanning}
                className="w-full p-2 bg-blue-100 border border-blue-300 rounded text-left text-sm"
              >
                📱 Paste QR URL Manually
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-semibold text-blue-900 text-sm mb-2">💡 How to Use</h4>
            <ul className="text-blue-800 text-xs space-y-1">
              <li>• Use demo buttons above for testing</li>
              <li>• Or paste a real QR code URL manually</li>
              <li>• Real camera scanning would work in production</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatusLoginProps {
  onAccessApplication: (applicationId: string, password: string) => Promise<void>
  onBack: () => void
  prefilledApplicationId?: string
}

export default function StatusLogin({ onAccessApplication, onBack, prefilledApplicationId = '' }: StatusLoginProps) {
  const [applicationId, setApplicationId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showQRScanner, setShowQRScanner] = useState(false)

  // Auto-fill application ID if provided via QR code
  useEffect(() => {
    if (prefilledApplicationId) {
      setApplicationId(prefilledApplicationId)
    }
  }, [prefilledApplicationId])

  const handleSubmit = async () => {
    setError('')
    
    if (!applicationId.trim()) {
      setError('Please enter your application ID')
      return
    }
    
    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    setIsLoading(true)
    
    try {
      // Call the parent component's access handler (now async)
      await onAccessApplication(applicationId.trim(), password.trim())
    } catch (err) {
      setError('Invalid application ID or password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQRScan = () => {
    setShowQRScanner(true)
  }

  const handleQRScanResult = async (appId, pass) => {
    setApplicationId(appId)
    if (pass) {
      setPassword(pass)
    }
    setShowQRScanner(false)
    
    // If we got both ID and password from demo, auto-submit
    if (appId && pass) {
      setTimeout(async () => {
        try {
          await onAccessApplication(appId, pass)
        } catch (error) {
          setError('Auto-login failed. Please try manually.')
        }
      }, 500)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary rounded-full">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">VisaLegatio</h1>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Check Application Status</h2>
          <p className="text-gray-600">Enter your application details to view progress</p>
          
          {prefilledApplicationId && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                ✅ QR code scanned! Application ID auto-filled. Please enter your password.
              </p>
            </div>
          )}
        </div>

        {/* Login Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="space-y-6">
              {/* Application ID */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Application ID
                  </span>
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="e.g., VSV-240101-A1B2"
                    className={`input input-bordered w-full pr-12 font-mono ${
                      prefilledApplicationId ? 'input-success' : ''
                    }`}
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleQRScan}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors"
                    title="Scan QR Code"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>
                <label className="label">
                  <span className="label-text-alt text-gray-500">
                    {prefilledApplicationId 
                      ? '✅ Auto-filled from QR code' 
                      : 'Found in your confirmation email or scan your QR code'
                    }
                  </span>
                </label>
              </div>

              {/* QR Code Scanner Section */}
              <div className="form-control">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <QrCode className="w-6 h-6 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Have a QR Code?</h4>
                  </div>
                  <p className="text-blue-800 text-sm mb-3">
                    Scan the QR code you received when submitting your application for instant access.
                  </p>
                  <button
                    type="button"
                    onClick={handleQRScan}
                    className="btn btn-primary btn-sm w-full"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Open QR Scanner
                  </button>
                  <p className="text-xs text-blue-700 mt-2 text-center">
                    Scan your application QR code for instant login
                  </p>
                </div>
              </div>

              {/* Password */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Access Password
                  </span>
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your access password"
                    className="input input-bordered w-full pr-12 font-mono" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <label className="label">
                  <span className="label-text-alt text-gray-500">
                    The password you set when submitting your application
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="alert alert-error">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button 
                onClick={handleSubmit}
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Accessing Application...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    View Application Status
                  </>
                )}
              </button>
            </div>

            {/* Help Section */}
            <div className="divider">Need Help?</div>
            
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="font-semibold text-blue-900 text-sm mb-2">Can't find your information?</h4>
                <ul className="text-blue-800 text-xs space-y-1">
                  <li>• Check your email confirmation for the application ID</li>
                  <li>• Use the QR code you saved when submitting</li>
                  <li>• Make sure you're entering the password correctly</li>
                  <li>• Contact support if you've lost your access details</li>
                </ul>
              </div>

              <button
                onClick={onBack}
                className="btn btn-ghost btn-sm w-full"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>

        {/* Demo Access */}
        <div className="mt-6 card bg-base-100 shadow">
          <div className="card-body py-4">
            <h4 className="font-semibold text-sm mb-3">Demo Access</h4>
            <div className="space-y-2">
              <button 
                className="btn btn-ghost btn-xs w-full justify-start text-left"
                onClick={() => {
                  setApplicationId('VSV-240101-A1B2')
                  setPassword('DEMO123')
                }}
              >
                <FileText className="w-3 h-3 mr-2" />
                Demo Application #1 (Business Visa)
              </button>
              <button 
                className="btn btn-ghost btn-xs w-full justify-start text-left"
                onClick={() => {
                  setApplicationId('VSV-240102-C3D4')
                  setPassword('DEMO456')
                }}
              >
                <FileText className="w-3 h-3 mr-2" />
                Demo Application #2 (Tourist Visa)
              </button>
              <button 
                className="btn btn-ghost btn-xs w-full justify-start text-left"
                onClick={() => {
                  setApplicationId('VSV-240103-E5F6')
                  setPassword('DEMO789')
                }}
              >
                <FileText className="w-3 h-3 mr-2" />
                Demo Application #3 (Student Visa)
              </button>
              <button 
                className="btn btn-ghost btn-xs w-full justify-start text-left"
                onClick={() => {
                  setApplicationId('VSV-240104-G7H8')
                  setPassword('DEMO999')
                }}
              >
                <FileText className="w-3 h-3 mr-2" />
                Demo Application #4 (Work Visa)
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900 text-sm">Security & Privacy</h4>
              <p className="text-gray-700 text-xs mt-1">
                Your application data is encrypted and secure. Never share your access password with anyone.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Scanner Popup */}
      {showQRScanner && (
        <QRScannerPopup 
          onScanResult={handleQRScanResult}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  )
}