# cc-statusline

<div align="center">

🚀 **Transform your Claude Code experience with a beautiful, informative statusline**

<img src="docs/images/cc-statusline-running.gif" alt="cc-statusline in action" width="600">

*Real-time directory, git branch, model info, costs, and session time tracking*

[![npm version](https://badge.fury.io/js/@sponzig%2Fcc-statusline.svg)](https://www.npmjs.com/package/@sponzig/cc-statusline)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)

</div>

## ⚡ Quick Start

**One command. Two questions. Beautiful statusline. ✨**

```bash
npx @sponzig/cc-statusline init
```

That's it! Answer 2 simple questions, restart Claude Code, and enjoy your new statusline.

## 🎯 Setup with just 1 command

<img src="docs/images/cc-statusline-init.gif" alt="Demo of cc-statusline setup" width="500">

## ✨ What You Get

Transform your bland Claude Code terminal into an information-rich powerhouse:

- **📁 Smart Directory Display** - Current folder with `~` abbreviation
- **🌿 Git Integration** - Current branch name with clean styling  
- **🤖 Model Intelligence** - Shows which Claude model you're using
- **💵 Real-Time Cost Tracking** - Live cost monitoring via ccusage integration
- **⌛ Session Management** - Time remaining until usage limit resets with progress bars
- **🔄 Cache Efficiency** - Track prompt caching performance and cost savings
- **📏 Context Usage** - Monitor context window utilization with smart alerts
- **📊 Advanced Analytics** - Token consumption, burn rate, and cost projections
- **💻 System Monitoring** - CPU, RAM, and load averages with smart thresholds
- **🎨 Beautiful Colors** - TTY-aware colors that respect your terminal theme
- **⚡ Lightning Fast** - Multi-level caching with <100ms execution time
- **🔧 Auto-Optimization** - Smart compact mode and configurable thresholds

## 🎛️ Features Overview

### 🔥 Default Features (Pre-selected)
| Feature | Description | Example |
|---------|-------------|---------|
| 📁 **Directory** | Current working directory | `~/my-project` |
| 🌿 **Git Branch** | Active git branch | `main` |
| 🤖 **Model** | Claude model name & version | `Opus 4.1` |
| 💵 **Usage & Cost** | Real-time costs with hourly rate | `$2.48 ($12.50/h)` |
| ⌛ **Session Time** | Time until reset with progress | `2h 15m until reset (68%)` |
| 🔄 **Cache Efficiency** | Prompt caching performance | `85% (saved 12k tok)` |
| 📏 **Context Usage** | Context window utilization | `45% (90k/200k)` |

### 🚀 Optional Power Features
| Feature | Description | Example |
|---------|-------------|---------|
| 📊 **Token Stats** | Total tokens consumed | `45,230 tok` |
| 🔥 **Burn Rate** | Tokens per minute | `847 tpm` |
| 📈 **Cost Projections** | Estimated session cost | `→$12.50 (2h left)` |
| ⚠️ **Efficiency Alerts** | Performance warnings | `⚠$15.2/h ⚠85%ctx` |
| 💻 **CPU Usage** | System CPU monitoring | `15%✓` |
| 🧠 **RAM Usage** | Memory utilization | `8.2G/16G` |
| ⚡ **System Load** | Load averages with trends | `1.2↘✓` |

### 🎨 Example Outputs

**Minimal Setup:**
```
📁 ~/my-app  🌿 main  🤖 Claude Sonnet
```

**Full Power Mode:**
```
📁 ~/projects/ai-tools  🌿 feature/statusline  🤖 Opus 4.1  ⌛ 2h 15m until reset (68%)  💵 $16.40→$24.50  🔄 87%  📏 65%  💻 15%✓  🧠 8.2G/16G  ⚡ 1.2↘✓
```

**Smart Compact Mode** (auto-activates with 6+ features):
```
📁 ~/ai-tools   🌿 test/vite  🤖 Sonnet 4  💻 6%⚠  🧠 1G/31G (3%)  ⚡ 1.1✓ (8c: 1.08/1.10/1.73)  ⌛ 1h20m  💰 $66→$91  ⚡94%  📏76%  🔥259840
```

## 🛠️ Advanced Usage

### Preview Your Statusline
Test your statusline before restarting Claude Code:

```bash
cc-statusline preview .claude/statusline.sh
```

**What preview does:**
1. 📄 **Loads** your actual statusline script
2. 🧪 **Runs** it with realistic mock data  
3. 📊 **Shows** exactly what the output will look like
4. ⚡ **Reports** performance metrics and functionality

### Custom Installation
```bash
# Generate to custom location
cc-statusline init --output ./my-statusline.sh

# Skip auto-installation (manual setup)
cc-statusline init --no-install

# Global installation for convenience
npm install -g @sponzig/cc-statusline
```

## 🔧 How It Works

### The Magic Behind The Scenes

1. **🎯 Smart Configuration** - Two intuitive questions configure everything
2. **🏗️ Intelligent Generation** - Creates optimized bash script tailored to your needs  
3. **⚙️ Auto-Installation** - Seamlessly integrates with Claude Code settings
4. **🔄 Real-Time Updates** - Connects to ccusage for live usage statistics

### Technical Architecture

- **⚡ Bash-First** - Native shell execution for maximum speed
- **🎨 TTY-Aware** - Automatically detects terminal capabilities
- **🌍 Environment Respect** - Honors `NO_COLOR` and other conventions
- **📦 Zero Dependencies** - Self-contained script with graceful fallbacks
- **🔒 Secure** - No network requests except ccusage integration

## 📋 Requirements

### ✅ Required (You Already Have These!)
- **Claude Code** - The tool you're already using
- **jq** - JSON processing (pre-installed on most systems)

### 🎁 Optional Enhancements
- **git** - For branch display (you probably have this)
- **ccusage** - For usage stats (works via `npx` - no install needed)

### Quick Compatibility Check
```bash
command -v jq && echo "✅ Ready to go!"
```

## 📂 File Structure

After installation, you'll have a clean setup:

```
.claude/
├── statusline.sh    # 🎯 Your generated statusline script
└── settings.json    # ⚙️ Auto-updated Claude Code configuration
```

### Manual Configuration (Backup Plan)

If auto-configuration fails, simply add this to `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": ".claude/statusline.sh",
    "padding": 0
  }
}
```

## 🔧 Troubleshooting

### 🚫 Statusline Not Showing
1. **Restart Claude Code** after installation
2. **Verify settings** - Check `.claude/settings.json` contains the configuration above
3. **Check permissions** - Ensure script is executable: `chmod +x .claude/statusline.sh`

### 🐌 Performance Issues
- **Test performance**: `cc-statusline preview .claude/statusline.sh`
- **Optimize features**: Disable heavy features if execution > 500ms
- **Disable ccusage**: Remove usage tracking if not needed

### 🧩 Missing Features
- **Install jq**: `brew install jq` (macOS) or `apt install jq` (Ubuntu)
- **ccusage setup**: Works automatically via `npx ccusage@latest`
- **Git not found**: Install git for branch display

## 🚀 Performance

| Metric | Target | Typical |
|--------|--------|---------|
| **Execution Time** | <100ms | 45-80ms |
| **Memory Usage** | <5MB | ~2MB |
| **CPU Impact** | Negligible | <1% |
| **Dependencies** | Minimal | jq only |

*Benchmarked on macOS with all features enabled*

## 🤝 Contributing

We love contributions! 🎉

**Quick Start:**
```bash
git clone https://github.com/Sponzig/cc-statusline
cd cc-statusline
npm install && npm run build
```

**Contribution Areas:**
- 🐛 **Bug Fixes** - Help make it more robust
- ✨ **New Features** - Add support for more runtimes/features  
- 📚 **Documentation** - Improve guides and examples
- 🧪 **Testing** - Add test coverage and edge cases

See our [Contributing Guide](CONTRIBUTING.md) for detailed information.

## 📊 Stats

<div align="center">

![GitHub stars](https://img.shields.io/github/stars/Sponzig/cc-statusline?style=social)
![GitHub forks](https://img.shields.io/github/forks/Sponzig/cc-statusline?style=social)
![npm downloads](https://img.shields.io/npm/dm/@sponzig/cc-statusline)

</div>

## 🔗 Related Projects

- **[ccusage](https://github.com/ryoppippi/ccusage)** - Claude Code usage analytics (would not be possible with it!)
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Official documentation

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release history.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made by [Sponzig](https://github.com/Sponzig)**

</div>