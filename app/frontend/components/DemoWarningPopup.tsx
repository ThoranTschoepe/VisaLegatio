'use client'

import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle, X, Lock, Eye, Database } from 'lucide-react'

export default function DemoWarningPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    // Check if user has previously dismissed with "don't show again"
    const dismissed = localStorage.getItem('visalegatio-demo-warning-dismissed')
    if (!dismissed) {
      setIsVisible(true)
    }
  }, [])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('visalegatio-demo-warning-dismissed', 'true')
    }
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-error to-warning p-6 text-error-content">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-error-content/20 rounded-full backdrop-blur-sm">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Important Security Notice</h2>
                <p className="text-error-content/80 mt-1">Public Demonstration Environment</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-error-content/20 rounded-lg transition-colors"
              aria-label="Close warning"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main Warning */}
          <div className="bg-error/10 border-2 border-error/20 rounded-lg p-5">
            <div className="flex gap-3">
              <Shield className="w-6 h-6 text-error flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-error-content text-lg mb-2">
                  Do Not Enter Personal or Sensitive Information
                </h3>
                <p className="text-error-content/90">
                  This is a public demonstration of the VisaLegatio system. All data entered, including application forms, documents, and messages, may be visible to other users and is not secure.
                </p>
              </div>
            </div>
          </div>

          {/* What NOT to enter */}
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-5">
            <h4 className="font-semibold text-warning-content mb-3 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Do NOT Enter the Following:
            </h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-warning-content/90">
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Real passport or ID numbers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Actual personal addresses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Real bank account details</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Genuine phone numbers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Actual email addresses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Real travel documents</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Personal photographs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>Any confidential information</span>
              </li>
            </ul>
          </div>

          {/* Demo Purpose */}
          <div className="bg-info/10 border border-info/20 rounded-lg p-5">
            <h4 className="font-semibold text-info-content mb-2 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Demonstration Purpose Only
            </h4>
            <p className="text-info-content/90 mb-3">
              This platform is designed to showcase the capabilities of the VisaLegatio digital embassy system. 
              Please use fictional data for testing purposes.
            </p>
            <div className="text-sm text-info-content/80">
              <p className="font-medium mb-1">Demo Credentials Available:</p>
              <ul className="space-y-1 ml-4">
                <li>• Pre-configured test applications</li>
                <li>• Sample officer accounts for embassy portal</li>
                <li>• Mock documents and data for testing</li>
              </ul>
            </div>
          </div>

          {/* Data Visibility Warning */}
          <div className="bg-base-200 border border-base-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-base-content/60 mt-0.5" />
              <div className="text-sm text-base-content/70">
                <p className="font-medium mb-1">Data Visibility Notice:</p>
                <p>
                  All information entered into this demonstration may be stored temporarily and could be accessed by other demo users. 
                  This system does not provide the security measures required for processing actual visa applications.
                </p>
              </div>
            </div>
          </div>

          {/* Checkbox and Continue */}
          <div className="space-y-4 pt-4 border-t">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="checkbox checkbox-primary mt-0.5"
              />
              <span className="text-sm text-base-content/70 group-hover:text-base-content">
                I understand this is a public demo and will not enter any personal or sensitive information
              </span>
            </label>

            <button
              onClick={handleClose}
              className="btn btn-primary w-full"
            >
              I Understand - Continue to Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}