'use client'

import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download
} from 'lucide-react'
import { Officer } from '@/types/embassy.types'

interface AnalyticsDashboardProps {
  onBack: () => void
  officer: Officer
}

export default function AnalyticsDashboard({ onBack, officer }: AnalyticsDashboardProps) {
  const mockData = {
    totalApplications: 1247,
    approvalRate: 87.3,
    avgProcessingTime: 8.5,
    pendingApplications: 89,
    trendsData: [
      { month: 'Jan 2024', applications: 156, approvals: 138, rejections: 18 },
      { month: 'Feb 2024', applications: 189, approvals: 165, rejections: 24 },
      { month: 'Mar 2024', applications: 203, approvals: 178, rejections: 25 },
      { month: 'Apr 2024', applications: 221, approvals: 195, rejections: 26 },
      { month: 'May 2024', applications: 198, approvals: 171, rejections: 27 },
      { month: 'Jun 2024', applications: 280, approvals: 248, rejections: 32 }
    ],
    visaTypeDistribution: [
      { type: 'Tourist', count: 524, percentage: 42.0 },
      { type: 'Business', count: 312, percentage: 25.0 },
      { type: 'Student', count: 186, percentage: 14.9 },
      { type: 'Work', count: 124, percentage: 9.9 },
      { type: 'Family Visit', count: 101, percentage: 8.1 }
    ]
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
          <h1 className="text-xl font-bold">Analytics & Reports</h1>
        </div>
        <div className="flex-none">
          <button className="btn btn-outline btn-sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{mockData.totalApplications.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Total Applications</p>
                </div>
              </div>
              <div className="text-sm text-green-600 flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4" />
                +12% from last period
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">{mockData.approvalRate}%</p>
                  <p className="text-sm text-gray-600">Approval Rate</p>
                </div>
              </div>
              <div className="text-sm text-green-600 flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4" />
                +2.3% from last period
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-info" />
                <div>
                  <p className="text-2xl font-bold">{mockData.avgProcessingTime}d</p>
                  <p className="text-sm text-gray-600">Avg Processing</p>
                </div>
              </div>
              <div className="text-sm text-green-600 flex items-center gap-1 mt-2">
                <TrendingDown className="w-4 h-4" />
                -1.2 days improvement
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-warning" />
                <div>
                  <p className="text-2xl font-bold">{mockData.pendingApplications}</p>
                  <p className="text-sm text-gray-600">Pending Review</p>
                </div>
              </div>
              <div className="text-sm text-yellow-600 flex items-center gap-1 mt-2">
                <Clock className="w-4 h-4" />
                6 urgent priority
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Application Trends</h3>
              <div className="mt-4">
                <div className="space-y-4">
                  {mockData.trendsData.map((month, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{month.month}</span>
                        <span>{month.applications} total</span>
                      </div>
                      <div className="flex h-4 bg-gray-200 rounded overflow-hidden">
                        <div 
                          className="bg-success" 
                          style={{ width: `${(month.approvals / month.applications) * 100}%` }}
                        />
                        <div 
                          className="bg-error" 
                          style={{ width: `${(month.rejections / month.applications) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>✅ {month.approvals} approved</span>
                        <span>❌ {month.rejections} rejected</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Visa Type Distribution</h3>
              <div className="space-y-3 mt-4">
                {mockData.visaTypeDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full bg-primary opacity-${100 - index * 20}`} />
                      <span className="font-medium">{item.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{item.count}</span>
                      <span className="text-sm text-gray-600 ml-1">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Processing Performance</h3>
              <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <span>Tourist Visas</span>
                  <span className="badge badge-success">6.5 days avg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Business Visas</span>
                  <span className="badge badge-warning">8.2 days avg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Student Visas</span>
                  <span className="badge badge-info">14.8 days avg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Work Visas</span>
                  <span className="badge badge-error">21.3 days avg</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Officer Performance</h3>
              <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <span>Maria Schmidt</span>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-success">98% accuracy</span>
                    <span className="badge badge-outline">156 processed</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>John Davis</span>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-success">96% accuracy</span>
                    <span className="badge badge-outline">142 processed</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Sarah Wilson</span>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-warning">94% accuracy</span>
                    <span className="badge badge-outline">128 processed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h4 className="font-semibold">Peak Application Period</h4>
              <p className="text-2xl font-bold text-primary">June 2024</p>
              <p className="text-sm text-gray-600">280 applications received</p>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h4 className="font-semibold">Highest Approval Rate</h4>
              <p className="text-2xl font-bold text-success">88.6%</p>
              <p className="text-sm text-gray-600">June 2024</p>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h4 className="font-semibold">Growth Rate</h4>
              <p className="text-2xl font-bold text-info">+79%</p>
              <p className="text-sm text-gray-600">Compared to last 6 months</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}