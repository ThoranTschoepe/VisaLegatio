import { BiasInfluenceAttributeCategory } from '@/types/embassy.types'

export const biasAttributeCategories: BiasInfluenceAttributeCategory[] = [
  {
    id: 'profile',
    title: 'Applicant profile',
    attributes: [
      {
        id: 'origin_region',
        label: 'Origin region',
        explanation:
          "Derived from the applicant's declared nationality and mapped into regional buckets through the bias feature config before one-hot encoding.",
      },
      {
        id: 'wealth_tier',
        label: 'Wealth tier',
        explanation:
          'Computed from income declarations, bank transactions, and sponsor support to place each case into low, medium, or high wealth tiers.',
      },
      {
        id: 'travel_history',
        label: 'Travel history tier',
        explanation:
          'Built from passport stamps and application responses; grouped into none, regional, or global travel exposure prior to modelling.',
      },
    ],
  },
  {
    id: 'documentation',
    title: 'Documentation & verification',
    attributes: [
      {
        id: 'document_density',
        label: 'Document density',
        explanation:
          'Measures submitted-versus-required documents. The ratio is normalised and used as a numeric feature to highlight thorough submissions.',
      },
      {
        id: 'sponsor_verification',
        label: 'Sponsor verification status',
        explanation:
          'Flag indicating whether sponsor identity and financial backing passed the verification workflow (binary feature).',
      },
      {
        id: 'scholarship_flag',
        label: 'Scholarship or grant flag',
        explanation:
          'Captured from supporting letters that confirm external funding sources, signalling lower financial risk.',
      },
    ],
  },
  {
    id: 'risk',
    title: 'Risk & process signals',
    attributes: [
      {
        id: 'automated_risk_score',
        label: 'Automated risk score',
        explanation:
          'Imported directly from the operational risk engine (0–100). Scores are rescaled so coefficients stay comparable across time windows.',
      },
      {
        id: 'visa_type_urgency',
        label: 'Visa type & urgency',
        explanation:
          'Categorical combination of product line and urgency indicator, expanded via one-hot encoding to catch product-specific patterns.',
      },
      {
        id: 'embassy_office',
        label: 'Embassy office identifier',
        explanation:
          'Tags each review with the processing post to surface localised bias trends without merging all data into a single pool.',
      },
    ],
  },
  {
    id: 'history',
    title: 'Case history',
    attributes: [
      {
        id: 'prior_visa_history',
        label: 'Prior visa history',
        explanation:
          'Binary feature indicating previously approved or rejected visas across the network. Highlights potential cumulative effects.',
      },
      {
        id: 'audit_trail',
        label: 'Audit trail signals',
        explanation:
          'Tracks past bias reviews and senior audit outcomes tied to the applicant or similar cases to expose repeat escalations.',
      },
    ],
  },
]
