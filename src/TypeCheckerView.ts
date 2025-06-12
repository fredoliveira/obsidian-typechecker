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
    return "shield-check";
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

  async updateCurrentFile(file: TFile | null) {
    console.time(`TypeChecker: updateCurrentFile ${file?.basename || "null"}`);

    // If this is the same file, just re-render (no validation needed)
    if (this.currentFile === file) {
      console.log(`TypeChecker: Same file, skipping validation`);
      this.renderResults();
      console.timeEnd(
        `TypeChecker: updateCurrentFile ${file?.basename || "null"}`
      );
      return;
    }

    this.currentFile = file;

    // If we have a current file, check it for errors and update the results
    if (file && file.extension === "md") {
      const errors = await this.plugin.validateFile(file);

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
    console.timeEnd(
      `TypeChecker: updateCurrentFile ${file?.basename || "null"}`
    );
  }

  // MARK: Rendering: Current file table
  private renderCurrentFileTable(
    contentEl: HTMLElement,
    currentFileErrors: ValidationError[]
  ) {
    // Current file section header
    const currentFileHeader = contentEl.createEl("div");
    currentFileHeader.style.marginBottom = "12px";
    currentFileHeader.style.fontSize = "var(--font-ui-small)";
    currentFileHeader.style.fontWeight = "400";
    currentFileHeader.style.color = "var(--text-muted)";
    currentFileHeader.textContent = `Current file:`;

    // Current file table
    const currentFileTable = contentEl.createEl("table");
    currentFileTable.style.width = "100%";
    currentFileTable.style.borderCollapse = "collapse";
    currentFileTable.style.fontSize = "var(--font-ui-small)";
    currentFileTable.style.marginBottom = "16px";

    // Table header
    const thead = currentFileTable.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.style.backgroundColor = "var(--background-modifier-hover)";
    headerRow.style.borderBottom =
      "1px solid var(--background-modifier-border)";

    const propertyHeader = headerRow.createEl("th", { text: "Property" });
    propertyHeader.style.padding = "4px 6px";
    propertyHeader.style.textAlign = "left";
    propertyHeader.style.fontWeight = "400";
    propertyHeader.style.width = "30%";

    const issueHeader = headerRow.createEl("th", { text: "Issue" });
    issueHeader.style.padding = "4px 6px";
    issueHeader.style.textAlign = "left";
    issueHeader.style.fontWeight = "400";

    // Table body
    const tbody = currentFileTable.createEl("tbody");
    currentFileErrors.forEach((error, index) => {
      const row = tbody.createEl("tr");
      row.style.borderBottom = "1px solid var(--background-modifier-border)";
      if (index % 2 === 1) {
        row.style.backgroundColor = "var(--background-modifier-hover-alpha)";
      }

      // Property cell
      const propertyCell = row.createEl("td");
      propertyCell.style.padding = "4px 6px";
      propertyCell.style.fontFamily = "var(--font-interface)";
      propertyCell.style.fontSize = "var(--font-ui-smaller)";
      propertyCell.style.fontWeight = "500";
      propertyCell.style.color = "var(--text-faint)";
      propertyCell.textContent = error.property;

      // Issue cell
      const issueCell = row.createEl("td");
      issueCell.style.padding = "4px 6px";
      issueCell.style.fontFamily = "var(--font-interface)";
      issueCell.style.fontSize = "var(--font-ui-smallest)";
      issueCell.style.color = "var(--text-error)";
      issueCell.textContent = error.message;
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
    const vaultHeader = contentEl.createEl("div");
    vaultHeader.style.marginBottom = "8px";
    vaultHeader.style.fontSize = "var(--font-ui-small)";
    vaultHeader.style.fontWeight = "400";
    vaultHeader.style.color = "var(--text-muted)";
    vaultHeader.textContent = `Vault issues: ${totalErrors} errors in ${this.results.length} files`;

    // Table
    const table = contentEl.createEl("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "var(--font-ui-small)";

    // Table header
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.style.backgroundColor = "var(--background-modifier-hover)";
    headerRow.style.borderBottom =
      "1px solid var(--background-modifier-border)";

    const fileHeader = headerRow.createEl("th", { text: "File" });
    fileHeader.style.padding = "4px 6px";
    fileHeader.style.textAlign = "left";
    fileHeader.style.fontWeight = "400";

    const errorsHeader = headerRow.createEl("th", { text: "Issues" });
    errorsHeader.style.padding = "4px 6px";
    errorsHeader.style.textAlign = "center";
    errorsHeader.style.fontWeight = "400";
    errorsHeader.style.width = "60px";

    // Table body
    const tbody = table.createEl("tbody");
    this.results.forEach((result, index) => {
      const row = tbody.createEl("tr");
      row.style.borderBottom = "1px solid var(--background-modifier-border)";
      row.style.cursor = "pointer";
      if (index % 2 === 1) {
        row.style.backgroundColor = "var(--background-modifier-hover-alpha)";
      }

      // File name cell
      const fileCell = row.createEl("td");
      fileCell.style.padding = "4px 6px";
      fileCell.style.fontFamily = "var(--font-interface)";
      fileCell.style.fontSize = "var(--font-ui-smaller)";
      fileCell.style.color = "var(--text-faint)";
      fileCell.style.maxWidth = "0";
      fileCell.style.overflow = "hidden";
      fileCell.style.textOverflow = "ellipsis";
      fileCell.style.whiteSpace = "nowrap";
      fileCell.textContent = result.file.basename;
      fileCell.title = result.file.path;

      // Error count cell
      const errorCell = row.createEl("td");
      errorCell.style.padding = "4px 6px";
      errorCell.style.textAlign = "center";
      errorCell.style.fontWeight = "300";
      errorCell.style.fontFamily = "var(--font-interface)";
      errorCell.style.fontSize = "var(--font-smaller)";
      errorCell.style.color = "var(--text-muted)";
      errorCell.style.textAlign = "right";
      errorCell.textContent = result.errors.length.toString();

      // Click to open file
      row.addEventListener("click", async () => {
        console.time(`TypeChecker: Opening ${result.file.basename}`);
        try {
          // Use faster direct file opening instead of openLinkText
          await this.app.workspace.getLeaf().openFile(result.file);
        } catch (error) {
          console.error("TypeChecker: Failed to open file", error);
          // Fallback to original method
          this.app.workspace.openLinkText(result.file.path, "");
        }
        console.timeEnd(`TypeChecker: Opening ${result.file.basename}`);
      });

      // Hover effect
      row.addEventListener("mouseenter", () => {
        row.style.backgroundColor = "var(--background-modifier-hover)";
      });
      row.addEventListener("mouseleave", () => {
        if (index % 2 === 1) {
          row.style.backgroundColor = "var(--background-modifier-hover-alpha)";
        } else {
          row.style.backgroundColor = "";
        }
      });
    });
  }

  private renderResults() {
    const container = this.containerEl.children[1];
    // Clear existing content except header
    const existing = container.querySelector(".type-checker-content");
    if (existing) existing.remove();

    const contentEl = container.createEl("div", {
      cls: "type-checker-content",
    });
    contentEl.style.padding = "6px";
    contentEl.style.height = "100%";
    contentEl.style.overflowY = "auto";

    if (this.results.length === 0) {
      const emptyState = contentEl.createEl("div");
      emptyState.style.textAlign = "center";
      emptyState.style.color = "var(--text-muted)";
      emptyState.style.marginTop = "2rem";

      emptyState.createEl("div", {
        text: "🛡️",
        cls: "type-checker-icon",
      });
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

    // Refresh button at bottom
    const footer = contentEl.createEl("div");
    footer.style.marginTop = "16px";
    footer.style.textAlign = "center";

    const refreshButton = footer.createEl("button", { text: "Refresh" });
    refreshButton.style.fontSize = "var(--font-ui-small)";
    refreshButton.style.padding = "4px 8px";
    refreshButton.addEventListener("click", () => this.plugin.checkAllFiles());
  }
}
