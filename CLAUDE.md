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

Run tests:
```bash
npm test                  # Run all tests with Vitest
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
npm run test:unit         # Run only unit tests (excludes integration tests)
npm run test:integration  # Run only integration tests
npm run test:legacy       # Run legacy test workflow (npm run build && node dist/test.js)
```

Run the CLI tool:
```bash
npm start
# or after building:
node dist/index.js
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
  - `bash-optimizer.ts` - NEW: Bash code optimization engine with variable compaction and builtin replacements
  - `template-cache.ts` - NEW: Template caching system for performance optimization

- **Utilities** (`src/utils/`):
  - `installer.ts` - Handles .claude/settings.json updates and file installation
  - `validator.ts` - Configuration validation
  - `tester.ts` - Mock data generation and script testing
  - `cache-manager.ts` - NEW: Advanced caching system for statusline data

### Key Design Patterns

- **Feature-based Architecture**: Each statusline feature (git, usage, colors) is encapsulated in its own module
- **Template Generation**: Features generate their bash code segments that are composed into final scripts
- **Performance Optimization**: Multi-layered caching and optimization system:
  - Template-level caching for common configurations
  - Bash code optimization with variable compaction and builtin replacements
  - Cache management for expensive operations (git, ccusage)
- **Mock Testing**: Uses `tester.ts` to generate realistic Claude Code JSON input for testing
- **Graceful Fallbacks**: Generated bash scripts include fallbacks when external tools (jq, git, ccusage) are unavailable
- **Safety-First Optimization**: Bash optimizer includes comprehensive validation to prevent script corruption

### Configuration Flow

1. `prompts.ts` collects user preferences via interactive prompts
2. `validator.ts` validates the configuration
3. `template-cache.ts` checks for cached templates of common configurations
4. `bash-generator.ts` orchestrates feature modules to generate the final script
5. `bash-optimizer.ts` applies safe optimizations to reduce script size and improve performance
6. `installer.ts` writes the optimized script and updates Claude Code settings

### Generated Script Structure

The bash scripts generated follow this pattern:
- Header with metadata and configuration
- Utility functions for each enabled feature
- JSON parsing using jq with fallbacks
- Display composition with conditional feature rendering

## Testing

### Unit Testing with Vitest

The project uses Vitest for comprehensive testing with coverage tracking:

```bash
npm test                  # Run all tests
npm run test:coverage     # Generate coverage report (80% threshold)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
```

Test structure:
- **Setup**: `src/__tests__/setup.ts` - Global mocks for fs, child_process, inquirer, ora
- **Fixtures**: `src/__tests__/fixtures/` - Mock data for Claude Code JSON and configurations
- **Coverage**: 80% threshold for branches, functions, lines, and statements
- **Validation**: Tests include safety validation for bash optimizer and cache manager

### Manual Testing Workflow

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

### Testing Notes

- All file system operations are mocked in tests for safety
- Bash optimizer tests validate that optimizations don't break script functionality
- Template cache tests ensure caching behavior is correct for common configurations
- Integration tests cover the full CLI workflow from prompts to script generation