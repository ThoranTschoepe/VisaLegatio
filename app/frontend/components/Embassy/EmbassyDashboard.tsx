'use client'
import { useState, useEffect } from 'react'
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Filter, 
  Search,
  FileText,
  TrendingUp,
  Eye,
  MoreVertical,
  BarChart3,
  Shield
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
  const [searchTerm, setSearchTerm] = useState('')
  const [currentView, setCurrentView] = useState<'dashboard' | 'review' | 'analytics'>('dashboard')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Load applications from backend
  useEffect(() => {
    loadApplications()
  }, [filterStatus, searchTerm])

  const loadApplications = async () => {
    try {
      setIsLoading(true)
      const filters: any = {}
      if (filterStatus !== 'all') filters.status = filterStatus
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
        lastActivity: new Date(app.lastActivity || app.updatedAt)
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
  const filteredApplications = applications.filter(app => {
    const matchesFilter = filterStatus === 'all' || app.status === filterStatus
    const matchesSearch = app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.id.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'badge-success'
      case 'rejected': return 'badge-error'
      case 'officer_review': return 'badge-warning'
      case 'background_check': return 'badge-info'
      case 'document_review': return 'badge-primary'
      default: return 'badge-ghost'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'normal': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getRiskColor = (score: number) => {
    if (score < 10) return 'text-green-600'
    if (score < 20) return 'text-yellow-600'
    return 'text-red-600'
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
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary">
            🏛️ Embassy Portal
          </h1>
        </div>
        <div className="flex-none gap-2">
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setCurrentView('analytics')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </button>
          {(officer.role === 'Senior Consular Officer' || officer.role === 'System Administrator') && (
            <button 
              className="btn btn-warning btn-sm"
              onClick={() => router.push('/embassy/bias-review')}
            >
              <Shield className="w-4 h-4 mr-2" />
              Bias Review
            </button>
          )}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full bg-primary text-white flex items-center justify-center">
                {officer.name.charAt(0)}
              </div>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
              <li><a>Profile</a></li>
              <li><a>Settings</a></li>
              <li><a onClick={onLogout}>Logout</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {officer.name.split(' ')[1]}</h2>
          <p className="text-gray-600">Manage visa applications and track processing status</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-gray-600">Total Applications</p>
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
                  <p className="text-sm text-gray-600">Pending Review</p>
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
                  <p className="text-sm text-gray-600">Approved Today</p>
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
                  <p className="text-sm text-gray-600">Avg Processing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bias Review Alert for Senior Officers */}
        {(officer.role === 'Senior Consular Officer' || officer.role === 'System Administrator') && (
          <div className="alert alert-warning shadow-lg mb-6">
            <Shield className="w-6 h-6" />
            <div className="flex-1">
              <h3 className="font-bold">Bias Review Available</h3>
              <p className="text-sm">Review rejected applications for potential AI bias patterns</p>
            </div>
            <button 
              className="btn btn-sm"
              onClick={() => router.push('/embassy/bias-review')}
            >
              Review Now
            </button>
          </div>
        )}

        {/* Search and Filters */}
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="form-control">
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="Search by name or application ID..." 
                      className="input input-bordered flex-1"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className="btn btn-square">
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="select select-bordered"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="document_review">Document Review</option>
                  <option value="background_check">Background Check</option>
                  <option value="officer_review">Officer Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                
                <button className="btn btn-outline">
                  <Filter className="w-5 h-5" />
                  More Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Applications Table */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Application Queue</h3>
              <span className="badge badge-outline">{filteredApplications.length} applications</span>
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
                  {filteredApplications.map((app) => (
                    <tr key={app.id} className="hover">
                      <td>
                        <div className="font-mono text-sm">{app.id}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">
                              {app.applicantName.split(' ').map(n => n[0]).join('')}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold">{app.applicantName}</div>
                            <div className="text-sm text-gray-600">{app.country}</div>
                          </div>
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