import { describe, it, expect } from 'vitest'
import { 
  applyCompactVariables, 
  applyBuiltinReplacements,
  optimizeBashCode, 
  getOptimizationStats,
  COMPACT_VARIABLES,
  BUILTIN_REPLACEMENTS,
  OptimizationOptions
} from './bash-optimizer.js'

describe('applyCompactVariables', () => {
  it('should compact variable names when enabled', () => {
    const bashCode = `
current_directory_path="/home/user"
echo "$current_directory_path"
git_branch_name="main"
session_percentage=75
`
    const options: OptimizationOptions = { compactVariables: true }
    const result = applyCompactVariables(bashCode, options)
    
    expect(result).toContain('cwd="/home/user"')
    expect(result).toContain('echo "$cwd"')
    expect(result).toContain('git_branch="main"')
    expect(result).toContain('pct=75')
  })

  it('should not compact variables when disabled', () => {
    const bashCode = `
current_directory_path="/home/user"
git_branch_name="main"
`
    const options: OptimizationOptions = { compactVariables: false }
    const result = applyCompactVariables(bashCode, options)
    
    expect(result).toContain('current_directory_path="/home/user"')
    expect(result).toContain('git_branch_name="main"')
  })

  it('should handle variable references with braces', () => {
    const bashCode = 'echo "${current_directory_path}/subdir"'
    const options: OptimizationOptions = { compactVariables: true }
    const result = applyCompactVariables(bashCode, options)
    
    expect(result).toContain('echo "$cwd/subdir"')
  })

  it('should handle variable references without braces', () => {
    const bashCode = 'echo "$current_directory_path"'
    const options: OptimizationOptions = { compactVariables: true }
    const result = applyCompactVariables(bashCode, options)
    
    expect(result).toContain('echo "$cwd"')
  })

  it('should handle multiple variable types', () => {
    const bashCode = `
total_tokens=1500
tokens_per_minute=45
use_color_flag=1
cache_file_path="/tmp/cache"
`
    const options: OptimizationOptions = { compactVariables: true }
    const result = applyCompactVariables(bashCode, options)
    
    expect(result).toContain('tot_tokens=1500')
    expect(result).toContain('tpm=45')
    expect(result).toContain('use_color=1')
    expect(result).toContain('cache_file="/tmp/cache"')
  })
})

describe('COMPACT_VARIABLES mapping', () => {
  it('should define directory/path variables', () => {
    expect(COMPACT_VARIABLES['current_directory_path']).toBe('cwd')
    expect(COMPACT_VARIABLES['current_dir']).toBe('cwd')
    expect(COMPACT_VARIABLES['home_directory']).toBe('home')
  })

  it('should define git variables', () => {
    expect(COMPACT_VARIABLES['git_branch_name']).toBe('git_branch')
    expect(COMPACT_VARIABLES['is_git_repository']).toBe('is_git_repo')
    expect(COMPACT_VARIABLES['git_cache_file']).toBe('git_cache')
  })

  it('should define usage/session variables', () => {
    expect(COMPACT_VARIABLES['session_percentage']).toBe('pct')
    expect(COMPACT_VARIABLES['total_tokens']).toBe('tot_tokens')
    expect(COMPACT_VARIABLES['tokens_per_minute']).toBe('tpm')
    expect(COMPACT_VARIABLES['cost_per_hour']).toBe('cost_ph')
  })

  it('should define color variables', () => {
    expect(COMPACT_VARIABLES['use_color_flag']).toBe('use_color')
    expect(COMPACT_VARIABLES['color_prefix']).toBe('clr_pre')
    expect(COMPACT_VARIABLES['color_suffix']).toBe('clr_suf')
  })
})

describe('BUILTIN_REPLACEMENTS mapping', () => {
  it('should define string manipulation replacements', () => {
    expect(BUILTIN_REPLACEMENTS['$(echo "$var" | sed "s|^$HOME|~|g")']).toBe('${var/#$HOME/~}')
    expect(BUILTIN_REPLACEMENTS['$(echo "$var" | sed "s|$HOME|~|g")']).toBe('${var/$HOME/~}')
  })

  it('should define date/time replacements', () => {
    expect(BUILTIN_REPLACEMENTS['$(date +%s)']).toBe('${EPOCHSECONDS:-$(date +%s)}')
  })

  it('should define command existence check replacements', () => {
    expect(BUILTIN_REPLACEMENTS['[ "$(command -v jq)" ]']).toBe('command -v jq >/dev/null 2>&1')
    expect(BUILTIN_REPLACEMENTS['[ "$(command -v git)" ]']).toBe('command -v git >/dev/null 2>&1')
    expect(BUILTIN_REPLACEMENTS['[ "$(which jq)" ]']).toBe('command -v jq >/dev/null 2>&1')
  })

  it('should define file operation replacements', () => {
    expect(BUILTIN_REPLACEMENTS['$(cat "$file")']).toBe('$(<"$file")')
  })

  it('should define test condition replacements', () => {
    expect(BUILTIN_REPLACEMENTS['[ $? -eq 0 ]']).toBe('((! $?))')
    expect(BUILTIN_REPLACEMENTS['[ -n "$var" ]']).toBe('[[ $var ]]')
    expect(BUILTIN_REPLACEMENTS['[ -z "$var" ]']).toBe('[[ ! $var ]]')
  })
})

