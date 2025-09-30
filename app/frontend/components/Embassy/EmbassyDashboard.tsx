'use client'
import { useState, useEffect, useMemo } from 'react'
import { 
  CheckCircle2, 
  Clock, 
  Search,
  FileText,
  TrendingUp,
  Eye,
  Shield,
  ArrowUpDown
} from 'lucide-react'
import { Officer, EmbassyApplication } from '@/types/embassy.types'
import { api, apiUtils } from '@/utils/api'
import ApplicationReview from './ApplicationReview'
import AnalyticsDashboard from './AnalyticsDashboard'
import { useRouter } from 'next/navigation'

interface EmbassyDashboardProps {
  officer: Officer
  onLogout: () => void
}

const mockApplications: EmbassyApplication[] = [
  {
    id: 'VSV-240101-A1B2',
    applicantName: 'Sarah Johnson',
    visaType: 'Business',
    status: 'officer_review',
    submittedAt: new Date('2024-01-15'),
    priority: 'high',
    country: 'United States',
    documentsCount: 4,
    riskScore: 15,
    estimatedDays: 2,
    lastActivity: new Date()
  },
  {
    id: 'VSV-240102-C3D4',
    applicantName: 'Miguel Rodriguez',
    visaType: 'Tourist',
    status: 'document_review',
    submittedAt: new Date('2024-01-16'),
    priority: 'normal',
    country: 'Spain',
    documentsCount: 5,
    riskScore: 8,
    estimatedDays: 5,
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: 'VSV-240103-E5F6',
    applicantName: 'Anna Chen',
    visaType: 'Student',
    status: 'background_check',
    submittedAt: new Date('2024-01-14'),
    priority: 'normal',
    country: 'China',
    documentsCount: 6,
    riskScore: 12,
    estimatedDays: 7,
    lastActivity: new Date(Date.now() - 4 * 60 * 60 * 1000)
  },
  {
    id: 'VSV-240104-G7H8',
    applicantName: 'James Wilson',
    visaType: 'Work',
    status: 'submitted',
    submittedAt: new Date('2024-01-17'),
    priority: 'urgent',
    country: 'United Kingdom',
    documentsCount: 3,
    riskScore: 25,
    estimatedDays: 1,
    lastActivity: new Date(Date.now() - 30 * 60 * 1000)
  }
]

