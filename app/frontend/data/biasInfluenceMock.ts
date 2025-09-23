export interface BiasAttributeDefinition {
  id: string
  label: string
  explanation: string
  categoryId: string
}

export interface BiasAttributeCategory {
  id: string
  title: string
  attributes: BiasAttributeDefinition[]
}

export interface BiasFactorScore {
  attributeId: string
  displayLabel?: string
  coefficient: number
  oddsRatio: number
  sampleShare: number
  pValue: number
  delta: number
  percentWeight: number
  direction: 'driver' | 'buffer'
  relatedSegments: Array<{ label: string; share: number }>
}

export const biasAttributeCategories: BiasAttributeCategory[] = [
  {
    id: 'profile',
    title: 'Applicant profile',
    attributes: [
      {
        id: 'origin_region',
        label: 'Origin region',
        explanation:
          "Derived from the applicant's declared nationality and mapped into regional buckets through the bias feature config before one-hot encoding.",
        categoryId: 'profile',
      },
      {
        id: 'wealth_tier',
        label: 'Wealth tier',
        explanation:
          'Computed from income declarations, bank transactions, and sponsor support to place each case into low, medium, or high wealth tiers.',
        categoryId: 'profile',
      },
      {
        id: 'travel_history',
        label: 'Travel history tier',
        explanation:
          'Built from passport stamps and application responses; grouped into none, regional, or global travel exposure prior to modelling.',
        categoryId: 'profile',
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
        categoryId: 'documentation',
      },
      {
        id: 'sponsor_verification',
        label: 'Sponsor verification status',
        explanation:
          'Flag indicating whether sponsor identity and financial backing passed the verification workflow (binary feature).',
        categoryId: 'documentation',
      },
      {
        id: 'scholarship_flag',
        label: 'Scholarship or grant flag',
        explanation:
          'Captured from supporting letters that confirm external funding sources, signalling lower financial risk.',
        categoryId: 'documentation',
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
        categoryId: 'risk',
      },
      {
        id: 'visa_type_urgency',
        label: 'Visa type & urgency',
        explanation:
          'Categorical combination of product line and urgency indicator, expanded via one-hot encoding to catch product-specific patterns.',
        categoryId: 'risk',
      },
      {
        id: 'embassy_office',
        label: 'Embassy office identifier',
        explanation:
          'Tags each review with the processing post to surface localised bias trends without merging all data into a single pool.',
        categoryId: 'risk',
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
        categoryId: 'history',
      },
      {
        id: 'audit_trail',
        label: 'Audit trail signals',
        explanation:
          'Tracks past bias reviews and senior audit outcomes tied to the applicant or similar cases to expose repeat escalations.',
        categoryId: 'history',
      },
    ],
  },
]

export const biasAttributeMap = biasAttributeCategories
  .flatMap(category => category.attributes)
  .reduce<Record<string, BiasAttributeDefinition>>((acc, attribute) => {
    acc[attribute.id] = attribute
    return acc
  }, {})

export const biasFactorScores: BiasFactorScore[] = [
  {
    attributeId: 'origin_region',
    displayLabel: 'Origin Region · West Africa',
    coefficient: 0.74,
    oddsRatio: Math.exp(0.74),
    sampleShare: 0.19,
    pValue: 0.012,
    delta: 6,
    percentWeight: 23.9,
    direction: 'driver',
    relatedSegments: [
      { label: 'Business visas', share: 0.34 },
      { label: 'Student visas', share: 0.29 },
      { label: 'Emergency travel', share: 0.18 },
    ],
  },
  {
    attributeId: 'automated_risk_score',
    displayLabel: 'Automated Risk Score ≥ 70',
    coefficient: 0.91,
    oddsRatio: Math.exp(0.91),
    sampleShare: 0.22,
    pValue: 0.008,
    delta: 9,
    percentWeight: 27.6,
    direction: 'driver',
    relatedSegments: [
      { label: 'Tourist visas', share: 0.37 },
      { label: 'Short-term work', share: 0.25 },
      { label: 'Background check pending', share: 0.21 },
    ],
  },
  {
    attributeId: 'wealth_tier',
    displayLabel: 'Wealth Tier · Low',
    coefficient: 0.58,
    oddsRatio: Math.exp(0.58),
    sampleShare: 0.27,
    pValue: 0.031,
    delta: 3,
    percentWeight: 18.4,
    direction: 'driver',
    relatedSegments: [
      { label: 'Family visit', share: 0.31 },
      { label: 'Medical support', share: 0.23 },
      { label: 'Religious travel', share: 0.16 },
    ],
  },
  {
    attributeId: 'document_density',
    displayLabel: 'Document Density · High',
    coefficient: -0.42,
    oddsRatio: Math.exp(-0.42),
    sampleShare: 0.46,
    pValue: 0.044,
    delta: -2,
    percentWeight: 15.1,
    direction: 'buffer',
    relatedSegments: [
      { label: 'Corporate sponsors', share: 0.38 },
      { label: 'Graduate study', share: 0.27 },
      { label: 'Diplomatic support', share: 0.14 },
    ],
  },
  {
    attributeId: 'sponsor_verification',
    displayLabel: 'Sponsor Verification · Verified',
    coefficient: -0.27,
    oddsRatio: Math.exp(-0.27),
    sampleShare: 0.33,
    pValue: 0.047,
    delta: -3,
    percentWeight: 9.8,
    direction: 'buffer',
    relatedSegments: [
      { label: 'Cultural exchange', share: 0.41 },
      { label: 'Seasonal work', share: 0.24 },
      { label: 'Tourism', share: 0.19 },
    ],
  },
  {
    attributeId: 'travel_history',
    displayLabel: 'Travel History · None',
    coefficient: 0.33,
    oddsRatio: Math.exp(0.33),
    sampleShare: 0.41,
    pValue: 0.061,
    delta: 1,
    percentWeight: 8.7,
    direction: 'driver',
    relatedSegments: [
      { label: 'Urgent family visits', share: 0.33 },
      { label: 'Humanitarian parole', share: 0.22 },
      { label: 'Business exploratory', share: 0.17 },
    ],
  },
  {
    attributeId: 'embassy_office',
    displayLabel: 'Embassy Office · Nordics Desk',
    coefficient: -0.35,
    oddsRatio: Math.exp(-0.35),
    sampleShare: 0.14,
    pValue: 0.028,
    delta: 0,
    percentWeight: 7.3,
    direction: 'buffer',
    relatedSegments: [
      { label: 'Research visas', share: 0.36 },
      { label: 'Innovation grants', share: 0.28 },
      { label: 'Conference travel', share: 0.21 },
    ],
  },
]
