# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin called "Obsidian Type Checker" that provides type checking functionality for Obsidian frontmatter. The plugin is built using TypeScript and follows the standard Obsidian plugin architecture.

## Development Commands

- `pnpm run dev` - Start development with watch mode (compiles TypeScript and watches for changes)
- `pnpm run build` - Build for production (runs TypeScript type checking then compiles with esbuild)
- `pnpm run version` - Bump version and update manifest.json and versions.json

## Build System

The project uses esbuild for bundling with a custom configuration in `esbuild.config.mjs`. The build process:
- Bundles `main.ts` into `main.js`
- Excludes Obsidian API and CodeMirror dependencies (marked as external)
- Supports both development (with sourcemaps and watch) and production builds
- TypeScript compilation includes strict null checks and targets ES6

## Plugin Architecture

The main plugin class extends Obsidian's `Plugin` base class and follows the standard lifecycle:
- `onload()` - Initialize plugin, register commands, UI elements, and event listeners
- `onunload()` - Clean up resources
- Settings are managed through `loadSettings()` and `saveSettings()` methods
- Plugin includes a settings tab, modal dialog, ribbon icon, and command palette commands

## Key Files

- `main.ts` - Main plugin entry point with core functionality
- `manifest.json` - Plugin metadata and configuration
- `esbuild.config.mjs` - Build configuration
- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript compiler configuration

## Installation and Testing

For local development, the plugin should be placed in `.obsidian/plugins/obsidian-typechecker/` within an Obsidian vault. After building, reload Obsidian to test changes.