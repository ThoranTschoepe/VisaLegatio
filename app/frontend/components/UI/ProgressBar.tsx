import React from 'react'

interface ProgressBarProps {
  value: number // 0-100
  backgroundClassName?: string // container background
  barClassName?: string // inner bar
  labelLeft?: string
  labelRight?: string
  srLabel?: string
}

// Accessible, theme-aware progress bar component
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  backgroundClassName = 'bg-primary/30',
  barClassName = 'bg-base-100',
  labelLeft,
  labelRight,
  srLabel
}) => {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div>
      {(labelLeft || labelRight) && (
        <div className="flex justify-between text-sm text-primary-content/80 mb-2">
          <span>{labelLeft}</span>
          <span>{labelRight}</span>
        </div>
      )}
      <div
        className={`w-full rounded-full h-2 ${backgroundClassName}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={srLabel || labelLeft || 'progress'}
      >
        <div
          className={`h-2 rounded-full transition-all duration-500 ease-out ${barClassName}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
