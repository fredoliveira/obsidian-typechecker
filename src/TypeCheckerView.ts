import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { TypeCheckerPlugin } from "./main";
import type { ValidationError } from "./types";

export const TYPE_CHECKER_VIEW_TYPE = "type-checker-view";

export class TypeCheckerView extends ItemView {
  private results: { file: TFile; errors: ValidationError[] }[] = [];
  private currentFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: TypeCheckerPlugin) {
    super(leaf);
  }

  getViewType() {
    return TYPE_CHECKER_VIEW_TYPE;
  }

  getDisplayText() {
    return "Type Checker";
  }

  getIcon() {
    return "list-check";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    // Automatically check all files when view opens
    await this.plugin.checkAllFiles();
  }

  async onClose() {
    // Nothing to clean up
  }

  async updateResults(results: { file: TFile; errors: ValidationError[] }[]) {
    this.results = results;
    await this.updateCurrentFile(this.app.workspace.getActiveFile());
  }

  async updateCurrentFile(file: TFile | null, forceValidation = false) {
    // If this is the same file and not forced, just re-render (no validation needed)
    if (this.currentFile === file && !forceValidation) {
      this.renderResults();
      return;
    }

    this.currentFile = file;

    // If we have a current file, check it for errors and update the results
    if (file && file.extension === "md") {
      const errors = await this.plugin.validateFile(file, forceValidation);

      // Update or add this file's results
      const existingIndex = this.results.findIndex(
        (result) => result.file.path === file.path
      );

      if (existingIndex >= 0) {
        this.results[existingIndex] = { file, errors };
      } else if (errors.length > 0) {
        this.results.push({ file, errors });
      }

      // Remove this file from results if it no longer has errors
      if (errors.length === 0 && existingIndex >= 0) {
        this.results.splice(existingIndex, 1);
      }
    }

    this.renderResults();
  }

  // MARK: Rendering: Current file table
  private renderCurrentFileTable(
    contentEl: HTMLElement,
    currentFileErrors: ValidationError[]
  ) {
    // Current file section header
    const currentFileHeader = contentEl.createEl("div", {
      text: "Current file:",
      cls: "typechecker-section-header",
    });

    // Current file table
    const currentFileTable = contentEl.createEl("table", {
      cls: "typechecker-table",
    });

    // Table header
    const thead = currentFileTable.createEl("thead");
    const headerRow = thead.createEl("tr", { cls: "typechecker-table-header" });

    headerRow.createEl("th", {
      text: "Property",
      cls: "typechecker-property-col",
    });
    headerRow.createEl("th", { text: "Issue" });

    // Table body
    const tbody = currentFileTable.createEl("tbody");
    currentFileErrors.forEach((error) => {
      const row = tbody.createEl("tr", { cls: "typechecker-table-row" });

      // Property cell
      row.createEl("td", {
        text: error.property,
        cls: "typechecker-property-cell",
      });

      // Issue cell
      row.createEl("td", {
        text: error.message,
        cls: "typechecker-issue-cell",
      });
    });
  }

  // MARK: Rendering: Vault-wide table
  private renderVaultWideTable(contentEl: HTMLElement) {
    // Summary
    const totalErrors = this.results.reduce(
      (sum, result) => sum + result.errors.length,
      0
    );

    // Vault-wide section header
    contentEl.createEl("div", {
      text: `Vault issues: ${totalErrors} errors in ${this.results.length} files`,
      cls: "typechecker-section-header",
    });

    // Table
    const table = contentEl.createEl("table", { cls: "typechecker-table" });

    // Table header
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr", { cls: "typechecker-table-header" });

    headerRow.createEl("th", { text: "File" });
    headerRow.createEl("th", {
      text: "",
      cls: "typechecker-errors-col",
    });

    // Table body
    const tbody = table.createEl("tbody");
    this.results.forEach((result) => {
      const row = tbody.createEl("tr", {
        cls: "typechecker-table-row typechecker-clickable",
      });

      // File name cell
      const fileCell = row.createEl("td", {
        text: result.file.basename,
        cls: "typechecker-file-cell",
      });
      fileCell.title = result.file.path;

      // Error count cell
      row.createEl("td", {
        text: result.errors.length.toString(),
        cls: "typechecker-error-count-cell",
      });

      // Click to open file
      row.addEventListener("click", async () => {
        try {
          // Use faster direct file opening instead of openLinkText
          await this.app.workspace.getLeaf().openFile(result.file);
        } catch (error) {
          console.error("TypeChecker: Failed to open file", error);
          // Fallback to original method
          this.app.workspace.openLinkText(result.file.path, "");
        }
      });
    });
  }

  private renderResults() {
    const container = this.containerEl.children[1];
    // Clear existing content except header
    const existing = container.querySelector(".typechecker-content");
    if (existing) existing.remove();

    const contentEl = container.createEl("div", {
      cls: "typechecker-content",
    });

    if (this.results.length === 0) {
      const emptyState = contentEl.createEl("div", {
        cls: "typechecker-empty-state",
      });

      emptyState.createEl("div", { text: "🛡️" });
      emptyState.createEl("h3", { text: "No type errors found" });
      emptyState.createEl("p", {
        text: "All frontmatter types are valid across your vault.",
      });

      return;
    }

    // Get current file errors if current file exists
    const currentFileErrors = this.currentFile
      ? this.results.find(
          (result) => result.file.path === this.currentFile?.path
        )?.errors || []
      : [];

    // Show current file table if current file has errors
    if (currentFileErrors.length > 0) {
      this.renderCurrentFileTable(contentEl, currentFileErrors);
    }

    // Show vault-wide table if there are any errors
    if (this.results.length > 0) {
      this.renderVaultWideTable(contentEl);
    }
  }
}
