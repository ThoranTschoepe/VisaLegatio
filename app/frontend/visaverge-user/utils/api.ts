// app/frontend/visaverge-user/utils/api.ts - Updated API integration with Python backend

import { ChatResponse, Question, VisaApplication, VisaType } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// API Client with error handling
class APIClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error)
      throw error
    }
  }

  // Chat with AVA
  async chat(message: string, sessionId?: string): Promise<ChatResponse> {
    const response = await this.request<any>('/chat/', {
      method: 'POST',
      body: JSON.stringify({ 
        message,
        session_id: sessionId 
      }),
    })

    // Transform backend response to frontend format
    return {
      response: response.response,
      suggestedVisaType: response.suggested_visa_type,
      nextAction: response.next_action,
      confidence: response.confidence,
      followUpQuestions: response.follow_up_questions || []
    }
  }

  // Get form questions for a visa type
  async getFormQuestions(visaType: VisaType, currentAnswers: Record<string, any> = {}): Promise<Question[]> {
    const response = await this.request<{ questions: Question[] }>(`/applications/${visaType}/questions`, {
      method: 'GET'
    })
    
    return response.questions
  }

  // Submit visa application
  async submitApplication(application: {
    visaType: VisaType
    answers: Record<string, any>
    documents: any[]
  }): Promise<VisaApplication> {
    const response = await this.request<any>('/applications/', {
      method: 'POST',
      body: JSON.stringify({
        visa_type: application.visaType,
        answers: application.answers,
        documents: application.documents
      }),
    })

    // Transform backend response to frontend format
    return this.transformApplicationResponse(response)
  }

  // Get application status
  async getApplicationStatus(applicationId: string): Promise<VisaApplication> {
    const response = await this.request<any>(`/applications/${applicationId}`)
    return this.transformApplicationResponse(response)
  }

  // Get all applications (for embassy dashboard)
  async getApplications(filters: { status?: string; search?: string } = {}): Promise<VisaApplication[]> {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.search) params.append('search', filters.search)
    
    const queryString = params.toString()
    const endpoint = queryString ? `/applications/?${queryString}` : '/applications/'
    
    const response = await this.request<any[]>(endpoint)
    return response.map(app => this.transformApplicationResponse(app))
  }

  // Update application status (embassy officer)
  async updateApplicationStatus(
    applicationId: string, 
    update: { status?: string; notes?: string; officer_id?: string }
  ): Promise<VisaApplication> {
    const response = await this.request<any>(`/applications/${applicationId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    })
    
    return this.transformApplicationResponse(response)
  }

  // Officer authentication
  async officerLogin(credentials: {
    officer_id: string
    password: string
    embassy: string
  }): Promise<any> {
    return await this.request<any>('/officers/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  // Get analytics data
  async getAnalytics(filters: { embassy_id?: string; days?: number } = {}): Promise<any> {
    const params = new URLSearchParams()
    if (filters.embassy_id) params.append('embassy_id', filters.embassy_id)
    if (filters.days) params.append('days', filters.days.toString())
    
    const queryString = params.toString()
    const endpoint = queryString ? `/analytics/dashboard?${queryString}` : '/analytics/dashboard'
    
    return await this.request<any>(endpoint)
  }

  // Upload document
  async uploadDocument(
    applicationId: string,
    documentType: string,
    file: File
  ): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('application_id', applicationId)
    formData.append('document_type', documentType)

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    return await response.json()
  }

  // Get chat history
  async getChatHistory(sessionId: string): Promise<any[]> {
    return await this.request<any[]>(`/chat/history/${sessionId}`)
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return await this.request<{ status: string }>('/health')
  }

  // Transform backend application response to frontend format
  private transformApplicationResponse(backendApp: any): VisaApplication {
    return {
      id: backendApp.id,
      userId: backendApp.user_id,
      visaType: backendApp.visa_type,
      status: backendApp.status,
      answers: backendApp.answers || {},
      documents: backendApp.documents || [],
      createdAt: new Date(backendApp.submitted_at),
      updatedAt: new Date(backendApp.updated_at),
      submittedAt: backendApp.submitted_at ? new Date(backendApp.submitted_at) : undefined,
      estimatedDecision: backendApp.estimated_decision ? new Date(backendApp.estimated_decision) : undefined,
      approvalProbability: backendApp.approval_probability,
      
      // Additional fields from backend
      applicantName: backendApp.applicant_name || backendApp.answers?.applicant_name,
      country: backendApp.country || backendApp.answers?.destination_country,
      priority: backendApp.priority,
      riskScore: backendApp.risk_score,
      documentsCount: backendApp.documents_count || (backendApp.documents?.length || 0),
      estimatedDays: backendApp.estimated_days,
      lastActivity: backendApp.last_activity ? new Date(backendApp.last_activity) : new Date(backendApp.updated_at)
    }
  }
}

// Create API instance
export const api = new APIClient()

// Export additional utilities
export const apiUtils = {
  // Check if backend is available
  async isBackendAvailable(): Promise<boolean> {
    try {
      await api.healthCheck()
      return true
    } catch (error) {
      console.warn('Backend not available, falling back to mock data')
      return false
    }
  },

  // Generate session ID for chat
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },

  // Format error messages for users
  formatErrorMessage(error: any): string {
    if (error.message) {
      return error.message
    }
    
    if (typeof error === 'string') {
      return error
    }
    
    return 'An unexpected error occurred. Please try again.'
  },

  // Get status color helper (for UI components)
  getStatusColor(status: string): string {
    switch (status) {
      case 'approved':
        return 'text-green-600'
      case 'rejected':
        return 'text-red-600'
      case 'requires_interview':
        return 'text-yellow-600'
      case 'submitted':
        return 'text-blue-600'
      case 'document_review':
      case 'background_check':
      case 'officer_review':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  },

  // Get priority color helper
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'text-red-600'
      case 'high':
        return 'text-orange-600'
      case 'normal':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  },

  // Get risk score color helper
  getRiskColor(score: number): string {
    if (score < 10) return 'text-green-600'
    if (score < 20) return 'text-yellow-600'
    return 'text-red-600'
  }
}