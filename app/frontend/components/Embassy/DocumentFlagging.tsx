'use client'

import { useState } from 'react'
import { Flag, AlertTriangle } from 'lucide-react'
import { EmbassyDocument, Officer } from '@/types/embassy.types'
import { api } from '@/utils/api'
import { useAlertStore } from '@/lib/stores/alert.store'

interface DocumentWithUrls extends EmbassyDocument {
  view_url?: string
  file_exists?: boolean
  ai_analysis?: {
    summary: string
    status: string
    concerns: string[]
  }
}

interface DocumentFlaggingProps {
  isOpen: boolean
  document: DocumentWithUrls | null
  applicationId: string
  officer: Officer
  currentFlaggedDocId: string | null
  onClose: () => void
  onFlagSuccess: (flaggedDocId: string) => void
  onUnflagSuccess: () => void
  onReloadDocuments: () => void
}

export default function DocumentFlagging({
  isOpen,
  document,
  applicationId,
  officer,
  currentFlaggedDocId,
  onClose,
  onFlagSuccess,
  onUnflagSuccess,
  onReloadDocuments
}: DocumentFlaggingProps) {
  const [flagReason, setFlagReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { showSuccess, showError } = useAlertStore()

  if (!isOpen || !document) return null

  const handleSubmitFlag = async () => {
    if (!flagReason.trim() || isSubmitting) return
    
    setIsSubmitting(true)
    try {
      await api.flagDocument(applicationId, {
        document_id: document.id,
        reason: flagReason,
        officer_id: officer.id
      })
      
      onFlagSuccess(document.id)
      showSuccess(`Document "${document.name}" flagged for applicant review`)
      handleClose()
      onReloadDocuments()
    } catch (error) {
      showError('Failed to flag document')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnflag = async () => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    try {
      await api.flagDocument(applicationId, {
        officer_id: officer.id
      })
      
      onUnflagSuccess()
      showSuccess('Document unflagged successfully')
      handleClose()
      onReloadDocuments()
    } catch (error) {
      showError('Failed to unflag document')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFlagReason('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-warning" />
            Flag Document for Applicant
          </h3>
          
          <div className="mb-4">
            <p className="text-sm text-base-content/60 mb-2">
              Flagging: <strong>{document.name}</strong>
            </p>
            <p className="text-sm text-base-content/60">
              The applicant will see this flag in their status tracker.
            </p>
          </div>
          
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Reason for flagging</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              placeholder="e.g., Document unclear, please provide a clearer scan..."
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="alert alert-warning mb-4">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              Only one document can be flagged at a time. Flagging this will replace any previously flagged document.
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSubmitFlag}
              disabled={!flagReason.trim() || isSubmitting}
              className="btn btn-warning flex-1"
            >
              {isSubmitting ? 'Flagging...' : 'Flag Document'}
            </button>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>

          {currentFlaggedDocId && (
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={handleUnflag}
                disabled={isSubmitting}
                className="btn btn-outline btn-sm w-full"
              >
                {isSubmitting ? 'Unflagging...' : 'Remove Current Flag'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}