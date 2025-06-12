import { Plugin, TFile, normalizePath, WorkspaceLeaf } from "obsidian";
import { TypeCheckerView, TYPE_CHECKER_VIEW_TYPE } from "./TypeCheckerView";
import { TypeCheckerSettingTab } from "./TypeCheckerSettingsTab";

import type {
  TypeCheckerSettings,
  PropertyTypes,
  ValidationError,
} from "./types";

const DEFAULT_SETTINGS: TypeCheckerSettings = {
  enableAutoCheck: true,
};

const IGNORED_PROPERTIES = ["position", "aliases", "tags"];

export class TypeCheckerPlugin extends Plugin {
  settings: TypeCheckerSettings;
  propertyTypes: PropertyTypes;
  private updateTimeout: NodeJS.Timeout | null = null;
  private validationCache: Map<
    string,
    { mtime: number; errors: ValidationError[] }
  > = new Map();

  async onload() {
    await this.loadSettings();
    await this.loadPropertyTypes();

    // Register the custom view
    this.registerView(
      TYPE_CHECKER_VIEW_TYPE,
      (leaf) => new TypeCheckerView(leaf, this)
    );


    // Add command to open Type Checker view
    this.addCommand({
      id: "open-type-checker-view",
      name: "Open Type Checker",
      callback: () => {
        this.activateView();
      },
    });

    // Add settings tab
    this.addSettingTab(new TypeCheckerSettingTab(this.app, this));

    // Auto-check on file change if enabled
    if (this.settings.enableAutoCheck) {
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", async () => {
          // Update the view with the new current file
          await this.updateViewCurrentFile();
        })
      );
    }

    // Also update view on file change even if auto-check is disabled
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", async () => {
        await this.updateViewCurrentFile();
      })
    );

    // Revalidate current file when metadata cache updates
    this.registerEvent(
      this.app.metadataCache.on("changed", async (file) => {
        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile && file.path === currentFile.path && file.extension === "md") {
          await this.updateViewCurrentFile(true); // Force validation
        }
      })
    );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async loadPropertyTypes() {
    const typesPath = normalizePath(this.app.vault.configDir + "/types.json");
    try {
      if (await this.app.vault.adapter.exists(typesPath)) {
        const typesContent = await this.app.vault.adapter.read(typesPath);
        const typesConfig = JSON.parse(typesContent);
        this.propertyTypes = typesConfig.types || {};
      } else {
        this.propertyTypes = {};
      }
    } catch (error) {
      console.error("Failed to load property types:", error);
      this.propertyTypes = {};
    }
  }


  async checkAllFiles() {
    const files = this.app.vault.getMarkdownFiles();
    const allResults: { file: TFile; errors: ValidationError[] }[] = [];

    for (const file of files) {
      const errors = await this.validateFile(file);
      if (errors.length > 0) {
        allResults.push({ file, errors });
      }
    }

    // Open or focus the type checker view
    this.activateView();

    // Update the view with results
    const leaf = this.app.workspace.getLeavesOfType(TYPE_CHECKER_VIEW_TYPE)[0];
    if (leaf?.view instanceof TypeCheckerView) {
      await leaf.view.updateResults(allResults);
    }
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(TYPE_CHECKER_VIEW_TYPE);

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      leaf = leaves[0];
    } else {
      // Our view could not be found in the workspace, create a new leaf
      // in the right sidebar for it
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: TYPE_CHECKER_VIEW_TYPE,
          active: true,
        });
      }
    }

    // Reveal the leaf in case it is in a collapsed sidebar
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async updateViewCurrentFile(forceValidation = false) {
    // Debounce rapid file changes to prevent excessive validation (but not for forced updates)
    if (this.updateTimeout && !forceValidation) {
      clearTimeout(this.updateTimeout);
    }

    const updateFn = async () => {
      const leaf = this.app.workspace.getLeavesOfType(
        TYPE_CHECKER_VIEW_TYPE
      )[0];
      if (leaf?.view instanceof TypeCheckerView) {
        const currentFile = this.app.workspace.getActiveFile();
        await leaf.view.updateCurrentFile(currentFile, forceValidation);
      }
      this.updateTimeout = null;
    };

    if (forceValidation) {
      // Don't debounce forced updates (like file saves)
      await updateFn();
    } else {
      this.updateTimeout = setTimeout(updateFn, 100); // 100ms debounce
    }
  }

  async validateFile(file: TFile, skipCache = false): Promise<ValidationError[]> {
    // Check cache first (unless skipping cache)
    const cacheKey = file.path;
    const cached = this.validationCache.get(cacheKey);

    if (!skipCache && cached && cached.mtime === file.stat.mtime) {
      return cached.errors;
    }

    const errors: ValidationError[] = [];
    const metadata = this.app.metadataCache.getFileCache(file);
    const frontmatter = metadata?.frontmatter;

    if (!frontmatter) {
      // Cache empty result
      this.validationCache.set(cacheKey, { mtime: file.stat.mtime, errors });
      return errors;
    }

    for (const [property, value] of Object.entries(frontmatter)) {
      // Skip position metadata and built-in Obsidian properties
      if (IGNORED_PROPERTIES.includes(property)) continue;

      const expectedType = this.propertyTypes[property];
      if (!expectedType) continue; // No type defined for this property

      const actualType = this.getValueType(value);
      const isValid = this.validatePropertyType(value, expectedType);

      if (!isValid) {
        errors.push({
          property,
          expected: expectedType,
          actual: actualType,
          message: `expected ${expectedType}, got ${actualType}`,
        });
      }
    }

    // Cache the result
    this.validationCache.set(cacheKey, { mtime: file.stat.mtime, errors });
    return errors;
  }

  // MARK: Property type validation
  validatePropertyType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case "text":
        return typeof value === "string";
      case "list":
      case "multitext": // Keep backward compatibility
        return (
          typeof value === "string" ||
          (Array.isArray(value) && value.every((v) => typeof v === "string"))
        );
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "checkbox":
      case "boolean":
        return typeof value === "boolean";
      case "date":
        return this.isValidDate(value) && !this.hasTimeComponent(value);
      case "datetime":
        return this.isValidDate(value) && this.hasTimeComponent(value);
      case "tags":
        return (
          Array.isArray(value) &&
          value.every((v) => typeof v === "string" && v.startsWith("#"))
        );
      case "aliases":
        return (
          Array.isArray(value) && value.every((v) => typeof v === "string")
        );
      default:
        return true; // Unknown type, assume valid
    }
  }

  getValueType(value: any): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "string") {
      if (this.isValidDate(value)) {
        return this.hasTimeComponent(value) ? "datetime" : "date";
      }
      return "text";
    }
    if (typeof value === "number" && !isNaN(value)) return "number";
    if (typeof value === "boolean") return "checkbox";
    if (Array.isArray(value)) {
      if (value.every((v) => typeof v === "string" && v.startsWith("#")))
        return "tags";
      if (value.every((v) => typeof v === "string")) return "list";
      return "array";
    }
    return typeof value;
  }

  isValidDate(value: any): boolean {
    if (typeof value !== "string") return false;
    // Check for common date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
    const datetimeRegex =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?Z?$/; // ISO datetime
    return (
      dateRegex.test(value) ||
      datetimeRegex.test(value) ||
      !isNaN(Date.parse(value))
    );
  }

  hasTimeComponent(value: string): boolean {
    if (typeof value !== "string") return false;
    // Check if the date string includes time component
    return (
      value.includes("T") ||
      (value.includes(" ") && /\d{1,2}:\d{2}/.test(value))
    );
  }
}

export default TypeCheckerPlugin;
