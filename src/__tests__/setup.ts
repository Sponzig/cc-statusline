import { vi, beforeEach } from 'vitest'

// Create mock functions with default implementations
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockReadFile = vi.fn().mockResolvedValue('')
const mockUnlink = vi.fn().mockResolvedValue(undefined)
const mockAccess = vi.fn().mockResolvedValue(undefined)
const mockStat = vi.fn().mockResolvedValue({} as any)

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