import { describe, it, expect } from 'vitest'
import { 
  generateColorBashCode, 
  generateBasicColors, 
  getThemeColors, 
  COLOR_CODES,
  ColorConfig 
} from './colors.js'

describe('generateColorBashCode', () => {
  it('should generate color helpers when enabled', () => {
    const config: ColorConfig = { enabled: true, theme: 'detailed' }
    const result = generateColorBashCode(config)
    
    expect(result).toContain('use_color=1')
    expect(result).toContain('# Safer color function with validation')
    expect(result).toContain('C() {')
    expect(result).toContain('RST() {')
    expect(result).toContain('NO_COLOR')
    expect(result).toContain('FORCE_COLOR')
    expect(result).toContain('EMERGENCY_RESET')
    expect(result).toContain('save_terminal_state')
    expect(result).toContain('restore_terminal_state')
  })

  it('should generate disabled color helpers when disabled', () => {
    const config: ColorConfig = { enabled: false, theme: 'minimal' }
    const result = generateColorBashCode(config)
    
    expect(result).toContain('use_color=0')
    expect(result).toContain('C() { :; }')
    expect(result).toContain('RST() { :; }')
    expect(result).not.toContain('NO_COLOR')
  })

  it('should include terminal detection logic when enabled', () => {
    const config: ColorConfig = { enabled: true, theme: 'compact' }
    const result = generateColorBashCode(config)
    
    expect(result).toContain('$TERM')
    expect(result).toContain('*color*|*-256color|xterm*|screen*|tmux*')
    expect(result).toContain('dumb|unknown')
  })

  it('should handle all theme types', () => {
    const themes: Array<'minimal' | 'detailed' | 'compact'> = ['minimal', 'detailed', 'compact']
    
    themes.forEach(theme => {
      const config: ColorConfig = { enabled: true, theme }
      const result = generateColorBashCode(config)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })
  })
})

describe('generateBasicColors', () => {
  it('should generate basic color functions using safe C() helper', () => {
    const result = generateBasicColors()
    
    expect(result).toContain('dir_clr() { C \'1;36\'; }')
    expect(result).toContain('model_clr() { C \'1;35\'; }')
    expect(result).toContain('ver_clr() { C \'1;33\'; }')
    expect(result).toContain('rst() { RST; }')
  })

  it('should use safe color code patterns', () => {
    const result = generateBasicColors()
    
    // Check for color codes passed to C() function
    expect(result).toContain('1;36')  // cyan
    expect(result).toContain('1;35')  // magenta
    expect(result).toContain('1;33')  // yellow
    expect(result).toContain('terminal-safe')
  })
})

describe('COLOR_CODES', () => {
  it('should define basic colors', () => {
    expect(COLOR_CODES.RED).toBe('31')
    expect(COLOR_CODES.GREEN).toBe('32')
    expect(COLOR_CODES.BLUE).toBe('34')
    expect(COLOR_CODES.YELLOW).toBe('33')
    expect(COLOR_CODES.CYAN).toBe('36')
    expect(COLOR_CODES.MAGENTA).toBe('35')
  })

  it('should define bright colors', () => {
    expect(COLOR_CODES.BRIGHT_RED).toBe('1;31')
    expect(COLOR_CODES.BRIGHT_GREEN).toBe('1;32')
    expect(COLOR_CODES.BRIGHT_BLUE).toBe('1;34')
    expect(COLOR_CODES.BRIGHT_YELLOW).toBe('1;33')
    expect(COLOR_CODES.BRIGHT_CYAN).toBe('1;36')
    expect(COLOR_CODES.BRIGHT_MAGENTA).toBe('1;35')
  })

  it('should define reset code', () => {
    expect(COLOR_CODES.RESET).toBe('0')
  })
})

describe('getThemeColors', () => {
  it('should return colors for minimal theme', () => {
    const colors = getThemeColors('minimal')
    
    expect(colors.directory).toBe(COLOR_CODES.CYAN)
    expect(colors.git).toBe(COLOR_CODES.GREEN)
    expect(colors.model).toBe(COLOR_CODES.MAGENTA)
    expect(colors.usage).toBe(COLOR_CODES.YELLOW)
    expect(colors.session).toBe(COLOR_CODES.BLUE)
  })

  it('should return bright colors for detailed theme', () => {
    const colors = getThemeColors('detailed')
    
    expect(colors.directory).toBe(COLOR_CODES.BRIGHT_CYAN)
    expect(colors.git).toBe(COLOR_CODES.BRIGHT_GREEN)
    expect(colors.model).toBe(COLOR_CODES.BRIGHT_MAGENTA)
    expect(colors.usage).toBe(COLOR_CODES.BRIGHT_YELLOW)
    expect(colors.session).toBe(COLOR_CODES.BRIGHT_BLUE)
  })

  it('should return specific colors for compact theme', () => {
    const colors = getThemeColors('compact')
    
    expect(colors.directory).toBe(COLOR_CODES.CYAN)
    expect(colors.git).toBe(COLOR_CODES.GREEN)
    expect(colors.model).toBe(COLOR_CODES.BLUE)
    expect(colors.usage).toBe(COLOR_CODES.YELLOW)
    expect(colors.session).toBe(COLOR_CODES.RED)
  })

  it('should handle all valid themes', () => {
    const themes: Array<'minimal' | 'detailed' | 'compact'> = ['minimal', 'detailed', 'compact']
    
    themes.forEach(theme => {
      const colors = getThemeColors(theme)
      expect(colors).toHaveProperty('directory')
      expect(colors).toHaveProperty('git')
      expect(colors).toHaveProperty('model')
      expect(colors).toHaveProperty('usage')
      expect(colors).toHaveProperty('session')
    })
  })

  it('should return different color schemes per theme', () => {
    const minimal = getThemeColors('minimal')
    const detailed = getThemeColors('detailed')
    const compact = getThemeColors('compact')
    
    // Detailed should use bright colors
    expect(detailed.directory).not.toBe(minimal.directory)
    expect(detailed.git).not.toBe(minimal.git)
    
    // Compact should use different model color
    expect(compact.model).not.toBe(minimal.model)
    expect(compact.session).not.toBe(minimal.session)
  })
})