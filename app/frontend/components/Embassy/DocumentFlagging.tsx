'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flag, AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react'
import { EmbassyDocument, Officer, FlaggedDocument } from '@/types/embassy.types'
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
  flaggedDocumentIds: Set<string>
  flaggedDocuments?: FlaggedDocument[]
  resolvedFlagHistory?: FlaggedDocument[]
  onClose: () => void
  onFlagSuccess: (flaggedDocId: string) => void
  onUnflagSuccess: (documentId: string) => void
  onReloadDocuments: () => void
}

export default function DocumentFlagging({
  isOpen,
  document,
  applicationId,
  officer,
  flaggedDocumentIds,
  flaggedDocuments = [],
  resolvedFlagHistory = [],
  onClose,
  onFlagSuccess,
  onUnflagSuccess,
  onReloadDocuments
}: DocumentFlaggingProps) {
  const [flagReason, setFlagReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [categories, setCategories] = useState<Array<{ code: string; label: string; description?: string }>>([])
  const [selectedCategory, setSelectedCategory] = useState('document_gap')
  const [flagDetails, setFlagDetails] = useState<Partial<FlaggedDocument> | null>(null)
  const { showSuccess, showError } = useAlertStore()

  const getAuditPalette = (decision?: string) => {
    switch (decision) {
      case 'clear_to_proceed':
        return {
          container: 'bg-success/10 border-success/20',
          icon: 'text-success',
          text: 'text-success'
        }
      case 'overturn_flag':
        return {
          container: 'bg-error/10 border-error/20',
          icon: 'text-error',
          text: 'text-error'
        }
      case 'escalate_to_security':
        return {
          container: 'bg-error/10 border-error/20',
          icon: 'text-error',
          text: 'text-error'
        }
      case 'escalate_to_policy':
      case 'request_additional_docs':
      case 'request_clarification':
      case 'issue_conditional_approval':
        return {
          container: 'bg-warning/10 border-warning/20',
          icon: 'text-warning',
          text: 'text-warning'
        }
      case 'refer_for_training':
        return {
          container: 'bg-info/10 border-info/20',
          icon: 'text-info',
          text: 'text-info'
        }
      default:
        return {
          container: 'bg-info/10 border-info/20',
          icon: 'text-info',
          text: 'text-info'
        }
    }
  }

  const getAuditIcon = (decision?: string) => {
    switch (decision) {
      case 'overturn_flag':
        return AlertCircle
      case 'escalate_to_policy':
      case 'escalate_to_security':
      case 'request_additional_docs':
      case 'request_clarification':
      case 'issue_conditional_approval':
        return AlertTriangle
      default:
        return ShieldCheck
    }
  }

  const formatDecisionLabel = (entry?: FlaggedDocument | null) => {
    if (!entry) return 'Reviewed'
    if (entry.auditDecisionLabel) return entry.auditDecisionLabel
    const decision = entry.auditDecisionCode || entry.auditStatus
    if (!decision) return 'Reviewed'
    return decision
      .split('_')
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  }

  const auditHistoryByDocumentId = useMemo(() => {
    const map = new Map<string, FlaggedDocument>()

    resolvedFlagHistory.forEach(flag => {
      if (flag.documentId) {
        map.set(flag.documentId, flag)
      }
    })

    flaggedDocuments.forEach(flag => {
      if (flag.documentId && (flag.auditDecisionCode || flag.auditNotes || flag.auditStatus)) {
        map.set(flag.documentId, flag)
      }
    })

    return map
  }, [flaggedDocuments, resolvedFlagHistory])

  const auditSummary = document ? auditHistoryByDocumentId.get(document.id) : undefined

  const isDocumentFlagged = useMemo(() => {
    if (!document) return false
    return flaggedDocumentIds.has(document.id)
  }, [document, flaggedDocumentIds])

  useEffect(() => {
    if (categories.length > 0) {
      return
    }

    let mounted = true

    const loadCatalog = async () => {
      setCatalogLoading(true)
      try {
        const response = await api.getFlagCatalog()
        if (!mounted) return
        const fetchedCategories = response.categories || []
        setCategories(fetchedCategories)

        const defaultCode = flagDetails?.flagType
          || fetchedCategories.find(category => category.code === selectedCategory)?.code
          || fetchedCategories[0]?.code
          || 'document_gap'
        setSelectedCategory(defaultCode)
      } catch (error) {
        if (mounted) {
          showError('Failed to load flag categories; defaulting to document gap')
          setCategories([])
          setSelectedCategory('document_gap')
        }
      } finally {
        if (mounted) {
          setCatalogLoading(false)
        }
      }
    }

    loadCatalog()

    return () => {
      mounted = false
    }
  }, [categories.length, flagDetails?.flagType, selectedCategory, showError])

  useEffect(() => {
    if (!document) {
      setFlagDetails(null)
      return
    }

    const flagFromProps = flaggedDocuments.find(flag => flag.documentId === document.id)

    if (flagFromProps) {
      setFlagDetails(flagFromProps)
      return
    }

    if (!isOpen || !isDocumentFlagged) {
      setFlagDetails(null)
      return
    }

    let mounted = true

    const loadFlagDetails = async () => {
      try {
        const applicationStatus = await api.getApplicationStatus(applicationId)
        if (!mounted) return
        const refreshedFlag = (applicationStatus.flaggedDocuments || []).find((f: FlaggedDocument) => f.documentId === document.id)
        if (refreshedFlag) {
          setFlagDetails(refreshedFlag)
        } else if (mounted) {
          setFlagDetails(null)
        }
      } catch (error) {
        if (mounted) {
          setFlagDetails(null)
        }
      }
    }

    loadFlagDetails()

    return () => {
      mounted = false
    }
  }, [applicationId, document, flaggedDocuments, isDocumentFlagged, isOpen, showError])

  useEffect(() => {
    if (!document) {
      return
    }

    const nextCategory = flagDetails?.flagType
      || categories[0]?.code
      || 'document_gap'

    setSelectedCategory(prev => (prev === nextCategory ? prev : nextCategory))
  }, [document?.id, flagDetails?.flagType, categories])

  if (!isOpen || !document) return null

  const handleSubmitFlag = async () => {
    if (!flagReason.trim() || isSubmitting) return
    
    setIsSubmitting(true)
    try {
      const response = await api.flagDocument(
        applicationId,
        document.id,
        flagReason,
        officer.id,
        selectedCategory || 'document_gap'
      )

      setFlagDetails({
        id: response.flag_id,
        documentId: document.id,
        flagType: selectedCategory,
        reason: flagReason,
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

  const handleUnflag = async (flagId: string) => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    try {
      await api.unflagDocument(applicationId, flagId)
      
      onUnflagSuccess(document.id)
      showSuccess('Document unflagged successfully')
      setFlagDetails(null)
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
    if (categories.length > 0) {
      setSelectedCategory(categories[0].code)
    } else {
      setSelectedCategory('document_gap')
    }
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
              <span className="label-text">Flag category</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              disabled={catalogLoading || isSubmitting}
            >
              {(categories.length > 0 ? categories : [{ code: 'document_gap', label: 'Document Gap' }]).map(category => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-base-content/60 mt-1">
              {categories.find(category => category.code === selectedCategory)?.description ||
                'Request additional or corrected documentation from the applicant.'}
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

          {auditSummary && !isDocumentFlagged && (() => {
            const decisionCode = auditSummary.auditDecisionCode || auditSummary.auditStatus
            const palette = getAuditPalette(decisionCode)
            const AuditIcon = getAuditIcon(decisionCode)
            const auditTimestamp = auditSummary.auditedAt || auditSummary.resolvedAt

            return (
              <div className={`mb-4 rounded-md border ${palette.container} p-3`}>
                <div className="flex items-start gap-2">
                  <AuditIcon className={`w-4 h-4 mt-0.5 ${palette.icon}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${palette.text}`}>
                      Senior review: {formatDecisionLabel(auditSummary)}
                    </p>
                    {auditSummary.auditNotes && (
                      <p className="text-xs text-base-content/70 mt-1">{auditSummary.auditNotes}</p>
                    )}
                    {auditTimestamp && (
                      <p className="text-[11px] text-base-content/60 mt-1">
                        Reviewed {auditTimestamp.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
          
          {isDocumentFlagged ? (
            <div className="alert alert-info mb-4">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">
                This document is already flagged. You can update the reason or remove the flag.
              </span>
            </div>
          ) : (
            <div className="alert alert-warning mb-4">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">
                The applicant will be notified about this flag and can upload a revised document.
              </span>
            </div>
          )}
          
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

          {isDocumentFlagged && flagDetails && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-base-content/60 mb-2">
                Need to clear this flag? The applicant will no longer see it once removed.
              </p>
              <button
                onClick={() => flagDetails?.id && handleUnflag(flagDetails.id)}
                disabled={isSubmitting || !flagDetails?.id}
                className="btn btn-outline btn-sm w-full"
              >
                {isSubmitting ? 'Unflagging...' : 'Remove Flag from This Document'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
