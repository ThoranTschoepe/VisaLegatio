'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArchiveRestore,
  ArrowRightCircle,
  CheckCircle2,
  Clock,
  FlagTriangleRight,
  ShieldCheck,
} from 'lucide-react'

interface DemoReviewItem {
  id: string
  applicant: string
  country: string
  visaType: string
  riskScore: number
  status: 'pending' | 'validated' | 'overturned' | 'escalated' | 'training_needed'
  reviewer: string
  reviewedAt: string
  summary: string
  aiRationale: string
}

const DEMO_QUEUE: DemoReviewItem[] = [
  {
    id: 'VSV-240202-BIAS2',
    applicant: 'Fatima Al-Rashid',
    country: 'Syria',
    visaType: 'student',
    riskScore: 72,
    status: 'pending',
    reviewer: 'john.davis',
    reviewedAt: '2024-03-04T09:15:00Z',
    summary: 'Initial reviewer flagged scholarship income not honoured by policy. Needs confirmation from senior lead.',
    aiRationale: 'AI model flagged feature: Wealth Tier · Low (driver: +24%), Travel History · Limited (+18%).',
  },
  {
    id: 'VSV-240205-BIAS5',
    applicant: 'Maria Gonzalez',
    country: 'Mexico',
    visaType: 'tourist',
    riskScore: 55,
    status: 'escalated',
    reviewer: 'admin',
    reviewedAt: '2024-03-03T14:42:00Z',
    summary: 'Family overstay flagged – reviewer requested policy check for collective punishments.',
    aiRationale: 'Driver: Origin Region · Latin America (+12%). Buffer: Sponsor Verification Passed (−9%).',
  },
  {
    id: 'VSV-240103-E5F6',
    applicant: 'Anna Chen',
    country: 'China',
    visaType: 'student',
    riskScore: 48,
    status: 'validated',
    reviewer: 'maria.schmidt',
    reviewedAt: '2024-03-01T11:05:00Z',
    summary: 'Missing admission letter confirmed; rejection stands. Audit closed.',
    aiRationale: 'Buffer: Document Density · High (−14%). Driver: Travel History · None (+7%).',
  },
]

type FilterOption = 'pending' | 'validated' | 'overturned' | 'escalated' | 'training_needed' | 'all'

const FILTER_LABELS: Record<FilterOption, string> = {
  all: 'All',
  pending: 'Pending',
  validated: 'Validated',
  overturned: 'Overturned',
  escalated: 'Escalated',
  training_needed: 'Training Needed',
}

export default function ReviewAuditDemo() {
  const [filter, setFilter] = useState<FilterOption>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_QUEUE[0]?.id ?? null)

  const filteredQueue = useMemo(() => {
    if (filter === 'all') return DEMO_QUEUE
    return DEMO_QUEUE.filter(item => item.status === filter)
  }, [filter])

  const selectedReview = useMemo(
    () => DEMO_QUEUE.find(item => item.id === selectedId) ?? filteredQueue[0] ?? null,
    [selectedId, filteredQueue],
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-success" />
            Review-of-Review Audit (demo)
          </h2>
          <p className="text-base-content/70">
            Senior officers validate fairness concerns flagged by reviewers. Use filters to triage the queue; decisions recorded here feed governance reporting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as FilterOption[]).map(option => (
            <button
              key={option}
              className={`btn btn-sm ${filter === option ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(option)}
            >
              {FILTER_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card bg-base-100 shadow-sm lg:col-span-1">
          <div className="card-body space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Queue ({filteredQueue.length})
            </h3>
            {filteredQueue.length === 0 ? (
              <p className="text-sm text-base-content/60">No reviews match this filter.</p>
            ) : (
              <ul className="space-y-2">
                {filteredQueue.map(item => (
                  <li key={item.id}>
                    <button
                      className={`w-full text-left btn btn-ghost btn-sm justify-start ${selectedReview?.id === item.id ? 'bg-base-200' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{item.applicant}</span>
                        <span className="text-xs text-base-content/60">
                          {item.country} · {item.visaType}
                        </span>
                      </div>
                      <ArrowRightCircle className="w-4 h-4 ml-auto" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm lg:col-span-2">
          <div className="card-body space-y-4">
            {selectedReview ? (
              <>
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                  <div>
                    <p className="text-xs uppercase text-base-content/50">Application</p>
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      {selectedReview.applicant}
                      <span className="badge badge-outline">{selectedReview.id}</span>
                    </h3>
                    <p className="text-sm text-base-content/60">
                      Visa: {selectedReview.visaType} · Risk score: {selectedReview.riskScore}
                    </p>
                  </div>
                  <div className="bg-base-200 rounded-lg p-3 text-sm text-base-content/70 space-y-1">
                    <p>Initial reviewer: {selectedReview.reviewer}</p>
                    <p>Status: <span className="capitalize">{selectedReview.status.replace('_', ' ')}</span></p>
                    <p>Reviewed at: {new Date(selectedReview.reviewedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-base-200 rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold uppercase text-base-content/60">Reviewer summary</h4>
                    <p className="text-base-content/80 text-sm leading-relaxed">{selectedReview.summary}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold uppercase text-base-content/60">Model rationale</h4>
                    <p className="text-base-content/70 text-sm leading-relaxed">{selectedReview.aiRationale}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DemoDecisionCard
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    title="Validate"
                    description="Confirm the reviewer’s call and record rationale."
                  />
                  <DemoDecisionCard
                    icon={<ArchiveRestore className="w-5 h-5" />}
                    title="Overturn"
                    description="Overturn the reviewer decision, reopen the case, or trigger remediation."
                  />
                  <DemoDecisionCard
                    icon={<FlagTriangleRight className="w-5 h-5" />}
                    title="Escalate"
                    description="Escalate to policy/compliance for structural follow-up."
                  />
                  <DemoDecisionCard
                    icon={<AlertCircle className="w-5 h-5" />}
                    title="Training Needed"
                    description="Tag for reviewer coaching or AI retraining feedback."
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-base-content/60">Select a review from the queue to inspect details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface DemoDecisionCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

function DemoDecisionCard({ icon, title, description }: DemoDecisionCardProps) {
  return (
    <div className="card bg-base-200/60 shadow-sm">
      <div className="card-body space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <p className="text-xs text-base-content/60 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
