import { StatuslineConfig } from '../cli/prompts.js'

/**
 * Result structure for configuration validation
 * 
 * @interface ValidationResult
 */
export interface ValidationResult {
  /** Whether the configuration passes all validation checks */
  isValid: boolean
  /** Array of validation errors that prevent execution */
  errors: string[]
  /** Array of validation warnings that may affect functionality */
  warnings: string[]
}

/**
 * Comprehensive configuration validation with smart warnings
 * 
 * Validates a statusline configuration against business rules and
 * provides actionable feedback. Performs both structural validation
 * (required fields, valid values) and semantic validation (feature
 * compatibility, performance warnings).
 * 
 * @param config - The configuration to validate
 * @returns Validation result with errors and warnings
 * 
 * @example
 * ```typescript
 * const validation = validateConfig(config)
 * if (!validation.isValid) {
 *   console.error('Validation failed:', validation.errors)
 *   return
 * }
 * 
 * if (validation.warnings.length > 0) {
 *   console.warn('Warnings:', validation.warnings)
 * }
 * ```
 */
export function validateConfig(config: StatuslineConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Enhanced type validation
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be a valid object')
    return { isValid: false, errors, warnings }
  }

  // Validate features array
  if (!Array.isArray(config.features)) {
    errors.push('Features must be an array')
  } else if (config.features.length === 0) {
    errors.push('At least one display feature must be selected')
  } else {
    // Validate individual feature names
    const validFeatures = ['directory', 'git', 'model', 'cpu', 'memory', 'load', 'usage', 'session', 'tokens', 'burnrate']
    const invalidFeatures = config.features.filter(f => !validFeatures.includes(f))
    if (invalidFeatures.length > 0) {
      errors.push(`Invalid features: ${invalidFeatures.join(', ')}. Valid options: ${validFeatures.join(', ')}`)
    }
  }

  // Enhanced runtime validation
  const validRuntimes = ['bash', 'python', 'node'] as const
  if (!validRuntimes.includes(config.runtime as any)) {
    errors.push(`Invalid runtime: "${config.runtime}". Must be one of: ${validRuntimes.join(', ')}`)
  }

  // Enhanced theme validation
  const validThemes = ['minimal', 'detailed', 'compact'] as const
  if (!validThemes.includes(config.theme as any)) {
    errors.push(`Invalid theme: "${config.theme}". Must be one of: ${validThemes.join(', ')}`)
  }

  // Validate boolean fields with detailed messages
  const booleanFields = ['colors', 'ccusageIntegration', 'logging', 'customEmojis'] as const
  booleanFields.forEach(field => {
    if (config[field] !== undefined && typeof config[field] !== 'boolean') {
      errors.push(`Field "${field}" must be a boolean (true/false), got: ${typeof config[field]}`)
    }
  })

  // Enhanced system monitoring validation
  if (config.systemMonitoring !== undefined) {
    if (typeof config.systemMonitoring !== 'object' || config.systemMonitoring === null) {
      errors.push('systemMonitoring must be an object')
    } else {
      const { refreshRate, cpuThreshold, memoryThreshold, loadThreshold } = config.systemMonitoring
      
      if (typeof refreshRate !== 'number' || refreshRate < 100 || refreshRate > 60000) {
        errors.push('systemMonitoring.refreshRate must be a number between 100 and 60000 milliseconds')
      }
      
      if (typeof cpuThreshold !== 'number' || cpuThreshold < 0 || cpuThreshold > 100) {
        errors.push('systemMonitoring.cpuThreshold must be a number between 0 and 100')
      }
      
      if (typeof memoryThreshold !== 'number' || memoryThreshold < 0 || memoryThreshold > 100) {
        errors.push('systemMonitoring.memoryThreshold must be a number between 0 and 100')
      }
      
      if (typeof loadThreshold !== 'number' || loadThreshold < 0 || loadThreshold > 50) {
        errors.push('systemMonitoring.loadThreshold must be a number between 0 and 50')
      }
    }
  }

  // Enhanced feature compatibility warnings
  const usageFeatures = ['usage', 'session', 'tokens', 'burnrate']
  const systemFeatures = ['cpu', 'memory', 'load']
  const hasUsageFeatures = config.features?.some(f => usageFeatures.includes(f)) ?? false
  const hasSystemFeatures = config.features?.some(f => systemFeatures.includes(f)) ?? false
  
  if (hasUsageFeatures && !config.ccusageIntegration) {
    warnings.push('Usage features (usage/session/tokens/burnrate) selected but ccusage integration is disabled. Install ccusage with: npm install -g ccusage')
  }

  if (hasSystemFeatures && !config.systemMonitoring) {
    warnings.push('System monitoring features (cpu/memory/load) selected but systemMonitoring configuration is missing. These features may not display correctly.')
  }

  // Enhanced performance warnings
  const featureCount = config.features?.length ?? 0
  if (featureCount > 7) {
    warnings.push(`${featureCount} features selected. Consider reducing to 5-7 features for optimal performance.`)
  } else if (featureCount > 5) {
    warnings.push(`${featureCount} features selected. This may slightly impact statusline performance.`)
  }

  // Enhanced visual consistency warnings
  if (config.customEmojis && !config.colors) {
    warnings.push('Custom emojis enabled but colors disabled. Consider enabling colors for better visual distinction.')
  }

  if (config.theme === 'compact' && featureCount > 6) {
    warnings.push('Compact theme with many features may result in cramped display. Consider using "detailed" theme instead.')
  }

  // Runtime-specific warnings
  if (config.runtime !== 'bash') {
    warnings.push(`Runtime "${config.runtime}" selected. Note that bash is the most tested and recommended runtime.`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Format validation result for user-friendly display
 * 
 * Takes a validation result and formats it into readable messages
 * with helpful suggestions and color coding for terminal display.
 * 
 * @param result - Validation result to format
 * @returns Formatted validation messages
 */
export function formatValidationResult(result: ValidationResult): {
  summary: string
  details: string[]
  suggestions: string[]
} {
  const details: string[] = []
  const suggestions: string[] = []
  
  // Format errors with clear action items
  result.errors.forEach((error, index) => {
    details.push(`❌ Error ${index + 1}: ${error}`)
    
    // Add specific suggestions based on error type
    if (error.includes('Invalid features')) {
      suggestions.push('💡 Run the configuration wizard again to select valid features')
    } else if (error.includes('Invalid runtime')) {
      suggestions.push('💡 Choose "bash" for maximum compatibility')
    } else if (error.includes('Invalid theme')) {
      suggestions.push('💡 Valid themes: minimal (simple), detailed (full info), compact (space-saving)')
    } else if (error.includes('systemMonitoring')) {
      suggestions.push('💡 System monitoring thresholds should be reasonable values (CPU/Memory: 0-100, Load: 0-50)')
    }
  })
  
  // Format warnings with context
  result.warnings.forEach((warning, index) => {
    details.push(`⚠️  Warning ${index + 1}: ${warning}`)
    
    if (warning.includes('ccusage')) {
      suggestions.push('💡 Install ccusage for usage tracking: npm install -g ccusage')
    } else if (warning.includes('performance')) {
      suggestions.push('💡 Consider reducing features or using compact theme for better performance')
    } else if (warning.includes('colors')) {
      suggestions.push('💡 Enable colors for better visual experience')
    }
  })
  
  const summary = result.isValid 
    ? '✅ Configuration is valid'
    : `❌ Configuration has ${result.errors.length} error(s) and ${result.warnings.length} warning(s)`
  
  return { summary, details, suggestions }
}

/**
 * System dependency validation for statusline features
 * 
 * Checks availability of external tools required by various statusline
 * features. This helps users understand which features will work in
 * their environment and provides early feedback about missing dependencies.
 * 
 * Note: Currently returns placeholder values. In a full implementation,
 * this would use child_process.exec to actually check for command availability.
 * 
 * @returns Object mapping dependency names to availability status
 * 
 * @example
 * ```typescript
 * const deps = validateDependencies()
 * if (!deps.jq) {
 *   console.warn('jq not found - JSON parsing will use fallback methods')
 * }
 * ```
 */
export function validateDependencies(): {
  jq: boolean
  git: boolean
  ccusage: boolean
  python?: boolean
  node?: boolean
} {
  // This would check system dependencies
  // For now, return placeholder
  return {
    jq: true,  // Would check: command -v jq >/dev/null 2>&1
    git: true, // Would check: command -v git >/dev/null 2>&1
    ccusage: false, // Would check: command -v ccusage >/dev/null 2>&1
    python: true,   // Would check: command -v python3 >/dev/null 2>&1
    node: true      // Would check: command -v node >/dev/null 2>&1
  }
}