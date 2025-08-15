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
    expect(result).toContain('C() { (( use_color )) && printf \'\\033[%sm\' "$1"; }')
    expect(result).toContain('RST() { (( use_color )) && printf \'\\033[0m\'; }')
    expect(result).toContain('NO_COLOR')
    expect(result).toContain('FORCE_COLOR')
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
  it('should generate basic color functions', () => {
    const result = generateBasicColors()
    
    expect(result).toContain('dir_clr() { (( use_color )) && printf \'\\033[1;36m\'; }')
    expect(result).toContain('model_clr() { (( use_color )) && printf \'\\033[1;35m\'; }')
    expect(result).toContain('ver_clr() { (( use_color )) && printf \'\\033[1;33m\'; }')
    expect(result).toContain('rst() { (( use_color )) && printf \'\\033[0m\'; }')
  })

  it('should use ANSI color codes', () => {
    const result = generateBasicColors()
    
    // Check for cyan (1;36m)
    expect(result).toContain('\\033[1;36m')
    // Check for magenta (1;35m)
    expect(result).toContain('\\033[1;35m')
    // Check for yellow (1;33m)
    expect(result).toContain('\\033[1;33m')
    // Check for reset (0m)
    expect(result).toContain('\\033[0m')
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