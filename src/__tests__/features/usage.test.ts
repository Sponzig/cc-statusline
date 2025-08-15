import { describe, it, expect } from 'vitest'
import { generateUsageDisplayCode, generateUsageUtilities } from '../../features/usage.js'
import type { UsageFeature } from '../../features/usage.js'

describe('generateUsageDisplayCode', () => {
  const baseConfig: UsageFeature = {
    enabled: true,
    showCost: false,
    showTokens: false,
    showBurnRate: false,
    showSession: false,
    showProgressBar: false
  }

  describe('basic functionality', () => {
    it('should return empty string when disabled', () => {
      const config = { ...baseConfig, enabled: false }
      const result = generateUsageDisplayCode(config, true)
      expect(result).toBe('')
    })

    it('should generate session display code', () => {
      const config = { ...baseConfig, showSession: true }
      const result = generateUsageDisplayCode(config, true)
      expect(result).toContain('session time')
      expect(result).toContain('⌛')
      expect(result).toContain('sess_txt')
    })

    it('should generate session display with progress bar', () => {
      const config = { ...baseConfig, showSession: true, showProgressBar: true }
      const result = generateUsageDisplayCode(config, true)
      expect(result).toContain('session time')
      expect(result).toContain('sess_bar')
    })

    it('should generate cost display code', () => {
      const config = { ...baseConfig, showCost: true }
      const result = generateUsageDisplayCode(config, true)
      expect(result).toContain('# cost')
      expect(result).toContain('💵')
      expect(result).toContain('cost_usd')
      expect(result).toContain('cost_ph')
    })

    it('should generate tokens display code', () => {
      const config = { ...baseConfig, showTokens: true }
      const result = generateUsageDisplayCode(config, true)
      expect(result).toContain('# tokens')
      expect(result).toContain('📊')
      expect(result).toContain('tot_tokens')
    })

    it('should generate tokens display with burn rate', () => {
      const config = { ...baseConfig, showTokens: true, showBurnRate: true }
      const result = generateUsageDisplayCode(config, true)
      expect(result).toContain('# tokens')
      expect(result).toContain('tpm')
      expect(result).toContain('true') // showBurnRate condition
    })
  })

  describe('emoji handling', () => {
    it('should use emojis when enabled', () => {
      const config = { 
        ...baseConfig, 
        showSession: true, 
        showCost: true, 
        showTokens: true 
      }
      const result = generateUsageDisplayCode(config, true)
      expect(result).toContain('⌛') // session emoji
      expect(result).toContain('💵') // cost emoji
      expect(result).toContain('📊') // token emoji
    })

    it('should use text labels when emojis disabled', () => {
      const config = { 
        ...baseConfig, 
        showSession: true, 
        showCost: true, 
        showTokens: true 
      }
      const result = generateUsageDisplayCode(config, false)
      expect(result).toContain('session:')
      expect(result).toContain('$') // cost symbol
      expect(result).toContain('tok:')
    })
  })

  describe('combined features', () => {
    it('should generate code for all features when enabled', () => {
      const config: UsageFeature = {
        enabled: true,
        showCost: true,
        showTokens: true,
        showBurnRate: true,
        showSession: true,
        showProgressBar: true
      }
      const result = generateUsageDisplayCode(config, true)
      
      expect(result).toContain('session time')
      expect(result).toContain('# cost')
      expect(result).toContain('# tokens')
      expect(result).toContain('sess_bar')
      expect(result).toContain('tpm')
    })

    it('should not include features that are disabled', () => {
      const config = { 
        ...baseConfig, 
        showSession: true, 
        showCost: false, 
        showTokens: false 
      }
      const result = generateUsageDisplayCode(config, true)
      
      expect(result).toContain('session time')
      expect(result).not.toContain('# cost')
      expect(result).not.toContain('# tokens')
    })
  })

  describe('bash code structure', () => {
    it('should generate valid bash conditional statements', () => {
      const config = { ...baseConfig, showCost: true }
      const result = generateUsageDisplayCode(config, true)
      
      expect(result).toContain('if [[ $cost_usd')
      expect(result).toContain('fi')
      expect(result).toMatch(/printf.*cost_clr/)
    })

    it('should include proper variable validation patterns', () => {
      const config = { ...baseConfig, showCost: true, showTokens: true }
      const result = generateUsageDisplayCode(config, true)
      
      // Cost validation
      expect(result).toContain('$cost_usd =~ ^[0-9.]+$')
      expect(result).toContain('$cost_ph =~ ^[0-9.]+$')
      
      // Token validation  
      expect(result).toContain('$tot_tokens =~ ^[0-9]+$')
      expect(result).toContain('$tpm =~ ^[0-9.]+$')
    })

    it('should include color function calls', () => {
      const config = { ...baseConfig, showSession: true, showCost: true }
      const result = generateUsageDisplayCode(config, true)
      
      expect(result).toContain('$(sess_clr)')
      expect(result).toContain('$(cost_clr)')
      expect(result).toContain('$(rst)')
    })
  })
})

describe('generateUsageUtilities', () => {
  it('should generate time helper functions', () => {
    const result = generateUsageUtilities()
    
    expect(result).toContain('to_epoch()')
    expect(result).toContain('fmt_time_hm()')
    expect(result).toContain('progress_bar()')
  })

  it('should include cross-platform date handling', () => {
    const result = generateUsageUtilities()
    
    expect(result).toContain('gdate') // macOS
    expect(result).toContain('date -u -j') // BSD date
    expect(result).toContain('python3') // fallback
  })

  it('should include progress bar logic', () => {
    const result = generateUsageUtilities()
    
    expect(result).toContain('progress_bar()')
    expect(result).toContain('filled=$(( p * w / 100 ))')
    expect(result).toContain("tr ' ' '='")
    expect(result).toContain("tr ' ' '-'")
  })

  it('should include proper parameter validation', () => {
    const result = generateUsageUtilities()
    
    expect(result).toContain('((p<0))&&p=0')
    expect(result).toContain('((p>100))&&p=100')
  })

  it('should generate optimized bash code', () => {
    const result = generateUsageUtilities()
    
    // Should not contain excessive whitespace or unoptimized patterns
    expect(result.trim()).not.toBe('')
    expect(result).not.toContain('  \n') // no trailing spaces before newlines
  })
})