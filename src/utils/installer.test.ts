import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// Use vi.hoisted to properly hoist mock variables
const { mockMkdir, mockWriteFile, mockReadFile, mockAccess } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockReadFile: vi.fn(),
  mockAccess: vi.fn(),
}))

// Mock fs module to match actual import pattern
vi.mock('fs', () => ({
  promises: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    access: mockAccess,
  }
}))

import { installStatusline, updateSettingsJson, checkClaudeCodeSetup } from './installer.js'
import { testPaths } from '../__tests__/setup.js'

describe('installStatusline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set default mock behaviors
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    mockReadFile.mockRejectedValue(new Error('File not found'))
    mockAccess.mockResolvedValue(undefined)
  })

  it('should create directory and write script file', async () => {
    const script = '#!/bin/bash\necho "test statusline"'
    const outputPath = testPaths.statusline
    
    await installStatusline(script, outputPath)
    
    expect(mockMkdir).toHaveBeenCalledWith(testPaths.claude, { recursive: true })
    expect(mockWriteFile).toHaveBeenCalledWith(outputPath, script, { mode: 0o755 })
    expect(mockWriteFile).toHaveBeenCalledWith(testPaths.settings, expect.any(String))
  })

  it('should update settings.json after writing script', async () => {
    const script = '#!/bin/bash\necho "test"'
    const outputPath = testPaths.statusline
    
    await installStatusline(script, outputPath)
    
    const settingsCall = mockWriteFile.mock.calls.find(call => 
      call[0] === testPaths.settings
    )
    expect(settingsCall).toBeDefined()
    expect(settingsCall![1]).toContain('"statusLine"')
    expect(settingsCall![1]).toContain('\".claude/statusline.sh\"')
  })

  it('should handle installation errors gracefully', async () => {
    mockMkdir.mockRejectedValue(new Error('Permission denied'))
    
    const script = '#!/bin/bash\necho "test"'
    const outputPath = path.join(testPaths.temp, 'invalid', 'statusline.sh')
    
    await expect(installStatusline(script, outputPath))
      .rejects.toThrow('Failed to install statusline')
  })

  it('should prevent overwriting project files in test mode', async () => {
    const originalEnv = process.env.VITEST
    process.env.VITEST = 'true'
    
    const script = '#!/bin/bash\necho "test"'
    const outputPath = '.claude/statusline.sh'
    
    await expect(installStatusline(script, outputPath))
      .rejects.toThrow('Test safety check: Refusing to overwrite project statusline')
    
    process.env.VITEST = originalEnv
  })

  it('should handle safe test paths correctly', async () => {
    const script = '#!/bin/bash\necho "test"'
    const outputPath = path.join(testPaths.temp, 'statusline.sh')
    
    await installStatusline(script, outputPath)
    
    expect(mockMkdir).toHaveBeenCalledWith(testPaths.temp, { recursive: true })
    expect(mockWriteFile).toHaveBeenCalledWith(outputPath, script, { mode: 0o755 })
  })
})

