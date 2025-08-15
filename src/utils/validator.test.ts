import { describe, it, expect } from 'vitest'
import { validateConfig, validateDependencies } from './validator.js'
import { 
  minimalConfig, 
  detailedConfig, 
  compactConfig, 
  allFeaturesConfig, 
  invalidConfig 
} from '../__tests__/fixtures/mock-configs.js'

describe('validateConfig', () => {
  it('should validate minimal valid configuration', () => {
    const result = validateConfig(minimalConfig)
    
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate detailed configuration', () => {
    const result = validateConfig(detailedConfig)
    
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate compact configuration', () => {
    const result = validateConfig(compactConfig)
    
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate configuration with all features', () => {
    const result = validateConfig(allFeaturesConfig)
    
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toContain('Many features selected. This may impact statusline performance.')
  })

  it('should reject configuration with no features', () => {
    const config = { ...minimalConfig, features: [] }
    const result = validateConfig(config)
    
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('At least one display feature must be selected')
  })

  it('should reject invalid runtime', () => {
    const result = validateConfig(invalidConfig)
    
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Invalid runtime: invalid')
  })

  it('should reject invalid theme', () => {
    const result = validateConfig(invalidConfig)
    
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Invalid theme: invalid')
  })

  it('should warn about usage features without ccusage integration', () => {
    const config = { 
      ...minimalConfig, 
      features: ['directory', 'usage', 'session'],
      ccusageIntegration: false 
    }
    const result = validateConfig(config)
    
    expect(result.isValid).toBe(true)
    expect(result.warnings).toContain('Usage features selected but ccusage integration is disabled. Some features may not work properly.')
  })

  it('should warn about custom emojis without colors', () => {
    const config = { 
      ...minimalConfig, 
      colors: false,
      customEmojis: true 
    }
    const result = validateConfig(config)
    
    expect(result.isValid).toBe(true)
    expect(result.warnings).toContain('Custom emojis enabled but colors disabled. Visual distinction may be limited.')
  })

  it('should handle multiple validation errors', () => {
    const multiErrorConfig = {
      features: [],
      runtime: 'invalid',
      colors: true,
      theme: 'invalid',
      ccusageIntegration: false,
      logging: false,
      customEmojis: false,
    } as any
    
    const result = validateConfig(multiErrorConfig)
    
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(3)
    expect(result.errors).toContain('At least one display feature must be selected')
    expect(result.errors).toContain('Invalid runtime: invalid')
    expect(result.errors).toContain('Invalid theme: invalid')
  })

  it('should validate runtime values', () => {
    const validRuntimes = ['bash', 'python', 'node']
    
    for (const runtime of validRuntimes) {
      const config = { ...minimalConfig, runtime: runtime as any }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
    }
  })

  it('should validate theme values', () => {
    const validThemes = ['minimal', 'detailed', 'compact']
    
    for (const theme of validThemes) {
      const config = { ...minimalConfig, theme: theme as any }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
    }
  })
})

describe('validateDependencies', () => {
  it('should return dependency status', () => {
    const deps = validateDependencies()
    
    expect(deps).toHaveProperty('jq')
    expect(deps).toHaveProperty('git')
    expect(deps).toHaveProperty('ccusage')
    expect(deps).toHaveProperty('python')
    expect(deps).toHaveProperty('node')
    
    expect(typeof deps.jq).toBe('boolean')
    expect(typeof deps.git).toBe('boolean')
    expect(typeof deps.ccusage).toBe('boolean')
  })

  it('should have placeholder implementation', () => {
    const deps = validateDependencies()
    
    // Current implementation returns hardcoded values
    expect(deps.jq).toBe(true)
    expect(deps.git).toBe(true)
    expect(deps.ccusage).toBe(false)
    expect(deps.python).toBe(true)
    expect(deps.node).toBe(true)
  })
})