describe('optimizeBashCode', () => {
  it('should reduce excessive blank lines', () => {
    const bashCode = `

    
echo "hello"


echo "world"

    
`
    const result = optimizeBashCode(bashCode)
    
    // Should not contain triple newlines (reduced to double at most)
    expect(result).not.toContain('\n\n\n')
    // Should preserve the actual commands
    expect(result).toContain('echo "hello"')
    expect(result).toContain('echo "world"')
  })

  it('should preserve bash structure', () => {
    const bashCode = `
# This is a comment
echo "hello" # inline comment
# Another comment
echo "world"
`
    const result = optimizeBashCode(bashCode)
    
    // Should preserve echo statements and comments (optimizer doesn't remove comments)
    expect(result).toContain('echo "hello"')
    expect(result).toContain('echo "world"')
    expect(result).toContain('# This is a comment')
  })

  it('should optimize bash constructs', () => {
    const bashCode = `
if [ -n "$var" ]; then
  echo "not empty"
fi
if [ -z "$other" ]; then
  echo "empty"
fi
`
    const result = optimizeBashCode(bashCode)
    
    // The optimization should replace test constructs
    expect(result).toContain('if [[ $var ]]')
    expect(result).toContain('if [[ ! $other ]]')
  })

  it('should handle complex bash code safely', () => {
    const bashCode = `
#!/bin/bash
# Git status check
current_directory_path="$PWD"
if [ -n "$current_directory_path" ]; then
  git_branch_name=$(git branch --show-current 2>/dev/null)
  session_percentage=75
  total_tokens=1500
fi
`
    const result = optimizeBashCode(bashCode)
    
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    // Should preserve essential structure
    expect(result).toContain('#!/bin/bash')
    expect(result).toContain('if [[ $current_directory_path ]]')
  })
})

describe('getOptimizationStats', () => {
  it('should calculate optimization statistics', () => {
    const original = 'echo "hello world"; echo "goodbye world"; echo "test"'
    const optimized = 'echo "hello"; echo "bye"'
    
    const stats = getOptimizationStats(original, optimized)
    
    expect(stats.originalSize).toBe(original.length)
    expect(stats.optimizedSize).toBe(optimized.length)
    expect(stats.bytesReduced).toBe(original.length - optimized.length)
    expect(stats.reductionPercent).toBeGreaterThan(0)
    expect(stats.reductionPercent).toBeLessThanOrEqual(100)
  })

  it('should handle case where optimized is larger', () => {
    const original = 'echo "hi"'
    const optimized = 'echo "hello world"'
    
    const stats = getOptimizationStats(original, optimized)
    
    expect(stats.bytesReduced).toBeLessThan(0)
    expect(stats.reductionPercent).toBeLessThan(0)
  })

  it('should handle identical strings', () => {
    const code = 'echo "same"'
    
    const stats = getOptimizationStats(code, code)
    
    expect(stats.originalSize).toBe(code.length)
    expect(stats.optimizedSize).toBe(code.length)
    expect(stats.bytesReduced).toBe(0)
    expect(stats.reductionPercent).toBe(0)
  })

  it('should round percentage to reasonable precision', () => {
    const original = 'echo "a very long string that will be reduced"'
    const optimized = 'echo "short"'
    
    const stats = getOptimizationStats(original, optimized)
    
    expect(Number.isFinite(stats.reductionPercent)).toBe(true)
    expect(stats.reductionPercent).toBeGreaterThan(50)
  })
})

describe('applyBuiltinReplacements', () => {
  it('should correctly transform single bracket test conditions with quoted variables', () => {
    const input = '[ -z "$cached_result" ] && cached_result=""'
    const result = applyBuiltinReplacements(input, { useBuiltins: true })
    
    // Should transform [ -z "$var" ] to [[ ! $var ]]
    expect(result).toContain('[[ ! $cached_result ]]')
    expect(result).not.toContain('[[[')  // Should not create triple brackets
  })

  it('should NOT transform already-transformed double bracket conditions', () => {
    const input = '[[ -z "$cached_result" ]] && cached_result=""'
    const result = applyBuiltinReplacements(input, { useBuiltins: true })
    
    // Should leave double brackets unchanged
    expect(result).toBe(input)
    expect(result).not.toContain('[[[')  // Should not create triple brackets
  })

  it('should correctly transform bash test conditions with unquoted variables', () => {
    const input = '[ -n $var ] && echo "has value"'
    const result = applyBuiltinReplacements(input, { useBuiltins: true })
    
    // Should transform [ -n $var ] to [[ $var ]]
    expect(result).toContain('[[ $var ]]')
    expect(result).not.toContain('[[[')  // Should not create triple brackets
  })

  it('should transform all test condition variants', () => {
    const input = `
    [ -n "$var1" ] && echo "test1"
    [ -z "$var2" ] && echo "test2"
    [ -n $var3 ] && echo "test3"
    [ -z $var4 ] && echo "test4"
    `
    const result = applyBuiltinReplacements(input, { useBuiltins: true })
    
    expect(result).toContain('[[ $var1 ]]')
    expect(result).toContain('[[ ! $var2 ]]')
    expect(result).toContain('[[ $var3 ]]')
    expect(result).toContain('[[ ! $var4 ]]')
    expect(result).not.toContain('[[[')  // Should not create triple brackets anywhere
  })

  it('should apply direct pattern replacements from BUILTIN_REPLACEMENTS', () => {
    const input = '$(date +%s)'
    const result = applyBuiltinReplacements(input, { useBuiltins: true })
    
    expect(result).toBe('${EPOCHSECONDS:-$(date +%s)}')
  })

  it('should handle edge cases without corruption', () => {
    const input = 'normal bash code without patterns'
    const result = applyBuiltinReplacements(input, { useBuiltins: true })
    
    expect(result).toBe(input)  // Should be unchanged
  })
})