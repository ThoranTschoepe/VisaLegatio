'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  PieChart,
  Search,
  TrendingUp,
} from 'lucide-react'
import { Officer } from '@/types/embassy.types'

const ALLOWED_ROLES = ['Senior Consular Officer', 'System Administrator']

type FactorDirection = 'driver' | 'buffer'

interface BiasInfluenceFactor {
  id: string
  label: string
  direction: FactorDirection
  coefficient: number
  oddsRatio: number
  percentWeight: number
  sampleShare: number
  confidence: number
  delta: number
  explanation: string
  relatedSegments: Array<{ label: string; share: number }>
}

interface SnapshotMeta {
  generatedAt: string
  windowDays: number
  sampleSize: number
  auc: number
  precision: number
  recall: number
}

const SNAPSHOT_META: SnapshotMeta = {
  generatedAt: '2024-09-18T08:15:00Z',
  windowDays: 42,
  sampleSize: 1248,
  auc: 0.82,
  precision: 0.41,
  recall: 0.36,
}

const FACTORS: BiasInfluenceFactor[] = [
  {
    id: 'origin_west_africa',
    label: 'Origin Region · West Africa',
    direction: 'driver',
    coefficient: 0.74,
    oddsRatio: Math.exp(0.74),
    percentWeight: 23.9,
    sampleShare: 0.19,
    confidence: 0.88,
    delta: 6,
    explanation:
      'Escalated rejections frequently cite documentation gaps and previous overstays linked to this origin. Senior review recommends coordinating with regional desks for context checks.',
    relatedSegments: [
      { label: 'Business visas', share: 0.34 },
      { label: 'Student visas', share: 0.29 },
      { label: 'Emergency travel', share: 0.18 },
    ],
  },
  {
    id: 'risk_score_over70',
    label: 'Automated Risk Score ≥ 70',
    direction: 'driver',
    coefficient: 0.91,
    oddsRatio: Math.exp(0.91),
    percentWeight: 27.6,
    sampleShare: 0.22,
    confidence: 0.92,
    delta: 9,
    explanation:
      'High scores from the automated risk engine correlate with a rising share of bias flags. Trend suggests over-sensitivity when combined with limited financial documentation.',
    relatedSegments: [
      { label: 'Tourist visas', share: 0.37 },
      { label: 'Short-term work', share: 0.25 },
      { label: 'Background check pending', share: 0.21 },
    ],
  },
  {
    id: 'wealth_low',
    label: 'Wealth Tier · Low',
    direction: 'driver',
    coefficient: 0.58,
    oddsRatio: Math.exp(0.58),
    percentWeight: 18.4,
    sampleShare: 0.27,
    confidence: 0.81,
    delta: 3,
    explanation:
      'Applicants classified in the lowest wealth bucket receive disproportionate bias escalations. Cross-check sponsor verification steps and consider alternative affordability proofs.',
    relatedSegments: [
      { label: 'Family visit', share: 0.31 },
      { label: 'Medical support', share: 0.23 },
      { label: 'Religious travel', share: 0.16 },
    ],
  },
  {
    id: 'docs_dense',
    label: 'Document Density · High',
    direction: 'buffer',
    coefficient: -0.42,
    oddsRatio: Math.exp(-0.42),
    percentWeight: 15.1,
    sampleShare: 0.46,
    confidence: 0.75,
    delta: -2,
    explanation:
      'Applications with complete document sets rarely trigger bias findings. Maintain the current checklist emphasis for dense submissions.',
    relatedSegments: [
      { label: 'Corporate sponsors', share: 0.38 },
      { label: 'Graduate study', share: 0.27 },
      { label: 'Diplomatic support', share: 0.14 },
    ],
  },
  {
    id: 'sponsor_verified',
    label: 'Sponsor Verification · Verified',
    direction: 'buffer',
    coefficient: -0.27,
    oddsRatio: Math.exp(-0.27),
    percentWeight: 9.8,
    sampleShare: 0.33,
    confidence: 0.73,
    delta: -3,
    explanation:
      'Consistent sponsor verification continues to buffer rejections from bias escalation. Consider extending the verification workflow to the most affected visa types.',
    relatedSegments: [
      { label: 'Cultural exchange', share: 0.41 },
      { label: 'Seasonal work', share: 0.24 },
      { label: 'Tourism', share: 0.19 },
    ],
  },
  {
    id: 'travel_none',
    label: 'Travel History · None',
    direction: 'driver',
    coefficient: 0.33,
    oddsRatio: Math.exp(0.33),
    percentWeight: 8.7,
    sampleShare: 0.41,
    confidence: 0.39,
    delta: 1,
    explanation:
      'Lack of prior travel nudges bias alerts mildly upward, particularly for urgent visit requests. Training materials flag this as a watchpoint rather than a decisive factor.',
    relatedSegments: [
      { label: 'Urgent family visits', share: 0.33 },
      { label: 'Humanitarian parole', share: 0.22 },
      { label: 'Business exploratory', share: 0.17 },
    ],
  },
  {
    id: 'origin_nordics',
    label: 'Origin Region · Nordics',
    direction: 'buffer',
    coefficient: -0.35,
    oddsRatio: Math.exp(-0.35),
    percentWeight: 7.3,
    sampleShare: 0.14,
    confidence: 0.78,
    delta: 0,
    explanation:
      'Applications originating from Nordic countries show consistently low bias escalation. Continue monitoring for any shift linked to policy changes.',
    relatedSegments: [
      { label: 'Research visas', share: 0.36 },
      { label: 'Innovation grants', share: 0.28 },
      { label: 'Conference travel', share: 0.21 },
    ],
  },
]

