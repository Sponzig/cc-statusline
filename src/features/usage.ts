import { cacheManager, generateContextHash } from '../utils/cache-manager.js'
import { optimizeBashCode } from '../generators/bash-optimizer.js'

/**
 * Configuration interface for usage and cost tracking features
 * 
 * @interface UsageFeature
 */
export interface UsageFeature {
  /** Whether usage tracking is enabled at all */
  enabled: boolean
  /** Show cost information ($X.XX format) */
  showCost: boolean
  /** Show token count statistics */
  showTokens: boolean
  /** Show tokens per minute burn rate */
  showBurnRate: boolean
  /** Show session time remaining */
  showSession: boolean
  /** Show visual progress bar for session */
  showProgressBar: boolean
}

/**
 * Generate bash code for ccusage integration and data collection
 * 
 * Creates optimized bash functions that query ccusage for cost and usage
 * statistics. Includes intelligent caching and error handling for cases
 * where ccusage is not available.
 * 
 * @param config - Usage feature configuration
 * @param colors - Whether color output is enabled
 * @returns Bash code for usage data collection
 */
export function generateUsageBashCode(config: UsageFeature, colors: boolean): string {
  if (!config.enabled) return ''

  // Generate cache context for memory caching
  const cacheContext = generateContextHash(
    JSON.stringify(config),
    colors.toString()
  )
  const cacheKey = cacheManager.generateCacheKey('ccusage', cacheContext)

  // Check memory cache first
  const cachedResult = cacheManager.getFromMemory<string>(cacheKey)
  if (cachedResult) {
    return cachedResult
  }

  // Build optimized jq query fields
  const jqFields: string[] = []
  if (config.showCost) {
    jqFields.push('cost_usd: (.costUSD // "")')
    jqFields.push('cost_per_hour: (.burnRate.costPerHour // "")')
  }
  if (config.showTokens) {
    jqFields.push('tot_tokens: (.totalTokens // "")')
  }
  if (config.showBurnRate) {
    jqFields.push('tpm: (.burnRate.tokensPerMinute // "")')
  }
  if (config.showSession || config.showProgressBar) {
    jqFields.push('reset_time_str: (.usageLimitResetTime // .endTime // "")')
    jqFields.push('start_time_str: (.startTime // "")')
  }
  
  const jqQuery = jqFields.length > 0 ? `{${jqFields.join(', ')}}` : '{}'

  const colorCode = colors ? `
# ---- usage colors ----
usage_clr() { [[ $use_color -eq 1 ]] && printf '\\033[1;35m'; }
cost_clr() { [[ $use_color -eq 1 ]] && printf '\\033[1;36m'; }
sess_clr() { 
  rem_pct=$(( 100 - pct ))
  if   (( rem_pct <= 10 )); then SCLR='1;31'
  elif (( rem_pct <= 25 )); then SCLR='1;33'
  else                          SCLR='1;32'; fi
  [[ $use_color -eq 1 ]] && printf '\\033[%sm' "$SCLR"
}
` : `
usage_clr() { :; }
cost_clr() { :; }
sess_clr() { :; }
`

  const bashCode = `${colorCode}
# ---- ccusage integration ----
sess_txt="" pct=0 sess_bar=""
cost_usd="" cost_ph="" tpm="" tot_tokens=""

if command -v jq >/dev/null 2>&1; then
${cacheManager.generateFileCacheCode('ccusage', 'ccusage blocks --json 2>/dev/null || timeout 3 npx ccusage@latest blocks --json 2>/dev/null')}
  
  if [[ $cached_result ]]; then
    blocks_output="$cached_result"
    # Single optimized jq call for all data extraction
    eval "$(echo "$blocks_output" | jq -r '
      .blocks[] | select(.isActive == true) | 
      ${jqQuery} | 
      to_entries | .[] | "\\(.key)=\\(.value | @sh)"
    ' 2>/dev/null)" 2>/dev/null${config.showSession || config.showProgressBar ? `
    
    # Session time calculation
    if [[ $reset_time_str && $start_time_str ]]; then
      start_sec=$(to_epoch "$start_time_str"); end_sec=$(to_epoch "$reset_time_str"); now_sec=\${EPOCHSECONDS:-\$(date +%s)}
      total=$(( end_sec - start_sec )); (( total<1 )) && total=1
      elapsed=$(( now_sec - start_sec )); (( elapsed<0 ))&&elapsed=0; (( elapsed>total ))&&elapsed=$total
      pct=$(( elapsed * 100 / total ))
      remaining=$(( end_sec - now_sec )); (( remaining<0 )) && remaining=0
      rh=$(( remaining / 3600 )); rm=$(( (remaining % 3600) / 60 ))
      end_hm=$(fmt_time_hm "$end_sec")${config.showSession ? `
      sess_txt="$(printf '%dh %dm until reset at %s (%d%%)' "$rh" "$rm" "$end_hm" "$pct")"` : ''}${config.showProgressBar ? `
      sess_bar=$(progress_bar "$pct" 10)` : ''}
    fi` : ''}
  fi
fi`

  // Apply micro-optimizations before caching
  const optimizedCode = optimizeBashCode(bashCode)
  
  // Cache the optimized bash code in memory
  cacheManager.setInMemory(cacheKey, optimizedCode, 'ccusage', cacheContext)
  
  return optimizedCode
}

