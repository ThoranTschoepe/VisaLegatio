'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  FlagTriangleRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

interface DemoAuditEntry {
  id: string
  applicant: string
  country: string
  visaType: string
  riskScore: number
  reviewer: string
  flaggedAt: string
  flagType: 'bias_positive' | 'policy_exception' | 'documentation_gap' | 'none'
  status: 'pending' | 'validated' | 'overturned' | 'escalated' | 'training_needed'
  summary: string
  note: string
  aiHighlight: string
}

const DEMO_ENTRIES: DemoAuditEntry[] = [
  {
    id: 'VSV-240202-BIAS2',
    applicant: 'Fatima Al-Rashid',
    country: 'Syria',
    visaType: 'Student Visa',
    riskScore: 72,
    reviewer: 'john.davis',
    flaggedAt: '2024-03-04T09:15:00Z',
    flagType: 'bias_positive',
    status: 'pending',
    summary: 'Scholarship award not honoured in financial screening.',
    note: 'Applicant provided a university-certified scholarship letter. Policy exception guidance pending.',
    aiHighlight: 'Influence factors: Wealth Tier · Low (+24%), Travel History · Limited (+18%).',
  },
  {
    id: 'VSV-240205-BIAS5',
    applicant: 'Maria Gonzalez',
    country: 'Mexico',
    visaType: 'Tourist Visa',
    riskScore: 55,
    reviewer: 'admin',
    flaggedAt: '2024-03-03T14:42:00Z',
    flagType: 'policy_exception',
    status: 'escalated',
    summary: 'Family overstay triggered rejection; reviewer unsure collective penalty is proportional.',
    note: 'Policy team to confirm whether the two-year entry bar should apply when dependants overstayed but main applicant did not.',
    aiHighlight: 'Influence factors: Origin Region · Latin America (+12%), Sponsor Verified (−9%).',
  },
  {
    id: 'VSV-240103-E5F6',
    applicant: 'Anna Chen',
    country: 'China',
    visaType: 'Student Visa',
    riskScore: 48,
    reviewer: 'maria.schmidt',
    flaggedAt: '2024-03-01T11:05:00Z',
    flagType: 'documentation_gap',
    status: 'validated',
    summary: 'Missing admission letter confirmed; rejection stands.',
    note: 'Applicant unable to supply admission verification within SLA. Case closed after second follow-up.',
    aiHighlight: 'Influence factors: Document Density · High (−14%), Travel History · None (+7%).',
  },
  {
    id: 'VSV-240209-CLR1',
    applicant: 'Ravi Patel',
    country: 'India',
    visaType: 'Business Visa',
    riskScore: 32,
    reviewer: 'john.davis',
    flaggedAt: '2024-03-02T08:30:00Z',
    flagType: 'none',
    status: 'validated',
    summary: 'Routine validation of reviewer decision with no bias indicators.',
    note: 'Sampling pulled this case, but reviewer notes and metrics aligned with policy. No escalation required.',
    aiHighlight: 'Influence factors: Sponsor Verification · Verified (−11%), Document Density · High (−8%).',
  },
  {
    id: 'VSV-240210-CLR2',
    applicant: 'Elena Petrova',
    country: 'Bulgaria',
    visaType: 'Tourist Visa',
    riskScore: 41,
    reviewer: 'maria.schmidt',
    flaggedAt: '2024-03-05T10:20:00Z',
    flagType: 'none',
    status: 'overturned',
    summary: 'Secondary audit overturned earlier bias concern after updated bank proof.',
    note: 'Applicant uploaded corrected bank statement; senior officer cleared the rejection with advisory to adjust sampling rule.',
    aiHighlight: 'Influence factors: Wealth Tier · Mid (+5%), Document Density · Medium (neutral).',
  },
]

const STATUS_META: Record<DemoAuditEntry['status'], { label: string; tone: string }> = {
  pending: { label: 'Needs review', tone: 'badge-warning' },
  validated: { label: 'Validated', tone: 'badge-success' },
  overturned: { label: 'Overturned', tone: 'badge-error' },
  escalated: { label: 'Escalated', tone: 'badge-info' },
  training_needed: { label: 'Training needed', tone: 'badge-secondary' },
}

