// Mock data for John Doe application review
export const JOHN_DOE_ANALYSIS = {
  passport: {
    summary: "The passport shows the name John Doe, passport number U12345678, and date of birth 16 OCT 1986, and all details appear consistent and correctly formatted, indicating the document is valid.",
    status: "verified",
    concerns: []
  },
  bank_statement: {
    summary: "John Doe has -$72.47 in his account by the end of the statement period. He receives regular payroll deposits but consistently overspends through web bill payments, card use, and fixed expenses like mortgage and insurance, leading to a negative balance.",
    status: "warning",
    concerns: ["Negative account balance", "Pattern of overspending", "Financial instability"]
  },
  invitation_letter: {
    summary: "The letter indicates a friendly, non-familial relationship between Maria Schneider and John Doe, with a short touristic visit planned; while the invitation is sincere and financially supportive, the lack of clearly defined personal ties may prompt further scrutiny regarding the applicant's incentive to return.",
    status: "warning",
    concerns: ["Weak personal ties", "Unclear return incentive", "Non-familial relationship"]
  },
  flight_itinerary: {
    summary: "John Doe has a confirmed one-way economy flight from Istanbul (IST) to Munich (MUC) on 28 June 2021, departing at 08:45 with flight TK1639 and seat 14A.",
    status: "critical",
    concerns: ["ONE-WAY TICKET ONLY", "No return flight booked", "High overstay risk"]
  }
} as const

export const JOHN_DOE_WARNINGS = [
  "Applicant shows financial instability with a negative account balance despite regular income.",
  "One-way flight and weak personal ties raise concerns about return intention."
] as const

export const DOCUMENT_NAMES = {
  passport: 'Passport (Photo Page)',
  photo: 'Passport Photo',
  bank_statement: 'Bank Statement',
  invitation_letter: 'Invitation Letter',
  travel_insurance: 'Travel Insurance',
  employment_letter: 'Employment Letter',
  flight_itinerary: 'Flight Itinerary'
} as const

export const DOCUMENT_DESCRIPTIONS = {
  passport: 'Clear photo of your passport information page',
  photo: 'Recent passport-sized photo (white background)',
  bank_statement: 'Last 3 months bank statements showing sufficient funds',
  invitation_letter: 'Official invitation letter from host organization',
  travel_insurance: 'Valid travel insurance covering your entire stay',
  employment_letter: 'Letter from employer confirming your employment',
  flight_itinerary: 'Flight booking confirmation or itinerary'
} as const