export const mockClaudeInput = {
  workspace: {
    current_dir: '/Users/test/projects/my-app',
  },
  model: {
    display_name: 'Claude 3.5 Sonnet',
    version: '20241022',
  },
  costUSD: 2.48,
  burnRate: {
    costPerHour: 12.50,
    tokensPerMinute: 45,
    tokensPerMinuteForIndicator: 42,
  },
  totalTokens: 15420,
  startTime: '2024-01-01T10:00:00Z',
  usageLimitResetTime: '2024-01-01T18:00:00Z',
  tokenCounts: {
    inputTokens: 12000,
    outputTokens: 3420,
    cacheCreationInputTokens: 2000,
    cacheReadInputTokens: 8000,
  },
  projection: {
    totalTokens: 25000,
    totalCost: 4.20,
    remainingMinutes: 180,
  },
  entries: 15,
  models: ['claude-3-5-sonnet-20241022'],
}

export const mockClaudeInputMinimal = {
  workspace: {
    current_dir: '/home/user/code',
  },
  model: {
    display_name: 'Claude',
  },
}

export const mockClaudeInputWithGit = {
  ...mockClaudeInput,
  workspace: {
    current_dir: '/Users/test/projects/git-project',
  },
}