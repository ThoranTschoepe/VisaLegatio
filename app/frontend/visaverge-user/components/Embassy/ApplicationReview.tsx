'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { EmbassyApplication, Officer, EmbassyDocument } from '@/types/embassy.types'

interface ApplicationReviewProps {
  application: EmbassyApplication
  onBack: () => void
  onUpdateStatus: (id: string, status: EmbassyApplication['status']) => void
  officer: Officer
}

export default function ApplicationReview({ 
  application, 
  onBack, 
  onUpdateStatus, 
  officer 
}: ApplicationReviewProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedDocument, setSelectedDocument] = useState(0)

  const mockDocuments: EmbassyDocument[] = [
    { id: '1', name: 'Passport', type: 'passport', verified: true, uploadedAt: '2024-01-15' },
    { id: '2', name: 'Photo', type: 'photo', verified: true, uploadedAt: '2024-01-15' },
    { id: '3', name: 'Bank Statement', type: 'bank_statement', verified: true, uploadedAt: '2024-01-15' },
    { id: '4', name: 'Invitation Letter', type: 'invitation_letter', verified: false, uploadedAt: '2024-01-15' }
  ]

  const mockAnswers = {
    'destination_country': 'Germany',
    'business_purpose': 'Conference/Meeting',
    'company_name': 'Tech Solutions Inc.',
    'invitation_company': 'Berlin Tech Conference',
    'duration': '7'
  }

  const handleMakeDecision = () => {
    if (decision) {
      const newStatus = decision === 'approve' ? 'approved' : 'rejected'
      onUpdateStatus(application.id, newStatus)
      onBack()
    }
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <button className="btn btn-ghost" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <div className="divider divider-horizontal"></div>
          <h1 className="text-xl font-bold">Application Review</h1>
        </div>
        <div className="flex-none">
          <span className="text-sm text-gray-600">Reviewing as: {officer.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Application Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Applicant Info */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Applicant Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold">{application.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Application ID</p>
                    <p className="font-mono text-sm">{application.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Visa Type</p>
                    <span className="badge badge-primary">{application.visaType}</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Country of Origin</p>
                    <p className="font-semibold">{application.country}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Risk Assessment</p>
                    <p className={`font-bold ${application.riskScore < 10 ? 'text-green-600' : application.riskScore < 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {application.riskScore}% Risk Score
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Answers */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Application Answers</h3>
                <div className="space-y-3">
                  {Object.entries(mockAnswers).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm text-gray-600">{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Documents */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow h-full">
              <div className="card-body">
                <h3 className="card-title">Documents ({mockDocuments.length})</h3>
                
                {/* Document List */}
                <div className="space-y-2">
                  {mockDocuments.map((doc, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded border cursor-pointer ${selectedDocument === index ? 'border-primary bg-primary/10' : 'border-gray-200'}`}
                      onClick={() => setSelectedDocument(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{doc.name}</p>
                          <p className="text-sm text-gray-600">Uploaded: {doc.uploadedAt}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.verified ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-warning" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Document Viewer */}
                <div className="mt-4 p-4 border rounded bg-gray-100">
                  <h4 className="font-semibold mb-2">{mockDocuments[selectedDocument].name}</h4>
                  <div className="bg-white p-6 rounded border-2 border-dashed text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Document Preview</p>
                    <p className="text-sm text-gray-500">
                      {mockDocuments[selectedDocument].verified ? 'Verified ✓' : 'Verification Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Decision */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="card-title">Make Decision</h3>
                
                <div className="space-y-4">
                  {/* Decision Buttons */}
                  <div className="space-y-2">
                    <button 
                      className={`btn w-full ${decision === 'approve' ? 'btn-success' : 'btn-outline btn-success'}`}
                      onClick={() => setDecision('approve')}
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Approve Application
                    </button>
                    
                    <button 
                      className={`btn w-full ${decision === 'reject' ? 'btn-error' : 'btn-outline btn-error'}`}
                      onClick={() => setDecision('reject')}
                    >
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Reject Application
                    </button>
                  </div>

                  {/* Notes */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Decision Notes</span>
                    </label>
                    <textarea 
                      className="textarea textarea-bordered h-24" 
                      placeholder="Add notes about your decision..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                  </div>

                  {/* Submit Decision */}
                  <button 
                    className="btn btn-primary w-full"
                    disabled={!decision}
                    onClick={handleMakeDecision}
                  >
                    Submit Decision
                  </button>
                </div>

                {/* AI Insights */}
                <div className="mt-6 p-4 bg-info/10 rounded">
                  <h4 className="font-semibold text-info mb-2">🤖 AI Insights</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Strong financial documentation</li>
                    <li>• Clear business purpose stated</li>
                    <li>• No previous visa violations</li>
                    <li>• All required documents present</li>
                  </ul>
                  <div className="mt-2">
                    <span className="badge badge-success">85% Approval Confidence</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}