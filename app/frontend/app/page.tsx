'use client'

import { useState, useEffect } from 'react'
import { Globe, Zap, Shield, Users, ArrowRight, Sparkles, QrCode, Download, Copy, Lock, Eye, EyeOff, CheckCircle2, Upload } from 'lucide-react'
import ChatInterface from '@/components/ChatInterface'
import DynamicForm from '@/components/DynamicForm'
import DocumentUpload from '@/components/DocumentUpload'
import StatusTracker from '@/components/StatusTracker'
import StatusLogin from '@/components/StatusLogin'
import ApplicationSubmitted from '@/components/ApplicationSubmitted'
import AlertContainer from '@/components/Alert/AlertContainer'
import DemoWarningPopup from '@/components/DemoWarningPopup'
import { Button, Stats, Stat, Badge } from '@/components/UI'
import { VisaType, Document } from '@/types'
import { api } from '@/utils/api'
import { useAlertStore } from '@/lib/stores/alert.store'

type AppStep = 'landing' | 'chat' | 'form' | 'submitted' | 'documents' | 'status' | 'status-login'

interface ApplicationData {
  id: string
  visaType: VisaType
  status: string
  applicantName?: string
}

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<AppStep>('landing')
  const [selectedVisaType, setSelectedVisaType] = useState<VisaType | null>(null)
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({})
  const [documents, setDocuments] = useState<Document[]>([])
  const [applicationData, setApplicationData] = useState<ApplicationData | null>(null)
  const [applicationPassword, setApplicationPassword] = useState<string>('')
  const [prefilledApplicationId, setPrefilledApplicationId] = useState<string>('')
  const [redirectToDocuments, setRedirectToDocuments] = useState<boolean>(false)
  const { showSuccess, showError } = useAlertStore()

  // Check URL parameters on page load for QR code functionality
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Pre-populate localStorage with demo credentials
      const demoCredentials = [
        { id: 'VSV-240101-A1B2', password: 'DEMO123' },
        { id: 'VSV-240102-C3D4', password: 'DEMO456' },
        { id: 'VSV-240103-E5F6', password: 'DEMO789' },
        { id: 'VSV-240104-G7H8', password: 'DEMO999' }
      ]
      
      demoCredentials.forEach(({ id, password }) => {
        const key = `app_${id}_password`
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, password)
        }
      })
      
      const urlParams = new URLSearchParams(window.location.search)
      const step = urlParams.get('step')
      const id = urlParams.get('id')
      const action = urlParams.get('action')
      
      // If QR code was scanned, navigate to status login with prefilled ID
      if (step === 'status-login' && id) {
        setPrefilledApplicationId(id)
        setCurrentStep('status-login')
        
        // Check if they want to upload documents specifically
        if (action === 'upload-documents') {
          setRedirectToDocuments(true)
          showSuccess('QR code scanned! Please enter your password to upload documents.')
        } else {
          showSuccess('QR code scanned! Please enter your password to access your application.')
        }
        
        // Clean up URL without refreshing page
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
  }, [showSuccess])

  const handleVisaTypeSelected = (visaType: VisaType) => {
    setSelectedVisaType(visaType)
    setCurrentStep('form')
    showSuccess(`Starting ${visaType} visa application!`)
  }

  const handleFormSubmit = async (answers: Record<string, any>, password: string) => {
    try {
      setFormAnswers(answers)
      setApplicationPassword(password)
      
      showSuccess('Submitting your application...')
      
      // Submit application to backend
      const application = await api.submitApplication({
        visaType: selectedVisaType!,
        answers,
        documents: [], // No documents yet
        password
      })
      
      setApplicationData({
        id: application.id,
        visaType: selectedVisaType!,
        status: application.status,
        applicantName: answers.applicant_name
      })
      
      // Store password locally for later access
      localStorage.setItem(`app_${application.id}_password`, password)
      
      setCurrentStep('submitted')
      showSuccess('Application submitted successfully!')
    } catch (error) {
      console.error('Error submitting application:', error)
      
      // Fallback for demo - generate mock application ID
      const mockId = `VSV-${Date.now().toString().slice(-8)}`
      setApplicationData({
        id: mockId,
        visaType: selectedVisaType!,
        status: 'document_collection',
        applicantName: answers.applicant_name
      })
      localStorage.setItem(`app_${mockId}_password`, password)
      setCurrentStep('submitted')
      showSuccess('Application submitted successfully!')
    }
  }

  const handleContinueToDocuments = () => {
    setCurrentStep('documents')
  }

  const handleSkipToTracking = () => {
    setCurrentStep('status')
  }

  const handleDocumentsComplete = () => {
    setCurrentStep('status')
    showSuccess('Documents uploaded successfully!')
  }

  const handleAccessApplication = async (appId: string, password: string) => {
    try {
      // Try to verify with backend first
      const application = await api.getApplicationWithPassword(appId, password)
      
      // If backend verification succeeds, proceed
      setApplicationData({
        id: application.id,
        visaType: application.visaType as VisaType,
        status: application.status,
        applicantName: application.applicantName
      })
      
      // Check if we should redirect to documents
      if (redirectToDocuments) {
        setRedirectToDocuments(false)
        setCurrentStep('documents')
        showSuccess('Application accessed! You can now upload your documents.')
      } else {
        setCurrentStep('status')
        showSuccess('Application accessed successfully!')
      }
      
    } catch (error) {
      console.error('Backend verification failed, trying localStorage fallback:', error)
      
      // Fallback to localStorage check for demo
      const storedPassword = localStorage.getItem(`app_${appId}_password`)
      
      if (storedPassword && storedPassword === password) {
        // Create mock application data for demo
        setApplicationData({
          id: appId,
          visaType: 'business', // Default for demo
          status: 'document_collection',
          applicantName: 'Demo User'
        })
        
        if (redirectToDocuments) {
          setRedirectToDocuments(false)
          setCurrentStep('documents')
          showSuccess('Application accessed! You can now upload your documents.')
        } else {
          setCurrentStep('status')
          showSuccess('Application accessed successfully!')
        }
      } else {
        showError('Invalid application ID or password')
      }
    }
  }

  const resetApplication = () => {
    setCurrentStep('landing')
    setSelectedVisaType(null)
    setFormAnswers({})
    setDocuments([])
    setApplicationData(null)
    setApplicationPassword('')
    setPrefilledApplicationId('')
    setRedirectToDocuments(false)
  }

  const startChatDirectly = () => {
    setCurrentStep('chat')
  }

  const showStatusLogin = () => {
    setCurrentStep('status-login')
  }

  // Navigate to documents from status page
  const navigateToDocuments = () => {
    if (applicationData) {
      setCurrentStep('documents')
      showSuccess('You can now upload your documents.')
    } else {
      showError('Application data not found. Please log in again.')
      setCurrentStep('status-login')
    }
  }

  // Reset demo warning function for development
  const resetDemoWarning = () => {
    localStorage.removeItem('visalegatio-demo-warning-dismissed')
    window.location.reload()
  }

  if (currentStep === 'status-login') {
    return (
      <>
        {/* Demo Warning Popup */}
        <DemoWarningPopup />
        
        <StatusLogin 
          onAccessApplication={handleAccessApplication}
          onBack={() => setCurrentStep('landing')}
          prefilledApplicationId={prefilledApplicationId}
        />
        <AlertContainer />
      </>
    )
  }

  if (currentStep === 'chat') {
    return (
      <>
        {/* Demo Warning Popup */}
        <DemoWarningPopup />
        
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Chat with AVA</h1>
              <p className="text-lg opacity-70">
                Your AI visa assistant is ready to help you find the right visa
              </p>
              <Badge variant="primary" className="mt-2">
                <Sparkles className="w-4 h-4 mr-1" />
                AI-Powered
              </Badge>
            </div>

            <div className="h-[600px]">
              <ChatInterface onVisaTypeSelected={handleVisaTypeSelected} />
            </div>

            <div className="text-center mt-6">
              <Button 
                variant="ghost" 
                onClick={() => setCurrentStep('landing')}
                className="btn-sm"
              >
                ← Back to homepage
              </Button>
            </div>
          </div>
        </div>
        <AlertContainer />
      </>
    )
  }

  if (currentStep === 'form' && selectedVisaType) {
    return (
      <>
        {/* Demo Warning Popup */}
        <DemoWarningPopup />
        
        <div className="container mx-auto px-4 py-8">
          <DynamicForm
            visaType={selectedVisaType}
            onSubmit={handleFormSubmit}
            onBack={() => setCurrentStep('chat')}
          />
        </div>
        <AlertContainer />
      </>
    )
  }

  if (currentStep === 'submitted' && applicationData) {
    return (
      <>
        {/* Demo Warning Popup */}
        <DemoWarningPopup />
        
        <div className="container mx-auto px-4 py-8">
          <ApplicationSubmitted
            applicationId={applicationData.id}
            onContinueToDocuments={handleContinueToDocuments}
            onSkipToTracking={handleSkipToTracking}
          />
        </div>
        <AlertContainer />
      </>
    )
  }

  if (currentStep === 'documents' && applicationData) {
    return (
      <>
        {/* Demo Warning Popup */}
        <DemoWarningPopup />
        
        <div className="container mx-auto px-4 py-8">
          <DocumentUpload
            visaType={applicationData.visaType}
            applicationId={applicationData.id}
            onDocumentsChange={setDocuments}
            onComplete={handleDocumentsComplete}
            onSkip={handleSkipToTracking}
          />
        </div>
        <AlertContainer />
      </>
    )
  }

  if (currentStep === 'status' && applicationData) {
    return (
      <>
        {/* Demo Warning Popup */}
        <DemoWarningPopup />
        
        <div className="container mx-auto px-4 py-8">
          <StatusTracker
            applicationId={applicationData.id}
            onNewApplication={resetApplication}
            onNavigateToDocuments={navigateToDocuments}
          />
        </div>
        <AlertContainer />
      </>
    )
  }

  // Landing page
  return (
    <>
      {/* Demo Warning Popup - Shows on first visit */}
      <DemoWarningPopup />
      
      {/* Hero Section */}
      <div className="hero h-screen bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 overflow-hidden">
        <div className="hero-content text-center">
          <div className="max-w-4xl">
            <div className="mb-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Globe className="w-12 h-12 text-primary" />
                <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  VisaLegatio
                </h1>
              </div>
              
              <p className="text-xl mb-8 opacity-80 max-w-3xl mx-auto leading-relaxed">
                The future of visa applications. Smart, transparent, and designed for the digital age.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={startChatDirectly}
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start New Application
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={showStatusLogin}
                >
                  Check Application Status
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AlertContainer />
      
      {/* Development reset button */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={resetDemoWarning}
          className="fixed bottom-4 left-4 btn btn-xs btn-outline opacity-50 hover:opacity-100"
        >
          Reset Demo Warning
        </button>
      )}
    </>
  )
}