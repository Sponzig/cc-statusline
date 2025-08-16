import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateBashStatusline } from './bash-generator.js'
import { 
  minimalConfig, 
  detailedConfig,
  allFeaturesConfig 
} from '../__tests__/fixtures/mock-configs.js'

// Mock the cache manager to avoid file system operations in tests
vi.mock('../utils/cache-manager.js', () => ({
  cacheManager: {
    generateCacheKey: vi.fn(() => 'test-cache-key'),
    getFromMemory: vi.fn(() => null),
    setInMemory: vi.fn(),
    updateMetrics: vi.fn(),
    generateCacheInitCode: vi.fn(() => '# cache init code'),
    generateProcessCacheCode: vi.fn(() => '# process cache code'),
    generateFileCacheCode: vi.fn(() => '# file cache code'),
  },
  generateFeatureHash: vi.fn(() => 'test-hash'),
  generateContextHash: vi.fn(() => 'test-context-hash'),
}))

// Mock the template cache to force using the main generator
vi.mock('./template-cache.js', () => ({
  generateOptimizedBashStatusline: vi.fn(() => null),
}))

describe('Content Tracking and Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rate Limiting', () => {
    it('should include rate limiting code in generated script', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('# ---- rate limiting to prevent spam ----')
      expect(result).toContain('rate_limit_file=')
      expect(result).toContain('current_time=')
      expect(result).toContain('min_interval=')
      expect(result).toContain('time_diff=')
      expect(result).toContain('exit 0')
    })

    it('should include rate limit file path', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('${HOME}/.claude/statusline_rate_limit.tmp')
    })

    it('should update rate limit timestamp', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('echo "$current_time" > "$rate_limit_file"')
    })

    it('should check for existing rate limit file', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('if [[ -f "$rate_limit_file" ]]')
      expect(result).toContain('last_time=$(cat "$rate_limit_file"')
    })

    it('should exit early if called too frequently', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('if (( time_diff < min_interval ))')
      expect(result).toContain('# Too frequent, exit silently')
      expect(result).toContain('exit 0')
    })
  })

  describe('Content Tracking', () => {
    it('should include content tracking initialization', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('# ---- content tracking to prevent empty newlines ----')
      expect(result).toContain('content_displayed=0')
    })

    it('should set content_displayed=1 for directory display', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('printf \'📁 %s%s%s\'')
      expect(result).toContain('content_displayed=1')
    })

    it('should set content_displayed=1 for model display when model feature is enabled', () => {
      const configWithModel = { ...minimalConfig, features: ['directory', 'git', 'model'] }
      const result = generateBashStatusline(configWithModel)
      
      expect(result).toContain('printf \'  🤖 %s%s%s\'')
      expect(result).toContain('content_displayed=1')
    })

    it('should set content_displayed=1 for git display when git is enabled', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('if [[ $git_branch ]]')
      expect(result).toContain('printf \'  🌿 %s%s%s\'')
      expect(result).toContain('content_displayed=1')
    })

    it('should set content_displayed=1 for usage features when enabled', () => {
      const result = generateBashStatusline(detailedConfig)
      
      // Should contain content_displayed=1 for various features
      expect(result).toContain('content_displayed=1')
      
      // Should have multiple instances of content_displayed=1 
      const matches = result.match(/content_displayed=1/g)
      expect(matches).toBeDefined()
      expect(matches!.length).toBeGreaterThan(2) // Multiple features should set this flag
    })

    it('should include conditional newline based on content_displayed', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('# conditional newline (only if content was displayed)')
      expect(result).toContain('if [[ $content_displayed -eq 1 ]]')
      expect(result).toContain('printf \'\\n\'')
      expect(result).toContain('fi')
    })

    it('should not include unconditional newlines in compact mode', () => {
      const compactConfig = { ...allFeaturesConfig, theme: 'compact' as const }
      const result = generateBashStatusline(compactConfig)
      
      // Should have the conditional newline
      expect(result).toContain('if [[ $content_displayed -eq 1 ]]')
      expect(result).toContain('printf \'\\n\'')
      
      // Should not have standalone newline prints outside of conditionals
      // Check that all printf '\n' are inside the conditional block
      const newlinePrintfMatches = result.match(/printf\s+'\\n'/g)
      expect(newlinePrintfMatches).toHaveLength(1) // Only one printf '\n' should exist
    })
  })

  describe('Integration Tests', () => {
    it('should include both rate limiting and content tracking', () => {
      const result = generateBashStatusline(allFeaturesConfig)
      
      // Should have rate limiting
      expect(result).toContain('# ---- rate limiting to prevent spam ----')
      expect(result).toContain('rate_limit_file=')
      
      // Should have content tracking
      expect(result).toContain('# ---- content tracking to prevent empty newlines ----')
      expect(result).toContain('content_displayed=0')
      
      // Should have conditional newline
      expect(result).toContain('if [[ $content_displayed -eq 1 ]]')
    })

    it('should ensure rate limiting comes before content tracking', () => {
      const result = generateBashStatusline(minimalConfig)
      
      const rateLimitingIndex = result.indexOf('# ---- rate limiting to prevent spam ----')
      const contentTrackingIndex = result.indexOf('# ---- content tracking to prevent empty newlines ----')
      
      expect(rateLimitingIndex).toBeGreaterThan(-1)
      expect(contentTrackingIndex).toBeGreaterThan(-1)
      expect(rateLimitingIndex).toBeLessThan(contentTrackingIndex)
    })

    it('should ensure content tracking initialization comes before display code', () => {
      const result = generateBashStatusline(minimalConfig)
      
      const contentTrackingIndex = result.indexOf('content_displayed=0')
      const displayIndex = result.indexOf('# ---- render statusline ----')
      
      expect(contentTrackingIndex).toBeGreaterThan(-1)
      expect(displayIndex).toBeGreaterThan(-1)
      expect(contentTrackingIndex).toBeLessThan(displayIndex)
    })

    it('should set content_displayed for all enabled features', () => {
      const result = generateBashStatusline(allFeaturesConfig)
      
      // Count occurrences of content_displayed=1
      const matches = result.match(/content_displayed=1/g)
      expect(matches).toBeDefined()
      expect(matches!.length).toBeGreaterThan(5) // Should have multiple features setting this flag
    })

    it('should handle empty config gracefully', () => {
      const emptyConfig = { 
        ...minimalConfig, 
        features: [] as any[]
      }
      const result = generateBashStatusline(emptyConfig)
      
      // Should still include the infrastructure
      expect(result).toContain('content_displayed=0')
      expect(result).toContain('rate_limit_file=')
      // Note: conditional newline should always be present since it's in the main display section
      expect(result).toContain('if [[ $content_displayed -eq 1 ]]')
    })
  })

  describe('Configuration Validation', () => {
    it('should include rate limiting for minimal configuration', () => {
      const result = generateBashStatusline(minimalConfig)
      
      expect(result).toContain('min_interval=0')
      expect(result).toContain('# Minimum 100ms between executions (0 seconds for now, could be tuned)')
    })

    it('should include rate limiting for detailed configuration', () => {
      const result = generateBashStatusline(detailedConfig)
      
      expect(result).toContain('min_interval=0')
      expect(result).toContain('statusline_rate_limit.tmp')
    })

    it('should include rate limiting for all features configuration', () => {
      const result = generateBashStatusline(allFeaturesConfig)
      
      expect(result).toContain('min_interval=0')
      expect(result).toContain('time_diff=')
    })
  })

  describe('Script Structure Validation', () => {
    it('should maintain proper script structure with new features', () => {
      const result = generateBashStatusline(allFeaturesConfig)
      
      // Should still have proper bash structure
      expect(result).toContain('#!/bin/bash')
      expect(result).toContain('input=$(cat)')
      
      // Rate limiting should come early
      expect(result.indexOf('rate_limit_file=')).toBeGreaterThan(result.indexOf('input=$(cat)'))
      
      // Content tracking should come after rate limiting but before display
      const rateLimitIndex = result.indexOf('rate_limit_file=')
      const contentTrackIndex = result.indexOf('content_displayed=0')
      const displayIndex = result.indexOf('# ---- render statusline ----')
      
      expect(rateLimitIndex).toBeLessThan(contentTrackIndex)
      expect(contentTrackIndex).toBeLessThan(displayIndex)
    })

    it('should not break existing functionality', () => {
      const result = generateBashStatusline(detailedConfig)
      
      // Should still include all expected features
      expect(result).toContain('# ---- git ----')
      expect(result).toContain('# ---- ccusage integration ----')
      expect(result).toContain('# ---- render statusline ----')
      
      // Should still include emojis and colors
      expect(result).toContain('🌿')
      expect(result).toContain('📁')
      expect(result).toContain('🤖')
      
      // Should still include proper bash syntax
      expect(result).toMatch(/if.*then/s)
      expect(result).toContain('fi')
    })
  })
})