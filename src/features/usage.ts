import { cacheManager, generateContextHash } from '../utils/cache-manager.js'
import { optimizeBashCode } from '../generators/bash-optimizer.js'

export interface UsageFeature {
  enabled: boolean
  showCost: boolean
  showTokens: boolean
  showBurnRate: boolean
  showSession: boolean
  showProgressBar: boolean
  showCacheEfficiency: boolean
  showProjections: boolean
  showContextUsage: boolean
  showEfficiencyAlerts: boolean
  compactMode: boolean
  thresholds?: {
    costWarning: number      // Warn at $X per hour
    timeWarning: number      // Warn with X minutes left  
    contextWarning: number   // Warn at X% context usage
    efficiencyWarning: number // Warn when burn rate X% above average
  }
}

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
  if (config.showCacheEfficiency || config.showContextUsage) {
    jqFields.push('cache_creation_tokens: (.tokenCounts.cacheCreationInputTokens // 0)')
    jqFields.push('cache_read_tokens: (.tokenCounts.cacheReadInputTokens // 0)')
    jqFields.push('input_tokens: (.tokenCounts.inputTokens // 0)')
    jqFields.push('output_tokens: (.tokenCounts.outputTokens // 0)')
  }
  if (config.showProjections) {
    jqFields.push('proj_total_tokens: (.projection.totalTokens // "")')
    jqFields.push('proj_total_cost: (.projection.totalCost // "")')
    jqFields.push('proj_remaining_mins: (.projection.remainingMinutes // "")')
    jqFields.push('entries_count: (.entries // 0)')
  }
  if (config.showEfficiencyAlerts) {
    jqFields.push('tpm_indicator: (.burnRate.tokensPerMinuteForIndicator // "")')
    jqFields.push('models_list: (.models // [])')
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
cache_clr() {
  # Color based on cache efficiency: green = good (>60%), yellow = ok (30-60%), red = poor (<30%)
  if [[ \$cache_efficiency ]]; then
    if   (( \$(echo "\$cache_efficiency >= 60" | bc -l 2>/dev/null || echo 0) )); then CCLR='1;32'  # Green
    elif (( \$(echo "\$cache_efficiency >= 30" | bc -l 2>/dev/null || echo 0) )); then CCLR='1;33'  # Yellow
    else                                                                             CCLR='1;31'; fi # Red
  else CCLR='1;37'; fi  # Gray if no data
  [[ \$use_color -eq 1 ]] && printf '\\033[%sm' "\$CCLR"
}
proj_clr() { [[ \$use_color -eq 1 ]] && printf '\\033[1;34m'; }  # Blue for projections
alert_clr() { [[ \$use_color -eq 1 ]] && printf '\\033[1;31m'; } # Red for alerts
context_clr() {
  # Color based on context usage: green (<60%), yellow (60-80%), red (>80%)
  if [[ \$context_usage_pct ]]; then
    if   (( context_usage_pct >= 80 )); then CTXCLR='1;31'  # Red
    elif (( context_usage_pct >= 60 )); then CTXCLR='1;33'  # Yellow
    else                                     CTXCLR='1;32'; fi # Green
  else CTXCLR='1;37'; fi  # Gray if no data
  [[ \$use_color -eq 1 ]] && printf '\\033[%sm' "\$CTXCLR"
}
` : `
usage_clr() { :; }
cost_clr() { :; }
sess_clr() { :; }
cache_clr() { :; }
proj_clr() { :; }
alert_clr() { :; }
context_clr() { :; }
`

  const bashCode = `${colorCode}
# ---- ccusage integration ----
sess_txt="" pct=0 sess_bar=""
cost_usd="" cost_ph="" tpm="" tot_tokens=""
cache_efficiency="" cache_savings="" context_usage_pct=""
proj_cost_txt="" proj_time_txt="" efficiency_alert=""

if command -v jq >/dev/null 2>&1; then
${cacheManager.generateFileCacheCode('ccusage', 'ccusage blocks --json 2>/dev/null || timeout 5 npx ccusage@latest blocks --json 2>/dev/null')}
  
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
    fi` : ''}${config.showCacheEfficiency || config.showContextUsage ? `
    
    # Cache efficiency and context utilization calculations
    if [[ \$cache_creation_tokens && \$cache_read_tokens ]]; then
      total_cache_tokens=\$(( cache_creation_tokens + cache_read_tokens ))
      if (( total_cache_tokens > 0 )); then
        cache_efficiency=\$(echo "scale=1; \$cache_read_tokens * 100 / \$total_cache_tokens" | bc -l 2>/dev/null || echo "0")
        # Calculate cache cost savings (cache reads are typically 10% cost of creation)
        cache_savings=\$(echo "scale=2; \$cache_read_tokens * 0.9" | bc -l 2>/dev/null || echo "0")
      fi
      # Estimate context usage percentage (rough approximation based on token patterns)
      if [[ \$input_tokens && \$output_tokens ]]; then
        total_conversation_tokens=\$(( input_tokens + output_tokens ))
        # Assume 200K context window, adjust context usage calculation
        context_usage_pct=\$(echo "scale=0; \$total_conversation_tokens * 100 / 200000" | bc -l 2>/dev/null || echo "0")
        (( context_usage_pct > 100 )) && context_usage_pct=100
      fi
    fi` : ''}${config.showProjections ? `
    
    # Cost and time projections
    if [[ \$proj_total_cost && \$proj_remaining_mins ]]; then
      proj_cost_txt=\$(printf "→\$%.2f" "\$proj_total_cost")
      if (( proj_remaining_mins > 60 )); then
        proj_hours=\$(( proj_remaining_mins / 60 ))
        proj_mins=\$(( proj_remaining_mins % 60 ))
        proj_time_txt=\$(printf "%dh%dm left" "\$proj_hours" "\$proj_mins")
      else
        proj_time_txt=\$(printf "%dm left" "\$proj_remaining_mins")
      fi
    fi` : ''}${config.showEfficiencyAlerts ? `
    
    # Efficiency alerts based on thresholds
    efficiency_alert=""
    if [[ \$cost_ph && \$cost_ph != "" ]]; then
      cost_warning_threshold=${config.thresholds?.costWarning || 15.0}
      if (( \$(echo "\$cost_ph > \$cost_warning_threshold" | bc -l 2>/dev/null || echo 0) )); then
        efficiency_alert="⚠\$\${cost_ph}/h"
      fi
    fi
    if [[ \$context_usage_pct && \$context_usage_pct != "" ]]; then
      context_warning_threshold=${config.thresholds?.contextWarning || 80}
      if (( context_usage_pct > context_warning_threshold )); then
        [[ \$efficiency_alert ]] && efficiency_alert="\$efficiency_alert " 
        efficiency_alert="\${efficiency_alert}⚠\${context_usage_pct}%ctx"
      fi
    fi` : ''}
  fi
fi`

  // Apply micro-optimizations before caching
  const optimizedCode = optimizeBashCode(bashCode)
  
  // Cache the optimized bash code in memory
  cacheManager.setInMemory(cacheKey, optimizedCode, 'ccusage', cacheContext)
  
  return optimizedCode
}

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

