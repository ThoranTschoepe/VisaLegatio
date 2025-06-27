'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Save, Send, AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Shield } from 'lucide-react'
import { Question, VisaType } from '@/types'
import { api } from '@/utils/api'

interface DynamicFormProps {
  visaType: VisaType
  onSubmit?: (answers: Record<string, any>, password: string) => void
  onBack?: () => void
}

export default function DynamicForm({ visaType, onSubmit, onBack }: DynamicFormProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showPasswordStep, setShowPasswordStep] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Load questions when visa type changes
  useEffect(() => {
    loadQuestions()
  }, [visaType])

  // Auto-save answers
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      autoSave()
    }
  }, [answers])

  // Generate a secure password suggestion
  useEffect(() => {
    if (showPasswordStep && !password) {
      const generatePassword = () => {
        const adjectives = ['Swift', 'Bright', 'Clear', 'Quick', 'Smart', 'Safe', 'Fast', 'Bold']
        const nouns = ['Lion', 'Eagle', 'Tiger', 'Star', 'Moon', 'Sun', 'Wave', 'Wind']
        const numbers = Math.floor(Math.random() * 999) + 100
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
        const noun = nouns[Math.floor(Math.random() * nouns.length)]
        
        return `${adj}${noun}${numbers}`
      }
      
      const suggestedPassword = generatePassword()
      setPassword(suggestedPassword)
      setConfirmPassword(suggestedPassword)
    }
  }, [showPasswordStep])

  const loadQuestions = async () => {
    setIsLoading(true)
    try {
      const loadedQuestions = await api.getFormQuestions(visaType, answers)
      setQuestions(loadedQuestions)
    } catch (error) {
      console.error('Error loading questions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const autoSave = async () => {
    setIsSaving(true)
    // Simulate auto-save
    setTimeout(() => setIsSaving(false), 500)
  }

  const validateAnswer = (question: Question, value: any): string | null => {
    if (question.required && (!value || value.toString().trim() === '')) {
      return 'This field is required'
    }

    if (question.validation) {
      if (question.type === 'number') {
        const numValue = parseFloat(value)
        if (question.validation.min && numValue < question.validation.min) {
          return question.validation.message || `Minimum value is ${question.validation.min}`
        }
        if (question.validation.max && numValue > question.validation.max) {
          return question.validation.message || `Maximum value is ${question.validation.max}`
        }
      }

      if (question.validation.pattern) {
        const regex = new RegExp(question.validation.pattern)
        if (!regex.test(value.toString())) {
          return question.validation.message || 'Invalid format'
        }
      }
    }

    return null
  }

  const validatePassword = (): boolean => {
    setPasswordError('')
    
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return false
    }
    
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return false
    }
    
    return true
  }

  const handleAnswer = (questionId: string, value: any) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    // Validate the answer
    const error = validateAnswer(question, value)
    
    setErrors(prev => ({
      ...prev,
      [questionId]: error || ''
    }))

    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0
  const canProceed = currentQuestion && answers[currentQuestion.id] && !errors[currentQuestion.id]
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  const goToNext = () => {
    if (canProceed && !isLastQuestion) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else if (canProceed && isLastQuestion) {
      // Go to password step
      setShowPasswordStep(true)
    }
  }

  const goToPrevious = () => {
    if (showPasswordStep) {
      setShowPasswordStep(false)
    } else if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmit = () => {
    if (!validatePassword()) {
      return
    }
    
    if (onSubmit) {
      onSubmit(answers, password)
    }
  }

  const getVisaTypeTitle = (type: VisaType): string => {
    const titles = {
      tourist: 'Tourist Visa Application',
      business: 'Business Visa Application',
      student: 'Student Visa Application',
      work: 'Work Visa Application',
      family_visit: 'Family Visit Visa Application',
      transit: 'Transit Visa Application'
    }
    return titles[type] || 'Visa Application'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary mx-auto mb-4"></div>
          <p className="text-base-content/70">Loading your personalized form...</p>
        </div>
      </div>
    )
  }

  if (!currentQuestion && !showPasswordStep) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-base-content mb-2">No questions available</h3>
        <p className="text-base-content/70">Please try again or contact support.</p>
      </div>
    )
  }

  if (showPasswordStep) {
    return (
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-success to-primary text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Secure Your Application</h2>
              <p className="text-success-content/80 text-sm mt-1">
                Set a password to access your application later
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-5 h-5" />
              <span>Secure</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-success-content/80 mb-2">
              <span>Ready to Submit</span>
              <span>100% complete</span>
            </div>
            <div className="w-full bg-success/30 rounded-full h-2">
              <div className="bg-white h-2 rounded-full w-full" />
            </div>
          </div>
        </div>

        {/* Password Form */}
        <div className="p-6">
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-base-content mb-2">
                Create Your Access Password
              </h3>
              <p className="text-base-content/70 text-sm">
                You'll use this password to check your application status and upload documents later
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input input-bordered w-full pr-12 font-mono"
                    placeholder="Enter a secure password..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/40 hover:text-base-content/60"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-base-content mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input input-bordered w-full pr-12 font-mono"
                    placeholder="Confirm your password..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/40 hover:text-base-content/60"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="alert alert-error">
                  <p className="text-error text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </p>
                </div>
              )}

              <div className="alert alert-info">
                <h4 className="font-semibold text-info-content text-sm mb-2">💡 Password Tips</h4>
                <ul className="text-info-content text-sm space-y-1">
                  <li>• We've suggested a secure password for you</li>
                  <li>• You can change it to something memorable</li>
                  <li>• Minimum 6 characters required</li>
                  <li>• You'll need this to access your application later</li>
                </ul>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6 border-t">
              <button
                onClick={goToPrevious}
                className="btn btn-ghost"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Questions
              </button>

              <button
                onClick={handleSubmit}
                disabled={!password || !confirmPassword}
                className="btn btn-success"
              >
                <Send className="w-4 h-4" />
                Submit Application
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-secondary text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{getVisaTypeTitle(visaType)}</h2>
            <p className="text-primary-content/80 text-sm mt-1">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {isSaving && (
              <>
                <Save className="w-4 h-4 animate-pulse" />
                <span>Saving...</span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-primary-content/80 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="w-full bg-primary/30 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-base-content mb-4">
            {currentQuestion.text}
          </h3>

          {/* Answer input based on question type */}
          <div className="space-y-4">
            {currentQuestion.type === 'text' && (
              <div>
                <input
                  type="text"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  className={`input input-bordered w-full ${
                    errors[currentQuestion.id] ? 'input-error' : ''
                  }`}
                  placeholder="Enter your answer..."
                />
                {errors[currentQuestion.id] && (
                  <p className="text-error text-sm mt-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errors[currentQuestion.id]}
                  </p>
                )}
              </div>
            )}

            {currentQuestion.type === 'select' && (
              <div className="grid gap-3">
                {currentQuestion.options?.map(option => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(currentQuestion.id, option)}
                    className={`p-4 text-left border rounded-lg transition-all ${
                      answers[currentQuestion.id] === option
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-base-300 hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {answers[currentQuestion.id] === option && (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'number' && (
              <div>
                <input
                  type="number"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  min={currentQuestion.validation?.min}
                  max={currentQuestion.validation?.max}
                  className={`input input-bordered w-full ${
                    errors[currentQuestion.id] ? 'input-error' : ''
                  }`}
                  placeholder="Enter number..."
                />
                {currentQuestion.validation && (
                  <p className="text-base-content/60 text-sm mt-2">
                    {currentQuestion.validation.min && currentQuestion.validation.max
                      ? `Enter a number between ${currentQuestion.validation.min} and ${currentQuestion.validation.max}`
                      : currentQuestion.validation.min
                      ? `Minimum: ${currentQuestion.validation.min}`
                      : currentQuestion.validation.max
                      ? `Maximum: ${currentQuestion.validation.max}`
                      : ''
                    }
                  </p>
                )}
                {errors[currentQuestion.id] && (
                  <p className="text-error text-sm mt-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errors[currentQuestion.id]}
                  </p>
                )}
              </div>
            )}

            {currentQuestion.type === 'date' && (
              <div>
                <input
                  type="date"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  className={`input input-bordered w-full ${
                    errors[currentQuestion.id] ? 'input-error' : ''
                  }`}
                />
                {errors[currentQuestion.id] && (
                  <p className="text-error text-sm mt-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errors[currentQuestion.id]}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6 border-t">
          <button
            onClick={onBack || goToPrevious}
            className="btn btn-ghost"
            disabled={currentQuestionIndex === 0 && !onBack}
          >
            <ChevronLeft className="w-4 h-4" />
            {currentQuestionIndex === 0 && onBack ? 'Back to Chat' : 'Previous'}
          </button>

          <button
            onClick={goToNext}
            disabled={!canProceed}
            className="btn btn-primary"
          >
            {isLastQuestion ? 'Continue to Security' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form summary sidebar (for larger screens) */}
      <div className="hidden lg:block fixed right-4 top-24 w-64 card bg-base-100 shadow-xl p-4 max-h-96 overflow-y-auto">
        <h4 className="font-semibold text-base-content mb-3">Your Answers</h4>
        <div className="space-y-2">
          {questions.slice(0, currentQuestionIndex + 1).map((q, index) => (
            <div key={q.id} className="text-sm">
              <p className="text-base-content/70 font-medium">{q.text}</p>
              <p className="text-base-content">{answers[q.id] || 'Not answered'}</p>
              {index < currentQuestionIndex && (
                <div className="w-full h-px bg-base-300 my-2" />
              )}
            </div>
          ))}
        </div>
        
        {/* Next Step Preview */}
        <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
          <h5 className="font-semibold text-success text-sm mb-1">Next Step</h5>
          <p className="text-success text-xs">
            Set your access password and submit your application for immediate processing!
          </p>
        </div>
      </div>
    </div>
  )
}