// Embassy-specific types

export interface Officer {
  id: string
  name: string
  role: string
  embassy: string
}

export interface Embassy {
  id: string
  name: string
  country: string
  location: string
}

export interface LoginCredentials {
  officerId: string
  password: string
  embassy: string
}

export interface EmbassyApplication {
  id: string
  applicantName: string
  visaType: string
  status: 'submitted' | 'document_review' | 'background_check' | 'officer_review' | 'approved' | 'rejected'
  submittedAt: Date
  priority: 'low' | 'normal' | 'high' | 'urgent'
  country: string
  documentsCount: number
  riskScore: number
  estimatedDays: number
  lastActivity: Date
  flaggedDocuments?: FlaggedDocument[]
}

export interface FlaggedDocument {
  id: string
  userId: string
  documentId: string
  applicationId: string
  reason: string
  flaggedByOfficerId?: string
  flaggedAt: Date
  resolved: boolean
  resolvedAt?: Date
  document?: EmbassyDocument
}

export interface EmbassyDocument {
  id: string
  name: string
  type: string
  verified: boolean
  uploadedAt: string
  size?: number
  url?: string
}

export interface ApplicationReviewData {
  application: EmbassyApplication
  documents: EmbassyDocument[]
  answers: Record<string, any>
  history: StatusUpdate[]
}

export interface StatusUpdate {
  id: string
  status: string
  timestamp: Date
  officerId: string
  notes?: string
}

export interface AnalyticsData {
  totalApplications: number
  approvalRate: number
  avgProcessingTime: number
  pendingApplications: number
  trendsData: {
    month: string
    applications: number
    approvals: number
    rejections: number
  }[]
  visaTypeDistribution: {
    type: string
    count: number
    percentage: number
  }[]
  countryStats: {
    country: string
    applications: number
    approvalRate: number
  }[]
  processingTimeByType: {
    visaType: string
    avgDays: number
    trend: 'up' | 'down' | 'stable'
  }[]
}

export interface BiasReviewCase {
  application: {
    id: string
    applicantName: string
    visaType: string
    status: string
    submittedAt?: string | null
    country: string
    riskScore: number
    documentsCount: number
  }
  rejectionReason: string
  aiConfidence: number
  reviewed: boolean
  reviewResult?: 'justified' | 'biased' | 'uncertain'
  reviewNotes?: string
  reviewedBy?: string
  reviewedAt?: string
  auditStatus: string
}

export interface BiasReviewStatistics {
  totalRejected: number
  sampleSize: number
  reviewedCount: number
  biasDetectedCount: number
  biasRate: number
  commonBiasPatterns: string[]
}

export interface BiasMonitoringMetrics {
  totalRejected: number
  sampledCount: number
  reviewedCount: number
  biasDetectedCount: number
  biasRate: number
  biasByCountry: Record<string, number>
  biasByVisaType: Record<string, number>
  auditStatusBreakdown: Record<string, number>
  commonBiasPatterns: string[]
  alerts: string[]
  windowDays: number
}

export interface BiasMonitoringSnapshot {
  snapshotId: string
  generatedAt: string | null
  metrics: BiasMonitoringMetrics
}

export interface BiasAuditDecision {
  id: string
  auditorId: string
  decision: 'validated' | 'overturned' | 'escalated' | 'training_needed'
  notes?: string
  createdAt?: string
}

export interface BiasAuditItem {
  review: {
    id: string
    applicationId: string
    officerId: string | null
    result: 'justified' | 'biased' | 'uncertain'
    notes?: string
    auditStatus: string
    reviewedAt?: string
  }
  application: {
    id: string
    visaType: string | null
    status: string | null
    riskScore: number | null
    country: string
    applicantName: string
  }
  audits: BiasAuditDecision[]
}

// Mock data constants
export const MOCK_EMBASSIES: Embassy[] = [
  { id: 'us_berlin', name: 'U.S. Embassy Berlin', country: 'Germany', location: 'Berlin, Germany' },
  { id: 'us_london', name: 'U.S. Embassy London', country: 'United Kingdom', location: 'London, UK' },
  { id: 'us_paris', name: 'U.S. Embassy Paris', country: 'France', location: 'Paris, France' },
  { id: 'us_tokyo', name: 'U.S. Embassy Tokyo', country: 'Japan', location: 'Tokyo, Japan' }
]

export const MOCK_OFFICERS = {
  'maria.schmidt': { password: 'demo123', name: 'Officer Maria Schmidt', role: 'Senior Consular Officer' },
  'john.davis': { password: 'demo123', name: 'Officer John Davis', role: 'Consular Officer' },
  'admin': { password: 'admin', name: 'Administrator', role: 'System Administrator' }
} as const
