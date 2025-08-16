import { vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'

// Create mock functions with default implementations
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockReadFile = vi.fn().mockResolvedValue('')
const mockUnlink = vi.fn().mockResolvedValue(undefined)
const mockAccess = vi.fn().mockResolvedValue(undefined)
const mockStat = vi.fn().mockResolvedValue({} as any)

// Mock os module for cross-platform home directory
vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => process.platform === 'win32' ? 'C:\\Users\\testuser' : '/home/testuser'),
    platform: vi.fn(() => process.platform),
  },
}))

// Mock fs/promises for file system operations
vi.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  unlink: mockUnlink,
  access: mockAccess,
  stat: mockStat,
}))

// Mock child_process for script execution
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

// Mock inquirer for CLI prompts
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

// Mock ora for spinner
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}))

// Export mock functions for use in tests
export { mockMkdir, mockWriteFile, mockReadFile, mockUnlink, mockAccess, mockStat }

// Cross-platform path helpers for tests
export const testPaths = {
  home: process.platform === 'win32' ? 'C:\\Users\\testuser' : '/home/testuser',
  claude: path.join(process.platform === 'win32' ? 'C:\\Users\\testuser' : '/home/testuser', '.claude'),
  statusline: path.join(process.platform === 'win32' ? 'C:\\Users\\testuser' : '/home/testuser', '.claude', 'statusline.sh'),
  settings: path.join(process.platform === 'win32' ? 'C:\\Users\\testuser' : '/home/testuser', '.claude', 'settings.json'),
  temp: path.join(process.platform === 'win32' ? 'C:\\temp' : '/tmp', 'test-claude'),
}

// Cross-platform string utilities for tests
export const testUtils = {
  normalizeLineEndings: (str: string): string => str.replace(/\r\n/g, '\n'),
  normalizePaths: (str: string): string => str.replace(/\\/g, '/'),
  normalizeString: (str: string): string => {
    return testUtils.normalizeLineEndings(str).trim()
  }
}

// Reset all mocks before each test and restore default behaviors
beforeEach(() => {
  vi.clearAllMocks()
  
  // Restore default behaviors for fs mocks
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockReadFile.mockResolvedValue('')
  mockAccess.mockResolvedValue(undefined)
  mockStat.mockResolvedValue({} as any)
  mockUnlink.mockResolvedValue(undefined)
})