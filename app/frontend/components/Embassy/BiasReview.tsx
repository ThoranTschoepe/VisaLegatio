'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import Modal from '@/components/UI/Modal'
import { api } from '@/utils/api'
import { Officer, BiasReviewCase, BiasReviewStatistics } from '@/types/embassy.types'

interface BiasReviewProps {
  officer: Officer
}

type ReviewDecision = 'justified' | 'biased' | 'uncertain'

export default function BiasReview({ officer }: BiasReviewProps) {
  const [cases, setCases] = useState<BiasReviewCase[]>([])
  const [statistics, setStatistics] = useState<BiasReviewStatistics | null>(null)
  const [selectedCase, setSelectedCase] = useState<BiasReviewCase | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadBiasReviewData()
  }, [])

  const reviewedCount = useMemo(
    () => cases.filter(item => item.reviewed).length,
    [cases],
  )

  const pendingCases = useMemo(
    () => cases.filter(item => !item.reviewed),
    [cases],
  )

  const loadBiasReviewData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await api.getBiasReviewSample({ sampleRate: 0.2, daysBack: 30 })
      setCases(response.cases)
      setStatistics(response.statistics)
    } catch (err: any) {
      console.error('Error loading bias review data', err)
      setError(err?.message || 'Failed to load bias review data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectCase = (caseItem: BiasReviewCase) => {
    setSelectedCase(caseItem)
    setReviewNotes(caseItem.reviewNotes || '')
  }

  const handleReviewSubmit = async (
    caseItem: BiasReviewCase,
    decision: ReviewDecision,
  ) => {
    try {
      setIsSubmitting(true)
      await api.submitBiasReview(caseItem.application.id, {
        result: decision,
        notes: reviewNotes,
        officer_id: officer.id,
        ai_confidence: caseItem.aiConfidence,
      })
      await loadBiasReviewData()
      setSelectedCase(null)
      setReviewNotes('')
    } catch (err: any) {
      console.error('Error submitting bias review', err)
      setError(err?.message || 'Failed to submit bias review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const statisticsCards = statistics && [
    {
      title: 'Total Rejected (window)',
      value: statistics.totalRejected,
      icon: FileText,
      tone: 'text-primary',
    },
    {
      title: 'Sample Size',
      value: statistics.sampleSize,
      icon: Shield,
      tone: 'text-secondary',
    },
    {
      title: 'Reviewed Cases',
      value: statistics.reviewedCount,
      icon: CheckCircle2,
      tone: 'text-success',
    },
    {
      title: 'Bias Rate',
      value: `${statistics.biasRate.toFixed(1)}%`,
      icon: AlertTriangle,
      tone: statistics.biasRate > 25 ? 'text-error' : 'text-warning',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-3">
            <Shield className="w-6 h-6 text-warning" />
            Bias Review Queue
          </h2>
          <p className="text-base-content/70">
            Audit AI-assisted rejections for potential bias. {pendingCases.length} case{pendingCases.length === 1 ? '' : 's'} pending review.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-sm"
            onClick={loadBiasReviewData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <XCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4 text-base-content/70">
            <div className="loading loading-spinner loading-lg text-warning" />
            <span>Loading bias review cases…</span>
          </div>
        </div>
      ) : (
        <>
          {statistics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statisticsCards?.map(card => (
                <div key={card.title} className="card bg-base-100 shadow-sm">
                  <div className="card-body flex flex-row items-center gap-4">
                    <card.icon className={`w-8 h-8 ${card.tone}`} />
                    <div>
                      <p className="text-sm text-base-content/70">{card.title}</p>
                      <p className="text-xl font-semibold">{card.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Sampled Rejections
                </h3>
                <span className="badge badge-outline">
                  {reviewedCount} / {cases.length} reviewed
                </span>
              </div>

              {cases.length === 0 ? (
                <div className="text-center py-10 text-base-content/60">
                  <p>No rejected applications matched the sampling criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Applicant</th>
                        <th>Visa Type</th>
                        <th>Risk Score</th>
                        <th className="hidden sm:table-cell">Rejection Reason</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map(caseItem => (
                        <tr key={caseItem.application.id}>
                          <td>
                            <div>
                              <p className="font-medium">{caseItem.application.applicantName}</p>
                              <p className="text-sm text-base-content/60">{caseItem.application.country}</p>
                            </div>
                          </td>
                          <td className="capitalize">{caseItem.application.visaType}</td>
                          <td>
                            <span className={`font-semibold ${getRiskTone(caseItem.application.riskScore)}`}>
                              {caseItem.application.riskScore}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell max-w-xs">
                            <p className="truncate" title={caseItem.rejectionReason}>
                              {caseItem.rejectionReason}
                            </p>
                          </td>
                          <td>
                            {caseItem.reviewed ? (
                              <span className={`badge ${getReviewBadgeTone(caseItem.reviewResult)}`}>
                                {caseItem.reviewResult === 'biased' ? 'Bias detected' : caseItem.reviewResult === 'justified' ? 'Justified' : 'Uncertain'}
                              </span>
                            ) : (
                              <span className="badge badge-warning badge-outline">Pending review</span>
                            )}
                          </td>
                          <td className="text-right">
                            <button
                              className="btn btn-sm"
                              onClick={() => handleSelectCase(caseItem)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {statistics?.commonBiasPatterns?.length ? (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Scale className="w-5 h-5 text-info" />
                  Emerging Bias Patterns
                </h3>
                <ul className="list-disc list-inside text-base-content/70 space-y-1">
                  {statistics.commonBiasPatterns.map(pattern => (
                    <li key={pattern}>{pattern}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Modal isOpen={Boolean(selectedCase)} onClose={() => setSelectedCase(null)} maxWidth="max-w-2xl">
        {selectedCase && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Review {selectedCase.application.applicantName}</h3>
              <span className="badge badge-outline">{selectedCase.application.id}</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <CaseMetaItem label="Visa Type" value={selectedCase.application.visaType} icon={PassportIcon} />
              <CaseMetaItem label="Risk Score" value={String(selectedCase.application.riskScore)} icon={AlertTriangle} tone={getRiskTone(selectedCase.application.riskScore)} />
              <CaseMetaItem label="AI Confidence" value={`${selectedCase.aiConfidence}%`} icon={Brain} />
              <CaseMetaItem label="Documents" value={`${selectedCase.application.documentsCount}`} icon={FileText} />
            </div>

            <div className="bg-base-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold uppercase text-base-content/70 mb-2">Rejection Summary</h4>
              <p className="text-base-content/80 leading-relaxed">{selectedCase.rejectionReason}</p>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Review Notes</span>
                <span className="label-text-alt">Visible to audit team</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-32"
                placeholder="Explain your assessment or policy references..."
                value={reviewNotes}
                onChange={event => setReviewNotes(event.target.value)}
              />
            </div>

            <div className="flex flex-col md:flex-row md:justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm text-base-content/70">Audit status: <span className="font-medium text-base-content">{selectedCase.auditStatus}</span></p>
                {selectedCase.reviewed && selectedCase.reviewResult && (
                  <p className="text-sm text-base-content/60">
                    Last reviewed {selectedCase.reviewedAt ? new Date(selectedCase.reviewedAt).toLocaleString() : 'recently'} by {selectedCase.reviewedBy || 'unknown officer'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleReviewSubmit(selectedCase, 'uncertain')}
                  disabled={isSubmitting}
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Needs more info
                </button>
                <button
                  className="btn btn-error btn-sm"
                  onClick={() => handleReviewSubmit(selectedCase, 'biased')}
                  disabled={isSubmitting}
                >
                  <ThumbsDown className="w-4 h-4 mr-1" />
                  Mark biased
                </button>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleReviewSubmit(selectedCase, 'justified')}
                  disabled={isSubmitting}
                >
                  <ThumbsUp className="w-4 h-4 mr-1" />
                  Justified
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const PassportIcon = ({ className = 'w-4 h-4' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 4h18v16H3z" />
    <circle cx="12" cy="10" r="2" />
    <path d="M10 14h4" />
    <path d="M8 18h8" />
  </svg>
)

interface CaseMetaItemProps {
  label: string
  value: string
  icon: any
  tone?: string
}

function CaseMetaItem({ label, value, icon: Icon, tone }: CaseMetaItemProps) {
  return (
    <div className="bg-base-200 rounded-lg p-3 flex items-center gap-3">
      <Icon className={`w-5 h-5 ${tone || 'text-primary'}`} />
      <div>
        <p className="text-xs uppercase tracking-wide text-base-content/60">{label}</p>
        <p className="text-base font-semibold text-base-content">{value}</p>
      </div>
    </div>
  )
}

function getRiskTone(score: number) {
  if (score >= 70) return 'text-error'
  if (score >= 50) return 'text-warning'
  if (score >= 30) return 'text-secondary'
  return 'text-success'
}

function getReviewBadgeTone(result?: ReviewDecision) {
  if (result === 'biased') return 'badge-error'
  if (result === 'justified') return 'badge-success'
  if (result === 'uncertain') return 'badge-warning'
  return 'badge-outline'
}
