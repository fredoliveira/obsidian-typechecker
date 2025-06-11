# Obsidian Type Checker Plugin

A plugin for Obsidian that validates frontmatter property types against your defined property schema. Help ensure data consistency across your vault by catching type mismatches in frontmatter properties.

## Features

-   **Property Type Validation**: Validates frontmatter properties against types defined in `.obsidian/types.json`
-   **Real-time Checking**: Automatically check files when switching between them
-   **Manual Validation**: Check individual files or your entire vault on demand
-   **Clear Error Reporting**: Get detailed feedback on property type mismatches
-   **Settings Panel**: Configure auto-checking and view your property type definitions

## Supported Property Types

The plugin validates against Obsidian's standard property types:

-   `text` - Single line text strings
-   `multitext` - Multi-line text or arrays of strings
-   `date` - Date values (YYYY-MM-DD, ISO datetime, or any parseable date format)
-   `tags` - Arrays of strings starting with "#"
-   `aliases` - Arrays of strings (file aliases)

## Setup

### 1. Define Property Types

Create a `.obsidian/types.json` file in your vault to define your property types:

```json
{
	"types": {
		"title": "text",
		"created": "date",
		"tags": "tags",
		"category": "multitext",
		"status": "text",
		"author": "multitext",
		"published": "date",
		"aliases": "aliases"
	}
}
```

### 2. Install the Plugin

1. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/obsidian-typechecker/` folder
2. Enable the plugin in Obsidian's Community Plugins settings

## Usage

### Ribbon Icon

Click the shield-check icon in the ribbon to validate the current file's frontmatter.

### Command Palette

-   **"Check current file frontmatter"** - Validate the active file
-   **"Check all files frontmatter"** - Validate all markdown files in your vault

### Auto-checking

Enable auto-checking in the plugin settings to automatically validate frontmatter when switching between files.

### Settings

Access plugin settings through Settings → Community Plugins → Type Checker to:

-   Toggle auto-checking on file changes
-   View your current property type definitions
-   Configure future inline warning features

## Example

Given this frontmatter:

```yaml
---
title: "My Note"
created: "not-a-date"
tags: ["tag1", "tag2"]
status: 42
---
```

And these type definitions:

```json
{
	"types": {
		"title": "text",
		"created": "date",
		"tags": "tags",
		"status": "text"
	}
}
```

The plugin will report:

-   ❌ Property 'created' should be date but got text
-   ❌ Property 'tags' should be tags but got multitext (missing # prefix)
-   ❌ Property 'status' should be text but got number

## Development

### Prerequisites

-   Node.js v16 or higher
-   pnpm (or npm/yarn)

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

-   `main.ts` - Main plugin code with type validation logic
-   `manifest.json` - Plugin metadata
-   `esbuild.config.mjs` - Build configuration
-   `CLAUDE.md` - Development guidance for Claude Code

## Contributing

This plugin was built to help maintain data consistency in Obsidian vaults. Contributions are welcome for:

-   Additional property type support
-   Inline warning indicators
-   Bulk property type fixing
-   Performance improvements

## License

MIT License - see LICENSE file for details.
