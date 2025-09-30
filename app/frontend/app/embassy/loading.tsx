import { Shield } from 'lucide-react'

export default function EmbassyLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-200 flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 bg-primary rounded-full animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-base-content">VisaLegatio</h1>
        </div>
        
        <div className="relative">
          <div className="w-20 h-20 border-4 border-base-300 rounded-full animate-spin mx-auto" />
          <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-primary rounded-full animate-spin mx-auto" />
        </div>
        
        <h2 className="text-xl font-semibold text-base-content/90 mt-6 mb-2">Embassy Portal</h2>
        <p className="text-base-content/70">Initializing secure connection...</p>
        
        <div className="mt-8 space-y-2">
          <div className="w-64 h-2 bg-base-300 rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-primary rounded-full animate-pulse" />
          </div>
          <p className="text-sm text-base-content/50">Verifying security protocols</p>
        </div>
      </div>
    </div>
  )
}