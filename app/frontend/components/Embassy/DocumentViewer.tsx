'use client'

import { X, ExternalLink } from 'lucide-react'

interface DocumentViewerProps {
  isOpen: boolean
  documentUrl: string
  onClose: () => void
}

export default function DocumentViewer({ 
  isOpen, 
  documentUrl, 
  onClose 
}: DocumentViewerProps) {
  if (!isOpen) return null

  const handleOpenInNewTab = () => {
    window.open(documentUrl, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg max-w-4xl w-full h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Document Viewer</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="btn btn-ghost btn-sm"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-4">
          <iframe
            src={documentUrl}
            className="w-full h-full border rounded"
            title="Document Viewer"
          />
        </div>
      </div>
    </div>
  )
}