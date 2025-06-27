// app/frontend/visaverge-user/utils/api.ts - Real document upload implementation

import { ChatResponse, Question, VisaApplication, VisaType } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// API Client with error handling
class APIClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}/api${endpoint}`
    
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

  // Flag a document (new endpoint)
  async flagDocument(
    applicationId: string, 
    documentId: string,
    reason: string,
    officerId?: string
  ): Promise<{ message: string; flag_id: string; document_id: string; reason: string }> {
    return await this.request(`/applications/${applicationId}/flag-document`, {
      method: 'POST',
      body: JSON.stringify({
        document_id: documentId,
        reason: reason,
        officer_id: officerId
      }),
    })
  }

  // Unflag a document (new endpoint)
  async unflagDocument(
    applicationId: string,
    flagId: string
  ): Promise<{ message: string; flag_id: string }> {
    return await this.request(`/applications/${applicationId}/unflag-document`, {
      method: 'POST',
      body: JSON.stringify({
        flag_id: flagId
      }),
    })
  }


  // Upload documents to existing application - REAL IMPLEMENTATION
  async uploadDocumentsToApplication(
    applicationId: string,
    documents: Array<{ file: File; type: string }>
  ): Promise<any[]> {
    const uploadPromises = documents.map(async ({ file, type }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('application_id', applicationId)
      formData.append('document_type', type)

      // Use fetch directly for file upload (no JSON content-type)
      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let browser set it with boundary for multipart
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Upload failed for ${file.name}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log(`✅ Successfully uploaded ${file.name}:`, result)
      return result
    })

    try {
      const results = await Promise.all(uploadPromises)
      
      // After successful uploads, update application status if needed
      try {
        await this.notifyDocumentUpload(applicationId, results)
      } catch (error) {
        console.warn('Failed to notify backend of document upload:', error)
        // Don't fail the upload if notification fails
      }
      
      return results
    } catch (error) {
      console.error('Document upload failed:', error)
      throw error
    }
  }

  // Notify backend about document upload to update application status
  private async notifyDocumentUpload(applicationId: string, uploadResults: any[]): Promise<void> {
    await this.request(`/applications/${applicationId}/documents`, {
      method: 'POST',
      body: JSON.stringify(uploadResults.map(result => ({
        id: result.id,
        name: result.name,
        type: result.type,
        verified: result.verified
     })))
    })
  }

  // Delete a document
  async deleteDocument(applicationId: string, documentType: string): Promise<void> {
    await this.request(`/documents/${applicationId}/${documentType}`, {
      method: 'DELETE'
    })
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
    documents?: any[]
    password?: string
  }): Promise<VisaApplication> {
    const response = await this.request<any>('/applications/', {
      method: 'POST',
      body: JSON.stringify({
        visa_type: application.visaType,
        answers: application.answers,
        documents: application.documents || [],
        password: application.password
      }),
    })

    return this.transformApplicationResponse(response)
  }

  // Get document requirements for a visa type
  async getDocumentRequirements(visaType: VisaType): Promise<{
    visa_type: string
    mandatory_documents: string[]
    optional_documents: string[]
    total_mandatory: number
    total_optional: number
  }> {
    const response = await this.request<any>(`/documents/${visaType}/requirements`)
    return response
  }

  // Get documents for an application
  async getApplicationDocuments(applicationId: string): Promise<Array<{
    id: string
    name: string
    type: string
    size: number
    verified: boolean
    uploaded_at: string
    file_path?: string
  }>> {
    const response = await this.request<any[]>(`/documents/application/${applicationId}`)
    return response
  }

  // Get application status with password validation
  async getApplicationWithPassword(applicationId: string, password: string): Promise<VisaApplication> {
    const response = await this.request<any>(`/applications/${applicationId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
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
      lastActivity: backendApp.last_activity ? new Date(backendApp.last_activity) : new Date(backendApp.updated_at),
      
      // Flagged documents (supports multiple)
      flaggedDocuments: backendApp.flagged_documents?.map((flag: any) => ({
        id: flag.id,
        userId: flag.user_id,
        documentId: flag.document_id,
        applicationId: flag.application_id,
        reason: flag.reason,
        flaggedByOfficerId: flag.flagged_by_officer_id,
        flaggedAt: new Date(flag.flagged_at),
        resolved: flag.resolved,
        resolvedAt: flag.resolved_at ? new Date(flag.resolved_at) : undefined,
        document: flag.document
      })) || []
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
      console.warn('Backend not available:', error)
      return false
    }
  },

  // Generate session ID for chat
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },

  // Generate application ID
  generateApplicationId(): string {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `VSV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${random}`
  },

  // Generate secure password
  generateSecurePassword(): string {
    const adjectives = ['Swift', 'Bright', 'Clear', 'Quick', 'Smart', 'Safe', 'Fast', 'Bold', 'Strong', 'Secure']
    const nouns = ['Lion', 'Eagle', 'Tiger', 'Star', 'Moon', 'Sun', 'Wave', 'Wind', 'Rock', 'Tree']
    const numbers = Math.floor(Math.random() * 999) + 100
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    
    return `${adj}${noun}${numbers}`
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

  // Create QR code URL
  createQRCodeUrl(data: string, size: number = 200): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
  },

  // Store document progress in localStorage (for demo persistence)
  storeDocumentProgress(applicationId: string, documents: any[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`docs_${applicationId}`, JSON.stringify(documents))
    }
  },

  // Get document progress from localStorage (for demo persistence)
  getDocumentProgress(applicationId: string): any[] {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`docs_${applicationId}`)
      return stored ? JSON.parse(stored) : []
    }
    return []
  },

  // Clear document progress
  clearDocumentProgress(applicationId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`docs_${applicationId}`)
    }
  },

  // Validate file before upload
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return { valid: false, error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB` }
    }

    // Check file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png']
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return { 
        valid: false, 
        error: `File type not supported. Allowed types: PDF, JPG, JPEG, PNG` 
      }
    }

    // Check minimum file size (1KB)
    if (file.size < 1024) {
      return { valid: false, error: 'File too small. Minimum size is 1KB' }
    }

    return { valid: true }
  }
}