'use client'

import { X, Brain, CheckCircle2, AlertTriangle, FileWarning } from 'lucide-react'

interface AIAnalysis {
  summary: string
  status: string
  concerns: string[]
}

interface DocumentAnalysisPanelProps {
  isOpen: boolean
  analysis: AIAnalysis | null
  onClose: () => void
}

const getAIStatusIcon = (status: string) => {
  switch (status) {
    case 'verified':
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-warning" />
    case 'critical':
      return <FileWarning className="w-4 h-4 text-error" />
    default:
      return <Brain className="w-4 h-4 text-base-content/50" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'verified':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'critical':
      return 'text-error'
    default:
      return 'text-base-content'
  }
}

export default function DocumentAnalysisPanel({ 
  isOpen, 
  analysis, 
  onClose 
}: DocumentAnalysisPanelProps) {
  if (!isOpen || !analysis) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-warning" />
            AI Document Analysis
          </h3>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {getAIStatusIcon(analysis.status)}
              <span className={`text-sm font-medium capitalize ${getStatusColor(analysis.status)}`}>
                {analysis.status}
              </span>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Analysis Summary</h4>
              <p className="text-sm text-base-content/80 leading-relaxed">
                {analysis.summary}
              </p>
            </div>
            
            {analysis.concerns && analysis.concerns.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Concerns Identified
                </h4>
                <ul className="space-y-1">
                  {analysis.concerns.map((concern, index) => (
                    <li key={index} className="text-sm text-base-content/80 flex items-start gap-2">
                      <span className="text-warning mt-1">•</span>
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}