/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryIf?: (error: Error) => boolean
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryIf: (error: Error) => {
    // Retry on file system errors, network errors, but not on validation errors
    return error.message.includes('ENOENT') ||
           error.message.includes('EACCES') ||
           error.message.includes('EMFILE') ||
           error.message.includes('EAGAIN') ||
           error.message.includes('timeout')
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = Math.min(
    options.baseDelay * Math.pow(options.backoffFactor, attempt),
    options.maxDelay
  )
  
  // Add jitter (±25% randomization) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)
  
  return Math.max(100, Math.min(options.maxDelay, exponentialDelay + jitter)) // Respect max delay
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        break
      }
      
      // Check if we should retry this error
      if (config.retryIf && !config.retryIf(lastError)) {
        break
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, config)
      await sleep(delay)
    }
  }
  
  // All retries exhausted, throw the last error
  throw lastError || new Error('Operation failed after all retries')
}

/**
 * Create a retry wrapper for file system operations
 */
export function createFileSystemRetry(options?: Partial<RetryOptions>) {
  const retryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    retryIf: (error: Error) => {
      // Specifically for file system operations
      return error.message.includes('ENOENT') ||
             error.message.includes('EACCES') ||
             error.message.includes('EMFILE') ||
             error.message.includes('EAGAIN') ||
             error.message.includes('EBUSY')
    },
    ...options
  }
  
  return <T>(operation: () => Promise<T>) => withRetry(operation, retryOptions)
}

/**
 * Enhanced error context for better error messages
 */
export interface ErrorContext {
  operation: string
  file?: string
  details?: Record<string, any>
}

/**
 * Create an enhanced error with context
 */
export function createEnhancedError(
  originalError: Error,
  context: ErrorContext
): Error {
  const { operation, file, details } = context
  
  let message = `${operation} failed`
  
  if (file) {
    message += ` for file: ${file}`
  }
  
  message += `\nReason: ${originalError.message}`
  
  if (details) {
    const detailsStr = Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
    message += `\nDetails: ${detailsStr}`
  }
  
  const enhancedError = new Error(message)
  enhancedError.name = originalError.name
  enhancedError.stack = originalError.stack
  
  return enhancedError
}