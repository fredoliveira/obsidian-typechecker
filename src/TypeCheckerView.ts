import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { TypeCheckerPlugin } from "./main";

export const TYPE_CHECKER_VIEW_TYPE = "type-checker-view";

interface ValidationError {
	property: string;
	expected: string;
	actual: string;
	message: string;
}

export class TypeCheckerView extends ItemView {
	private results: { file: TFile; errors: ValidationError[] }[] = [];

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
		container.createEl("div", { text: "Type Checker", cls: "view-header" });
		this.renderResults();
	}

	async onClose() {
		// Nothing to clean up
	}

	updateResults(results: { file: TFile; errors: ValidationError[] }[]) {
		this.results = results;
		this.renderResults();
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
				text: "Run 'Check all files' to scan your vault for frontmatter type issues.",
			});

			const checkButton = emptyState.createEl("button", {
				text: "Check All Files",
			});
			checkButton.classList.add("mod-cta");
			checkButton.addEventListener("click", () =>
				this.plugin.checkAllFiles()
			);

			return;
		}

		// Summary
		const totalErrors = this.results.reduce(
			(sum, result) => sum + result.errors.length,
			0
		);
		const summary = contentEl.createEl("div");
		summary.style.marginBottom = "8px";
		summary.style.padding = "6px 8px";
		summary.style.backgroundColor = "var(--background-modifier-error)";
		summary.style.borderRadius = "4px";
		summary.style.fontSize = "var(--font-ui-small)";
		summary.style.color = "var(--text-error)";
		summary.style.fontWeight = "600";
		summary.textContent = `${totalErrors} errors in ${this.results.length} files`;

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
			row.style.borderBottom =
				"1px solid var(--background-modifier-border)";
			row.style.cursor = "pointer";
			if (index % 2 === 1) {
				row.style.backgroundColor =
					"var(--background-modifier-hover-alpha)";
			}

			// File name cell
			const fileCell = row.createEl("td");
			fileCell.style.padding = "4px 6px";
			fileCell.style.fontFamily = "var(--font-interface)";
			fileCell.style.fontSize = "var(--font-ui-smaller)";
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
			errorCell.style.color = "var(--text-error)";
			errorCell.style.textAlign = "right";
			errorCell.textContent = result.errors.length.toString();

			// Click to open file
			row.addEventListener("click", () => {
				this.app.workspace.openLinkText(result.file.path, "");
			});

			// Hover effect
			row.addEventListener("mouseenter", () => {
				row.style.backgroundColor = "var(--background-modifier-hover)";
			});
			row.addEventListener("mouseleave", () => {
				if (index % 2 === 1) {
					row.style.backgroundColor =
						"var(--background-modifier-hover-alpha)";
				} else {
					row.style.backgroundColor = "";
				}
			});
		});

		// Refresh button at bottom
		const footer = contentEl.createEl("div");
		footer.style.marginTop = "8px";
		footer.style.textAlign = "center";

		const refreshButton = footer.createEl("button", { text: "Refresh" });
		refreshButton.style.fontSize = "var(--font-ui-small)";
		refreshButton.style.padding = "4px 8px";
		refreshButton.addEventListener("click", () =>
			this.plugin.checkAllFiles()
		);
	}
}
