import { optimizeBashCode } from '../generators/bash-optimizer.js'

export interface ColorConfig {
  enabled: boolean
  theme: 'minimal' | 'detailed' | 'compact'
}

export function generateColorBashCode(config: ColorConfig): string {
  let bashCode: string

  if (!config.enabled) {
    bashCode = `
# ---- color helpers (disabled) ----
use_color=0
C() { :; }
RST() { :; }
`
  } else {
    bashCode = `
# ---- color helpers (terminal-safe with focus preservation) ----
use_color=1

# Honor explicit environment variables
[[ $NO_COLOR ]] && use_color=0
[[ $FORCE_COLOR ]] && use_color=1

# Detect modern terminals (more permissive than TTY-only)
if (( use_color && ! FORCE_COLOR )); then
  # Check for explicit color support indicators
  case "$TERM" in
    *color*|*-256color|xterm*|screen*|tmux*) 
      use_color=1 ;;
    dumb|unknown) 
      use_color=0 ;;
    *) 
      # Default to colors for modern environments (WSL, containers, etc.)
      # Only disable if we're definitely not in a capable terminal
      [[ -t 1 ]] || use_color=1  # Enable colors even for non-TTY if not explicitly disabled
      ;;
  esac
fi

# Terminal state preservation and safe ANSI sequence generation
save_terminal_state() {
  # Save cursor position and terminal attributes (if supported)
  [[ $use_color -eq 1 ]] && printf '\\0337' 2>/dev/null || true
}

restore_terminal_state() {
  # Restore cursor position and ensure clean state
  [[ $use_color -eq 1 ]] && printf '\\0338\\033[0m' 2>/dev/null || true
}

# Safer color function with validation and error handling
C() { 
  if (( use_color )); then
    # Validate input is a valid ANSI color code
    local code="$1"
    if [[ $code =~ ^[0-9]+(;[0-9]+)*$ ]]; then
      printf '\\033[%sm' "$code" 2>/dev/null || true
    fi
  fi
}

# Enhanced reset function that ensures terminal cleanup
RST() { 
  if (( use_color )); then
    # Use both specific reset and general reset for safety
    printf '\\033[0m' 2>/dev/null || true
    # Additional cleanup for certain terminals
    printf '\\033[?25h' 2>/dev/null || true  # Ensure cursor is visible
  fi
}

# Emergency terminal reset function (for error recovery)
EMERGENCY_RESET() {
  printf '\\033[0m\\033[?25h\\033[2J\\033[H' 2>/dev/null || true
}

# Trap to ensure terminal state is restored on any exit
trap 'restore_terminal_state' EXIT INT TERM
`
  }

  return optimizeBashCode(bashCode)
}

export function generateBasicColors(): string {
  const bashCode = `
# ---- basic colors (terminal-safe) ----
dir_clr() { C '1;36'; }    # cyan
model_clr() { C '1;35'; }  # magenta  
ver_clr() { C '1;33'; }    # yellow
rst() { RST; }
`

  return optimizeBashCode(bashCode)
}

export const COLOR_CODES = {
  // Basic colors
  BLACK: '30',
  RED: '31', 
  GREEN: '32',
  YELLOW: '33',
  BLUE: '34',
  MAGENTA: '35',
  CYAN: '36',
  WHITE: '37',
  
  // Bright colors (bold)
  BRIGHT_BLACK: '1;30',
  BRIGHT_RED: '1;31',
  BRIGHT_GREEN: '1;32', 
  BRIGHT_YELLOW: '1;33',
  BRIGHT_BLUE: '1;34',
  BRIGHT_MAGENTA: '1;35',
  BRIGHT_CYAN: '1;36',
  BRIGHT_WHITE: '1;37',
  
  // Reset
  RESET: '0'
} as const

export function getThemeColors(theme: 'minimal' | 'detailed' | 'compact') {
  switch (theme) {
    case 'minimal':
      return {
        directory: COLOR_CODES.CYAN,
        git: COLOR_CODES.GREEN,
        model: COLOR_CODES.MAGENTA,
        usage: COLOR_CODES.YELLOW,
        session: COLOR_CODES.BLUE
      }
    case 'detailed':
      return {
        directory: COLOR_CODES.BRIGHT_CYAN,
        git: COLOR_CODES.BRIGHT_GREEN,
        model: COLOR_CODES.BRIGHT_MAGENTA,
        usage: COLOR_CODES.BRIGHT_YELLOW,
        session: COLOR_CODES.BRIGHT_BLUE
      }
    case 'compact':
      return {
        directory: COLOR_CODES.CYAN,
        git: COLOR_CODES.GREEN,
        model: COLOR_CODES.BLUE,
        usage: COLOR_CODES.YELLOW,
        session: COLOR_CODES.RED
      }
  }
}