import { StatuslineConfig } from '../../cli/prompts.js'

export const minimalConfig: StatuslineConfig = {
  features: ['directory', 'git'],
  runtime: 'bash',
  colors: true,
  theme: 'minimal',
  ccusageIntegration: false,
  logging: false,
  customEmojis: false,
}

export const detailedConfig: StatuslineConfig = {
  features: ['directory', 'git', 'model', 'usage', 'session', 'cache', 'context'],
  runtime: 'bash',
  colors: true,
  theme: 'detailed',
  ccusageIntegration: true,
  logging: true,
  customEmojis: false,
}

export const compactConfig: StatuslineConfig = {
  features: ['directory', 'git', 'usage'],
  runtime: 'bash',
  colors: false,
  theme: 'compact',
  ccusageIntegration: true,
  logging: false,
  customEmojis: true,
}

export const systemMonitoringConfig: StatuslineConfig = {
  features: ['directory', 'cpu', 'memory', 'load'],
  runtime: 'bash',
  colors: true,
  theme: 'detailed',
  ccusageIntegration: false,
  logging: false,
  customEmojis: false,
  systemMonitoring: {
    refreshRate: 5,
    cpuThreshold: 80,
    memoryThreshold: 85,
    loadThreshold: 2.0,
  },
}

export const allFeaturesConfig: StatuslineConfig = {
  features: [
    'directory',
    'git', 
    'model',
    'cpu',
    'memory',
    'load',
    'usage',
    'session',
    'cache',
    'context',
    'burnrate',
    'tokens',
    'projections',
    'alerts'
  ],
  runtime: 'bash',
  colors: true,
  theme: 'detailed',
  ccusageIntegration: true,
  logging: true,
  customEmojis: false,
}

export const invalidConfig = {
  features: [],
  runtime: 'invalid',
  colors: true,
  theme: 'invalid',
  ccusageIntegration: false,
  logging: false,
  customEmojis: false,
} as any as StatuslineConfig