export function generateUsageDisplayCode(config: UsageFeature, emojis: boolean): string {
  if (!config.enabled) return ''

  // Count enabled features to determine if auto-compact mode should activate
  const enabledFeatures = [
    config.showCost, config.showTokens, config.showBurnRate, config.showSession,
    config.showCacheEfficiency, config.showProjections, config.showContextUsage, config.showEfficiencyAlerts
  ].filter(Boolean).length

  // Auto-activate compact mode when too many features enabled (>5)
  const shouldUseCompact = config.compactMode || enabledFeatures > 5
  
  let displayCode = ''

  // Progressive smart compacting based on feature count
  if (shouldUseCompact && enabledFeatures > 5) {
    const isUltraCompact = enabledFeatures >= 8
    const spacing = isUltraCompact ? '' : ' '
    
    displayCode += `
# smart compact usage display (${enabledFeatures} features, ${isUltraCompact ? 'ultra-compact' : 'smart-compact'} mode)

# Helper functions for smart formatting
format_currency() {
  local amount="\$1" ultra="\$2"
  if [[ \$ultra == "1" ]]; then
    printf "\$%.0f" "\$amount"  # Remove decimals in ultra mode
  else
    printf "\$%.2f" "\$amount"
  fi
}

format_number_k() {
  local num="\$1" ultra="\$2"
  if (( num > 1000 )); then
    if [[ \$ultra == "1" ]]; then
      printf "%.0fk" "\$(echo "scale=0; \$num / 1000" | bc -l 2>/dev/null || echo "0")"
    else
      printf "%.0fk" "\$(echo "scale=0; \$num / 1000" | bc -l 2>/dev/null || echo "0")"
    fi
  else
    printf "%.0f" "\$num"
  fi
}

format_time_compact() {
  local time_str="\$1" ultra="\$2"
  if [[ \$ultra == "1" ]]; then
    echo "\$time_str" | sed 's/ //g'  # Remove spaces: "1h 10m" → "1h10m"
  else
    echo "\$time_str"
  fi
}`

    // Add session time (always first for temporal context)
    if (config.showSession) {
      displayCode += `
# session time
if [[ \$sess_txt ]]; then
  remaining=\$(echo "\$sess_txt" | grep -o '[0-9]\\+h [0-9]\\+m' | head -1)
  if [[ \$remaining ]]; then
    formatted_time=\$(format_time_compact "\$remaining" "${isUltraCompact ? '1' : '0'}")
    printf '  ⌛ %s%s%s${spacing}' "$(sess_clr)" "\$formatted_time" "$(rst)"
  fi
fi`
    }

    // Add cost information (with projections if enabled)
    if (config.showCost) {
      const costEmoji = isUltraCompact ? '💰' : '💵'
      displayCode += `
# cost with smart formatting
if [[ \$cost_usd ]]; then
  formatted_cost=\$(format_currency "\$cost_usd" "${isUltraCompact ? '1' : '0'}")
  printf '  ${costEmoji} %s%s' "$(cost_clr)" "\$formatted_cost"
  [[ \$proj_total_cost && "${config.showProjections ? 'true' : 'false'}" == "true" ]] && {
    formatted_proj=\$(format_currency "\$proj_total_cost" "${isUltraCompact ? '1' : '0'}")
    printf '→%s' "\$formatted_proj"
  }
  printf '%s${spacing}' "$(rst)"
fi`
    }

    // Add cache efficiency
    if (config.showCacheEfficiency) {
      const cacheEmoji = isUltraCompact ? '⚡' : '🔄'
      displayCode += `
# cache efficiency
if [[ \$cache_efficiency ]]; then
  printf '  ${cacheEmoji}%s%.0f%%%s${spacing}' "$(cache_clr)" "\$cache_efficiency" "$(rst)"
fi`
    }

    // Add context usage with integrated alerts
    if (config.showContextUsage) {
      displayCode += `
# context usage with alerts
if [[ \$context_usage_pct ]]; then
  context_warning_threshold=${config.thresholds?.contextWarning || 80}
  if (( context_usage_pct > context_warning_threshold )); then
    printf '  📏%s%d%%⚠%s${spacing}' "$(context_clr)" "\$context_usage_pct" "$(rst)"
  else
    printf '  📏%s%d%%%s${spacing}' "$(context_clr)" "\$context_usage_pct" "$(rst)"
  fi
fi`
    }

    // Add burn rate
    if (config.showBurnRate) {
      displayCode += `
# burn rate
if [[ \$tpm ]]; then
  formatted_tpm=\$(format_number_k "\$tpm" "${isUltraCompact ? '1' : '0'}")
  unit="${isUltraCompact ? '' : ' tpm'}"
  printf '  🔥%s%s%s%s${spacing}' "$(usage_clr)" "\$formatted_tpm" "\$unit" "$(rst)"
fi`
    }

    displayCode += `
# newline after compact display
printf '\\n'`

    return optimizeBashCode(displayCode)
  }

  if (config.showSession) {
    const sessionEmoji = emojis ? '⌛' : 'session:'
    displayCode += `
# session time
if [[ $sess_txt ]]; then
  printf '  ${sessionEmoji} %s%s%s' "$(sess_clr)" "$sess_txt" "$(rst)"${config.showProgressBar ? `
  printf '  %s[%s]%s' "$(sess_clr)" "$sess_bar" "$(rst)"` : ''}
fi`
  }

  if (config.showCost) {
    const costEmoji = emojis ? '💵' : '$'
    displayCode += `
# cost with smart projection integration
if [[ $cost_usd && $cost_usd =~ ^[0-9.]+$ ]]; then
  printf '  ${costEmoji} %s$%.2f' "$(cost_clr)" "$cost_usd"
  # Show projection if available and projections feature enabled
  if [[ $proj_total_cost && "${config.showProjections ? 'true' : 'false'}" == "true" ]]; then
    printf '→$%.2f' "$proj_total_cost"
  fi
  # Show hourly rate if available
  if [[ $cost_ph && $cost_ph =~ ^[0-9.]+$ ]]; then
    printf ' ($%.2f/h)' "$cost_ph"
  fi
  printf '%s' "$(rst)"
fi`
  }

  if (config.showTokens) {
    const tokenEmoji = emojis ? '📊' : 'tok:'
    displayCode += `
# tokens
if [[ $tot_tokens && $tot_tokens =~ ^[0-9]+$ ]]; then
  if [[ $tpm && $tpm =~ ^[0-9.]+$ ]] && ${config.showBurnRate ? 'true' : 'false'}; then
    printf '  ${tokenEmoji} %s%s tok (%.0f tpm)%s' "$(usage_clr)" "$tot_tokens" "$tpm" "$(rst)"
  else
    printf '  ${tokenEmoji} %s%s tok%s' "$(usage_clr)" "$tot_tokens" "$(rst)"
  fi
fi`
  }

  if (config.showCacheEfficiency) {
    const cacheEmoji = emojis ? '🔄' : 'cache:'
    displayCode += `
# cache efficiency
if [[ $cache_efficiency && $cache_efficiency != "0" ]]; then
  printf '  ${cacheEmoji} %s%.1f%%%s' "$(cache_clr)" "$cache_efficiency" "$(rst)"
  [[ $cache_savings && $cache_savings != "0" ]] && printf ' %s(saved %.0f tok)%s' "$(cache_clr)" "$cache_savings" "$(rst)"
fi`
  }

  if (config.showProjections && !config.showCost) {
    // Only show separate projections if cost display isn't already showing them
    const projEmoji = emojis ? '📈' : 'proj:'
    displayCode += `
# projections (standalone when cost not shown)
if [[ $proj_cost_txt ]]; then
  printf '  ${projEmoji} %s%s%s' "$(proj_clr)" "$proj_cost_txt" "$(rst)"
  [[ $proj_time_txt ]] && printf ' %s(%s)%s' "$(proj_clr)" "$proj_time_txt" "$(rst)"
fi`
  } else if (config.showProjections && config.showCost) {
    // Show only time projection when cost is already integrated
    const projEmoji = emojis ? '⏱️' : 'time:'
    displayCode += `
# time projection (when cost already shown)
if [[ $proj_time_txt ]]; then
  printf '  ${projEmoji} %s%s%s' "$(proj_clr)" "$proj_time_txt" "$(rst)"
fi`
  }

  if (config.showContextUsage) {
    const contextEmoji = emojis ? '📏' : 'ctx:'
    displayCode += `
# context usage with integrated alerts
if [[ $context_usage_pct && $context_usage_pct != "0" ]]; then
  context_warning_threshold=${config.thresholds?.contextWarning || 80}
  if (( context_usage_pct > context_warning_threshold )); then
    printf '  ${contextEmoji} %s%d%%⚠%s' "$(context_clr)" "$context_usage_pct" "$(rst)"
  else
    printf '  ${contextEmoji} %s%d%%%s' "$(context_clr)" "$context_usage_pct" "$(rst)"
  fi
fi`
  }

  if (config.showEfficiencyAlerts && !config.showContextUsage) {
    displayCode += `
# efficiency alerts (standalone when context not shown)
if [[ $efficiency_alert ]]; then
  printf '  %s%s%s' "$(alert_clr)" "$efficiency_alert" "$(rst)"
fi`
  }


  return optimizeBashCode(displayCode)
}