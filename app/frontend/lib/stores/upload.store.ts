import { create } from 'zustand'
import { UploadProgress } from '@/utils/uploadService'

export interface UploadFile {
  id: string
  file: File
  documentType: string
  status: 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled'
  progress?: UploadProgress
  error?: string
  result?: any
  retryCount: number
  preview?: string
}

interface UploadStore {
  uploads: Map<string, UploadFile>
  activeUploads: number
  maxConcurrentUploads: number
  
  // Actions
  addToQueue: (file: File, documentType: string, preview?: string) => string
  updateUploadStatus: (id: string, status: UploadFile['status'], error?: string) => void
  updateUploadProgress: (id: string, progress: UploadProgress) => void
  updateUploadResult: (id: string, result: any) => void
  removeUpload: (id: string) => void
  retryUpload: (id: string) => void
  clearCompleted: () => void
  clearAll: () => void
  getUploadById: (id: string) => UploadFile | undefined
  getUploadsByStatus: (status: UploadFile['status']) => UploadFile[]
  getNextQueued: () => UploadFile | undefined
  incrementActiveUploads: () => void
  decrementActiveUploads: () => void
  canStartNewUpload: () => boolean
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  uploads: new Map(),
  activeUploads: 0,
  maxConcurrentUploads: 2,

  addToQueue: (file: File, documentType: string, preview?: string) => {
    const id = `${documentType}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const uploadFile: UploadFile = {
      id,
      file,
      documentType,
      status: 'queued',
      retryCount: 0,
      preview
    }
    
    set(state => ({
      uploads: new Map(state.uploads).set(id, uploadFile)
    }))
    
    return id
  },

  updateUploadStatus: (id: string, status: UploadFile['status'], error?: string) => {
    set(state => {
      const uploads = new Map(state.uploads)
      const upload = uploads.get(id)
      if (upload) {
        uploads.set(id, { ...upload, status, error })
      }
      return { uploads }
    })
  },

  updateUploadProgress: (id: string, progress: UploadProgress) => {
    set(state => {
      const uploads = new Map(state.uploads)
      const upload = uploads.get(id)
      if (upload) {
        uploads.set(id, { ...upload, progress })
      }
      return { uploads }
    })
  },

  updateUploadResult: (id: string, result: any) => {
    set(state => {
      const uploads = new Map(state.uploads)
      const upload = uploads.get(id)
      if (upload) {
        uploads.set(id, { ...upload, result })
      }
      return { uploads }
    })
  },

  removeUpload: (id: string) => {
    set(state => {
      const uploads = new Map(state.uploads)
      uploads.delete(id)
      return { uploads }
    })
  },

  retryUpload: (id: string) => {
    set(state => {
      const uploads = new Map(state.uploads)
      const upload = uploads.get(id)
      if (upload && upload.status === 'failed') {
        uploads.set(id, {
          ...upload,
          status: 'queued',
          error: undefined,
          progress: undefined,
          retryCount: upload.retryCount + 1
        })
      }
      return { uploads }
    })
  },

  clearCompleted: () => {
    set(state => {
      const uploads = new Map(state.uploads)
      Array.from(uploads.entries()).forEach(([id, upload]) => {
        if (upload.status === 'completed') {
          uploads.delete(id)
        }
      })
      return { uploads }
    })
  },

  clearAll: () => {
    set({ uploads: new Map(), activeUploads: 0 })
  },

  getUploadById: (id: string) => {
    return get().uploads.get(id)
  },

  getUploadsByStatus: (status: UploadFile['status']) => {
    const uploads = get().uploads
    return Array.from(uploads.values()).filter(upload => upload.status === status)
  },

  getNextQueued: () => {
    const uploads = get().uploads
    return Array.from(uploads.values()).find(upload => upload.status === 'queued')
  },

  incrementActiveUploads: () => {
    set(state => ({ activeUploads: state.activeUploads + 1 }))
  },

  decrementActiveUploads: () => {
    set(state => ({ activeUploads: Math.max(0, state.activeUploads - 1) }))
  },

  canStartNewUpload: () => {
    const { activeUploads, maxConcurrentUploads } = get()
    return activeUploads < maxConcurrentUploads
  }
}))