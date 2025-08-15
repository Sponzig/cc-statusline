import { StatuslineConfig } from '../cli/prompts.js'
import { promises as fs } from 'fs'
import path from 'path'
import { createFileSystemRetry, createEnhancedError } from './retry.js'

export async function installStatusline(
  script: string,
  outputPath: string,
  config: StatuslineConfig
): Promise<void> {
  const fileRetry = createFileSystemRetry()
  
  try {
    // Ensure the directory exists with retry
    const dir = path.dirname(outputPath)
    await fileRetry(() => fs.mkdir(dir, { recursive: true }))

    // Write the script with retry
    await fileRetry(() => fs.writeFile(outputPath, script, { mode: 0o755 }))

    // Update .claude/settings.json if it exists
    await updateSettingsJson(dir, path.basename(outputPath))

    // Note: statusline-config.json removed per user feedback - not needed
    // The statusline script contains all necessary configuration info

  } catch (error) {
    const enhancedError = createEnhancedError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'Install statusline',
        file: outputPath,
        details: {
          scriptLength: script.length,
          configFeatures: config.features.join(', '),
          outputPath
        }
      }
    )
    throw enhancedError
  }
}

export async function updateSettingsJson(claudeDir: string, scriptName: string): Promise<void> {
  const settingsPath = path.join(claudeDir, 'settings.json')
  const fileRetry = createFileSystemRetry({ maxRetries: 2 })
  
  try {
    let settings: any = {}
    
    // Try to read existing settings with retry
    try {
      const settingsContent = await fileRetry(() => fs.readFile(settingsPath, 'utf-8'))
      settings = JSON.parse(settingsContent)
    } catch (error) {
      // File doesn't exist or invalid JSON, start fresh
      if (error instanceof Error && !error.message.includes('ENOENT')) {
        console.warn(`Warning: Could not read existing settings.json: ${error.message}`)
      }
    }

    // Update statusLine configuration
    settings.statusLine = {
      type: 'command',
      command: `.claude/${scriptName}`,
      padding: 0
    }

    // Write updated settings with retry
    await fileRetry(() => fs.writeFile(settingsPath, JSON.stringify(settings, null, 2)))
    
  } catch (error) {
    const enhancedError = createEnhancedError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'Update settings.json',
        file: settingsPath,
        details: {
          claudeDir,
          scriptName,
          settingsPath
        }
      }
    )
    
    // Settings update failed, but don't fail the entire installation
    console.warn(`Warning: ${enhancedError.message}`)
    throw new Error('SETTINGS_UPDATE_FAILED') // Signal that manual config is needed
  }
}

export async function checkClaudeCodeSetup(): Promise<{
  hasClaudeDir: boolean
  hasSettings: boolean
  currentStatusline?: string
}> {
  const claudeDir = './.claude'
  const settingsPath = path.join(claudeDir, 'settings.json')
  
  try {
    const dirExists = await fs.access(claudeDir).then(() => true).catch(() => false)
    const settingsExists = await fs.access(settingsPath).then(() => true).catch(() => false)
    
    let currentStatusline: string | undefined
    
    if (settingsExists) {
      try {
        const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
        currentStatusline = settings.statusLine?.command
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    const result: {
      hasClaudeDir: boolean
      hasSettings: boolean
      currentStatusline?: string
    } = {
      hasClaudeDir: dirExists,
      hasSettings: settingsExists
    }
    
    if (currentStatusline !== undefined) {
      result.currentStatusline = currentStatusline
    }
    
    return result
  } catch {
    return {
      hasClaudeDir: false,
      hasSettings: false
    }
  }
}