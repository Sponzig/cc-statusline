import { describe, it, expect } from 'vitest'
import { validateConfig, validateDependencies } from '../../utils/validator.js'
import type { StatuslineConfig } from '../../cli/prompts.js'

describe('validateConfig', () => {
  const baseConfig: StatuslineConfig = {
    features: ['directory', 'git'],
    runtime: 'bash',
    theme: 'minimal',
    colors: true,
    ccusageIntegration: false,
    logging: false,
    customEmojis: false
  }

  describe('valid configurations', () => {
    it('should validate a minimal valid config', () => {
      const result = validateConfig(baseConfig)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate config with all supported runtimes', () => {
      const runtimes: Array<'bash' | 'python' | 'node'> = ['bash', 'python', 'node']
      
      runtimes.forEach(runtime => {
        const config = { ...baseConfig, runtime }
        const result = validateConfig(config)
        expect(result.isValid).toBe(true)
      })
    })

    it('should validate config with all supported themes', () => {
      const themes: Array<'minimal' | 'detailed' | 'compact'> = ['minimal', 'detailed', 'compact']
      
      themes.forEach(theme => {
        const config = { ...baseConfig, theme }
        const result = validateConfig(config)
        expect(result.isValid).toBe(true)
      })
    })
  })

  describe('invalid configurations', () => {
    it('should reject config with no features', () => {
      const config = { ...baseConfig, features: [] }
      const result = validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('At least one display feature must be selected')
    })

    it('should reject config with invalid runtime', () => {
      const config = { ...baseConfig, runtime: 'invalid' as any }
      const result = validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid runtime') && e.includes('invalid'))).toBe(true)
    })

    it('should reject config with invalid theme', () => {
      const config = { ...baseConfig, theme: 'invalid' as any }
      const result = validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid theme') && e.includes('invalid'))).toBe(true)
    })
  })

  describe('warnings', () => {
    it('should warn about usage features without ccusage integration', () => {
      const config = { 
        ...baseConfig, 
        features: ['usage', 'session', 'tokens'], 
        ccusageIntegration: false 
      }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('ccusage integration is disabled'))).toBe(true)
    })

    it('should warn about performance with many features', () => {
      const config = { 
        ...baseConfig, 
        features: ['directory', 'git', 'model', 'cpu', 'memory', 'load', 'usage'] 
      }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('features selected'))).toBe(true)
    })

    it('should warn about emojis without colors', () => {
      const config = { 
        ...baseConfig, 
        customEmojis: true, 
        colors: false 
      }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('Custom emojis enabled but colors disabled'))).toBe(true)
    })

    it('should not warn about usage features with ccusage integration enabled', () => {
      const config = { 
        ...baseConfig, 
        features: ['usage', 'session'], 
        ccusageIntegration: true 
      }
      const result = validateConfig(config)
      expect(result.warnings).not.toContain(
        'Usage features selected but ccusage integration is disabled. Some features may not work properly.'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle config with single feature', () => {
      const config = { ...baseConfig, features: ['directory'] }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should handle config with exactly 5 features (performance threshold)', () => {
      const config = { 
        ...baseConfig, 
        features: ['directory', 'git', 'model', 'usage', 'session'] 
      }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.warnings).not.toContain(
        'Many features selected. This may impact statusline performance.'
      )
    })

    it('should handle config with exactly 6 features (over performance threshold)', () => {
      const config = { 
        ...baseConfig, 
        features: ['directory', 'git', 'model', 'usage', 'session', 'tokens'] 
      }
      const result = validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('features selected'))).toBe(true)
    })
  })
})

describe('validateDependencies', () => {
  it('should return dependency availability status', () => {
    const result = validateDependencies()
    
    expect(result).toHaveProperty('jq')
    expect(result).toHaveProperty('git')
    expect(result).toHaveProperty('ccusage')
    expect(result).toHaveProperty('python')
    expect(result).toHaveProperty('node')
    
    expect(typeof result.jq).toBe('boolean')
    expect(typeof result.git).toBe('boolean')
    expect(typeof result.ccusage).toBe('boolean')
    expect(typeof result.python).toBe('boolean')
    expect(typeof result.node).toBe('boolean')
  })

  it('should have consistent return structure', () => {
    const result1 = validateDependencies()
    const result2 = validateDependencies()
    
    expect(Object.keys(result1)).toEqual(Object.keys(result2))
  })
})

