// Export all embassy components for easy importing

export { default as EmbassyLogin } from './EmbassyLogin'
export { default as EmbassyDashboard } from './EmbassyDashboard'
export { default as ApplicationReview } from './ApplicationReview'
export { default as AnalyticsDashboard } from './AnalyticsDashboard'

// Re-export types for convenience
export type {
  Officer,
  Embassy,
  LoginCredentials,
  EmbassyApplication,
  EmbassyDocument,
  ApplicationReviewData,
  StatusUpdate,
  AnalyticsData
} from '@/types/embassy.types'