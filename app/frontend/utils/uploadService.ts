import axios, { AxiosInstance, AxiosError, CancelTokenSource } from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  speed?: number
  timeRemaining?: number
}

export interface UploadResult {
  id: string
  name: string
  type: string
  size: number
  verified: boolean
  uploaded_at: string
  file_path: string
  ai_analysis?: {
    classification: {
      document_type: string
      confidence: number
      is_correct_type: boolean
    }
    extracted_data: {
      text_content: string
      key_fields: Record<string, any>
      dates: string[]
      amounts: string[]
      names: string[]
    }
    problems: Array<{
      problem_type: string
      severity: string
      description: string
      suggestion: string
    }>
    overall_confidence: number
    is_authentic: boolean
    processing_time_ms: number
    analyzed_at: string
  }
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void
  onSuccess?: (result: UploadResult) => void
  onError?: (error: Error) => void
  maxRetries?: number
  retryDelay?: number
}

class UploadService {
  private axios: AxiosInstance
  private uploadTokens: Map<string, CancelTokenSource> = new Map()
  private startTimes: Map<string, number> = new Map()

  constructor() {
    this.axios = axios.create({
      baseURL: `${API_BASE}/api`,
      timeout: 60000, // 60 seconds timeout
      headers: {
        'Accept': 'application/json',
      }
    })

    // Add request interceptor for error handling
    this.axios.interceptors.response.use(
      response => response,
      async error => {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Upload timeout - please try again with a smaller file or better connection')
        }
        if (!error.response) {
          throw new Error('Network error - please check your connection')
        }
        throw error
      }
    )
  }

  async uploadDocument(
    applicationId: string,
    file: File,
    documentType: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      onProgress,
      onSuccess,
      onError,
      maxRetries = 3,
      retryDelay = 1000
    } = options

    const uploadId = `${documentType}_${Date.now()}`
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.attemptUpload(
          applicationId,
          file,
          documentType,
          uploadId,
          onProgress
        )
        
        onSuccess?.(result)
        return result
      } catch (error) {
        lastError = error as Error
        console.error(`Upload attempt ${attempt} failed:`, error)
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = retryDelay * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed
    const finalError = lastError || new Error('Upload failed after multiple attempts')
    onError?.(finalError)
    throw finalError
  }

  private async attemptUpload(
    applicationId: string,
    file: File,
    documentType: string,
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate file before upload
    this.validateFile(file)

    // Create form data
    const formData = new FormData()
    formData.append('file', file)
    formData.append('application_id', applicationId)
    formData.append('document_type', documentType)

    // Create cancel token
    const cancelTokenSource = axios.CancelToken.source()
    this.uploadTokens.set(uploadId, cancelTokenSource)
    
    // Track upload start time for speed calculation
    const startTime = Date.now()
    this.startTimes.set(uploadId, startTime)
    let lastLoaded = 0
    let lastTime = startTime

    try {
      const response = await this.axios.post<UploadResult>(
        '/documents/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          cancelToken: cancelTokenSource.token,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total && onProgress) {
              const currentTime = Date.now()
              const loaded = progressEvent.loaded
              const total = progressEvent.total
              const percentage = Math.round((loaded * 100) / total)
              
              // Calculate upload speed
              const timeDiff = (currentTime - lastTime) / 1000 // seconds
              const bytesDiff = loaded - lastLoaded
              const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0 // bytes per second
              
              // Calculate time remaining
              const remainingBytes = total - loaded
              const timeRemaining = speed > 0 ? remainingBytes / speed : 0
              
              onProgress({
                loaded,
                total,
                percentage,
                speed,
                timeRemaining
              })
              
              lastLoaded = loaded
              lastTime = currentTime
            }
          }
        }
      )

      return response.data
    } finally {
      // Cleanup
      this.uploadTokens.delete(uploadId)
      this.startTimes.delete(uploadId)
    }
  }

  cancelUpload(uploadId: string): void {
    const tokenSource = this.uploadTokens.get(uploadId)
    if (tokenSource) {
      tokenSource.cancel('Upload cancelled by user')
      this.uploadTokens.delete(uploadId)
      this.startTimes.delete(uploadId)
    }
  }

  cancelAllUploads(): void {
    this.uploadTokens.forEach(tokenSource => {
      tokenSource.cancel('All uploads cancelled')
    })
    this.uploadTokens.clear()
    this.startTimes.clear()
  }

  private validateFile(file: File): void {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
    }

    // Check file extension
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext))
    
    if (!hasValidExtension) {
      throw new Error(`Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`)
    }

    // Additional validation for images
    if (fileName.match(/\.(jpg|jpeg|png)$/)) {
      // Could add image dimension validation here if needed
      // This would require reading the file as an image
    }
  }

  async validateFileWithPreview(file: File): Promise<{
    valid: boolean
    error?: string
    preview?: string
  }> {
    try {
      this.validateFile(file)
      
      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const preview = await this.generateImagePreview(file)
        return { valid: true, preview }
      }
      
      return { valid: true }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid file'
      }
    }
  }

  private generateImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 KB/s'
    const kbps = bytesPerSecond / 1024
    if (kbps < 1024) {
      return `${kbps.toFixed(1)} KB/s`
    }
    const mbps = kbps / 1024
    return `${mbps.toFixed(1)} MB/s`
  }

  formatTimeRemaining(seconds: number): string {
    if (seconds === 0 || !isFinite(seconds)) return 'calculating...'
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
}

export const uploadService = new UploadService()