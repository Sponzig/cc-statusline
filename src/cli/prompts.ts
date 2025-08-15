import inquirer from 'inquirer'

/**
 * Configuration interface for statusline generation
 * 
 * This interface defines all the options available for customizing
 * the Claude Code statusline appearance and behavior.
 * 
 * @interface StatuslineConfig
 */
export interface StatuslineConfig {
  /** Array of feature identifiers to enable in the statusline */
  features: string[]
  
  /** Target runtime environment for the generated script */
  runtime: 'bash' | 'python' | 'node'
  
  /** Whether to enable colors and visual styling */
  colors: boolean
  
  /** Display theme affecting information density and formatting */
  theme: 'minimal' | 'detailed' | 'compact'
  
  /** Whether to integrate with ccusage for cost/usage tracking */
  ccusageIntegration: boolean
  
  /** Whether to enable debug logging in generated scripts */
  logging: boolean
  
  /** Whether to use custom emojis instead of text labels */
  customEmojis: boolean
  
  /** 
   * Optional system monitoring configuration
   * Only used when system monitoring features are enabled
   */
  systemMonitoring?: {
    /** How often to refresh system metrics (in milliseconds) */
    refreshRate: number
    /** CPU usage threshold for warnings (0-100) */
    cpuThreshold: number
    /** Memory usage threshold for warnings (0-100) */
    memoryThreshold: number
    /** Load average threshold for warnings */
    loadThreshold: number
  }
}

/**
 * Interactive configuration collection using Inquirer.js
 * 
 * Presents a series of prompts to gather user preferences for
 * statusline generation. Uses smart defaults based on common
 * usage patterns and provides clear descriptions for each option.
 * 
 * @returns Promise that resolves to the collected configuration
 * 
 * @example
 * ```typescript
 * const config = await collectConfiguration()
 * console.log('Selected features:', config.features)
 * ```
 */
export async function collectConfiguration(): Promise<StatuslineConfig> {
  console.log('🚀 Welcome to cc-statusline! Let\'s create your custom Claude Code statusline.\n')

  const config = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: 'What would you like to display in your statusline?',
      choices: [
        { name: '📁 Working Directory', value: 'directory', checked: true },
        { name: '🌿 Git Branch', value: 'git', checked: true },
        { name: '🤖 Model Name & Version', value: 'model', checked: true },
        { name: '💻 CPU Usage', value: 'cpu', checked: false },
        { name: '🧠 RAM Usage', value: 'memory', checked: false },
        { name: '⚡ System Load', value: 'load', checked: false },
        { name: '💵 Usage & Cost', value: 'usage', checked: true },
        { name: '⌛ Session Time Remaining', value: 'session', checked: true },
        { name: '📊 Token Statistics', value: 'tokens', checked: false },
        { name: '🔥 Burn Rate (tokens/min)', value: 'burnrate', checked: false }
      ],
      validate: (answer: string[]) => {
        if (answer.length < 1) {
          return 'You must choose at least one feature.'
        }
        return true
      }
    },
    {
      type: 'confirm',
      name: 'colors',
      message: 'Enable colors and emojis?',
      default: true
    }
  ])

  // Add system monitoring configuration if system features are selected
  const hasSystemFeatures = config.features.some((f: string) => ['cpu', 'memory', 'load'].includes(f))
  
  if (hasSystemFeatures) {
    const systemConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'refreshRate',
        message: 'System monitoring refresh rate (seconds):',
        default: '3',
        validate: (input: string) => {
          const num = parseInt(input)
          if (isNaN(num) || num < 1 || num > 60) {
            return 'Please enter a number between 1 and 60 seconds'
          }
          return true
        }
      },
      {
        type: 'input',
        name: 'cpuThreshold',
        message: 'CPU usage warning threshold (percentage):',
        default: '75',
        validate: (input: string) => {
          const num = parseInt(input)
          if (isNaN(num) || num < 10 || num > 95) {
            return 'Please enter a number between 10 and 95 percent'
          }
          return true
        }
      },
      {
        type: 'input',
        name: 'memoryThreshold',
        message: 'Memory usage warning threshold (percentage):',
        default: '80',
        validate: (input: string) => {
          const num = parseInt(input)
          if (isNaN(num) || num < 10 || num > 95) {
            return 'Please enter a number between 10 and 95 percent'
          }
          return true
        }
      },
      {
        type: 'input',
        name: 'loadThreshold',
        message: 'System load warning threshold (load average):',
        default: '2.0',
        validate: (input: string) => {
          const num = parseFloat(input)
          if (isNaN(num) || num < 0.1 || num > 10.0) {
            return 'Please enter a number between 0.1 and 10.0'
          }
          return true
        }
      }
    ])
    
    // Merge system monitoring config (convert seconds to milliseconds for refreshRate)
    config.systemMonitoring = {
      refreshRate: parseInt(systemConfig.refreshRate) * 1000, // Convert seconds to milliseconds
      cpuThreshold: parseInt(systemConfig.cpuThreshold),
      memoryThreshold: parseInt(systemConfig.memoryThreshold),
      loadThreshold: parseFloat(systemConfig.loadThreshold)
    }
  }

  // Set intelligent defaults for system monitoring if not already configured
  if (!config.systemMonitoring && hasSystemFeatures) {
    config.systemMonitoring = {
      refreshRate: 3000, // 3 seconds in milliseconds
      cpuThreshold: 75,
      memoryThreshold: 80,
      loadThreshold: 2.0
    }
  }
  
  return {
    features: config.features,
    runtime: 'bash',
    colors: config.colors,
    theme: 'detailed',
    ccusageIntegration: true, // Always enabled since npx works
    logging: false,
    customEmojis: false,
    ...config
  } as StatuslineConfig
}

export function displayConfigSummary(config: StatuslineConfig): void {
  console.log('\n✅ Configuration Summary:')
  console.log(`   Runtime: ${config.runtime}`)
  console.log(`   Theme: ${config.theme}`)
  console.log(`   Colors: ${config.colors ? '✅' : '❌'}`)
  console.log(`   Features: ${config.features.join(', ')}`)
  
  if (config.ccusageIntegration) {
    console.log('   📊 ccusage integration enabled')
  }
  
  if (config.logging) {
    console.log('   📝 Debug logging enabled')
  }
  
  if (config.systemMonitoring) {
    console.log(`   💻 System monitoring enabled (${config.systemMonitoring.refreshRate}s refresh)`)
    console.log(`      CPU threshold: ${config.systemMonitoring.cpuThreshold}%, Memory: ${config.systemMonitoring.memoryThreshold}%, Load: ${config.systemMonitoring.loadThreshold}`)
  }
  
  console.log('')
}