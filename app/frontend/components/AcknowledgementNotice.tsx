'use client'

import { ChangeEvent, useId } from 'react'
import { ShieldCheck } from 'lucide-react'

export interface AcknowledgementNoticeProps {
  title?: string
  message?: string
  acknowledgeLabel?: string
  learnMoreLabel?: string
  learnMoreHref?: string
  onLearnMore?: () => void
  checked: boolean
  onChange: (checked: boolean) => void
  showError?: boolean
  errorText?: string
  disabled?: boolean
  className?: string
}

const DEFAULT_MESSAGE = 'AI will be used to summarize or highlight key facts. All files will still be evaluated by humans.'

export function AcknowledgementNotice({
  title = 'AI Summarization Notice',
  message = DEFAULT_MESSAGE,
  acknowledgeLabel = 'Got it',
  learnMoreLabel = 'Learn more',
  learnMoreHref,
  onLearnMore,
  checked,
  onChange,
  showError,
  errorText = 'Please acknowledge before continuing.',
  disabled,
  className
}: AcknowledgementNoticeProps) {
  const checkboxId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked)
  }

  const showLearnMore = Boolean(learnMoreHref || onLearnMore)

  return (
    <div
      className={`rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6 ${
        className || ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-base-content">{title}</h3>
            <p className="text-sm text-base-content/70">{message}</p>
          </div>

          {showLearnMore && (
            <div>
              {learnMoreHref ? (
                <a
                  href={learnMoreHref}
                  className="text-sm font-medium text-primary hover:text-primary/80 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {learnMoreLabel}
                </a>
              ) : (
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:text-primary/80 hover:underline"
                  onClick={onLearnMore}
                >
                  {learnMoreLabel}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              id={checkboxId}
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={checked}
              onChange={handleChange}
              disabled={disabled}
            />
            <label htmlFor={checkboxId} className="text-sm font-medium text-base-content/80 cursor-pointer">
              {acknowledgeLabel}
            </label>
          </div>

          {showError && !checked && (
            <p className="text-sm font-medium text-error">{errorText}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default AcknowledgementNotice
