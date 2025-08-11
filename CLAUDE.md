# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin called "Property Checker" that provides frontmatter property type validation for Obsidian. The plugin validates frontmatter properties against user-defined type schemas and displays validation results in a dedicated sidebar view. Built using TypeScript following standard Obsidian plugin architecture.

## Development Commands

- `pnpm run dev` - Start development with watch mode (compiles TypeScript and watches for changes)
- `pnpm run build` - Build for production (runs TypeScript type checking then compiles with esbuild)
- `pnpm run version` - Bump version and update manifest.json and versions.json

## Build System

The project uses esbuild for bundling with a custom configuration in `esbuild.config.mjs`. The build process:

- Bundles `src/main.ts` into `main.js`
- Excludes Obsidian API and CodeMirror dependencies (marked as external)
- Supports both development (with sourcemaps and watch) and production builds
- TypeScript compilation includes strict null checks and targets ES6

## Plugin Architecture

The main plugin class extends Obsidian's `Plugin` base class and follows the standard lifecycle:

- `onload()` - Initialize plugin, register custom view, command, and event listeners
- `onunload()` - Clean up resources (currently minimal cleanup needed)
- Settings are managed through `loadSettings()` and `saveSettings()` methods
- Plugin includes a settings tab and single command palette command

### Core Components

- **Main Plugin (`src/main.ts`)** - Core validation logic, event handling, and view management
- **Type Checker View (`src/TypeCheckerView.ts`)** - Sidebar view showing validation results
- **Settings Tab (`src/TypeCheckerSettingsTab.ts`)** - Plugin configuration interface
- **Types (`src/types.ts`)** - TypeScript type definitions
- **Styles (`styles.css`)** - CSS styling with `typechecker-` namespace

## Validation System

The plugin validates frontmatter properties against types defined in `.obsidian/types.json`:

### Supported Property Types

- `text` - Single line text strings
- `list`/`multitext` - Arrays of strings (backward compatibility)
- `number` - Numeric values
- `checkbox`/`boolean` - Boolean values
- `date` - Date values (YYYY-MM-DD)
- `datetime` - Date/time values (ISO format with time)
- `tags` - Arrays of strings starting with "#"
- `aliases` - Arrays of strings

### Event Handling

- **File switching**: `active-leaf-change` event updates the view for new files
- **File saving**: `metadataCache.on('changed')` event triggers validation when metadata updates
- **Auto-checking**: Controlled by `enableAutoCheck` setting

### Performance Optimizations

- **Validation caching**: Results cached by file path and mtime
- **Smart cache invalidation**: Cache cleared on metadata changes
- **Debounced updates**: 100ms debounce on file switching to prevent excessive validation

## Key Files

- `src/main.ts` - Main plugin entry point with validation logic and event handling
- `src/TypeCheckerView.ts` - Sidebar view implementation with results display
- `src/TypeCheckerSettingsTab.ts` - Settings panel for configuration
- `src/types.ts` - TypeScript interfaces and type definitions
- `styles.css` - Plugin styling with namespaced CSS classes
- `manifest.json` - Plugin metadata and configuration
- `esbuild.config.mjs` - Build configuration
- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript compiler configuration

## Installation and Testing

For local development, the plugin should be placed in `.obsidian/plugins/obsidian-typechecker/` within an Obsidian vault. After building, reload Obsidian to test changes.

### User Configuration

Users must create `.obsidian/types.json` to define property types:

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

## UI/UX Design

- **Single command**: "Open Type Checker" - opens sidebar view
- **No ribbon icon**: Keeps UI clean, uses command palette access
- **CSS-based styling**: All styling in `styles.css` with `typechecker-` prefix
- **Responsive sidebar**: Shows current file errors and vault-wide summary
- **Clickable file navigation**: Click files in results to open them
