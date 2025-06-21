'use client'

import { useState } from 'react'
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock,
  User,
  Building
} from 'lucide-react'
import { LoginCredentials, Officer, MOCK_EMBASSIES, MOCK_OFFICERS } from '@/types/embassy.types'
import { api, apiUtils } from '@/utils/api'

interface EmbassyLoginProps {
  onLogin: (officer: Officer) => void
}

export default function EmbassyLogin({ onLogin }: EmbassyLoginProps) {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    officerId: '',
    password: '',
    embassy: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Use real backend authentication
      const response = await api.officerLogin({
        officer_id: credentials.officerId,
        password: credentials.password,
        embassy: credentials.embassy
      })

      // Successful login
      onLogin({
        id: response.id,
        name: response.name,
        role: response.role,
        embassy: credentials.embassy
      })
    } catch (error: any) {
      console.error('Login error:', error)
      setError(apiUtils.formatErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = (officerId: string) => {
    setCredentials({
      officerId,
      password: MOCK_OFFICERS[officerId as keyof typeof MOCK_OFFICERS].password,
      embassy: 'us_berlin'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">VisaLegatio</h1>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Embassy Portal</h2>
          <p className="text-gray-600">Secure access for consular officers</p>
        </div>

        {/* Login Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="space-y-4">
              {/* Embassy Selection */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Embassy Location
                  </span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={credentials.embassy}
                  onChange={(e) => setCredentials(prev => ({ ...prev, embassy: e.target.value }))}
                  required
                >
                  <option value="">Select your embassy</option>
                  {MOCK_EMBASSIES.map(embassy => (
                    <option key={embassy.id} value={embassy.id}>
                      {embassy.name} - {embassy.location}
                    </option>
                  ))}
                </select>
              </div>

              {/* Officer ID */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Officer ID
                  </span>
                </label>
                <input 
                  type="text" 
                  placeholder="Enter your officer ID"
                  className="input input-bordered w-full" 
                  value={credentials.officerId}
                  onChange={(e) => setCredentials(prev => ({ ...prev, officerId: e.target.value }))}
                  required
                />
              </div>

              {/* Password */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </span>
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="input input-bordered w-full pr-12" 
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="alert alert-error">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Login Button */}
              <button 
                onClick={handleSubmit}
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    Secure Login
                  </>
                )}
              </button>
            </div>

            {/* Demo Credentials */}
            <div className="divider">Demo Access</div>
            
            <div className="space-y-2">
              <button 
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => handleDemoLogin('maria.schmidt')}
              >
                <User className="w-4 h-4 mr-2" />
                Officer Maria Schmidt (Senior)
              </button>
              <button 
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => handleDemoLogin('john.davis')}
              >
                <User className="w-4 h-4 mr-2" />
                Officer John Davis (Standard)
              </button>
              <button 
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => handleDemoLogin('admin')}
              >
                <Shield className="w-4 h-4 mr-2" />
                Administrator Access
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 text-sm">Security Notice</h4>
              <p className="text-blue-800 text-xs mt-1">
                This is a secure government system. All activities are logged and monitored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}