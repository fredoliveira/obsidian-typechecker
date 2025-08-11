# Property Checker

A plugin for Obsidian that validates frontmatter property types against your defined property schema. Help ensure data consistency across your vault by catching type mismatches in frontmatter properties.

## Features

- **Property Type Validation**: Validates frontmatter properties against types defined in `.obsidian/types.json`
- **Real-time Checking**: Automatically validates files when switching between them or saving changes
- **Sidebar View**: Dedicated Type Checker view shows validation results for current file and vault-wide issues
- **Clear Error Reporting**: Concise error messages like "expected text, got number"
- **Performance Optimized**: Smart caching and metadata-based validation for fast operation

## Supported Property Types

The plugin validates against Obsidian's standard property types:

- `text` - Single line text strings
- `list` - Arrays of strings (also accepts `multitext` for backward compatibility)
- `number` - Numeric values (integers and decimals)
- `checkbox` - Boolean values (true/false)
- `date` - Date values (YYYY-MM-DD format)
- `datetime` - Date and time values (ISO format with time component)
- `tags` - Arrays of strings starting with "#"
- `aliases` - Arrays of strings (file aliases)

## Setup

### 1. Define Property Types

Create a `.obsidian/types.json` file in your vault to define your property types:

```json
{
  "types": {
    "title": "text",
    "created": "date",
    "modified": "datetime",
    "tags": "tags",
    "category": "list",
    "status": "text",
    "priority": "number",
    "completed": "checkbox",
    "aliases": "aliases"
  }
}
```

### 2. Install the Plugin

1. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/obsidian-typechecker/` folder
2. Enable the plugin in Obsidian's Community Plugins settings

## Usage

### Command Palette

- **"Open Type Checker"** - Opens the Type Checker sidebar view

### Type Checker View

The sidebar view shows:

- **Current file errors** - Validation issues in the currently active file
- **Vault-wide issues** - Summary of all files with type errors
- **Clickable file list** - Click any file to open it and see its issues

### Auto-checking

Enable auto-checking in the plugin settings to automatically validate frontmatter when:

- Switching between files
- Saving file changes (metadata updates)

### Settings

Access plugin settings through Settings → Community Plugins → Property Checker to:

- Toggle auto-checking on file changes
- View your current property type definitions

## Example

Given this frontmatter:

```yaml
---
title: "My Note"
created: "not-a-date"
priority: "high"
completed: "yes"
---
```

And these type definitions:

```json
{
  "types": {
    "title": "text",
    "created": "date",
    "priority": "number",
    "completed": "checkbox"
  }
}
```

The plugin will report:

- ❌ **created**: expected date, got text
- ❌ **priority**: expected number, got text
- ❌ **completed**: expected checkbox, got text

## Development

### Prerequisites

- Node.js v16 or higher
- pnpm (or npm/yarn)

### Setup

```bash
# Install dependencies
pnpm install

# Start development with hot reload
pnpm run dev

# Build for production
pnpm run build
```

### Project Structure

- `src/main.ts` - Main plugin code with type validation logic
- `src/TypeCheckerView.ts` - Sidebar view implementation
- `src/TypeCheckerSettingsTab.ts` - Settings panel
- `src/types.ts` - TypeScript type definitions
- `styles.css` - Plugin styling
- `manifest.json` - Plugin metadata
- `esbuild.config.mjs` - Build configuration
- `CLAUDE.md` - Development guidance for Claude Code

## Contributing

This plugin was built to help maintain data consistency in Obsidian vaults. Contributions are welcome for:

- Additional property type support
- Enhanced validation rules
- UI/UX improvements
- Performance optimizations

## License

MIT License - see LICENSE file for details.
