# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Build the project:
```bash
npm run build
```

Build in watch mode:
```bash
npm run dev
```

Run the CLI tool:
```bash
npm start
# or after building:
node dist/index.js
```

Test the tool locally:
```bash
npm test
# This runs: npm run build && node dist/test.js
```

Test CLI commands without installation:
```bash
npx . init --no-install  # Test configuration wizard
npx . preview ./test-statusline.sh  # Test preview functionality
```

## Architecture

This is a CLI tool for generating custom Claude Code statuslines. The architecture is modular and feature-based:

### Core Components

- **CLI Layer** (`src/cli/`):
  - `commands.ts` - Commander.js command definitions and handlers
  - `prompts.ts` - Interactive configuration wizard using Inquirer.js
  - `preview.ts` - Preview command for testing generated scripts

- **Feature Modules** (`src/features/`):
  - `colors.ts` - TTY-aware color generation and theming
  - `git.ts` - Git branch detection and display utilities
  - `usage.ts` - ccusage integration for cost/session tracking

- **Code Generation** (`src/generators/`):
  - `bash-generator.ts` - Main script generator that orchestrates features into bash scripts

- **Utilities** (`src/utils/`):
  - `installer.ts` - Handles .claude/settings.json updates and file installation
  - `validator.ts` - Configuration validation
  - `tester.ts` - Mock data generation and script testing

### Key Design Patterns

- **Feature-based Architecture**: Each statusline feature (git, usage, colors) is encapsulated in its own module
- **Template Generation**: Features generate their bash code segments that are composed into final scripts
- **Mock Testing**: Uses `tester.ts` to generate realistic Claude Code JSON input for testing
- **Graceful Fallbacks**: Generated bash scripts include fallbacks when external tools (jq, git, ccusage) are unavailable

### Configuration Flow

1. `prompts.ts` collects user preferences via interactive prompts
2. `validator.ts` validates the configuration
3. `bash-generator.ts` orchestrates feature modules to generate the final script
4. `installer.ts` writes the script and updates Claude Code settings

### Generated Script Structure

The bash scripts generated follow this pattern:
- Header with metadata and configuration
- Utility functions for each enabled feature
- JSON parsing using jq with fallbacks
- Display composition with conditional feature rendering

## Testing

Manual testing workflow:
```bash
# Build and test generation
npm run build
./dist/index.js init --output ./test-statusline.sh --no-install

# Test preview with mock data
./dist/index.js preview ./test-statusline.sh

# Test with different feature combinations
# (Modify default selections in prompts.ts and rebuild)
```

The preview command is essential for development - it runs generated scripts with realistic mock Claude Code JSON data to verify functionality.