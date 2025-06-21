'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Save, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Question, VisaType } from '@/types'
import { api } from '@/utils/api'

interface DynamicFormProps {
  visaType: VisaType
  onSubmit?: (answers: Record<string, any>) => void
  onBack?: () => void
}

export default function DynamicForm({ visaType, onSubmit, onBack }: DynamicFormProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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
    }
  }

  const goToPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(answers)
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your personalized form...</p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No questions available</h3>
        <p className="text-gray-600">Please try again or contact support.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{getVisaTypeTitle(visaType)}</h2>
            <p className="text-blue-100 text-sm mt-1">
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
          <div className="flex justify-between text-sm text-blue-100 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="w-full bg-blue-500 bg-opacity-30 rounded-full h-2">
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
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
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[currentQuestion.id] ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your answer..."
                />
                {errors[currentQuestion.id] && (
                  <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
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
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {answers[currentQuestion.id] === option && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
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
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[currentQuestion.id] ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter number..."
                />
                {currentQuestion.validation && (
                  <p className="text-gray-500 text-sm mt-2">
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
                  <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
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
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[currentQuestion.id] ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors[currentQuestion.id] && (
                  <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
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
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={currentQuestionIndex === 0 && !onBack}
          >
            <ChevronLeft className="w-4 h-4" />
            {currentQuestionIndex === 0 && onBack ? 'Back to Chat' : 'Previous'}
          </button>

          <div className="flex gap-3">
            {!isLastQuestion ? (
              <button
                onClick={goToNext}
                disabled={!canProceed}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
                Submit Application
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form summary sidebar (for larger screens) */}
      <div className="hidden lg:block fixed right-4 top-24 w-64 bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
        <h4 className="font-semibold text-gray-800 mb-3">Your Answers</h4>
        <div className="space-y-2">
          {questions.slice(0, currentQuestionIndex + 1).map((q, index) => (
            <div key={q.id} className="text-sm">
              <p className="text-gray-600 font-medium">{q.text}</p>
              <p className="text-gray-800">{answers[q.id] || 'Not answered'}</p>
              {index < currentQuestionIndex && (
                <div className="w-full h-px bg-gray-200 my-2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}