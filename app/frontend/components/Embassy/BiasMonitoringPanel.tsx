'use client'

import { useEffect, useState, type ElementType } from 'react'
import {
  Shield,
  RefreshCw,
  Brain,
  CheckCircle2,
  FileText,
  XCircle,
} from 'lucide-react'
import { api } from '@/utils/api'
import {
  Officer,
  BiasReviewCase,
  BiasReviewStatistics,
  BiasMonitoringSnapshot,
} from '@/types/embassy.types'
import BiasInfluenceDemo from './BiasInfluenceDemo'
import { biasAttributeCategories } from '@/data/biasInfluenceMock'

interface BiasMonitoringPanelProps {
  officer: Officer
}

export default function BiasMonitoringPanel({ officer }: BiasMonitoringPanelProps) {
  const [cases, setCases] = useState<BiasReviewCase[]>([])
  const [statistics, setStatistics] = useState<BiasReviewStatistics | null>(null)
  const [snapshot, setSnapshot] = useState<BiasMonitoringSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMonitoringData()
  }, [])

  const loadMonitoringData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [sample, overview] = await Promise.all([
        api.getBiasReviewSample({ sampleRate: 1, daysBack: 30 }),
        api.getBiasMonitoringOverview(),
      ])
      setCases(sample.cases)
      setStatistics(sample.statistics)
      setSnapshot(overview)
    } catch (err: any) {
      console.error('Failed to load monitoring data', err)
      setError(err?.message || 'Unable to load bias monitoring data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      await loadMonitoringData()
    } finally {
      setIsRefreshing(false)
    }
  }

  const reviewedCount = statistics?.reviewedCount ?? 0
  const biasDetectedCount = statistics?.biasDetectedCount ?? 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-3">
            <Shield className="w-6 h-6 text-warning" />
            Bias Monitoring Overview
          </h2>
          <p className="text-base-content/70">
            Review sampling insights and emerging bias patterns. Signed in as {officer.name}.
          </p>
          <p className="text-xs text-base-content/50">
            Snapshot window: {snapshot?.metrics.windowDays ?? 30} days • Last generated:{' '}
            {snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleString() : '—'}
          </p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh data
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <XCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-base-content/70">
            <RefreshCw className="w-10 h-10 animate-spin" />
            Loading monitoring data…
          </div>
        </div>
      ) : (
        <>
          {statistics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={FileText}
                label="Total rejections (window)"
                value={statistics.totalRejected}
              />
              <StatCard
                icon={Shield}
                label="Sampled cases"
                value={statistics.sampleSize}
              />
              <StatCard
                icon={CheckCircle2}
                label="Reviewed sample"
                value={`${reviewedCount}`}
              />
              <StatCard
                icon={Brain}
                label="Bias findings"
                value={biasDetectedCount}
              />
            </div>
          )}

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Sampled rejection cases
                </h3>
                <span className="badge badge-outline">
                  {reviewedCount} / {cases.length} reviewed
                </span>
              </div>

              {cases.length === 0 ? (
                <div className="text-center py-10 text-base-content/60">
                  No sampled rejections available for this window.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Application</th>
                        <th>Visa Type</th>
                        <th>Country</th>
                        <th>Risk</th>
                        <th>Review Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map((caseItem) => (
                        <tr key={caseItem.application.id}>
                          <td>
                            <div>
                              <p className="font-semibold">{caseItem.application.applicantName}</p>
                              <p className="text-xs text-base-content/60 font-mono">
                                {caseItem.application.id}
                              </p>
                            </div>
                          </td>
                          <td className="capitalize">{caseItem.application.visaType}</td>
                          <td>{caseItem.application.country}</td>
                          <td>
                            <span className={`font-semibold ${riskTone(caseItem.application.riskScore)}`}>
                              {caseItem.application.riskScore}
                            </span>
                          </td>
                          <td>
                            {renderReviewBadge(caseItem)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <BiasInfluenceDemo />

          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Attribute catalog</h3>
                <p className="text-xs text-base-content/60">
                  Key attributes tracked in the bias influence model and how each signal is calculated before fitting the regression.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {biasAttributeCategories.map(category => (
                  <section key={category.id} className="p-4 rounded-lg bg-base-200/60 space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wide">{category.title}</h4>
                    <ul className="space-y-3 text-sm">
                      {category.attributes.map(attribute => (
                        <li key={attribute.id}>
                          <p className="font-medium">{attribute.label}</p>
                          <p className="text-xs text-base-content/70 leading-relaxed">{attribute.explanation}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: ElementType
  label: string
  value: string | number
  tone?: string
  helper?: string
}

function StatCard({ icon: Icon, label, value, tone, helper }: StatCardProps) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body flex items-center gap-4">
        <Icon className={`w-8 h-8 ${tone || 'text-primary'}`} />
        <div>
          <p className="text-sm text-base-content/60">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          {helper && <p className="text-xs text-base-content/50">{helper}</p>}
        </div>
      </div>
    </div>
  )
}

function renderReviewBadge(caseItem: BiasReviewCase) {
  if (!caseItem.reviewed || !caseItem.review_result) {
    return <span className="badge badge-neutral">Pending</span>
  }

  switch (caseItem.review_result) {
    case 'justified':
      return <span className="badge badge-success">Justified</span>
    case 'biased':
      return <span className="badge badge-error">Biased</span>
    case 'uncertain':
      return <span className="badge badge-warning">Uncertain</span>
    default:
      return <span className="badge badge-neutral">Pending</span>
  }
}

function riskTone(score: number) {
  if (score >= 70) return 'text-error'
  if (score >= 50) return 'text-warning'
  if (score >= 30) return 'text-secondary'
  return 'text-success'
}
