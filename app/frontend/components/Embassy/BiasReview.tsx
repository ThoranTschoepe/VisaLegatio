'use client'

import { useState, useEffect } from 'react'
import { debug, error as logError } from '@/lib/log'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Brain, 
  Scale, 
  TrendingUp,
  RefreshCw,
  FileText,
  Eye,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Users,
  Clock
} from 'lucide-react'
import { Officer, EmbassyApplication } from '@/types/embassy.types'
import Modal from '@/components/UI/Modal'
import { api } from '@/utils/api'

interface BiasReviewProps {
  officer: Officer
}

interface BiasReviewCase {
  application: EmbassyApplication
  rejection_reason: string
  reviewed: boolean
  review_result?: 'justified' | 'biased' | 'uncertain'
  review_notes?: string
  reviewed_by?: string
  reviewed_at?: string
}

interface BiasStatistics {
  total_rejected: number
  sample_size: number
  reviewed_count: number
  bias_detected_count: number
  bias_rate: number
  common_bias_patterns: string[]
}

export default function BiasReview({ officer }: BiasReviewProps) {
  const [cases, setCases] = useState<BiasReviewCase[]>([])
  const [selectedCase, setSelectedCase] = useState<BiasReviewCase | null>(null)
  const [statistics, setStatistics] = useState<BiasStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadBiasReviewData()
  }, [])

  const loadBiasReviewData = async () => {
    try {
      setIsLoading(true)
      
      // Mock data for demonstration
      const mockCases: BiasReviewCase[] = [
        {
          application: {
            id: 'VSV-240201-BIAS1',
            applicantName: 'Ahmed Hassan',
            visaType: 'tourist',
            status: 'rejected',
            submittedAt: new Date('2024-01-20'),
            priority: 'normal',
            country: 'Egypt',
            documentsCount: 5,
            riskScore: 65,
            estimatedDays: 0,
            lastActivity: new Date()
          },
          rejection_reason: 'High risk score due to country of origin and limited travel history',
          reviewed: false
        },
        {
          application: {
            id: 'VSV-240202-BIAS2',
            applicantName: 'Fatima Al-Rashid',
            visaType: 'student',
            status: 'rejected',
            submittedAt: new Date('2024-01-19'),
            priority: 'normal',
            country: 'Syria',
            documentsCount: 6,
            riskScore: 72,
            estimatedDays: 0,
            lastActivity: new Date()
          },
          rejection_reason: 'Insufficient financial documentation despite scholarship',
          reviewed: true,
          review_result: 'biased',
          review_notes: 'Applicant has full scholarship. Financial requirements should be waived.',
          reviewed_by: 'john.davis',
          reviewed_at: '2024-01-25'
        },
        {
          application: {
            id: 'VSV-240203-BIAS3',
            applicantName: 'Vladimir Petrov',
            visaType: 'business',
            status: 'rejected',
            submittedAt: new Date('2024-01-18'),
            priority: 'high',
            country: 'Russia',
            documentsCount: 4,
            riskScore: 80,
            estimatedDays: 0,
            lastActivity: new Date()
          },
          rejection_reason: 'Geopolitical risk factors and incomplete documentation',
          reviewed: true,
          review_result: 'justified',
          review_notes: 'Missing critical business documents. Rejection is warranted.',
          reviewed_by: 'maria.schmidt',
          reviewed_at: '2024-01-24'
        },
        {
          application: {
            id: 'VSV-240204-BIAS4',
            applicantName: 'Chen Wei',
            visaType: 'family_visit',
            status: 'rejected',
            submittedAt: new Date('2024-01-17'),
            priority: 'normal',
            country: 'China',
            documentsCount: 5,
            riskScore: 45,
            estimatedDays: 0,
            lastActivity: new Date()
          },
          rejection_reason: 'Name similarity to watchlist entry (false positive)',
          reviewed: false
        },
        {
          application: {
            id: 'VSV-240205-BIAS5',
            applicantName: 'Maria Gonzalez',
            visaType: 'tourist',
            status: 'rejected',
            submittedAt: new Date('2024-01-16'),
            priority: 'normal',
            country: 'Mexico',
            documentsCount: 6,
            riskScore: 55,
            estimatedDays: 0,
            lastActivity: new Date()
          },
          rejection_reason: 'Previous overstay by family member',
          reviewed: true,
          review_result: 'biased',
          review_notes: 'Applicant should not be penalized for family member actions',
          reviewed_by: 'admin',
          reviewed_at: '2024-01-23'
        }
      ]

      const mockStats: BiasStatistics = {
        total_rejected: 50,
        sample_size: 5,
        reviewed_count: 3,
        bias_detected_count: 2,
        bias_rate: 40,
        common_bias_patterns: [
          'Country of origin bias (35%)',
          'Name-based false positives (25%)',
          'Family association penalties (20%)',
          'Financial requirement misapplication (20%)'
        ]
      }

      setCases(mockCases)
      setStatistics(mockStats)
    } catch (error) {
      logError('Error loading bias review data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReviewSubmit = async (caseItem: BiasReviewCase, result: 'justified' | 'biased' | 'uncertain') => {
    try {
      // Update the case with review result
      const updatedCases = cases.map(c => {
        if (c.application.id === caseItem.application.id) {
          return {
            ...c,
            reviewed: true,
            review_result: result,
            review_notes: reviewNotes,
            reviewed_by: officer.id,
            reviewed_at: new Date().toISOString()
          }
        }
        return c
      })
      
      setCases(updatedCases)
      
      // Update statistics
      if (statistics) {
        const newReviewedCount = statistics.reviewed_count + 1
        const newBiasCount = result === 'biased' ? statistics.bias_detected_count + 1 : statistics.bias_detected_count
        setStatistics({
          ...statistics,
          reviewed_count: newReviewedCount,
          bias_detected_count: newBiasCount,
          bias_rate: newReviewedCount > 0 ? Math.round((newBiasCount / newReviewedCount) * 100) : 0
        })
      }

      // Close modal after submit
      setShowDetailModal(false)
      setSelectedCase(null)
      setReviewNotes('')
    } catch (err) {
      logError('Error submitting review result', err)
    }
  }

  const getReviewBadge = (result?: 'justified' | 'biased' | 'uncertain') => {
    if (!result) return <span className="badge badge-neutral">Pending</span>
    switch (result) {
      case 'justified':
        return <span className="badge badge-success">Justified</span>
      case 'biased':
        return <span className="badge badge-error">Biased</span>
      case 'uncertain':
        return <span className="badge badge-warning">Uncertain</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Common Bias Patterns */}
      {statistics && statistics.common_bias_patterns.length > 0 && (
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body">
            <h3 className="card-title flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Common Bias Patterns Detected
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {statistics.common_bias_patterns.map((pattern, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="badge badge-error badge-sm">!</div>
                  <span className="text-sm">{pattern}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cases Table */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h3 className="card-title">Sampled Rejection Cases</h3>
            <button 
              onClick={loadBiasReviewData}
              className="btn btn-outline btn-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Sample
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Applicant</th>
                  <th>Type</th>
                  <th>Country</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => (
                  <tr key={caseItem.application.id} className="hover">
                    <td className="font-mono text-sm">{caseItem.application.id}</td>
                    <td>
                      <div>
                        <div className="font-semibold">{caseItem.application.applicantName}</div>
                        <div className="text-xs text-base-content/70">
                          {new Date(caseItem.application.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-outline">{caseItem.application.visaType}</span>
                    </td>
                    <td>{caseItem.application.country}</td>
                    <td>
                      <span className={`font-bold ${
                        caseItem.application.riskScore >= 70 ? 'text-error' :
                        caseItem.application.riskScore >= 50 ? 'text-warning' :
                        'text-success'
                      }`}>
                        {caseItem.application.riskScore}%
                      </span>
                    </td>
                    <td>{getReviewBadge(caseItem.review_result)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setSelectedCase(caseItem)
                            setShowDetailModal(true)
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                        {caseItem.reviewed && (
                          <div className="tooltip" data-tip={`Reviewed by ${caseItem.reviewed_by} on ${caseItem.reviewed_at}`}>
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showDetailModal && selectedCase && (
        <Modal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedCase(null)
            setReviewNotes('')
          }}
          title={`Bias Review: ${selectedCase.application.id}`}
          size="xl"
        >
          <p className="text-base-content/70 mb-6">Review this rejection for potential bias</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-lg">Application Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Applicant:</strong> {selectedCase.application.applicantName}</p>
                    <p><strong>Country:</strong> {selectedCase.application.country}</p>
                    <p><strong>Visa Type:</strong> {selectedCase.application.visaType}</p>
                    <p><strong>Risk Score:</strong> <span className="text-error font-bold">{selectedCase.application.riskScore}%</span></p>
                    <p><strong>Documents:</strong> {selectedCase.application.documentsCount} submitted</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-lg">Your Review</h3>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Review Notes</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-32"
                      placeholder="Explain your assessment of potential bias..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>
                  <div className="divider">Decision</div>
                  <div className="space-y-3">
                    <button
                      className="btn btn-success w-full"
                      onClick={() => handleReviewSubmit(selectedCase, 'justified')}
                      disabled={!reviewNotes.trim()}
                    >
                      <ThumbsUp className="w-5 h-5 mr-2" />
                      Rejection Justified
                    </button>
                    <button
                      className="btn btn-error w-full"
                      onClick={() => handleReviewSubmit(selectedCase, 'biased')}
                      disabled={!reviewNotes.trim()}
                    >
                      <ThumbsDown className="w-5 h-5 mr-2" />
                      Bias Detected
                    </button>
                    <button
                      className="btn btn-warning w-full"
                      onClick={() => handleReviewSubmit(selectedCase, 'uncertain')}
                      disabled={!reviewNotes.trim()}
                    >
                      <Clock className="w-5 h-5 mr-2" />
                      Uncertain - Need More Review
                    </button>
                  </div>
                </div>
              </div>
              {selectedCase.reviewed && (
                <div className="card bg-info/10 border border-info/20">
                  <div className="card-body">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> Previous Review
                    </h4>
                    <p className="text-sm text-base-content/70 mb-2">Reviewed by {selectedCase.reviewed_by} on {selectedCase.reviewed_at}</p>
                    <p className="text-sm mb-2"><strong>Result:</strong> {selectedCase.review_result}</p>
                    <p className="text-sm whitespace-pre-line">{selectedCase.review_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="alert alert-info mt-4">
            <Brain className="w-5 h-5" />
            <div>
              <h4 className="font-semibold">Common Bias Indicators to Check:</h4>
              <ul className="text-sm mt-2 space-y-1">
                <li>• Country-based generalizations without individual assessment</li>
                <li>• Name-based assumptions or false positives</li>
                <li>• Penalties for family members' actions</li>
                <li>• Incorrect application of financial requirements</li>
                <li>• Cultural or religious bias in risk assessment</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}