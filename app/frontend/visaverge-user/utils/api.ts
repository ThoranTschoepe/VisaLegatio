// utils/api.ts

import { ChatResponse, Question, VisaApplication, VisaType } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Mock API responses for development (replace with real API calls later)
export const api = {
  // Chat with AVA
  async chat(message: string): Promise<ChatResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('tourist') || lowerMessage.includes('vacation') || lowerMessage.includes('holiday')) {
      return {
        response: "Perfect! For a tourist visa, you'll typically need a passport, bank statements, travel insurance, and a travel itinerary. The process usually takes 5-10 business days. Would you like me to start your application?",
        suggestedVisaType: 'tourist',
        nextAction: 'start_form',
        confidence: 0.9,
        followUpQuestions: ["How long do you plan to stay?", "Which country are you visiting?"]
      }
    }
    
    if (lowerMessage.includes('business') || lowerMessage.includes('work') || lowerMessage.includes('conference')) {
      return {
        response: "Great! For a business visa, you'll need an invitation letter from the company, your employment details, and proof of business activities. This typically takes 7-15 business days. Shall we begin your application?",
        suggestedVisaType: 'business',
        nextAction: 'start_form',
        confidence: 0.85,
        followUpQuestions: ["Do you have an invitation letter?", "What type of business activities?"]
      }
    }
    
    if (lowerMessage.includes('student') || lowerMessage.includes('study') || lowerMessage.includes('university')) {
      return {
        response: "Excellent! For a student visa, you'll need an acceptance letter from your educational institution, proof of finances, and academic transcripts. Processing takes 15-30 business days. Ready to start?",
        suggestedVisaType: 'student',
        nextAction: 'start_form',
        confidence: 0.92
      }
    }
    
    if (lowerMessage.includes('family') || lowerMessage.includes('visit') || lowerMessage.includes('relative')) {
      return {
        response: "I understand you want to visit family! You'll need an invitation from your family member, proof of relationship, and financial documentation. Processing typically takes 10-20 business days. Let's get started!",
        suggestedVisaType: 'family_visit',
        nextAction: 'start_form',
        confidence: 0.88
      }
    }
    
    return {
      response: "Hi! I'm AVA, your AI visa assistant. I can help you with tourist, business, student, work, or family visit visas. What type of travel are you planning? 🛂✈️",
      nextAction: 'continue_chat',
      confidence: 0.5
    }
  },

  // Get dynamic form questions
  async getFormQuestions(visaType: VisaType, currentAnswers: Record<string, any> = {}): Promise<Question[]> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const baseQuestions: Record<VisaType, Question[]> = {
      tourist: [
        {
          id: 'destination_country',
          text: 'Which country are you planning to visit?',
          type: 'select',
          options: ['Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Other'],
          required: true
        },
        {
          id: 'travel_purpose',
          text: 'What is the main purpose of your visit?',
          type: 'select',
          options: ['Sightseeing', 'Visiting friends/family', 'Cultural events', 'Medical treatment'],
          required: true
        },
        {
          id: 'duration',
          text: 'How many days do you plan to stay?',
          type: 'number',
          required: true,
          validation: { min: 1, max: 90, message: 'Tourist stays are typically 1-90 days' }
        },
        {
          id: 'accommodation',
          text: 'Where will you be staying?',
          type: 'select',
          options: ['Hotel', 'Airbnb', 'With friends/family', 'Hostel', 'Other'],
          required: true
        }
      ],
      business: [
        {
          id: 'destination_country',
          text: 'Which country is your business visit to?',
          type: 'select',
          options: ['Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Other'],
          required: true
        },
        {
          id: 'business_purpose',
          text: 'What type of business activities?',
          type: 'select',
          options: ['Conference/Meeting', 'Training', 'Negotiations', 'Site visit', 'Trade fair'],
          required: true
        },
        {
          id: 'company_name',
          text: 'What is your company name?',
          type: 'text',
          required: true
        },
        {
          id: 'invitation_company',
          text: 'Name of the inviting company/organization',
          type: 'text',
          required: true
        },
        {
          id: 'duration',
          text: 'Duration of business visit (days)?',
          type: 'number',
          required: true,
          validation: { min: 1, max: 30, message: 'Business visits are typically 1-30 days' }
        }
      ],
      student: [
        {
          id: 'destination_country',
          text: 'Which country will you study in?',
          type: 'select',
          options: ['Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Other'],
          required: true
        },
        {
          id: 'institution_name',
          text: 'Name of educational institution',
          type: 'text',
          required: true
        },
        {
          id: 'study_level',
          text: 'Level of study',
          type: 'select',
          options: ['Bachelor\'s degree', 'Master\'s degree', 'PhD', 'Exchange program', 'Language course'],
          required: true
        },
        {
          id: 'study_duration',
          text: 'Duration of studies (months)',
          type: 'number',
          required: true,
          validation: { min: 1, max: 60, message: 'Study duration typically 1-60 months' }
        }
      ],
      work: [
        {
          id: 'destination_country',
          text: 'Which country will you work in?',
          type: 'select',
          options: ['Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Other'],
          required: true
        },
        {
          id: 'job_title',
          text: 'Job title/position',
          type: 'text',
          required: true
        },
        {
          id: 'employer_name',
          text: 'Employer company name',
          type: 'text',
          required: true
        },
        {
          id: 'contract_duration',
          text: 'Contract duration (months)',
          type: 'number',
          required: true,
          validation: { min: 1, max: 60, message: 'Work contracts typically 1-60 months' }
        }
      ],
      family_visit: [
        {
          id: 'destination_country',
          text: 'Which country are you visiting?',
          type: 'select',
          options: ['Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Other'],
          required: true
        },
        {
          id: 'relationship',
          text: 'Relationship to person you\'re visiting',
          type: 'select',
          options: ['Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Other family'],
          required: true
        },
        {
          id: 'host_name',
          text: 'Name of person you\'re visiting',
          type: 'text',
          required: true
        },
        {
          id: 'visit_duration',
          text: 'Duration of visit (days)',
          type: 'number',
          required: true,
          validation: { min: 1, max: 180, message: 'Family visits typically 1-180 days' }
        }
      ],
      transit: [
        {
          id: 'transit_country',
          text: 'Which country are you transiting through?',
          type: 'select',
          options: ['Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Other'],
          required: true
        },
        {
          id: 'final_destination',
          text: 'What is your final destination?',
          type: 'text',
          required: true
        },
        {
          id: 'transit_duration',
          text: 'How long is your layover (hours)?',
          type: 'number',
          required: true,
          validation: { min: 1, max: 24, message: 'Transit typically 1-24 hours' }
        }
      ]
    }
    
    return baseQuestions[visaType] || []
  },

  // Submit application
  async submitApplication(application: Partial<VisaApplication>): Promise<VisaApplication> {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const now = new Date()
    const estimatedDecision = new Date(now.getTime() + (10 * 24 * 60 * 60 * 1000)) // 10 days from now
    
    return {
      id: `app_${Date.now()}`,
      userId: 'user_123',
      visaType: application.visaType!,
      status: 'submitted',
      answers: application.answers || {},
      documents: application.documents || [],
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      estimatedDecision,
      approvalProbability: Math.floor(Math.random() * 30) + 70 // 70-100%
    }
  },

  // Get application status
  async getApplicationStatus(applicationId: string): Promise<VisaApplication> {
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Mock status progression
    const statuses: any[] = ['submitted', 'document_review', 'background_check', 'officer_review']
    const currentStatusIndex = Math.floor(Math.random() * statuses.length)
    
    return {
      id: applicationId,
      userId: 'user_123',
      visaType: 'tourist',
      status: statuses[currentStatusIndex],
      answers: {},
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      approvalProbability: Math.floor(Math.random() * 30) + 70
    }
  }
}