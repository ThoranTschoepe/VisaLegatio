'use client'

import { useState } from 'react'
import { Globe, Zap, Shield, Users, ArrowRight, Sparkles } from 'lucide-react'
import ChatInterface from '@/components/ChatInterface'
import DynamicForm from '@/components/DynamicForm'
import DocumentUpload from '@/components/DocumentUpload'
import StatusTracker from '@/components/StatusTracker'
import DarkModeSwitcher from '@/components/Layout/DarkModeSwitcher/DarkModeSwitcher'
import AlertContainer from '@/components/Alert/AlertContainer'
import { Card, Button, Stats, Stat, Badge } from '@/components/UI'
import { VisaType, Document } from '@/types'
import { api } from '@/utils/api'
import { useAlertStore } from '@/lib/stores/alert.store'

type AppStep = 'landing' | 'chat' | 'form' | 'documents' | 'status'

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<AppStep>('landing')
  const [selectedVisaType, setSelectedVisaType] = useState<VisaType | null>(null)
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({})
  const [documents, setDocuments] = useState<Document[]>([])
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const { showSuccess, showError } = useAlertStore()

  const handleVisaTypeSelected = (visaType: VisaType) => {
    setSelectedVisaType(visaType)
    setCurrentStep('form')
    showSuccess(`Starting ${visaType} visa application!`)
  }

  const handleFormSubmit = (answers: Record<string, any>) => {
    setFormAnswers(answers)
    setCurrentStep('documents')
    showSuccess('Form completed! Please upload your documents.')
  }

  const handleDocumentsComplete = () => {
    // Simulate application submission
    submitApplication()
  }

  const submitApplication = async () => {
    try {
      showSuccess('Submitting your application...')
      const application = await api.submitApplication({
        visaType: selectedVisaType!,
        answers: formAnswers,
        documents
      })
      setApplicationId(application.id)
      setCurrentStep('status')
      showSuccess('Application submitted successfully!')
    } catch (error) {
      console.error('Error submitting application:', error)
      showError('Failed to submit application. Please try again.')
    }
  }

  const resetApplication = () => {
    setCurrentStep('landing')
    setSelectedVisaType(null)
    setFormAnswers({})
    setDocuments([])
    setApplicationId(null)
  }

  const startChatDirectly = () => {
    setCurrentStep('chat')
  }

  if (currentStep === 'chat') {
    return (
      <div className="min-h-screen bg-base-200">
        {/* Navbar */}
        <div className="navbar bg-base-100 shadow-lg">
          <div className="flex-1">
            <button 
              onClick={() => setCurrentStep('landing')}
              className="btn btn-ghost normal-case text-xl font-bold"
            >
              <Globe className="w-6 h-6 mr-2" />
              VisaVerge
            </button>
          </div>
          <div className="flex-none">
            <DarkModeSwitcher />
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
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

            {/* Chat Interface */}
            <Card className="h-[600px]">
              <ChatInterface onVisaTypeSelected={handleVisaTypeSelected} />
            </Card>

            {/* Back button */}
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
      </div>
    )
  }

  if (currentStep === 'form' && selectedVisaType) {
    return (
      <div className="min-h-screen bg-base-200">
        {/* Navbar */}
        <div className="navbar bg-base-100 shadow-lg">
          <div className="flex-1">
            <span className="text-xl font-bold">
              <Globe className="w-6 h-6 mr-2 inline" />
              VisaVerge
            </span>
          </div>
          <div className="flex-none">
            <DarkModeSwitcher />
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <DynamicForm
            visaType={selectedVisaType}
            onSubmit={handleFormSubmit}
            onBack={() => setCurrentStep('chat')}
          />
        </div>
        <AlertContainer />
      </div>
    )
  }

  if (currentStep === 'documents' && selectedVisaType) {
    return (
      <div className="min-h-screen bg-base-200">
        {/* Navbar */}
        <div className="navbar bg-base-100 shadow-lg">
          <div className="flex-1">
            <span className="text-xl font-bold">
              <Globe className="w-6 h-6 mr-2 inline" />
              VisaVerge
            </span>
          </div>
          <div className="flex-none">
            <DarkModeSwitcher />
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <DocumentUpload
            visaType={selectedVisaType}
            onDocumentsChange={setDocuments}
            onComplete={handleDocumentsComplete}
          />
        </div>
        <AlertContainer />
      </div>
    )
  }

  if (currentStep === 'status' && applicationId) {
    return (
      <div className="min-h-screen bg-base-200">
        {/* Navbar */}
        <div className="navbar bg-base-100 shadow-lg">
          <div className="flex-1">
            <span className="text-xl font-bold">
              <Globe className="w-6 h-6 mr-2 inline" />
              VisaVerge
            </span>
          </div>
          <div className="flex-none">
            <DarkModeSwitcher />
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <StatusTracker
            applicationId={applicationId}
            onNewApplication={resetApplication}
          />
        </div>
        <AlertContainer />
      </div>
    )
  }

  // Landing page
  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <span className="text-2xl font-bold">
            <Globe className="w-8 h-8 mr-2 inline text-primary" />
            VisaVerge
          </span>
        </div>
        <div className="flex-none">
          <DarkModeSwitcher />
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero min-h-screen bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10">
        <div className="hero-content text-center">
          <div className="max-w-4xl">
            <div className="mb-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Globe className="w-12 h-12 text-primary" />
                <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  VisaVerge
                </h1>
              </div>
              
              <p className="text-xl mb-8 opacity-80 max-w-3xl mx-auto leading-relaxed">
                The future of visa applications. Smart, transparent, and designed for the digital age.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={startChatDirectly}
                  className="btn-lg gradient-primary text-white border-none"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start with AVA AI Assistant
                </Button>
                
                <Button variant="outline" size="lg">
                  Watch Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Features Grid */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Why Choose VisaVerge?</h2>
          <p className="text-xl opacity-70">Experience the next generation of visa applications</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-primary/10 rounded-full">
                <Zap className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">AI-Powered Guidance</h3>
            <p className="opacity-70 leading-relaxed">
              AVA, our AI assistant, guides you through the entire process, pre-screens your eligibility, and provides personalized recommendations.
            </p>
            <div className="mt-4">
              <Badge variant="primary">
                <Sparkles className="w-3 h-3 mr-1" />
                Smart AI
              </Badge>
            </div>
          </Card>

          <Card className="text-center hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-secondary">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-secondary/10 rounded-full">
                <Shield className="w-8 h-8 text-secondary" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">Real-Time Transparency</h3>
            <p className="opacity-70 leading-relaxed">
              No more "application is being processed." See exactly where your application stands with live updates and approval probability.
            </p>
            <div className="mt-4">
              <Badge variant="secondary">Live Updates</Badge>
            </div>
          </Card>

          <Card className="text-center hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-accent">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-accent/10 rounded-full">
                <Users className="w-8 h-8 text-accent" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">Smart Forms</h3>
            <p className="opacity-70 leading-relaxed">
              Dynamic forms that adapt to your answers, skip irrelevant questions, and auto-validate documents using advanced AI.
            </p>
            <div className="mt-4">
              <Badge variant="accent">Adaptive</Badge>
            </div>
          </Card>
        </div>

        {/* Stats Section */}
        <Card className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Revolutionizing Visa Applications
            </h2>
            <p className="text-lg opacity-70">
              See the difference VisaVerge makes
            </p>
          </div>

          <Stats className="w-full">
            <Stat 
              title="Faster Processing" 
              value="75%" 
              description="↗︎ Compared to traditional methods"
              className="text-primary"
            />
            <Stat 
              title="User Satisfaction" 
              value="90%" 
              description="↗︎ Customer approval rating"
              className="text-secondary"
            />
            <Stat 
              title="Fewer Errors" 
              value="50%" 
              description="↘︎ Reduction in application mistakes"
              className="text-accent"
            />
            <Stat 
              title="AI Support" 
              value="24/7" 
              description="Always available assistance"
              className="text-success"
            />
          </Stats>
        </Card>

        {/* Demo Preview */}
        <Card className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Experience the Future Today
            </h2>
            <p className="text-lg opacity-70">
              Try our AI assistant and see how easy visa applications can be
            </p>
          </div>

          {/* Mini Chat Demo */}
          <div className="max-w-3xl mx-auto">
            <div className="h-96 border border-base-300 rounded-xl overflow-hidden">
              <ChatInterface onVisaTypeSelected={handleVisaTypeSelected} />
            </div>
          </div>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Visa Experience?
            </h2>
            <p className="text-lg opacity-70 mb-8 max-w-2xl mx-auto">
              Join thousands of travelers who have already discovered a better way to apply for visas.
            </p>
            
            <Button
              size="lg"
              onClick={startChatDirectly}
              className="btn-lg gradient-primary text-white border-none"
            >
              Start Your Application Now
              <ArrowRight className="w-6 h-6 ml-2" />
            </Button>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-10 bg-base-300 text-base-content">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Globe className="w-8 h-8 text-primary" />
            VisaVerge
          </div>
          <p className="opacity-70 max-w-md">
            Reimagining embassy services for the digital age
          </p>
          <p className="text-sm opacity-50">
            Built with ❤️ for the Embassy Innovation Hackathon
          </p>
        </div>
      </footer>

      <AlertContainer />
    </div>
  )
}