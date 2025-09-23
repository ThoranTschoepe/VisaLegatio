'use client'

import { useMemo } from 'react'

import { biasAttributeMap, biasFactorScores } from '@/data/biasInfluenceMock'

interface InfluenceRow {
  id: string
  label: string
  coefficient: number
  oddsRatio: number
  sampleShare: number
  pValue: number
  delta: number
  direction: 'driver' | 'buffer'
  rawScore: number
}

export default function BiasInfluenceDemo() {
  const scoredRows = useMemo<InfluenceRow[]>(() => {
    return biasFactorScores.map(factor => {
      const attribute = biasAttributeMap[factor.attributeId]
      const prevalenceWeight = Math.sqrt(factor.sampleShare)
      const confidenceWeight = Math.max(0, 1 - factor.pValue / 0.1)
      const rawScore = Math.abs(factor.coefficient) * prevalenceWeight * confidenceWeight

      return {
        id: factor.attributeId,
        label: factor.displayLabel ?? attribute?.label ?? factor.attributeId,
        coefficient: factor.coefficient,
        oddsRatio: factor.oddsRatio,
        sampleShare: factor.sampleShare,
        pValue: factor.pValue,
        delta: factor.delta,
        direction: factor.direction,
        rawScore,
      }
    })
  }, [])

  const split = useMemo(() => {
    const drivers = scoredRows.filter(row => row.direction === 'driver')
    const buffers = scoredRows.filter(row => row.direction === 'buffer')

    const driverTotal = drivers.reduce((acc, row) => acc + row.rawScore, 0) || 1
    const bufferTotal = buffers.reduce((acc, row) => acc + row.rawScore, 0) || 1

    const driverRows = drivers
      .map(row => ({
        ...row,
        percent: (row.rawScore / driverTotal) * 100,
        trendDirection: row.delta >= 0 ? 'up' : 'down',
      }))
      .sort((a, b) => b.percent - a.percent)

    const bufferRows = buffers
      .map(row => ({
        ...row,
        percent: (row.rawScore / bufferTotal) * 100,
        trendDirection: row.delta >= 0 ? 'up' : 'down',
      }))
      .sort((a, b) => b.percent - a.percent)

    return { driverRows, bufferRows }
  }, [scoredRows])

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Influence Leaderboard (demo)</h3>
            <p className="text-xs text-base-content/60">
              Scores derived from a logistic regression on the last 6 weeks of reviewed cases. Higher values indicate stronger influence on bias flags.
            </p>
          </div>
          <div className="text-xs text-base-content/50">
            Model diagnostics · AUC 0.82 · Sample size 1,248 reviews
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InfluenceColumn title="Drivers" accent="text-error" rows={split.driverRows} />
          <InfluenceColumn title="Buffers" accent="text-success" rows={split.bufferRows} />
        </div>

        <div className="alert alert-info text-xs">
          <span>
            Influence percentages are normalised separately for drivers (β &gt; 0) and buffers (β &lt; 0). Raw weight = |β| × √prevalence × confidence; factors with p ≥ 0.1 are down-weighted.
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
                  <span>p={row.pValue.toFixed(3)} · conf {Math.max(0, 1 - row.pValue / 0.1).toFixed(2)}</span>
                  <span className={row.trendDirection === 'up' ? 'text-warning' : 'text-success'}>
                    {row.trendDirection === 'up' ? '▲' : '▼'} {Math.abs(row.delta)} pts
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