export default function BiasMonitoringFactorsPage() {
  const router = useRouter()
  const [officer, setOfficer] = useState<Officer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [directionFilter, setDirectionFilter] = useState<FactorDirection | 'all'>('all')
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null)

  useEffect(() => {
    const storedOfficer = window.localStorage.getItem('embassy_officer')
    if (!storedOfficer) {
      router.push('/embassy')
      return
    }

    try {
      const parsedOfficer = JSON.parse(storedOfficer)
      if (!ALLOWED_ROLES.includes(parsedOfficer.role)) {
        window.alert('Access denied. This workspace is restricted to senior officers.')
        router.push('/embassy')
        return
      }
      setOfficer(parsedOfficer)
    } catch (error) {
      console.error('Failed to parse stored officer', error)
      router.push('/embassy')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const filteredFactors = useMemo(() => {
    const term = search.trim().toLowerCase()
    return FACTORS.filter(factor => {
      const matchesDirection =
        directionFilter === 'all' ? true : factor.direction === directionFilter
      const matchesSearch =
        term.length === 0 ||
        factor.label.toLowerCase().includes(term) ||
        factor.explanation.toLowerCase().includes(term)
      return matchesDirection && matchesSearch
    }).sort((a, b) => b.percentWeight - a.percentWeight)
  }, [directionFilter, search])

  if (isLoading || !officer) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-base-content/70">Preparing factor workspace…</p>
        </div>
      </div>
    )
  }

  const activeFactor = filteredFactors.find(factor => factor.id === activeFactorId)

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-sm">
        <div className="flex-1">
          <button className="btn btn-ghost" onClick={() => router.push('/embassy/bias-monitoring')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to monitoring overview
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className={`card bg-base-100 shadow lg:col-span-${activeFactor ? '2' : '3'}`}>
            <div className="card-body space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">Bias Factor Watch</h1>
                  <p className="text-sm text-base-content/60">
                    Sorted by influence share over the last {SNAPSHOT_META.windowDays} days. Signed in as {officer.name}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`btn btn-sm ${directionFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setDirectionFilter('all')}
                  >
                    All factors
                  </button>
                  <button
                    className={`btn btn-sm ${directionFilter === 'driver' ? 'btn-error' : 'btn-outline'}`}
                    onClick={() => setDirectionFilter('driver')}
                  >
                    Drivers
                  </button>
                  <button
                    className={`btn btn-sm ${directionFilter === 'buffer' ? 'btn-success' : 'btn-outline'}`}
                    onClick={() => setDirectionFilter('buffer')}
                  >
                    Buffers
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-3">
                <label className="input input-bordered flex items-center gap-2 lg:max-w-sm">
                  <Search className="w-4 h-4 opacity-70" />
                  <input
                    type="text"
                    placeholder="Search by factor or note"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    className="grow"
                  />
                </label>
                <div className="badge badge-outline gap-2">
                  <Filter className="w-3 h-3" />
                  {filteredFactors.length} results
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Factor</th>
                      <th>Direction</th>
                      <th className="text-right">Odds ratio</th>
                      <th className="text-right">Influence share</th>
                      <th className="text-right">Sample share</th>
                      <th className="text-right">Confidence</th>
                      <th className="text-right">Δ score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFactors.map(factor => {
                      const DirectionIcon = factor.direction === 'driver' ? ArrowUpRight : ArrowDownRight
                      const directionTone = factor.direction === 'driver' ? 'text-error' : 'text-success'
                      const trendTone =
                        factor.delta === 0 ? 'text-base-content/60' : factor.delta > 0 ? 'text-warning' : 'text-success'
                      return (
                        <tr
                          key={factor.id}
                          className={activeFactorId === factor.id ? 'bg-base-200/80' : ''}
                          onClick={() => setActiveFactorId(factor.id)}
                        >
                          <td className="whitespace-normal">
                            <p className="font-semibold">{factor.label}</p>
                            <p className="text-xs text-base-content/60">β={factor.coefficient.toFixed(2)}</p>
                          </td>
                          <td>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${directionTone}`}>
                              <DirectionIcon className="w-3 h-3" />
                              {factor.direction === 'driver' ? 'Driver' : 'Buffer'}
                            </span>
                          </td>
                          <td className="text-right font-mono">{factor.oddsRatio.toFixed(2)}×</td>
                          <td className="text-right font-mono">{factor.percentWeight.toFixed(1)}%</td>
                          <td className="text-right font-mono">{(factor.sampleShare * 100).toFixed(0)}%</td>
                          <td className="text-right font-mono">{(factor.confidence * 100).toFixed(0)}%</td>
                          <td className={`text-right font-mono ${trendTone}`}>
                            {factor.delta > 0 ? '+' : ''}{factor.delta}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {activeFactor && (
            <aside className="card bg-base-100 shadow lg:row-span-2">
              <div className="card-body space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{activeFactor.label}</h2>
                    <p className="text-xs text-base-content/60">Factor details and related segments</p>
                  </div>
                  <button className="btn btn-xs btn-ghost" onClick={() => setActiveFactorId(null)}>
                    Close
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <p>{activeFactor.explanation}</p>
                  <div className="flex items-center gap-2 text-xs text-base-content/60">
                    <PieChart className="w-4 h-4" />
                    {(activeFactor.sampleShare * 100).toFixed(0)}% of reviewed cases include this attribute.
                  </div>
                </div>

                <div className="divider" />

                <h3 className="text-sm font-semibold uppercase tracking-wide">Segment distribution</h3>
                <ul className="space-y-2 text-sm">
                  {activeFactor.relatedSegments.map(segment => (
                    <li key={segment.label} className="flex items-center justify-between">
                      <span>{segment.label}</span>
                      <span className="font-mono">{(segment.share * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-4">
              <h2 className="text-lg font-semibold">Model snapshot</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <SnapshotStat label="Window" value={`${SNAPSHOT_META.windowDays} days`} icon={Filter} />
                <SnapshotStat label="Sample size" value={`${SNAPSHOT_META.sampleSize}`} icon={PieChart} />
                <SnapshotStat label="AUC" value={SNAPSHOT_META.auc.toFixed(2)} icon={TrendingUp} />
                <SnapshotStat label="Precision" value={SNAPSHOT_META.precision.toFixed(2)} icon={TrendingUp} />
                <SnapshotStat label="Recall" value={SNAPSHOT_META.recall.toFixed(2)} icon={TrendingUp} />
                <SnapshotStat
                  label="Updated"
                  value={new Date(SNAPSHOT_META.generatedAt).toLocaleString()}
                  icon={TrendingUp}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SnapshotStatProps {
  label: string
  value: string
  icon: typeof Filter
}

function SnapshotStat({ label, value, icon: Icon }: SnapshotStatProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-base-200/70">
      <Icon className="w-5 h-5 text-primary" />
      <div>
        <p className="text-xs text-base-content/60 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}
