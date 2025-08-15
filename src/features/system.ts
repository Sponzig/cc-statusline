import { cacheManager, generateContextHash } from '../utils/cache-manager.js'
import { optimizeBashCode } from '../generators/bash-optimizer.js'

export interface SystemFeature {
  enabled: boolean
  showCPU: boolean
  showRAM: boolean
  showLoad: boolean
  refreshRate: number
  displayFormat: 'compact' | 'detailed'
}

export function generateSystemBashCode(config: SystemFeature, colors: boolean): string {
  if (!config.enabled) return ''

  // Generate cache context for memory caching
  const cacheContext = generateContextHash(
    JSON.stringify(config),
    colors.toString(),
    'system_bash_code'
  )
  const cacheKey = cacheManager.generateCacheKey('system', cacheContext)

  // Check memory cache first
  const cachedResult = cacheManager.getFromMemory<string>(cacheKey)
  if (cachedResult) {
    return cachedResult
  }

  const colorCode = colors ? `
# ---- system colors ----
cpu_clr() { 
  if (( cpu_percent > 80 )); then CLR='1;31'
  elif (( cpu_percent > 50 )); then CLR='1;33'
  else CLR='1;32'; fi
  [[ $use_color -eq 1 ]] && printf '\\033[%sm' "$CLR"
}
mem_clr() { 
  if (( mem_percent > 85 )); then CLR='1;31'
  elif (( mem_percent > 60 )); then CLR='1;33'
  else CLR='1;32'; fi
  [[ $use_color -eq 1 ]] && printf '\\033[%sm' "$CLR"
}
load_clr() { 
  if (( \$(echo "$load_1min > 2.0" | bc -l 2>/dev/null || echo 0) )); then CLR='1;31'
  elif (( \$(echo "$load_1min > 1.0" | bc -l 2>/dev/null || echo 0) )); then CLR='1;33'
  else CLR='1;32'; fi
  [[ $use_color -eq 1 ]] && printf '\\033[%sm' "$CLR"
}
sys_clr() { [[ $use_color -eq 1 ]] && printf '\\033[1;36m'; }
` : `
cpu_clr() { :; }
mem_clr() { :; }
load_clr() { :; }
sys_clr() { :; }
`

  const bashCode = `${colorCode}
# ---- system monitoring ----
cpu_percent=0 mem_used_gb=0 mem_total_gb=0 mem_percent=0
load_1min=0 load_5min=0 load_15min=0

# System metrics cache (TTL: ${config.refreshRate} seconds)
sys_cache="\${HOME}/.claude/system_\${PWD//\\//_}.tmp"
sys_ttl=${config.refreshRate}
now=\${EPOCHSECONDS:-\$(date +%s)}
sys_cached=0

if [[ -f $sys_cache ]]; then
  cache_time=\$(stat -c %Y "\$sys_cache" 2>/dev/null || stat -f %m "\$sys_cache" 2>/dev/null || echo 0)
  if (( now - cache_time < sys_ttl )); then
    eval "\$(<"\$sys_cache")"
    sys_cached=1
  else
    rm -f "\$sys_cache" 2>/dev/null
  fi
fi

# Collect system metrics only if not cached
if [[ $sys_cached -eq 0 ]]; then
  # Performance timing for optimization measurement
  [[ \$CC_STATUSLINE_DEBUG ]] && sys_start_time=\$(date +%s%3N 2>/dev/null || date +%s)
  
  # Cache platform detection to avoid repeated uname calls
  if [[ -z \$SYS_PLATFORM ]]; then
    SYS_PLATFORM="\$(uname -s 2>/dev/null)"
    # WSL detection for enhanced performance
    if [[ \$SYS_PLATFORM == "Linux" ]] && [[ -r /proc/version ]] && grep -qi "microsoft" /proc/version 2>/dev/null; then
      SYS_PLATFORM="WSL"
      # Cache WSL version for optimizations
      if grep -qi "wsl2" /proc/version 2>/dev/null; then
        export SYS_WSL_VERSION="2"
      else
        export SYS_WSL_VERSION="1"
      fi
    fi
    # Cache platform in user session for reuse
    export SYS_PLATFORM
  fi
  platform="\$SYS_PLATFORM"
  
  case "\$platform" in
    Linux*)
      # Linux - enhanced /proc filesystem optimizations${config.showCPU ? `
      # Enhanced CPU detection with /proc/stat priority for efficiency
      linux_cpu_detected=0
      
      # Primary method: Direct /proc/stat reading (most efficient)
      if [[ \$linux_cpu_detected -eq 0 ]] && [[ -r /proc/stat ]]; then
        # Single read with optimized parsing
        if read -r cpu_line < /proc/stat 2>/dev/null && [[ \$cpu_line ]]; then
          cpu_times=(\$cpu_line)
          if [[ \${#cpu_times[@]} -ge 8 ]]; then
            # Optimized integer-only calculation with bounds checking
            user=\${cpu_times[1]:-0}; nice=\${cpu_times[2]:-0}; system=\${cpu_times[3]:-0}
            idle=\${cpu_times[4]:-0}; iowait=\${cpu_times[5]:-0}; irq=\${cpu_times[6]:-0}; softirq=\${cpu_times[7]:-0}
            steal=\${cpu_times[8]:-0}  # Include steal time for virtualized environments
            
            active=\$((user + nice + system + irq + softirq + steal))
            total=\$((active + idle + iowait))
            
            if (( total > 0 )); then
              cpu_percent=\$(( active * 100 / total ))
              # Bounds checking for sanity
              (( cpu_percent > 100 )) && cpu_percent=100
              (( cpu_percent < 0 )) && cpu_percent=0
              linux_cpu_detected=1
            fi
          fi
        fi
      fi
      
      # Fallback 1: vmstat method for systems where /proc/stat is unreliable
      if [[ \$linux_cpu_detected -eq 0 ]] && command -v vmstat >/dev/null 2>&1; then
        vmstat_output=\$(vmstat 1 2 2>/dev/null | tail -1)
        if [[ \$vmstat_output ]]; then
          cpu_idle=\$(echo "\$vmstat_output" | awk '{print \$15}' 2>/dev/null)
          if [[ \$cpu_idle =~ ^[0-9]+$ ]] && (( cpu_idle >= 0 && cpu_idle <= 100 )); then
            cpu_percent=\$((100 - cpu_idle))
            linux_cpu_detected=1
          fi
        fi
      fi
      
      # Fallback 2: top command for older systems
      if [[ \$linux_cpu_detected -eq 0 ]] && command -v top >/dev/null 2>&1; then
        cpu_line=\$(top -bn1 | grep "^%Cpu" 2>/dev/null | head -1)
        if [[ \$cpu_line ]]; then
          # Parse top CPU line (format varies by version)
          cpu_percent=\$(echo "\$cpu_line" | awk '{
            # Look for patterns like: %Cpu(s):  5.2%us,  1.0%sy
            if (match(\$0, /([0-9.]+)%[[:space:]]*us.*([0-9.]+)%[[:space:]]*sy/, arr)) {
              user_pct = arr[1]; sys_pct = arr[2]
              print int(user_pct + sys_pct + 0.5)  # Round to nearest int
            }
          }' 2>/dev/null)
          if [[ \$cpu_percent =~ ^[0-9]+$ ]] && (( cpu_percent >= 0 && cpu_percent <= 100 )); then
            linux_cpu_detected=1
          fi
        fi
      fi` : ''}${config.showRAM ? `
      
      # Enhanced /proc/meminfo parsing with comprehensive metrics
      linux_mem_detected=0
      
      # Primary method: Optimized /proc/meminfo single-pass parsing
      if [[ \$linux_mem_detected -eq 0 ]] && [[ -r /proc/meminfo ]]; then
        # Single awk pass for all memory metrics with enhanced accuracy
        eval "\$(awk '
          /^MemTotal:/ { total = \$2 }
          /^MemAvailable:/ { avail = \$2; has_avail = 1 }
          /^MemFree:/ { free = \$2 }
          /^Buffers:/ { buffers = \$2 }
          /^Cached:/ { cached = \$2 }
          /^SReclaimable:/ { sreclaimable = \$2 }
          /^Shmem:/ { shmem = \$2 }
          END {
            if (total > 0) {
              if (has_avail) {
                # Use kernel-calculated MemAvailable if available (Linux 3.14+)
                used_kb = total - avail
              } else {
                # Calculate available memory manually for older kernels
                # Include SReclaimable but subtract Shmem for accuracy
                avail = free + buffers + cached + sreclaimable - shmem
                if (avail < 0) avail = free + buffers + cached  # Fallback calculation
                used_kb = total - avail
              }
              
              # Bounds checking and integer math with proper rounding
              if (used_kb < 0) used_kb = 0
              if (used_kb > total) used_kb = total
              
              # Convert to GB with rounding (add 524288 KB for 0.5GB rounding)
              used_gb = int((used_kb + 524288) / 1048576)
              total_gb = int((total + 524288) / 1048576)
              percent = (total > 0) ? int(used_kb * 100 / total) : 0
              
              # Additional bounds checking
              if (percent < 0) percent = 0
              if (percent > 100) percent = 100
              
              printf "mem_total_kb=%d;mem_used_kb=%d;mem_used_gb=%d;mem_total_gb=%d;mem_percent=%d", total, used_kb, used_gb, total_gb, percent
            }
          }' /proc/meminfo 2>/dev/null)"
        
        # Validate results and mark as detected if successful
        if [[ \$mem_total_gb && \$mem_total_gb -gt 0 ]]; then
          linux_mem_detected=1
          # Additional safety bounds
          [[ \$mem_used_gb -lt 0 ]] && mem_used_gb=0
          [[ \$mem_total_gb -lt 1 ]] && mem_total_gb=1
        fi
      fi
      
      # Fallback 1: free command for systems with limited /proc access
      if [[ \$linux_mem_detected -eq 0 ]] && command -v free >/dev/null 2>&1; then
        free_info=\$(free -m 2>/dev/null | awk 'NR==2 {print \$2, \$7}')  # total, available
        if [[ \$free_info ]]; then
          read -r mem_total_mb mem_avail_mb <<< "\$free_info"
          if [[ \$mem_total_mb && \$mem_total_mb -gt 0 ]]; then
            # Convert to GB and calculate percentage
            mem_total_gb=\$(( (mem_total_mb + 512) / 1024 ))  # Round to nearest GB
            if [[ \$mem_avail_mb && \$mem_avail_mb -gt 0 ]]; then
              mem_used_mb=\$((mem_total_mb - mem_avail_mb))
              mem_used_gb=\$(( (mem_used_mb + 512) / 1024 ))
              mem_percent=\$(( mem_used_mb * 100 / mem_total_mb ))
            else
              # Estimate if available not provided
              mem_used_gb=\$(( mem_total_gb / 2 ))
              mem_percent=50
            fi
            linux_mem_detected=1
          fi
        fi
      fi` : ''}${config.showLoad ? `
      
      if [[ -r /proc/loadavg ]]; then
        read -r load_1min load_5min load_15min _ < /proc/loadavg
      fi` : ''}
      ;;
    WSL*)
      # WSL - optimized hybrid approach combining Linux /proc with Windows performance counters${config.showCPU ? `
      # WSL-optimized CPU detection - prefer /proc/stat for consistency
      if [[ -r /proc/stat ]]; then
        cpu_line=\$(head -1 /proc/stat 2>/dev/null)
        if [[ \$cpu_line ]]; then
          cpu_times=(\$cpu_line)
          if [[ \${#cpu_times[@]} -ge 8 ]]; then
            # Integer-only calculation optimized for WSL
            user=\${cpu_times[1]:-0}; nice=\${cpu_times[2]:-0}; system=\${cpu_times[3]:-0}
            idle=\${cpu_times[4]:-0}; iowait=\${cpu_times[5]:-0}; irq=\${cpu_times[6]:-0}; softirq=\${cpu_times[7]:-0}
            active=\$((user + nice + system + irq + softirq))
            total=\$((active + idle + iowait))
            if (( total > 0 )); then
              cpu_percent=\$(( active * 100 / total ))
            fi
          fi
        fi
      fi
      
      # Fallback to vmstat if /proc/stat failed
      if [[ \$cpu_percent -eq 0 ]] && command -v vmstat >/dev/null 2>&1; then
        vmstat_output=\$(vmstat 1 2 2>/dev/null | tail -1)
        if [[ \$vmstat_output ]]; then
          cpu_idle=\$(echo "\$vmstat_output" | awk '{print \$15}' 2>/dev/null)
          if [[ \$cpu_idle =~ ^[0-9]+$ ]] && (( cpu_idle <= 100 )); then
            cpu_percent=\$((100 - cpu_idle))
          fi
        fi
      fi` : ''}${config.showRAM ? `
      
      # WSL-optimized memory detection with enhanced /proc/meminfo parsing
      if [[ -r /proc/meminfo ]]; then
        # Single-pass awk optimized for WSL performance characteristics
        eval "\$(awk '
          /^MemTotal:/ { total = \$2 }
          /^MemAvailable:/ { avail = \$2; has_avail = 1 }
          /^MemFree:/ { free = \$2 }
          /^Buffers:/ { buffers = \$2 }
          /^Cached:/ { cached = \$2 }
          /^SReclaimable:/ { sreclaimable = \$2 }
          END {
            if (!has_avail) {
              # WSL-specific calculation including SReclaimable for accuracy
              avail = free + buffers + cached + sreclaimable
            }
            if (total > 0 && avail >= 0) {
              used_kb = total - avail
              # Integer math with proper rounding optimized for WSL
              used_gb = int((used_kb + 524288) / 1048576)
              total_gb = int((total + 524288) / 1048576)
              percent = int(used_kb * 100 / total)
              printf "mem_total_kb=%d;mem_used_kb=%d;mem_used_gb=%d;mem_total_gb=%d;mem_percent=%d", total, used_kb, used_gb, total_gb, percent
            }
          }' /proc/meminfo 2>/dev/null)"
        
        # WSL-specific validation and bounds checking
        [[ \$mem_used_gb -lt 0 ]] && mem_used_gb=0
        [[ \$mem_total_gb -lt 1 ]] && mem_total_gb=1
      fi` : ''}${config.showLoad ? `
      
      # WSL-optimized load average - direct /proc/loadavg reading
      if [[ -r /proc/loadavg ]]; then
        read -r load_1min load_5min load_15min _ < /proc/loadavg
        # WSL-specific load normalization if needed
        if [[ \$SYS_WSL_VERSION == "1" ]] && command -v nproc >/dev/null 2>&1; then
          # WSL1 may need load adjustment based on CPU cores
          cpu_cores=\$(nproc 2>/dev/null || echo "1")
          # Adjust load values for single-core WSL1 if necessary
          if (( cpu_cores == 1 )) && (( \$(echo "\$load_1min > 1.0" | bc -l 2>/dev/null || echo 0) )); then
            # Cap load at reasonable values for single-core WSL1
            load_1min=\$(echo "scale=2; if (\$load_1min > 2.0) 2.0 else \$load_1min" | bc -l 2>/dev/null || echo "\$load_1min")
          fi
        fi
      fi` : ''}
      ;;
    Darwin*)
      # macOS - optimized system commands${config.showCPU ? `
      if command -v top >/dev/null 2>&1; then
        # Single top call with optimized parsing
        cpu_info=\$(top -l 1 -n 0 | grep "CPU usage" 2>/dev/null)
        if [[ \$cpu_info ]]; then
          # Extract user and sys CPU using awk for better performance
          cpu_percent=\$(echo "\$cpu_info" | awk '
            match(\$0, /([0-9.]+)%[[:space:]]+user.*([0-9.]+)%[[:space:]]+sys/, arr) {
              user = int(arr[1] + 0.5)  # Round to nearest integer
              sys = int(arr[2] + 0.5)   # Round to nearest integer
              print user + sys
            }')
          # Validate result
          [[ ! \$cpu_percent =~ ^[0-9]+$ ]] && cpu_percent=0
        fi
      fi` : ''}${config.showRAM ? `
      
      # Enhanced macOS memory detection with fallbacks
      macos_mem_detected=0
      
      # Primary method: sysctl + vm_stat
      if [[ \$macos_mem_detected -eq 0 ]] && command -v vm_stat >/dev/null 2>&1 && command -v sysctl >/dev/null 2>&1; then
        mem_total_bytes=\$(sysctl -n hw.memsize 2>/dev/null)
        page_size=\$(sysctl -n hw.pagesize 2>/dev/null || echo "4096")
        if [[ \$mem_total_bytes && \$mem_total_bytes -gt 0 && \$page_size && \$page_size -gt 0 ]]; then
          # Single vm_stat call with dynamic page size and enhanced parsing
          eval "\$(vm_stat 2>/dev/null | awk -v page_size=\$page_size '
            /Pages free:/ { free = \$3; gsub(/\\./, "", free) }
            /Pages inactive:/ { inactive = \$3; gsub(/\\./, "", inactive) }
            /Pages speculative:/ { spec = \$3; gsub(/\\./, "", spec) }
            /Pages wired down:/ { wired = \$4; gsub(/\\./, "", wired) }
            /Pages active:/ { active = \$3; gsub(/\\./, "", active) }
            END {
              if (free && inactive && spec && wired && active) {
                # Enhanced calculation including wired and active pages
                avail_bytes = (free + inactive + spec) * page_size
                used_bytes = '$mem_total_bytes' - avail_bytes
                # Ensure used_bytes is not negative
                if (used_bytes < 0) used_bytes = (wired + active) * page_size
                # Integer math with rounding for GB conversion
                used_gb = int((used_bytes + 536870912) / 1073741824)  # +0.5GB for rounding
                total_gb = int(('$mem_total_bytes' + 536870912) / 1073741824)
                percent = int(used_bytes * 100 / '$mem_total_bytes')
                printf "mem_used_gb=%d;mem_total_gb=%d;mem_percent=%d", used_gb, total_gb, percent
              }
            }')"
          [[ \$mem_total_gb && \$mem_total_gb -gt 0 ]] && macos_mem_detected=1
        fi
      fi
      
      # Fallback 1: top command for memory info
      if [[ \$macos_mem_detected -eq 0 ]] && command -v top >/dev/null 2>&1; then
        mem_info=\$(top -l 1 -s 0 | grep "PhysMem" 2>/dev/null)
        if [[ \$mem_info ]]; then
          # Parse top output for memory info (format: PhysMem: 1234M used (456M wired), 789M unused.)
          eval "\$(echo "\$mem_info" | awk '
            /PhysMem:/ {
              match(\$0, /([0-9]+)([MG])[[:space:]]+used.*([0-9]+)([MG])[[:space:]]+unused/, arr)
              if (length(arr) >= 4) {
                used_val = arr[1]; used_unit = arr[2]
                unused_val = arr[3]; unused_unit = arr[4]
                
                # Convert to GB
                used_gb = (used_unit == "G") ? used_val : int(used_val / 1024)
                unused_gb = (unused_unit == "G") ? unused_val : int(unused_val / 1024)
                total_gb = used_gb + unused_gb
                percent = (total_gb > 0) ? int(used_gb * 100 / total_gb) : 0
                
                printf "mem_used_gb=%d;mem_total_gb=%d;mem_percent=%d", used_gb, total_gb, percent
              }
            }')"
          [[ \$mem_total_gb && \$mem_total_gb -gt 0 ]] && macos_mem_detected=1
        fi
      fi
      
      # Fallback 2: system_profiler (slower but comprehensive)
      if [[ \$macos_mem_detected -eq 0 ]] && command -v system_profiler >/dev/null 2>&1; then
        mem_total_gb=\$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Memory:/ { gsub(/[^0-9]/, "", \$2); print int(\$2) }')
        if [[ \$mem_total_gb && \$mem_total_gb -gt 0 ]]; then
          # Estimate usage at 50% since we can't get actual usage this way
          mem_used_gb=\$(( mem_total_gb / 2 ))
          mem_percent=50
          macos_mem_detected=1
        fi
      fi` : ''}${config.showLoad ? `
      
      # Enhanced macOS load detection with fallbacks
      macos_load_detected=0
      
      # Primary method: sysctl vm.loadavg
      if [[ \$macos_load_detected -eq 0 ]] && command -v sysctl >/dev/null 2>&1; then
        load_info=\$(sysctl -n vm.loadavg 2>/dev/null)
        if [[ \$load_info ]]; then
          load_array=(\$load_info)
          if [[ \${#load_array[@]} -ge 4 ]]; then
            load_1min=\${load_array[1]}
            load_5min=\${load_array[2]}
            load_15min=\${load_array[3]}
            macos_load_detected=1
          fi
        fi
      fi
      
      # Fallback 1: uptime command
      if [[ \$macos_load_detected -eq 0 ]] && command -v uptime >/dev/null 2>&1; then
        uptime_info=\$(uptime 2>/dev/null)
        if [[ \$uptime_info =~ load[[:space:]]+averages:[[:space:]]+([0-9.]+)[[:space:]]+([0-9.]+)[[:space:]]+([0-9.]+) ]]; then
          load_1min=\${BASH_REMATCH[1]}
          load_5min=\${BASH_REMATCH[2]}
          load_15min=\${BASH_REMATCH[3]}
          macos_load_detected=1
        fi
      fi
      
      # Fallback 2: w command (if available)
      if [[ \$macos_load_detected -eq 0 ]] && command -v w >/dev/null 2>&1; then
        w_output=\$(w | head -1 2>/dev/null)
        if [[ \$w_output =~ load[[:space:]]+averages:[[:space:]]+([0-9.]+)[[:space:]]+([0-9.]+)[[:space:]]+([0-9.]+) ]]; then
          load_1min=\${BASH_REMATCH[1]}
          load_5min=\${BASH_REMATCH[2]}
          load_15min=\${BASH_REMATCH[3]}
          macos_load_detected=1
        fi
      fi` : ''}
      ;;
    *)
      # Fallback for other platforms${config.showCPU ? `
      if command -v uptime >/dev/null 2>&1; then
        uptime_info=\$(uptime 2>/dev/null)
        if [[ \$uptime_info =~ load[[:space:]]+average.*:[[:space:]]+([0-9.]+) ]]; then
          load_1min=\${BASH_REMATCH[1]}
          # Rough CPU estimate from load (capped at 100%)
          cpu_percent=\$(echo "\$load_1min * 100" | bc -l 2>/dev/null | cut -d. -f1)
          (( cpu_percent > 100 )) && cpu_percent=100
        fi
      fi` : ''}${config.showRAM ? `
      
      if command -v free >/dev/null 2>&1; then
        free_info=\$(free -m 2>/dev/null | grep "^Mem:")
        if [[ \$free_info ]]; then
          mem_array=(\$free_info)
          mem_total_mb=\${mem_array[1]}
          mem_used_mb=\${mem_array[2]}
          mem_total_gb=\$(( mem_total_mb / 1024 ))
          mem_used_gb=\$(( mem_used_mb / 1024 ))
          (( mem_total_mb > 0 )) && mem_percent=\$(( mem_used_mb * 100 / mem_total_mb ))
        fi
      fi` : ''}${config.showLoad ? `
      
      if command -v uptime >/dev/null 2>&1; then
        uptime_info=\$(uptime 2>/dev/null)
        if [[ \$uptime_info =~ load[[:space:]]+average.*:[[:space:]]+([0-9.]+),[[:space:]]+([0-9.]+),[[:space:]]+([0-9.]+) ]]; then
          load_1min=\${BASH_REMATCH[1]}
          load_5min=\${BASH_REMATCH[2]}
          load_15min=\${BASH_REMATCH[3]}
        fi
      fi` : ''}
      ;;
  esac
  
  # Performance timing completion
  if [[ \$CC_STATUSLINE_DEBUG && \$sys_start_time ]]; then
    sys_end_time=\$(date +%s%3N 2>/dev/null || date +%s)
    sys_duration=\$(( sys_end_time - sys_start_time ))
  fi
  
  # Cache the results
  mkdir -p "\${HOME}/.claude" 2>/dev/null
  {
    echo "cpu_percent=\$cpu_percent"
    echo "mem_used_gb=\$mem_used_gb"
    echo "mem_total_gb=\$mem_total_gb"
    echo "mem_percent=\$mem_percent"
    echo "load_1min=\$load_1min"
    echo "load_5min=\$load_5min"
    echo "load_15min=\$load_15min"
  } > "\$sys_cache" 2>/dev/null
  
  # Debug logging if enabled
  if [[ \$CC_STATUSLINE_DEBUG ]]; then
    {
      echo "[DEBUG] System monitoring at \$(date):"
      echo "  Platform: \$platform (cached: \${SYS_PLATFORM:+yes})"
      echo "  CPU: \$cpu_percent%"
      echo "  Memory: \$mem_used_gb GB / \$mem_total_gb GB (\$mem_percent%)"
      echo "  Load: \$load_1min / \$load_5min / \$load_15min"
      [[ \$sys_duration ]] && echo "  Collection time: \${sys_duration}ms"
      echo "  Cache TTL: ${config.refreshRate}s"
    } >> "\${HOME}/.claude/statusline-debug.log" 2>/dev/null
  fi
fi`

  // Apply micro-optimizations before caching
  const optimizedCode = optimizeBashCode(bashCode)
  
  // Cache the optimized bash code in memory
  cacheManager.setInMemory(cacheKey, optimizedCode, 'system', cacheContext)
  
  return optimizedCode
}

export function generateSystemDisplayCode(config: SystemFeature, emojis: boolean): string {
  if (!config.enabled) return ''

  let displayCode = ''

  if (config.showCPU) {
    const cpuEmoji = emojis ? '💻' : 'cpu:'
    displayCode += `
# cpu usage
if [[ \$cpu_percent && \$cpu_percent != "0" ]]; then
  printf '  ${cpuEmoji} %s%s%%%s' "\$(cpu_clr)" "\$cpu_percent" "\$(rst)"
fi`
  }

  if (config.showRAM) {
    const ramEmoji = emojis ? '🧠' : 'ram:'
    if (config.displayFormat === 'detailed') {
      displayCode += `
# memory usage (detailed)
if [[ \$mem_total_gb && \$mem_total_gb -gt 0 ]]; then
  printf '  ${ramEmoji} %s%sGB/%sGB (%s%%)%s' "\$(mem_clr)" "\$mem_used_gb" "\$mem_total_gb" "\$mem_percent" "\$(rst)"
fi`
    } else {
      displayCode += `
# memory usage (compact)
if [[ \$mem_total_gb && \$mem_total_gb -gt 0 ]]; then
  printf '  ${ramEmoji} %s%sG/%sG%s' "\$(mem_clr)" "\$mem_used_gb" "\$mem_total_gb" "\$(rst)"
fi`
    }
  }

  if (config.showLoad) {
    const loadEmoji = emojis ? '⚡' : 'load:'
    if (config.displayFormat === 'detailed') {
      displayCode += `
# system load (detailed with context)
if [[ \$load_1min && \$load_1min != "0" ]]; then
  # Add load status indicator
  load_status=""
  if (( \$(echo "\$load_1min < 1.0" | bc -l 2>/dev/null || echo 1) )); then
    load_status="✓"  # Good
  elif (( \$(echo "\$load_1min < 2.0" | bc -l 2>/dev/null || echo 0) )); then
    load_status="⚠"  # Warning
  else
    load_status="⚠"  # High load
  fi
  printf '  ${loadEmoji} Load: %s%s%s %s (1m/5m/15m: %s/%s/%s)' "\$(load_clr)" "\$load_1min" "\$(rst)" "\$load_status" "\$load_1min" "\$load_5min" "\$load_15min"
fi`
    } else {
      displayCode += `
# system load (compact with status)
if [[ \$load_1min && \$load_1min != "0" ]]; then
  # Add trend indicator based on 1min vs 5min
  trend=""
  if (( \$(echo "\$load_1min > \$load_5min" | bc -l 2>/dev/null || echo 0) )); then
    trend="↗"  # Increasing
  elif (( \$(echo "\$load_1min < \$load_5min" | bc -l 2>/dev/null || echo 0) )); then
    trend="↘"  # Decreasing  
  else
    trend="→"  # Stable
  fi
  printf '  ${loadEmoji} %s%s%s%s' "\$(load_clr)" "\$load_1min" "\$trend" "\$(rst)"
fi`
    }
  }

  return optimizeBashCode(displayCode)
}

export function generateSystemUtilities(): string {
  const utilities = `
# ---- system utilities ----
# Ensure bc is available for floating point math (fallback to integer math)
has_bc() { command -v bc >/dev/null 2>&1; }

# Safe numeric comparison for load averages
load_compare() {
  local val="\$1" threshold="\$2"
  if has_bc; then
    echo "\$val > \$threshold" | bc -l 2>/dev/null || echo 0
  else
    # Integer comparison fallback (multiply by 100)
    local val_int="\$(echo "\$val * 100" | cut -d. -f1 2>/dev/null || echo 0)"
    local thresh_int="\$(echo "\$threshold * 100" | cut -d. -f1 2>/dev/null || echo 0)"
    (( val_int > thresh_int )) && echo 1 || echo 0
  fi
}

${cacheManager.generateCacheInitCode()}`

  return optimizeBashCode(utilities)
}