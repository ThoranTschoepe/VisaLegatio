'use client'

import { useMemo } from 'react'

import {
  BiasInfluenceAttributeCatalog,
  BiasInfluenceLeaderboard,
} from '@/types/embassy.types'
import { biasAttributeCategories as defaultAttributeCategories } from '@/data/biasInfluenceMock'

interface InfluenceLeaderboardProps {
  leaderboard: BiasInfluenceLeaderboard | null
  attributes: BiasInfluenceAttributeCatalog | null
  isLoading: boolean
  error?: string | null
}

interface InfluenceRow {
  id: string
  label: string
  coefficient: number
  oddsRatio: number
  sampleShare: number
  pValue: number | null
  delta: number
  direction: 'driver' | 'buffer'
  rawScore: number
  confidenceWeight: number
}

export default function InfluenceLeaderboard({ leaderboard, attributes, isLoading, error }: InfluenceLeaderboardProps) {
  const attributeCategories = attributes?.categories && attributes.categories.length > 0
    ? attributes.categories
    : defaultAttributeCategories

  const attributeMap = useMemo(() => {
    return attributeCategories
      .flatMap(category => category.attributes)
      .reduce<Record<string, { label: string; explanation: string }>>((acc, attribute) => {
        acc[attribute.id] = { label: attribute.label, explanation: attribute.explanation }
        return acc
      }, {})
  }, [attributeCategories])

  const scoredRows = useMemo<InfluenceRow[]>(() => {
    if (!leaderboard || !leaderboard.factors) {
      return []
    }

    return leaderboard.factors.map(factor => {
      const attribute = attributeMap[factor.attributeId]
      const prevalenceWeight = factor.prevalenceWeight ?? Math.sqrt(Math.max(0, factor.sampleShare))
      const computedConfidence = factor.confidenceWeight ?? (factor.pValue != null ? Math.max(0, 1 - factor.pValue / 0.1) : 1)
      const rawScore = Math.abs(factor.coefficient) * (prevalenceWeight || 0) * (computedConfidence || 0)

      return {
        id: factor.attributeId,
        label: factor.displayLabel ?? attribute?.label ?? factor.attributeId,
        coefficient: factor.coefficient,
        oddsRatio: factor.oddsRatio,
        sampleShare: factor.sampleShare,
        pValue: factor.pValue ?? null,
        delta: factor.delta,
        direction: factor.direction,
        rawScore,
        confidenceWeight: computedConfidence || 0,
      }
    })
  }, [attributeMap, leaderboard])

  const split = useMemo(() => {
    const drivers = scoredRows.filter(row => row.direction === 'driver')
    const buffers = scoredRows.filter(row => row.direction === 'buffer')

    const driverTotal = drivers.reduce((acc, row) => acc + row.rawScore, 0) || 1
    const bufferTotal = buffers.reduce((acc, row) => acc + row.rawScore, 0) || 1

    const driverRows = drivers
      .map(row => ({
        ...row,
        percent: driverTotal ? (row.rawScore / driverTotal) * 100 : 0,
        trendDirection: row.delta >= 0 ? 'up' : 'down',
      }))
      .sort((a, b) => b.percent - a.percent)

    const bufferRows = buffers
      .map(row => ({
        ...row,
        percent: bufferTotal ? (row.rawScore / bufferTotal) * 100 : 0,
        trendDirection: row.delta >= 0 ? 'up' : 'down',
      }))
      .sort((a, b) => b.percent - a.percent)

    return { driverRows, bufferRows }
  }, [scoredRows])

  const modelDiagnostics = leaderboard?.model
  const warnings = modelDiagnostics?.warnings ?? []
  const hasLiveData = scoredRows.length > 0

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Bias influence leaderboard</h3>
            <p className="text-xs text-base-content/60">
              Coefficients derived from the latest logistic regression on reviewed bias cases. Drivers increase bias odds; buffers reduce them.
            </p>
          </div>
          <div className="text-xs text-base-content/50">
            {modelDiagnostics ? (
              <span>
                Window {modelDiagnostics.windowDays ?? 30} days · Sample size {modelDiagnostics.sampleSize.toLocaleString()}
                {Number.isFinite(modelDiagnostics.auc) ? ` · AUC ${modelDiagnostics.auc.toFixed(2)}` : ''}
                {modelDiagnostics.refreshedAt ? ` · Refreshed ${new Date(modelDiagnostics.refreshedAt).toLocaleString()}` : ''}
              </span>
            ) : (
              <span>Model diagnostics not yet available</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-base-content/60">
            <div className="flex items-center gap-3">
              <span className="loading loading-spinner loading-sm" />
              Fetching influence metrics…
            </div>
          </div>
        ) : hasLiveData ? (
          <div className="grid gap-4 md:grid-cols-2">
            <InfluenceColumn title="Drivers" accent="text-error" rows={split.driverRows} />
            <InfluenceColumn title="Buffers" accent="text-success" rows={split.bufferRows} />
          </div>
        ) : (
          <div className="alert alert-info">
            <span>
              Influence metrics are not yet available. {error ? `(${error})` : warnings.length > 0 ? warnings[0] : 'Awaiting enough reviewed cases or model training.'}
            </span>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="alert alert-warning text-xs">
            <span className="font-medium">Model warnings:</span>
            <ul className="list-disc list-inside">
              {warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {error && hasLiveData && (
          <div className="alert alert-warning text-xs">{error}</div>
        )}

        <div className="alert alert-info text-xs">
          <span>
            Influence percentages are normalised separately for drivers (β &gt; 0) and buffers (β &lt; 0). Raw weight = |β| × √prevalence × confidence.
          </span>
        </div>
      </div>
    </div>
  )
}

interface ColumnProps {
  title: string
  accent: string
  rows: Array<InfluenceRow & { percent: number; trendDirection: 'up' | 'down' }>
}

function InfluenceColumn({ title, accent, rows }: ColumnProps) {
  return (
    <div className="card bg-base-200/50 shadow-sm">
      <div className="card-body space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wide">{title}</h4>
          <span className={`${accent} text-xs font-medium`}>100% total</span>
        </div>
        <ul className="space-y-3">
          {rows.length === 0 ? (
            <li className="text-xs text-base-content/60">No factors in this band.</li>
          ) : (
            rows.map(row => (
              <li key={row.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="text-base-content/60">{row.percent.toFixed(1)}%</span>
                </div>
                <div className="progress progress-primary h-2">
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${Math.min(100, row.percent)}%`, transition: 'width 0.5s ease' }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-base-content/60">
                  <span>β={row.coefficient.toFixed(2)} · OR {row.oddsRatio.toFixed(2)}×</span>
                  <span>{(row.sampleShare * 100).toFixed(0)}% sample</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>
                    p=
                    {row.pValue != null ? row.pValue.toFixed(3) : '—'} · conf {row.confidenceWeight.toFixed(2)}
                  </span>
                  <span className={row.trendDirection === 'up' ? 'text-warning' : 'text-success'}>
                    {row.trendDirection === 'up' ? '▲' : '▼'} {Math.abs(row.delta).toFixed(1)} pts
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
