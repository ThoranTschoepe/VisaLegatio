// types/index.ts

export interface Message {
  id: string
  text: string
  sender: 'user' | 'ava'
  timestamp: Date
  metadata?: {
    suggestedVisaType?: string
    nextAction?: string
    confidence?: number
  }
}

export interface Question {
  id: string
  text: string
  type: 'text' | 'select' | 'number' | 'date' | 'file'
  options?: string[]
  required?: boolean
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
  dependsOn?: {
    questionId: string
    value: any
  }
}

export interface VisaApplication {
  id: string
  userId: string
  visaType: string
  status: ApplicationStatus
  answers: Record<string, any>
  documents: Document[]
  createdAt: Date
  updatedAt: Date
  submittedAt?: Date
  estimatedDecision?: Date
  approvalProbability?: number
}

export interface Document {
  id: string
  name: string
  type: DocumentType
  size: number
  uploadedAt: Date
  verified: boolean
  url?: string
}

export type ApplicationStatus = 
  | 'draft'
  | 'submitted' 
  | 'document_review'
  | 'background_check'
  | 'officer_review'
  | 'approved'
  | 'rejected'
  | 'requires_interview'

export type DocumentType = 
  | 'passport'
  | 'photo'
  | 'bank_statement'
  | 'invitation_letter'
  | 'travel_insurance'
  | 'employment_letter'
  | 'flight_itinerary'

export type VisaType = 
  | 'tourist'
  | 'business' 
  | 'student'
  | 'work'
  | 'family_visit'
  | 'transit'

export interface ChatResponse {
  response: string
  suggestedVisaType?: VisaType
  nextAction: 'continue_chat' | 'start_form' | 'upload_documents' | 'submit_application'
  confidence?: number
  followUpQuestions?: string[]
}