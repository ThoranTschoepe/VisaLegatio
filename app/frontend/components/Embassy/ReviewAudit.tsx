'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightCircle,
  CircleDashed,
  ClipboardList,
  Eye,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { api } from '@/utils/api'
import {
  BiasAuditFlag,
  BiasAuditItem,
  FlagCatalog,
  FlagDecisionMatrixEntry,
  Officer,
} from '@/types/embassy.types'

interface ReviewAuditProps {
  officer: Officer
}

type DecisionOption = FlagDecisionMatrixEntry

type QueueFilter = 'requires_audit' | 'resolved'

type DecisionDisplayMetadata = {
  code: string
  label: string
  description?: string
  severity?: string
  requiresFollowUp?: boolean
}

type ApplicationDocumentRecord = {
  id: string
  name: string
  type: string
  size: number
  verified: boolean
  uploadedAt: string
  viewUrl?: string | null
  downloadUrl?: string | null
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

const buildDocumentUrl = (relative?: string | null) => {
  if (!relative) return null
  if (/^https?:\/\//i.test(relative)) return relative
  const normalized = relative.startsWith('/') ? relative : `/${relative}`
  return `${API_BASE_URL}${normalized}`
}

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`
}

const FILTER_META: Record<
  QueueFilter,
  { label: string; description: string; predicate: (item: BiasAuditItem) => boolean }
> = {
  requires_audit: {
    label: 'Needs attention',
    description: 'Flagged or pending decisions requiring senior review.',
    predicate: item => item.review.auditStatus === 'pending',
  },
  resolved: {
    label: 'Resolved',
    description: 'Reviews that already have a senior decision on record.',
    predicate: item => item.review.auditStatus !== 'pending',
  },
}

export default function ReviewAudit({ officer }: ReviewAuditProps) {
  const [queue, setQueue] = useState<BiasAuditItem[]>([])
  const [selectedReview, setSelectedReview] = useState<BiasAuditItem | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedDecisionCode, setSelectedDecisionCode] = useState('')
  const [decisionOptions, setDecisionOptions] = useState<DecisionOption[]>([])
  const [decisionBlocker, setDecisionBlocker] = useState<string | null>(null)
  const [flagCatalog, setFlagCatalog] = useState<FlagCatalog | null>(null)
  const [decisionMatrix, setDecisionMatrix] = useState<Record<string, FlagDecisionMatrixEntry[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('requires_audit')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [documents, setDocuments] = useState<ApplicationDocumentRecord[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)

  const pendingCount = useMemo(
    () => queue.filter(item => item.review.auditStatus === 'pending').length,
    [queue],
  )

  const statusBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    queue.forEach(item => {
      const status = item.review.auditStatus || 'unknown'
      breakdown[status] = (breakdown[status] || 0) + 1
    })
    return breakdown
  }, [queue])

  const matrixForReview = useMemo(() => {
    if (!selectedReview || !selectedReview.decisionMatrix) {
      return decisionMatrix
    }
    return mergeDecisionMatrix(decisionMatrix, selectedReview.decisionMatrix)
  }, [decisionMatrix, selectedReview])

  const decisionMetadata = useMemo<Record<string, DecisionDisplayMetadata>>(() => {
    const metadata: Record<string, DecisionDisplayMetadata> = {}

    Object.values(decisionMatrix).forEach(entries => {
      entries.forEach(entry => {
        metadata[entry.code] = {
          code: entry.code,
          label: entry.label || entry.code,
          description: entry.description,
          severity: entry.severity,
          requiresFollowUp: entry.requiresFollowUp,
        }
      })
    })

    if (selectedReview?.decisionMatrix) {
      Object.values(selectedReview.decisionMatrix).forEach(entries => {
        entries.forEach(entry => {
          metadata[entry.code] = {
            code: entry.code,
            label: entry.label || entry.code,
            description: entry.description,
            severity: entry.severity,
            requiresFollowUp: entry.requiresFollowUp,
          }
        })
      })
    }

    if (flagCatalog) {
      flagCatalog.decisions.forEach(entry => {
        metadata[entry.code] = {
          code: entry.code,
          label: entry.label || metadata[entry.code]?.label || entry.code,
          description: metadata[entry.code]?.description || entry.description,
          severity: metadata[entry.code]?.severity || entry.severity,
          requiresFollowUp: metadata[entry.code]?.requiresFollowUp,
        }
      })
    }

    return metadata
  }, [decisionMatrix, flagCatalog, selectedReview?.decisionMatrix])

  const visibleQueue = useMemo(() => {
    const filter = FILTER_META[queueFilter]
    if (!filter) return queue
    return queue.filter(filter.predicate)
  }, [queue, queueFilter])

  const documentsById = useMemo(() => {
    const map = new Map<string, ApplicationDocumentRecord>()
    documents.forEach(doc => {
      map.set(doc.id, doc)
    })
    return map
  }, [documents])

  const flaggedDocumentIds = useMemo(() => {
    if (!selectedReview) return new Set<string>()
    const ids = new Set<string>()
    selectedReview.flags.forEach(flag => {
      if (flag.document?.id) {
        ids.add(flag.document.id)
      }
    })
    return ids
  }, [selectedReview])

  const resolvedFlags = useMemo(() => {
    if (!selectedReview) return []
    return selectedReview.flags.filter(flag => flag.resolved)
  }, [selectedReview])

  const flagByDocumentId = useMemo(() => {
    const map = new Map<string, BiasAuditFlag>()
    if (!selectedReview) return map

    selectedReview.flags.forEach(flag => {
      if (flag.document?.id && !map.has(flag.document.id)) {
        map.set(flag.document.id, flag)
      }
    })

    return map
  }, [selectedReview])

  const latestFlagTimestamp = useMemo(() => {
    if (!selectedReview) return null
    return selectedReview.flags.reduce<string | null>((latest, flag) => {
      if (!flag.flaggedAt) return latest
      if (!latest) return flag.flaggedAt
      return new Date(flag.flaggedAt) > new Date(latest) ? flag.flaggedAt : latest
    }, null)
  }, [selectedReview])

  const formatAuditStatus = (status: string) => {
    if (status === 'pending') return 'Needs review'
    return decisionMetadata[status]?.label || status.replace('_', ' ')
  }

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const [catalog, queueResponse] = await Promise.all([
          flagCatalog ? Promise.resolve(flagCatalog) : api.getFlagCatalog(),
          api.getReviewAuditQueue({ status: 'all', limit: 40 }),
        ])

        setFlagCatalog(catalog)
        applyQueueResponse(queueResponse, undefined)
      } catch (err: any) {
        console.error('Failed to load audit queue', err)
        setError(err?.message || 'Unable to load review-of-review queue')
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setNotes('')
  }, [selectedReview?.review.id])

  useEffect(() => {
    let isActive = true

    const loadDocuments = async (applicationId: string) => {
      try {
        setDocumentsLoading(true)
        setDocumentsError(null)
        const response = await api.getApplicationDocuments(applicationId)
        const normalized = response.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          verified: doc.verified,
          uploadedAt: doc.uploaded_at,
          viewUrl: doc.view_url,
          downloadUrl: doc.download_url,
        }))
        if (!isActive) return
        setDocuments(normalized)
      } catch (err: any) {
        console.error('Failed to load application documents', err)
        if (!isActive) return
        setDocuments([])
        setDocumentsError(err?.message || 'Unable to load documents for this application')
      } finally {
        if (!isActive) return
        setDocumentsLoading(false)
      }
    }

    if (selectedReview?.review.applicationId) {
      loadDocuments(selectedReview.review.applicationId)
    } else {
      setDocuments([])
      setDocumentsError(null)
      setDocumentsLoading(false)
    }

    return () => {
      isActive = false
    }
  }, [selectedReview?.review.applicationId])

  useEffect(() => {
    if (!selectedReview) {
      setDecisionOptions([])
      setSelectedDecisionCode('')
      setDecisionBlocker(null)
      return
    }

    const { options, blocker } = deriveDecisionOptions(
      selectedReview,
      matrixForReview,
      decisionMetadata,
      flagCatalog,
    )

    setDecisionOptions(options)
    setDecisionBlocker(blocker)

    setSelectedDecisionCode(previous => {
      if (previous && options.some(option => option.code === previous)) {
        return previous
      }
      return options[0]?.code || ''
    })
  }, [selectedReview, matrixForReview, decisionMetadata, flagCatalog])

  const applyQueueResponse = (
    response: { items: BiasAuditItem[]; decisionMatrix: Record<string, FlagDecisionMatrixEntry[]>; count: number },
    targetReviewId: string | undefined,
  ) => {
    setDecisionMatrix(previous => mergeDecisionMatrix(previous, response.decisionMatrix))
    setQueue(response.items)
    setLastUpdatedAt(new Date())

    if (response.items.length === 0) {
      setSelectedReview(null)
      return
    }

    const nextSelection = targetReviewId
      ? response.items.find(item => item.review.id === targetReviewId) || response.items[0]
      : response.items[0]

    setSelectedReview(nextSelection)
  }

  const loadAuditQueue = async (targetReviewId?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const queueResponse = await api.getReviewAuditQueue({ status: 'all', limit: 40 })
      applyQueueResponse(queueResponse, targetReviewId)
    } catch (err: any) {
      console.error('Failed to refresh audit queue', err)
      setError(err?.message || 'Unable to refresh queue')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectReview = async (item: BiasAuditItem) => {
    try {
      setIsDetailLoading(true)
      const detail = await api.getReviewAuditDetail(item.review.id)
      setDecisionMatrix(previous => mergeDecisionMatrix(previous, detail.decisionMatrix || {}))
      setSelectedReview(detail)
      setQueue(previous =>
        previous.map(existing => (existing.review.id === detail.review.id ? detail : existing)),
      )
    } catch (err: any) {
      console.error('Failed to load review detail', err)
      setError(err?.message || 'Unable to load review detail')
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleSubmitDecision = async () => {
    if (!selectedReview) return
    if (!selectedDecisionCode) {
      setError('No compatible decision is available for this review.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await api.submitReviewAuditDecision(selectedReview.review.id, {
        decisionCode: selectedDecisionCode,
        notes,
        auditor_id: officer.id,
      })

      await loadAuditQueue(selectedReview.review.id)
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
        <button className="btn btn-sm" onClick={() => loadAuditQueue(selectedReview?.review.id)} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending audits"
          value={pendingCount}
          description="Awaiting senior decision"
          tone="warning"
        />
        <StatCard
          title="Resolved"
          value={Math.max(queue.length - pendingCount, 0)}
          description="Validated or closed"
          tone="success"
        />
        <StatCard
          title="Total in view"
          value={queue.length}
          description={`${queueFilter === 'requires_audit' ? 'Filtered' : 'All'} queue items`}
        />
        <StatCard
          title="Last updated"
          value={lastUpdatedAt ? formatRelativeTime(lastUpdatedAt.toISOString()) : '—'}
          description={lastUpdatedAt ? lastUpdatedAt.toLocaleString() : 'Not yet loaded'}
        />
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
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          <div className="card bg-base-100 shadow-sm lg:col-span-1 self-start">
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
              <div className="max-h-[520px] overflow-y-auto pr-1">
                {visibleQueue.length === 0 ? (
                  <p className="text-sm text-base-content/60">No reviews match this filter.</p>
                ) : (
                  <ul className="space-y-2">
                    {visibleQueue.map(item => (
                      <li key={item.review.id}>
                        <button
                          className={`w-full rounded-lg border text-left transition-all ${
                            selectedReview?.review.id === item.review.id
                              ? 'border-primary/50 bg-primary/5 shadow-sm'
                              : 'border-base-200 bg-base-100 hover:border-base-300 hover:bg-base-100/80'
                          }`}
                          onClick={() => handleSelectReview(item)}
                          aria-pressed={selectedReview?.review.id === item.review.id}
                        >
                          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                <span>{item.application.applicantName}</span>
                                <span className="badge badge-outline text-[10px] uppercase">
                                  {item.application.visaType || '—'}
                                </span>
                              </div>
                              <p className="text-xs text-base-content/60">
                                {item.application.country}
                              </p>
                              <p className="text-xs text-base-content/50">
                                Flagged {formatRelativeTime(item.review.reviewedAt)} ago by {item.review.officerId ?? 'unknown'}
                              </p>
                            </div>
                            <div className="flex flex-col items-start gap-1 sm:items-end">
                              <StatusBadge status={item.review.auditStatus} metadata={decisionMetadata} breakdown={statusBreakdown} />
                              {item.review.reviewedAt && (
                                <span className="text-[10px] text-base-content/40">
                                  {new Date(item.review.reviewedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm lg:col-span-2 self-start">
            <div className="card-body space-y-4">
              {selectedReview ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-base-content/60">Application</p>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          {selectedReview.application.applicantName}
                          <span className="badge badge-outline">{selectedReview.review.applicationId}</span>
                        </h3>
                        <span className="badge badge-ghost uppercase text-[11px]">
                          {selectedReview.application.visaType || 'Unknown visa'}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/60">
                        {selectedReview.application.country} · Risk score {selectedReview.application.riskScore ?? '—'} · {selectedReview.flagSummary.active} active flag{selectedReview.flagSummary.active === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="border border-base-200 rounded-lg bg-base-100 p-4 space-y-3">
                        <h4 className="text-sm font-semibold uppercase text-base-content/60">Application details</h4>
                        <dl className="space-y-2 text-sm text-base-content/80">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Country</dt>
                            <dd className="font-medium text-right">{selectedReview.application.country}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Visa type</dt>
                            <dd className="font-medium text-right">{selectedReview.application.visaType || 'Unknown'}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Application status</dt>
                            <dd className="font-medium text-right">{selectedReview.application.status || 'Not set'}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Risk score</dt>
                            <dd className="font-medium text-right">{selectedReview.application.riskScore ?? '—'}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Flag summary</dt>
                            <dd className="font-medium text-right">{selectedReview.flagSummary.active} active / {selectedReview.flagSummary.total} total</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Last reviewed</dt>
                            <dd className="font-medium text-right">
                              {selectedReview.review.reviewedAt ? new Date(selectedReview.review.reviewedAt).toLocaleString() : 'Unknown'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="border border-base-200 rounded-lg bg-base-100 p-4 space-y-3">
                        <h4 className="text-sm font-semibold uppercase text-base-content/60">Review snapshot</h4>
                        <dl className="space-y-2 text-sm text-base-content/80">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Original reviewer</dt>
                            <dd className="font-medium text-right">{selectedReview.review.officerId || 'Unknown'}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Result</dt>
                            <dd className="font-medium text-right capitalize">{selectedReview.review.result}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Audit status</dt>
                            <dd className="font-medium text-right">{formatAuditStatus(selectedReview.review.auditStatus)}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Reviewed at</dt>
                            <dd className="font-medium text-right">
                              {selectedReview.review.reviewedAt ? new Date(selectedReview.review.reviewedAt).toLocaleString() : 'Not recorded'}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Audits logged</dt>
                            <dd className="font-medium text-right">{selectedReview.audits.length}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="border border-base-200 rounded-lg bg-base-100 p-4 space-y-3">
                        <h4 className="text-sm font-semibold uppercase text-base-content/60">Review signals</h4>
                        <dl className="space-y-2 text-sm text-base-content/80">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Active flags</dt>
                            <dd className="font-medium text-right">{selectedReview.flagSummary.active}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Most recent flag</dt>
                            <dd className="font-medium text-right">
                              {latestFlagTimestamp ? formatRelativeTime(latestFlagTimestamp) : 'None'}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-base-content/60">Flag types</dt>
                            <dd className="font-medium text-right">
                              {selectedReview.flagSummary.activeTypes.length > 0
                                ? selectedReview.flagSummary.activeTypes.map(type => formatFlagLabel(type)).join(', ')
                                : '—'}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div className="border border-base-200 rounded-lg bg-base-100 p-4">
                      <h4 className="text-sm font-semibold uppercase text-base-content/60 mb-2">Reviewer notes</h4>
                      <p className="text-base-content/80 leading-relaxed whitespace-pre-line">
                        {selectedReview.review.notes || 'No notes provided.'}
                      </p>
                    </div>

                    {resolvedFlags.length > 0 && (
                      <div className="border border-base-200 rounded-lg bg-base-100 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold uppercase text-base-content/60">Flag history</h4>
                          <span className="badge badge-outline">{resolvedFlags.length} resolved</span>
                        </div>
                        <ul className="space-y-3 text-xs text-base-content/70">
                          {resolvedFlags.map(flag => {
                            const docRecord = flag.document?.id ? documentsById.get(flag.document.id) : undefined
                            const viewUrl = buildDocumentUrl(docRecord?.viewUrl)
                            return (
                              <li key={flag.id} className="rounded-md border border-base-200 p-3 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">{formatFlagLabel(flag.flagType)}</span>
                                  <span className="text-base-content/50">
                                    Resolved {flag.resolvedAt ? new Date(flag.resolvedAt).toLocaleString() : 'Unknown'}
                                  </span>
                                </div>
                                {flag.reason && <p className="leading-relaxed">{flag.reason}</p>}
                                {flag.document?.id && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="badge badge-outline badge-sm">{flag.document.type || 'Document'}</span>
                                    {viewUrl ? (
                                      <a
                                        href={viewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-ghost btn-xs gap-1"
                                      >
                                        <Eye className="w-3 h-3" />
                                        Open file
                                      </a>
                                    ) : (
                                      <span className="text-base-content/50">Preview unavailable</span>
                                    )}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="bg-base-100 border border-base-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase text-base-content/60">Application documents</h4>
                      <span className="badge badge-outline">
                        {documents.length} files
                      </span>
                    </div>
                    {documentsLoading ? (
                      <div className="flex items-center gap-2 text-base-content/70 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
                      </div>
                    ) : documentsError ? (
                      <div className="alert alert-warning py-2 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{documentsError}</span>
                      </div>
                    ) : documents.length > 0 ? (
                      <div className="space-y-2">
                        {documents.map(doc => {
                          const isFlagged = flaggedDocumentIds.has(doc.id)
                          const linkedFlag = flagByDocumentId.get(doc.id)
                          const flagLabel = linkedFlag ? formatFlagLabel(linkedFlag.flagType) : null
                          const viewUrl = buildDocumentUrl(doc.viewUrl)
                          return (
                            <div
                              key={doc.id}
                              className={`flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${
                                isFlagged ? 'border-warning bg-warning/10' : 'border-base-200 bg-base-100'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                  <span>{doc.name}</span>
                                  <span className="badge badge-outline text-[10px] uppercase">{doc.type}</span>
                                  {doc.verified && <span className="badge badge-success badge-sm">Verified</span>}
                                  {isFlagged && (
                                    <span className="badge badge-warning badge-sm">
                                      {flagLabel || 'Flagged'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-base-content/60">
                                  {formatFileSize(doc.size)} · Uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'Unknown'}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {viewUrl ? (
                                  <a
                                    href={viewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline btn-xs gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Open
                                  </a>
                                ) : (
                                  <span className="text-xs text-base-content/50">No preview</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-base-content/60">No documents found for this application.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase text-base-content/60">Decision</h4>
                    {isDetailLoading ? (
                      <div className="flex items-center gap-2 text-base-content/70">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading decision options…
                      </div>
                    ) : decisionOptions.length > 0 ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {decisionOptions.map(option => (
                          <label
                            key={option.code}
                            className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all ${
                              selectedDecisionCode === option.code
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-base-200 bg-base-100 hover:border-base-300 hover:bg-base-100/80'
                            }`}
                          >
                            <input
                              type="radio"
                              className="radio radio-sm mt-1"
                              name="audit-decision"
                              checked={selectedDecisionCode === option.code}
                              onChange={() => setSelectedDecisionCode(option.code)}
                            />
                            <div className="flex flex-1 flex-col gap-2">
                              <span className="font-medium text-sm sm:text-base leading-snug">
                                {option.label || option.code}
                              </span>
                              <div className="flex flex-wrap gap-2 text-xs text-base-content/60">
                                {option.severity && (
                                  <span className={`badge ${severityToBadge(option.severity)} whitespace-nowrap`}>
                                    Severity: {option.severity}
                                  </span>
                                )}
                                {option.requiresFollowUp && (
                                  <span className="badge badge-warning whitespace-nowrap">Requires follow-up</span>
                                )}
                              </div>
                              {option.description && (
                                <span className="text-xs text-base-content/60 leading-snug">
                                  {option.description}
                                </span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="alert alert-warning">
                        <AlertCircle className="w-4 h-4" />
                        <span>
                          {decisionBlocker || 'No decisions are currently available for the selected flags.'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-semibold uppercase text-base-content/60">Audit Notes</span>
                      <span className="text-xs text-base-content/50">Reference policy rationale for transparency</span>
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-base-200 bg-base-100 p-4 text-sm leading-relaxed shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                      rows={6}
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
                              <p className="font-medium">
                                {decisionMetadata[entry.decisionCode]?.label || entry.decisionCode}
                              </p>
                              <p className="text-base-content/60">{entry.notes || 'No notes provided.'}</p>
                              <p className="text-xs text-base-content/50">
                                {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown time'}
                              </p>
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
                        disabled={isSubmitting || !selectedDecisionCode || decisionOptions.length === 0}
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

function StatCard({
  title,
  value,
  description,
  tone,
}: {
  title: string
  value: number | string
  description?: string
  tone?: 'warning' | 'success'
}) {
  const toneClass = tone === 'warning' ? 'border-warning/40 bg-warning/10 text-warning' : tone === 'success' ? 'border-success/40 bg-success/10 text-success' : 'border-base-200 bg-base-100'

  return (
    <div className={`border rounded-xl p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{title}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {description && <p className="text-xs opacity-70 mt-1">{description}</p>}
    </div>
  )
}

function StatusBadge({
  status,
  metadata,
  breakdown,
}: {
  status: string
  metadata: Record<string, DecisionDisplayMetadata>
  breakdown: Record<string, number>
}) {
  const label = metadata[status]?.label || status.replace('_', ' ')
  const count = breakdown[status] || 0
  const isPending = status === 'pending'
  const tone = isPending ? 'badge-warning' : 'badge-outline'

  return (
    <span className={`${tone} text-xs flex items-center gap-1`}>
      {label}
      {count > 1 && <span className="hidden sm:inline text-[10px]">· {count}</span>}
    </span>
  )
}

function renderDecisionBadges(
  flag: BiasAuditFlag,
  metadata: Record<string, DecisionDisplayMetadata>,
): JSX.Element {
  const codes = flag.allowedDecisions && flag.allowedDecisions.length > 0
    ? flag.allowedDecisions
    : flag.decisionDetails?.map(entry => entry.code) || []

  if (codes.length === 0) {
    return <span>No catalogue rules for this flag type.</span>
  }

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {codes.map(code => {
        const entry = metadata[code]
        return (
          <span key={code} className="badge badge-outline" title={entry?.description || code}>
            {entry?.label || code}
          </span>
        )
      })}
    </div>
  )
}

function severityToBadge(severity?: string): string {
  if (!severity) return 'badge-ghost'
  const normalized = severity.toLowerCase()
  if (normalized === 'high' || normalized === 'critical') return 'badge-error'
  if (normalized === 'medium') return 'badge-warning'
  if (normalized === 'low') return 'badge-success'
  return 'badge-outline'
}

function formatFlagLabel(flagType?: string | null): string {
  if (!flagType) return ''
  return flagType
    .split('_')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function deriveDecisionOptions(
  review: BiasAuditItem,
  matrix: Record<string, FlagDecisionMatrixEntry[]>,
  metadata: Record<string, DecisionDisplayMetadata>,
  catalog: FlagCatalog | null,
): { options: DecisionOption[]; blocker: string | null } {
  const flags = review.flags || []
  const activeFlags = flags.filter(flag => !flag.resolved)
  const relevantFlags = activeFlags.length > 0 ? activeFlags : flags

  const flagSets = relevantFlags
    .map(flag => {
      const matrixEntries = matrix[flag.flagType] || []
      const matrixCodes = matrixEntries.map(entry => entry.code)

      let codes: string[] = []
      if (matrixCodes.length > 0) {
        codes = matrixCodes
      } else if (flag.allowedDecisions && flag.allowedDecisions.length > 0) {
        codes = flag.allowedDecisions
      } else if (review.allowedDecisions && review.allowedDecisions[flag.flagType]) {
        codes = review.allowedDecisions[flag.flagType]
      }

      return {
        flagType: flag.flagType,
        codes: new Set(codes),
      }
    })
    .filter(entry => entry.codes.size > 0)

  if (flagSets.length > 0) {
    let intersection = new Set<string>(flagSets[0].codes)
    flagSets.slice(1).forEach(entry => {
      intersection = new Set([...intersection].filter(code => entry.codes.has(code)))
    })

    if (intersection.size === 0) {
      return {
        options: [],
        blocker: 'No compatible decisions across the active flags. Please review the flag configuration.',
      }
    }

    const options = Array.from(intersection).map(code =>
      enrichDecisionOption(code, relevantFlags, matrix, metadata, catalog),
    )

    return {
      options: dedupeAndSortOptions(options),
      blocker: null,
    }
  }

  const fallbackCodes = new Set<string>()

  Object.values(review.allowedDecisions || {}).forEach(codes => {
    codes.forEach(code => fallbackCodes.add(code))
  })

  if (fallbackCodes.size === 0) {
    Object.values(matrix).forEach(entries => {
      entries.forEach(entry => fallbackCodes.add(entry.code))
    })
  }

  if (fallbackCodes.size === 0 && catalog) {
    catalog.decisions.forEach(entry => fallbackCodes.add(entry.code))
  }

  const options = Array.from(fallbackCodes).map(code =>
    enrichDecisionOption(code, relevantFlags, matrix, metadata, catalog),
  )

  return {
    options: dedupeAndSortOptions(options),
    blocker: null,
  }
}

function dedupeAndSortOptions(options: DecisionOption[]): DecisionOption[] {
  const seen = new Map<string, DecisionOption>()
  options.forEach(option => {
    seen.set(option.code, {
      code: option.code,
      label: option.label || option.code,
      description: option.description,
      severity: option.severity,
      requiresFollowUp: option.requiresFollowUp,
    })
  })

  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function enrichDecisionOption(
  code: string,
  flags: BiasAuditFlag[],
  matrix: Record<string, FlagDecisionMatrixEntry[]>,
  metadata: Record<string, DecisionDisplayMetadata>,
  catalog: FlagCatalog | null,
): DecisionOption {
  for (const flag of flags) {
    const matrixEntry = (matrix[flag.flagType] || []).find(entry => entry.code === code)
    if (matrixEntry) {
      return matrixEntry
    }

    const flagEntry = (flag.decisionDetails || []).find(entry => entry.code === code)
    if (flagEntry) {
      return flagEntry
    }
  }

  const meta = metadata[code]
  if (meta) {
    return {
      code,
      label: meta.label || code,
      description: meta.description,
      severity: meta.severity,
      requiresFollowUp: meta.requiresFollowUp,
    }
  }

  const fallback = catalog?.decisions.find(entry => entry.code === code)
  if (fallback) {
    return {
      code,
      label: fallback.label || code,
      description: fallback.description,
      severity: fallback.severity,
    }
  }

  return { code, label: code }
}

function mergeDecisionMatrix(
  base: Record<string, FlagDecisionMatrixEntry[]>,
  incoming: Record<string, FlagDecisionMatrixEntry[]>,
): Record<string, FlagDecisionMatrixEntry[]> {
  const result: Record<string, FlagDecisionMatrixEntry[]> = { ...base }

  Object.entries(incoming || {}).forEach(([flagType, entries]) => {
    const existing = result[flagType] || []
    const mergedByCode = new Map<string, FlagDecisionMatrixEntry>()

    existing.forEach(entry => {
      mergedByCode.set(entry.code, { ...entry })
    })

    entries.forEach(entry => {
      const previous = mergedByCode.get(entry.code) || {}
      mergedByCode.set(entry.code, {
        code: entry.code,
        label: entry.label || previous.label || entry.code,
        description: entry.description || previous.description,
        severity: entry.severity || previous.severity,
        requiresFollowUp: entry.requiresFollowUp ?? previous.requiresFollowUp,
      })
    })

    result[flagType] = Array.from(mergedByCode.values())
  })

  return result
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