/**
 * Generate utility functions for time formatting and progress bars
 * 
 * Creates cross-platform bash utilities for:
 * - Converting ISO timestamps to epoch time
 * - Formatting time in HH:MM format  
 * - Rendering ASCII progress bars
 * 
 * Includes fallbacks for different date command variants (GNU, BSD, macOS)
 * and Python-based parsing for maximum compatibility.
 * 
 * @returns Optimized bash utility functions
 */
export function generateUsageUtilities(): string {
  const utilities = `
# ---- time helpers ----
to_epoch() {
  ts="$1"
  if command -v gdate >/dev/null 2>&1; then gdate -d "$ts" +%s 2>/dev/null && return; fi
  date -u -j -f "%Y-%m-%dT%H:%M:%S%z" "\${ts/Z/+0000}" +%s 2>/dev/null && return
  python3 - "$ts" <<'PY' 2>/dev/null
import sys, datetime
s=sys.argv[1].replace('Z','+00:00')
print(int(datetime.datetime.fromisoformat(s).timestamp()))
PY
}

fmt_time_hm() {
  epoch="$1"
  if date -r 0 +%s >/dev/null 2>&1; then date -r "$epoch" +"%H:%M"; else date -d "@$epoch" +"%H:%M"; fi
}

progress_bar() {
  p="\${1:-0}"; w="\${2:-10}"
  [[ $p =~ ^[0-9]+$ ]] || p=0; ((p<0))&&p=0; ((p>100))&&p=100
  filled=$(( p * w / 100 )); empty=$(( w - filled ))
  printf '%*s' "$filled" '' | tr ' ' '='
  printf '%*s' "$empty" '' | tr ' ' '-'
}`

  return optimizeBashCode(utilities)
}

/**
 * Generate session display code with optional progress bar
 */
function generateSessionDisplay(emojis: boolean, showProgressBar: boolean): string {
  const sessionEmoji = emojis ? '⌛' : 'session:'
  return `
# session time
if [[ $sess_txt ]]; then
  printf '  ${sessionEmoji} %s%s%s' "$(sess_clr)" "$sess_txt" "$(rst)"${showProgressBar ? `
  printf '  %s[%s]%s' "$(sess_clr)" "$sess_bar" "$(rst)"` : ''}
fi`
}

/**
 * Generate cost display code with optional burn rate
 */
function generateCostDisplay(emojis: boolean): string {
  const costEmoji = emojis ? '💵' : '$'
  return `
# cost
if [[ $cost_usd && $cost_usd =~ ^[0-9.]+$ ]]; then
  if [[ $cost_ph && $cost_ph =~ ^[0-9.]+$ ]]; then
    printf '  ${costEmoji} %s$%.2f ($%.2f/h)%s' "$(cost_clr)" "$cost_usd" "$cost_ph" "$(rst)"
  else
    printf '  ${costEmoji} %s$%.2f%s' "$(cost_clr)" "$cost_usd" "$(rst)"
  fi
fi`
}

/**
 * Generate tokens display code with optional burn rate
 */
function generateTokensDisplay(emojis: boolean, showBurnRate: boolean): string {
  const tokenEmoji = emojis ? '📊' : 'tok:'
  return `
# tokens
if [[ $tot_tokens && $tot_tokens =~ ^[0-9]+$ ]]; then
  if [[ $tpm && $tpm =~ ^[0-9.]+$ ]] && ${showBurnRate ? 'true' : 'false'}; then
    printf '  ${tokenEmoji} %s%s tok (%.0f tpm)%s' "$(usage_clr)" "$tot_tokens" "$tpm" "$(rst)"
  else
    printf '  ${tokenEmoji} %s%s tok%s' "$(usage_clr)" "$tot_tokens" "$(rst)"
  fi
fi`
}

export function generateUsageDisplayCode(config: UsageFeature, emojis: boolean): string {
  if (!config.enabled) return ''

  let displayCode = ''

  if (config.showSession) {
    displayCode += generateSessionDisplay(emojis, config.showProgressBar)
  }

  if (config.showCost) {
    displayCode += generateCostDisplay(emojis)
  }

  if (config.showTokens) {
    displayCode += generateTokensDisplay(emojis, config.showBurnRate)
  }

  return optimizeBashCode(displayCode)
}