export default function EmbassyDashboard({ officer, onLogout }: EmbassyDashboardProps) {
  const router = useRouter()
  const [applications, setApplications] = useState<EmbassyApplication[]>([])
  const [selectedApplication, setSelectedApplication] = useState<EmbassyApplication | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterVisaType, setFilterVisaType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<'none' | 'status' | 'priority' | 'submission'>('none')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentView, setCurrentView] = useState<'dashboard' | 'review' | 'analytics'>('dashboard')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Load applications from backend
  useEffect(() => {
    loadApplications()
  }, [filterStatus, filterVisaType, searchTerm])

  const loadApplications = async () => {
    try {
      setIsLoading(true)
      const filters: any = {}
      if (filterStatus !== 'all') filters.status = filterStatus
      if (filterVisaType !== 'all') filters.visaType = filterVisaType
      if (searchTerm) filters.search = searchTerm

      const response = await api.getApplications(filters)
      
      // Transform response to match frontend types
      const transformedApps: EmbassyApplication[] = response.map((app: any) => ({
        id: app.id,
        applicantName: app.applicantName || app.answers?.applicant_name || 'Unknown',
        visaType: app.visaType,
        status: app.status,
        submittedAt: new Date(app.submittedAt || app.createdAt),
        priority: app.priority || 'normal',
        country: app.country || app.answers?.destination_country || 'Unknown',
        documentsCount: app.documentsCount || 0,
        riskScore: app.riskScore || 0,
        estimatedDays: app.estimatedDays || 0,
        lastActivity: new Date(app.lastActivity || app.updatedAt),
        flaggedDocuments: app.flaggedDocuments || [],
        resolvedFlagHistory: app.resolvedFlagHistory || []
      }))

      setApplications(transformedApps)
      setError('')
    } catch (err: any) {
      console.error('Error loading applications:', err)
      setError('Failed to load applications')
      
      // Fallback to mock data if backend fails
      setApplications(mockApplications)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter and search applications
  const visaTypeOptions = useMemo(() => {
    const types = new Set<string>()
    applications.forEach(app => {
      if (app.visaType) {
        types.add(app.visaType)
      }
    })
    return Array.from(types).sort()
  }, [applications])

  const displayedApplications = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim()

    const filtered = applications.filter(app => {
      const matchesFilter = filterStatus === 'all' || app.status === filterStatus
      const matchesVisa = filterVisaType === 'all' || app.visaType === filterVisaType
      const matchesSearch = !normalizedSearch ||
        app.applicantName.toLowerCase().includes(normalizedSearch) ||
        app.id.toLowerCase().includes(normalizedSearch)
      return matchesFilter && matchesVisa && matchesSearch
    })

    if (sortOption === 'none') {
      return filtered
    }

    const statusOrder = ['submitted', 'document_review', 'flagged_for_review', 'flag_audited', 'background_check', 'officer_review', 'approved', 'rejected']
    const priorityOrder = ['urgent', 'high', 'normal', 'low']
    const directionMultiplier = sortDirection === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const getOrderIndex = (value: string, order: string[]) => {
        const index = order.indexOf(value)
        return index === -1 ? order.length : index
      }

      let comparison = 0

      if (sortOption === 'status') {
        comparison = getOrderIndex(a.status, statusOrder) - getOrderIndex(b.status, statusOrder)
      } else if (sortOption === 'priority') {
        comparison = getOrderIndex(a.priority, priorityOrder) - getOrderIndex(b.priority, priorityOrder)
      } else if (sortOption === 'submission') {
        comparison = a.submittedAt.getTime() - b.submittedAt.getTime()
      }

      if (comparison === 0) {
        comparison = a.submittedAt.getTime() - b.submittedAt.getTime()

        if (comparison === 0) {
          comparison = a.applicantName.localeCompare(b.applicantName)
        }
      }

      return comparison * directionMultiplier
    })
  }, [applications, filterStatus, searchTerm, sortOption, sortDirection])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'badge-success'
      case 'rejected': return 'badge-error'
      case 'flagged_for_review': return 'badge-secondary'
      case 'flag_audited': return 'badge-accent'
      case 'officer_review': return 'badge-warning'
      case 'background_check': return 'badge-info'
      case 'document_review': return 'badge-primary'
      default: return 'badge-ghost'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-error'
      case 'high': return 'text-warning'
      case 'normal': return 'text-primary'
      default: return 'text-base-content/60'
    }
  }

  const getRiskColor = (score: number) => {
    if (score < 10) return 'text-success'
    if (score < 20) return 'text-warning'
    return 'text-error'
  }

  const handleReviewApplication = (application: EmbassyApplication) => {
    setSelectedApplication(application)
    setCurrentView('review')
  }

  const handleUpdateStatus = async (applicationId: string, newStatus: EmbassyApplication['status']) => {
    try {
      await api.updateApplicationStatus(applicationId, {
        status: newStatus,
        officer_id: officer.id,
        notes: `Status updated to ${newStatus} by ${officer.name}`
      })

      // Update local state
      setApplications(prev => 
        prev.map(app => 
          app.id === applicationId 
            ? { ...app, status: newStatus, lastActivity: new Date() }
            : app
        )
      )
    } catch (error) {
      console.error('Error updating application status:', error)
      // Fallback to local update for demo
      setApplications(prev => 
        prev.map(app => 
          app.id === applicationId 
            ? { ...app, status: newStatus, lastActivity: new Date() }
            : app
        )
      )
    }
  }

  const stats = {
    total: applications.length,
    pending: applications.filter(app => !['approved', 'rejected'].includes(app.status)).length,
    approved: applications.filter(app => app.status === 'approved').length,
    avgProcessingTime: 8
  }

  if (currentView === 'review' && selectedApplication) {
    return (
      <ApplicationReview 
        application={selectedApplication}
        onBack={() => setCurrentView('dashboard')}
        onUpdateStatus={handleUpdateStatus}
        officer={officer}
      />
    )
  }

  if (currentView === 'analytics') {
    return (
      <AnalyticsDashboard 
        onBack={() => setCurrentView('dashboard')}
        officer={officer}
      />
    )
  }

  return (
    <div className="min-h-screen bg-base-200">


      <div className="container mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {officer.name.split(' ')[1]}</h2>
          <p className="text-base-content/60">Manage visa applications and track processing status</p>
        </div>

        {(officer.role === 'Senior Consular Officer' || officer.role === 'System Administrator') && (
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-warning" />
                    Governance Console
                  </h3>
                  <p className="text-sm text-base-content/60 max-w-xl">
                    Access senior tools to monitor bias signals, audit reviewer escalations, and track high-level analytics.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setCurrentView('analytics')}
                  >
                    Open Analytics
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => router.push('/embassy/bias-monitoring')}
                  >
                    Bias Monitoring
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => router.push('/embassy/review-audit')}
                  >
                    Review Audits
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-base-content/60">Total Applications</p>
                </div>
              </div>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-warning" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-base-content/60">Pending Review</p>
                </div>
              </div>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-sm text-base-content/60">Approved Today</p>
                </div>
              </div>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-info" />
                <div>
                  <p className="text-2xl font-bold">{stats.avgProcessingTime}d</p>
                  <p className="text-sm text-base-content/60">Avg Processing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bias Review Alert for Senior Officers */}
        {/* Applications Table */}
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-6">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold">Application Queue</h3>
                <span className="badge badge-outline">{displayedApplications.length} applications</span>
              </div>
              <p className="text-sm text-base-content/60">
                Refine by visa type, review status, or submission recency.
              </p>
            </div>

            <div className="rounded-2xl border border-base-300/60 bg-base-200/40 p-4">
              <div className="grid gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-xs font-semibold uppercase tracking-wide text-base-content/70">
                      Search Queue
                    </span>
                  </label>
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-base-content/50" />
                    <input
                      type="text"
                      placeholder="Search by name or application ID..."
                      className="input input-bordered w-full bg-base-100 pl-11"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label="Search applications"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs font-semibold uppercase tracking-wide text-base-content/70">
                        Visa Type
                      </span>
                    </label>
                    <select
                      className="select select-bordered bg-base-100"
                      value={filterVisaType}
                      onChange={(e) => setFilterVisaType(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      {visaTypeOptions.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs font-semibold uppercase tracking-wide text-base-content/70">
                        Status Filter
                      </span>
                    </label>
                    <select
                      className="select select-bordered bg-base-100"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="submitted">Submitted</option>
                      <option value="document_review">Document Review</option>
                      <option value="flagged_for_review">Flagged for Review</option>
                      <option value="flag_audited">Flag Audited</option>
                      <option value="background_check">Background Check</option>
                      <option value="officer_review">Officer Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs font-semibold uppercase tracking-wide text-base-content/70">
                        Sort Queue
                      </span>
                    </label>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                      <select
                        className="select select-bordered w-full bg-base-100"
                        value={sortOption}
                        onChange={(e) => {
                          const value = e.target.value as 'none' | 'status' | 'priority' | 'submission'
                          setSortOption(value)

                          if (value === 'none') {
                            setSortDirection('asc')
                          } else if (value === 'submission') {
                            setSortDirection('desc')
                          } else {
                            setSortDirection('asc')
                          }
                        }}
                      >
                        <option value="none">Default Order</option>
                        <option value="status">Status First</option>
                        <option value="priority">Priority Level</option>
                        <option value="submission">Submission Time</option>
                      </select>

                      <button
                        className="btn btn-outline sm:w-auto"
                        disabled={sortOption === 'none'}
                        onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                      >
                        <ArrowUpDown className="w-4 h-4" />
                        <span className="ml-2 text-sm">
                          {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Applicant</th>
                    <th>Visa Type</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Risk Score</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedApplications.map((app) => (
                    <tr key={app.id} className="hover">
                      <td>
                        <div className="font-mono text-sm">{app.id}</div>
                      </td>
                      <td>
                        <div>
                          <div className="font-semibold">{app.applicantName}</div>
                          <div className="text-sm text-base-content/60">{app.country}</div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-outline">{app.visaType}</span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(app.status)}`}>
                          {app.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`font-semibold ${getPriorityColor(app.priority)}`}>
                          {app.priority.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`font-bold ${getRiskColor(app.riskScore)}`}>
                          {app.riskScore}%
                        </span>
                      </td>
                      <td>
                        <div className="text-sm">
                          {app.submittedAt.toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleReviewApplication(app)}
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