describe('updateSettingsJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    mockReadFile.mockRejectedValue(new Error('File not found'))
    mockAccess.mockResolvedValue(undefined)
  })

  it('should create new settings.json when file does not exist', async () => {
    await updateSettingsJson(testPaths.claude, 'statusline.sh')
    
    expect(mockWriteFile).toHaveBeenCalledWith(
      testPaths.settings,
      expect.stringContaining('\".claude/statusline.sh\"')
    )
    
    const writtenContent = mockWriteFile.mock.calls[0]![1] as string
    const settings = JSON.parse(writtenContent)
    expect(settings.statusLine.command).toBe('.claude/statusline.sh')
  })

  it('should update existing settings.json', async () => {
    const existingSettings = JSON.stringify({
      otherSetting: 'value',
      statusLine: {
        type: 'old',
        command: 'old-command'
      }
    })
    
    mockReadFile.mockResolvedValue(existingSettings)
    
    await updateSettingsJson(testPaths.claude, 'new-statusline.sh')
    
    const writtenContent = mockWriteFile.mock.calls[0]![1] as string
    const parsedContent = JSON.parse(writtenContent)
    
    expect(parsedContent.statusLine.command).toBe('.claude/new-statusline.sh')
    expect(parsedContent.otherSetting).toBe('value')
  })

  it('should handle invalid JSON in existing settings', async () => {
    mockReadFile.mockResolvedValue('invalid json content')
    
    await updateSettingsJson(testPaths.claude, 'statusline.sh')
    
    expect(mockWriteFile).toHaveBeenCalledWith(
      testPaths.settings,
      expect.stringContaining('\".claude/statusline.sh\"')
    )
  })

  it('should create correct statusLine configuration', async () => {
    await updateSettingsJson(testPaths.claude, 'my-statusline.sh')
    
    const writtenContent = mockWriteFile.mock.calls[0]![1] as string
    const settings = JSON.parse(writtenContent)
    
    expect(settings.statusLine).toEqual({
      type: 'command',
      command: '.claude/my-statusline.sh',
      padding: 0
    })
  })

  it('should throw error when write fails', async () => {
    mockWriteFile.mockRejectedValue(new Error('Permission denied'))
    
    await expect(updateSettingsJson(path.join(testPaths.temp, 'invalid'), 'statusline.sh'))
      .rejects.toThrow('SETTINGS_UPDATE_FAILED')
  })
})

describe('checkClaudeCodeSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccess.mockResolvedValue(undefined)
    mockReadFile.mockResolvedValue('')
  })

  it('should detect existing Claude directory and settings', async () => {
    mockAccess.mockResolvedValue(undefined)
    mockReadFile.mockResolvedValue(JSON.stringify({
      statusLine: {
        command: '.claude/existing-statusline.sh'
      }
    }))
    
    const result = await checkClaudeCodeSetup()
    
    expect(result.hasClaudeDir).toBe(true)
    expect(result.hasSettings).toBe(true)
    expect(result.currentStatusline).toBe('.claude/existing-statusline.sh')
  })

  it('should handle missing directory', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'))
    
    const result = await checkClaudeCodeSetup()
    
    expect(result.hasClaudeDir).toBe(false)
    expect(result.hasSettings).toBe(false)
    expect(result.currentStatusline).toBeUndefined()
  })

  it('should handle directory exists but no settings', async () => {
    mockAccess
      .mockResolvedValueOnce(undefined) // Directory exists
      .mockRejectedValueOnce(new Error('ENOENT')) // Settings file does not exist
    
    const result = await checkClaudeCodeSetup()
    
    expect(result.hasClaudeDir).toBe(true)
    expect(result.hasSettings).toBe(false)
    expect(result.currentStatusline).toBeUndefined()
  })

  it('should handle invalid JSON in settings', async () => {
    mockAccess.mockResolvedValue(undefined)
    mockReadFile.mockResolvedValue('invalid json')
    
    const result = await checkClaudeCodeSetup()
    
    expect(result.hasClaudeDir).toBe(true)
    expect(result.hasSettings).toBe(true)
    expect(result.currentStatusline).toBeUndefined()
  })

  it('should handle settings without statusLine configuration', async () => {
    mockAccess.mockResolvedValue(undefined)
    mockReadFile.mockResolvedValue(JSON.stringify({
      otherSetting: 'value'
    }))
    
    const result = await checkClaudeCodeSetup()
    
    expect(result.hasClaudeDir).toBe(true)
    expect(result.hasSettings).toBe(true)
    expect(result.currentStatusline).toBeUndefined()
  })

  it('should handle errors gracefully', async () => {
    mockAccess.mockImplementation(() => {
      throw new Error('Unexpected error')
    })
    
    const result = await checkClaudeCodeSetup()
    
    expect(result.hasClaudeDir).toBe(false)
    expect(result.hasSettings).toBe(false)
  })
})