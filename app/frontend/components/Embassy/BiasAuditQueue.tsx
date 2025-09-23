'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArchiveRestore,
  ArrowRightCircle,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { api } from '@/utils/api'
import { BiasAuditItem, Officer } from '@/types/embassy.types'

interface BiasAuditQueueProps {
  officer: Officer
}

type AuditDecision = 'validated' | 'overturned' | 'escalated' | 'training_needed'

const DECISION_LABELS: Record<AuditDecision, string> = {
  validated: 'Validated',
  overturned: 'Overturned',
  escalated: 'Escalated',
  training_needed: 'Training Needed',
}

type QueueFilter = 'requires_audit' | 'resolved'

const FILTER_META: Record<QueueFilter, { label: string; description: string; predicate: (item: BiasAuditItem) => boolean }> = {
  requires_audit: {
    label: 'Needs attention',
    description: 'Flagged or pending decisions requiring senior review.',
    predicate: item => item.review.auditStatus === 'pending',
  },
  resolved: {
    label: 'Resolved',
    description: 'Reviews that have already been validated or closed.',
    predicate: item => item.review.auditStatus !== 'pending',
  },
}

export default function BiasAuditQueue({ officer }: BiasAuditQueueProps) {
  const [queue, setQueue] = useState<BiasAuditItem[]>([])
  const [selectedReview, setSelectedReview] = useState<BiasAuditItem | null>(null)
  const [decision, setDecision] = useState<AuditDecision>('validated')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('requires_audit')

  const pendingCount = useMemo(
    () => queue.filter(item => item.review.auditStatus === 'pending').length,
    [queue],
  )

  useEffect(() => {
    loadAuditQueue()
  }, [])

  const loadAuditQueue = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const items = await api.getReviewAuditQueue({ status: 'all', limit: 40 })
      setQueue(items)
      setSelectedReview(items[0] || null)
      setDecision('validated')
      setNotes('')
    } catch (err: any) {
      console.error('Failed to load audit queue', err)
      setError(err?.message || 'Unable to load review-of-review queue')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectReview = async (item: BiasAuditItem) => {
    try {
      setIsLoading(true)
      const detail = await api.getReviewAuditDetail(item.review.id)
      setSelectedReview(detail)
      setDecision('validated')
      setNotes('')
    } catch (err: any) {
      console.error('Failed to load review detail', err)
      setError(err?.message || 'Unable to load review detail')
    } finally {
      setIsLoading(false)
    }
  }

  const visibleQueue = useMemo(() => {
    const filter = FILTER_META[queueFilter]
    if (!filter) return queue
    return queue.filter(filter.predicate)
  }, [queue, queueFilter])

  const handleSubmitDecision = async () => {
    if (!selectedReview) return

    try {
      setIsSubmitting(true)
      await api.submitReviewAuditDecision(selectedReview.review.id, {
        decision,
        notes,
        auditor_id: officer.id,
      })
      await loadAuditQueue()
    } catch (err: any) {
      console.error('Failed to submit audit decision', err)
      setError(err?.message || 'Failed to submit decision')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-success" />
            Review-of-Review Audit
          </h2>
          <p className="text-base-content/70">
            Senior officers validate flagged reviews before final disposition. {pendingCount} pending audits.
          </p>
        </div>
        <button className="btn btn-sm" onClick={loadAuditQueue} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-base-content/70">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          Loading audit queue…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card bg-base-100 shadow-sm lg:col-span-1">
            <div className="card-body space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  Queue
                </h3>
                <div className="btn-group">
                  {(Object.keys(FILTER_META) as QueueFilter[]).map(option => (
                    <button
                      key={option}
                      className={`btn btn-xs ${queueFilter === option ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setQueueFilter(option)}
                    >
                      {FILTER_META[option].label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-base-content/60">{FILTER_META[queueFilter].description}</p>
              {visibleQueue.length === 0 ? (
                <p className="text-sm text-base-content/60">No reviews match this filter.</p>
              ) : (
                <ul className="space-y-2">
                  {visibleQueue.map(item => (
                    <li key={item.review.id}>
                      <button
                        className={`w-full text-left btn btn-ghost btn-sm justify-start ${selectedReview?.review.id === item.review.id ? 'bg-base-200' : ''}`}
                        onClick={() => handleSelectReview(item)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{item.application.applicantName}</span>
                          <span className="text-xs text-base-content/60">
                            {item.application.country} · {item.application.visaType}
                          </span>
                          <span className="text-xs text-base-content/50">
                            Flagged {formatRelativeTime(item.review.reviewedAt)} ago by {item.review.officerId ?? 'unknown'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs flex items-center gap-1 ${item.review.auditStatus === 'pending' ? 'text-warning' : 'text-success'}`}>
                            {formatStatus(item.review.auditStatus)}
                          </span>
                          {item.review.reviewedAt && (
                            <span className="text-[10px] text-base-content/40">
                              {new Date(item.review.reviewedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
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
                  <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
                    <div>
                      <p className="text-sm text-base-content/60">Application</p>
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        {selectedReview.application.applicantName}
                        <span className="badge badge-outline">{selectedReview.review.applicationId}</span>
                      </h3>
                      <p className="text-sm text-base-content/60">
                        Visa: {selectedReview.application.visaType || 'Unknown'} · Risk: {selectedReview.application.riskScore ?? '—'}
                      </p>
                    </div>
                    <div className="bg-base-200 rounded-lg p-3 text-sm text-base-content/80">
                      <p>Original reviewer: {selectedReview.review.officerId || 'unknown'}</p>
                      <p>Review result: <strong className="capitalize">{selectedReview.review.result}</strong></p>
                      <p>Audit status: <span className="capitalize">{selectedReview.review.auditStatus}</span></p>
                      <p>Reviewed at: {selectedReview.review.reviewedAt ? new Date(selectedReview.review.reviewedAt).toLocaleString() : 'Unknown date'}</p>
                    </div>
                  </div>

                  <div className="bg-base-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold uppercase text-base-content/60 mb-2">Reviewer Notes</h4>
                    <p className="text-base-content/80 leading-relaxed">
                      {selectedReview.review.notes || 'No notes provided.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase text-base-content/60">Decision</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      {(Object.keys(DECISION_LABELS) as AuditDecision[]).map(value => (
                        <label key={value} className={`btn btn-outline justify-start ${decision === value ? 'btn-active' : ''}`}>
                          <input
                            type="radio"
                            className="radio radio-sm mr-2"
                            name="audit-decision"
                            checked={decision === value}
                            onChange={() => setDecision(value)}
                          />
                          <DecisionIcon decision={value} />
                          <span className="ml-2">{DECISION_LABELS[value]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Audit Notes</span>
                      <span className="label-text-alt">Reference policy rationale for transparency</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-32"
                      placeholder="Summarise your decision, cite policy or escalation path…"
                      value={notes}
                      onChange={event => setNotes(event.target.value)}
                    />
                  </div>

                  {selectedReview.audits.length > 0 && (
                    <div className="bg-base-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold uppercase text-base-content/60 mb-2">Audit history</h4>
                      <ul className="space-y-2">
                        {selectedReview.audits.map(entry => (
                          <li key={entry.id} className="flex items-start gap-2 text-sm">
                            <UserCheck className="w-4 h-4 text-primary mt-1" />
                            <div>
                              <p className="font-medium">{DECISION_LABELS[entry.decision]}</p>
                              <p className="text-base-content/60">{entry.notes || 'No notes provided.'}</p>
                              <p className="text-xs text-base-content/50">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown time'}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                    <p className="text-sm text-base-content/60 flex items-center gap-2">
                      <CircleDashed className="w-4 h-4" />
                      Decisions are recorded for monitoring analytics and policy tuning.
                    </p>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost" onClick={() => setSelectedReview(null)}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSubmitDecision}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRightCircle className="w-4 h-4 mr-2" />
                        )}
                        Record Decision
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-base-content/60">
                  Select a review from the queue to begin auditing.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DecisionIcon({ decision }: { decision: AuditDecision }) {
  switch (decision) {
    case 'validated':
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'overturned':
      return <ArchiveRestore className="w-4 h-4 text-error" />
    case 'escalated':
      return <AlertTriangle className="w-4 h-4 text-warning" />
    case 'training_needed':
      return <MessageSquare className="w-4 h-4 text-info" />
    default:
      return null
  }
}

function formatStatus(status: string) {
  if (status === 'pending') return 'Needs review'
  if (status === 'validated') return 'Validated'
  if (status === 'overturned') return 'Overturned'
  if (status === 'training_needed') return 'Training needed'
  if (status === 'escalated') return 'Escalated'
  return status.replace('_', ' ')
}

function formatRelativeTime(timestamp?: string | null) {
  if (!timestamp) return 'recently'
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
