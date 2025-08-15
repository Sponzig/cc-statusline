import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  withRetry, 
  createFileSystemRetry, 
  createEnhancedError,
  calculateDelay,
  DEFAULT_RETRY_OPTIONS,
  sleep
} from '../../utils/retry.js'

describe('sleep', () => {
  it('should resolve after specified time', async () => {
    const start = Date.now()
    await sleep(10)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(5) // Allow some tolerance
    expect(elapsed).toBeLessThan(50) // But not too much
  })
})

describe('calculateDelay', () => {
  const options = DEFAULT_RETRY_OPTIONS

  it('should calculate exponential backoff', () => {
    const delay0 = calculateDelay(0, options)
    const delay1 = calculateDelay(1, options)
    const delay2 = calculateDelay(2, options)

    expect(delay1).toBeGreaterThan(delay0)
    expect(delay2).toBeGreaterThan(delay1)
  })

  it('should respect maximum delay', () => {
    const delay = calculateDelay(10, { ...options, maxDelay: 5000 })
    expect(delay).toBeLessThanOrEqual(5000)
  })

  it('should have minimum delay of 100ms', () => {
    const delay = calculateDelay(0, { ...options, baseDelay: 50 })
    expect(delay).toBeGreaterThanOrEqual(100)
  })

  it('should include jitter', () => {
    const delays = Array.from({ length: 10 }, () => calculateDelay(1, options))
    const uniqueDelays = new Set(delays)
    
    // With jitter, we should get different values
    expect(uniqueDelays.size).toBeGreaterThan(1)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should succeed on first try', async () => {
    const operation = vi.fn().mockResolvedValue('success')
    
    const result = await withRetry(operation, { maxRetries: 2 })
    
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and eventually succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('ENOENT: file not found'))
      .mockRejectedValueOnce(new Error('EAGAIN: resource temporarily unavailable'))
      .mockResolvedValue('success')
    
    const result = await withRetry(operation, { maxRetries: 3, baseDelay: 10 })
    
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should fail after max retries', async () => {
    const error = new Error('EACCES: permission denied')
    const operation = vi.fn().mockRejectedValue(error)
    
    await expect(
      withRetry(operation, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('EACCES: permission denied')
    
    expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should not retry when retryIf returns false', async () => {
    const error = new Error('Validation error')
    const operation = vi.fn().mockRejectedValue(error)
    
    await expect(
      withRetry(operation, { 
        maxRetries: 2,
        baseDelay: 10,
        retryIf: (err) => !err.message.includes('Validation')
      })
    ).rejects.toThrow('Validation error')
    
    expect(operation).toHaveBeenCalledTimes(1) // No retries
  })

  it('should handle non-Error objects', async () => {
    const operation = vi.fn().mockRejectedValue('string error')
    
    await expect(
      withRetry(operation, { maxRetries: 1, baseDelay: 10 })
    ).rejects.toThrow('string error')
  })

  it('should respect custom retry conditions', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success')
    
    const result = await withRetry(operation, {
      maxRetries: 2,
      baseDelay: 10,
      retryIf: (err) => err.message.includes('timeout')
    })
    
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(2)
  })
})

describe('createFileSystemRetry', () => {
  it('should create retry function with file system specific conditions', () => {
    const retryFn = createFileSystemRetry()
    expect(typeof retryFn).toBe('function')
  })

  it('should retry on file system errors', async () => {
    const retryFn = createFileSystemRetry({ maxRetries: 2, baseDelay: 10 })
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('ENOENT: no such file'))
      .mockResolvedValue('success')
    
    const result = await retryFn(operation)
    
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('should not retry on non-file-system errors by default', async () => {
    const retryFn = createFileSystemRetry({ maxRetries: 2, baseDelay: 10 })
    const operation = vi.fn().mockRejectedValue(new Error('JSON parse error'))
    
    await expect(retryFn(operation)).rejects.toThrow('JSON parse error')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on various file system error codes', async () => {
    const errorCodes = ['ENOENT', 'EACCES', 'EMFILE', 'EAGAIN', 'EBUSY']
    const retryFn = createFileSystemRetry({ maxRetries: 1, baseDelay: 10 })
    
    for (const code of errorCodes) {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error(`${code}: file system error`))
        .mockResolvedValue('success')
      
      const result = await retryFn(operation)
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
      
      vi.clearAllMocks()
    }
  })
})

describe('createEnhancedError', () => {
  it('should create enhanced error with context', () => {
    const originalError = new Error('Original message')
    const context = {
      operation: 'File write',
      file: '/path/to/file.txt',
      details: { size: 1024, mode: '0o755' }
    }
    
    const enhanced = createEnhancedError(originalError, context)
    
    expect(enhanced.message).toContain('File write failed')
    expect(enhanced.message).toContain('file: /path/to/file.txt')
    expect(enhanced.message).toContain('Reason: Original message')
    expect(enhanced.message).toContain('Details: size: 1024, mode: 0o755')
    expect(enhanced.name).toBe(originalError.name)
    expect(enhanced.stack).toBe(originalError.stack)
  })

  it('should work without file context', () => {
    const originalError = new Error('Network timeout')
    const context = {
      operation: 'API call',
      details: { url: 'https://api.example.com', timeout: 5000 }
    }
    
    const enhanced = createEnhancedError(originalError, context)
    
    expect(enhanced.message).toContain('API call failed')
    expect(enhanced.message).toContain('Reason: Network timeout')
    expect(enhanced.message).toContain('Details: url: https://api.example.com, timeout: 5000')
    expect(enhanced.message).not.toContain('file:')
  })

  it('should work without details', () => {
    const originalError = new Error('Simple error')
    const context = {
      operation: 'Simple operation'
    }
    
    const enhanced = createEnhancedError(originalError, context)
    
    expect(enhanced.message).toContain('Simple operation failed')
    expect(enhanced.message).toContain('Reason: Simple error')
    expect(enhanced.message).not.toContain('Details:')
    expect(enhanced.message).not.toContain('file:')
  })

  it('should preserve original error properties', () => {
    const originalError = new TypeError('Type mismatch')
    originalError.stack = 'Original stack trace'
    
    const context = { operation: 'Type check' }
    const enhanced = createEnhancedError(originalError, context)
    
    expect(enhanced.name).toBe('TypeError')
    expect(enhanced.stack).toBe('Original stack trace')
  })
})