export default function ReviewAuditListDemo() {
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_ENTRIES[0]?.id ?? null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'flagged' | DemoAuditEntry['flagType']>('flagged')

  const flagTypes = useMemo(() => {
    return Array.from(
      new Set(
        DEMO_ENTRIES.filter(entry => entry.flagType !== 'none').map(entry => entry.flagType)
      )
    )
  }, [])

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return DEMO_ENTRIES
    if (activeFilter === 'flagged') {
      return DEMO_ENTRIES.filter(entry => entry.flagType !== 'none')
    }
    return DEMO_ENTRIES.filter(entry => entry.flagType === activeFilter)
  }, [activeFilter])

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedId(null)
      return
    }

    if (!filteredEntries.some(entry => entry.id === selectedId)) {
      setSelectedId(filteredEntries[0].id)
    }
  }, [filteredEntries, selectedId])

  const visibleEntries = filteredEntries
  const selected = visibleEntries.find(item => item.id === selectedId) ?? visibleEntries[0] ?? null

  return (
    <div className="p-6 space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-success" />
          Senior Audit Demo
        </h1>
        <p className="text-sm text-base-content/70 max-w-2xl">
          Explore how senior officers triage reviewer escalations. Cards on the left summarize flagged decisions; select one to inspect reviewer notes, AI highlights, and available audit actions.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Audit filters">
            <FilterChip
              label="All"
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
            />
            <FilterChip
              label="Flagged"
              active={activeFilter === 'flagged'}
              onClick={() => setActiveFilter('flagged')}
            />
            {flagTypes.map(type => (
              <FilterChip
                key={type}
                label={toFriendlyLabel(type)}
                active={activeFilter === type}
                onClick={() => setActiveFilter(type)}
              />
            ))}
          </div>

          {visibleEntries.length === 0 ? (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body text-sm text-base-content/60">
                No audit reviews match this filter.
              </div>
            </div>
          ) : (
            visibleEntries.map(entry => {
              const status = STATUS_META[entry.status]
              const active = selectedId === entry.id
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    setSelectedId(entry.id)
                    setIsLoading(true)
                    setTimeout(() => setIsLoading(false), 350)
                  }}
                  className={`w-full text-left card transition-shadow focus:outline-none ${active ? 'bg-primary/10 border border-primary/40 shadow-lg' : 'bg-base-100 shadow-sm hover:shadow-md'}`}
                >
                  <div className="card-body space-y-2">
                    <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{entry.applicant}</h3>
                      <p className="text-xs text-base-content/60">
                        {entry.country} · {entry.visaType}
                      </p>
                    </div>
                    <span className={`badge ${status.tone}`}>{toFriendlyLabel(entry.flagType)}</span>
                    </div>
                    <p className="text-sm text-base-content/70 line-clamp-2">{entry.summary}</p>
                    <div className="flex items-center justify-between text-xs text-base-content/60">
                      <span>Risk score {entry.riskScore}</span>
                      <span>Flagged {formatRelativeTime(entry.flaggedAt)} ago</span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <aside className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-base-content/70">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading details…
              </div>
            ) : selected ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{selected.applicant}</h3>
                    <p className="text-sm text-base-content/60">
                      {selected.country} · {selected.visaType}
                    </p>
                  </div>
                  <span className={`badge ${STATUS_META[selected.status].tone}`}>{toFriendlyLabel(selected.flagType)}</span>
                </div>

                <div className="space-y-3 bg-base-200/70 rounded-lg p-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-base-content/50">Reviewer summary</h4>
                    <p className="text-sm text-base-content/80 leading-relaxed">{selected.note}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-base-content/50">High influence factors</h4>
                    <ul className="list-disc list-inside text-sm text-base-content/70 space-y-1">
                      {parseFactors(selected.aiHighlight).map(factor => (
                        <li key={factor}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-base-200/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-base-content/50">Senior officer comment</h4>
                  <textarea
                    className="textarea textarea-bordered w-full h-24"
                    placeholder="Summarise your decision, cite policy, or provide follow-up instructions..."
                  />
                  <p className="text-xs text-base-content/50">
                    Comments are stored in the audit log and shared with policy teams.
                  </p>
                </div>

                <div className="grid gap-2 text-sm">
                  <DemoActionButton
                    tone="btn-outline btn-success"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    title="Validate"
                    description="Confirm reviewer call; log rationale and close."
                  />
                  <DemoActionButton
                    tone="btn-outline btn-error"
                    icon={<ArchiveRestore className="w-4 h-4" />}
                    title="Overturn"
                    description="Reopen the case or issue corrective action."
                  />
                  <DemoActionButton
                    tone="btn-outline btn-warning"
                    icon={<FlagTriangleRight className="w-4 h-4" />}
                    title="Escalate"
                    description="Send to policy/compliance for structural follow-up."
                  />
                  <DemoActionButton
                    tone="btn-outline btn-info"
                    icon={<AlertTriangle className="w-4 h-4" />}
                    title="Training needed"
                    description="Flag reviewer coaching or AI feedback."
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-base-content/60">Select a review from the list to inspect details.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

interface DemoActionButtonProps {
  tone: string
  icon: React.ReactNode
  title: string
  description: string
}

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`btn btn-xs ${active ? 'btn-primary' : 'btn-outline'}`}
      type="button"
    >
      {label}
    </button>
  )
}

function DemoActionButton({ tone, icon, title, description }: DemoActionButtonProps) {
  return (
    <button className={`btn w-full justify-start text-left ${tone}`}>
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-base-content/60 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  )
}

function parseFactors(raw: string) {
  if (!raw) return []
  const factorsText = raw.split(':')[1] || raw
  return factorsText
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

function toFriendlyLabel(type: DemoAuditEntry['flagType']) {
  switch (type) {
    case 'bias_positive':
      return 'Bias positive'
    case 'policy_exception':
      return 'Policy exception'
    case 'documentation_gap':
      return 'Documentation gap'
    case 'none':
      return 'No flag'
    default:
      return type
  }
}

function formatRelativeTime(timestamp: string) {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const minutes = Math.floor(diffMs / (1000 * 60))
  if (minutes < 1) return 'moments'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} wk`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mo`
  const years = Math.floor(days / 365)
  return `${years} yr`
}
