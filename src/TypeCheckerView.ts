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
		const existing = container.querySelector('.type-checker-content');
		if (existing) existing.remove();

		const contentEl = container.createEl("div", { cls: "type-checker-content" });
		contentEl.style.padding = "16px";
		contentEl.style.height = "100%";
		contentEl.style.overflowY = "auto";

		if (this.results.length === 0) {
			const emptyState = contentEl.createEl("div");
			emptyState.style.textAlign = "center";
			emptyState.style.color = "var(--text-muted)";
			emptyState.style.marginTop = "2rem";
			
			emptyState.createEl("div", { text: "🛡️", cls: "type-checker-icon" });
			emptyState.createEl("h3", { text: "No type errors found" });
			emptyState.createEl("p", { text: "Run 'Check all files' to scan your vault for frontmatter type issues." });
			
			const checkButton = emptyState.createEl("button", { text: "Check All Files" });
			checkButton.classList.add("mod-cta");
			checkButton.addEventListener("click", () => this.plugin.checkAllFiles());
			
			return;
		}

		// Summary
		const totalErrors = this.results.reduce((sum, result) => sum + result.errors.length, 0);
		const summary = contentEl.createEl("div");
		summary.style.marginBottom = "1rem";
		summary.style.padding = "12px";
		summary.style.backgroundColor = "var(--background-modifier-error)";
		summary.style.borderRadius = "6px";
		summary.style.border = "1px solid var(--background-modifier-border)";
		
		const summaryTitle = summary.createEl("h3", { text: `${totalErrors} Type Errors Found` });
		summaryTitle.style.margin = "0 0 4px 0";
		summaryTitle.style.color = "var(--text-error)";
		
		const summaryDesc = summary.createEl("p", { text: `Found in ${this.results.length} files` });
		summaryDesc.style.margin = "0";
		summaryDesc.style.color = "var(--text-muted)";
		summaryDesc.style.fontSize = "var(--font-ui-small)";

		// Results
		this.results.forEach((result) => {
			const fileSection = contentEl.createEl("div");
			fileSection.style.marginBottom = "1rem";
			fileSection.style.border = "1px solid var(--background-modifier-border)";
			fileSection.style.borderRadius = "6px";
			fileSection.style.overflow = "hidden";
			
			// File header
			const fileHeader = fileSection.createEl("div");
			fileHeader.style.padding = "12px 16px";
			fileHeader.style.backgroundColor = "var(--background-modifier-hover)";
			fileHeader.style.display = "flex";
			fileHeader.style.justifyContent = "space-between";
			fileHeader.style.alignItems = "center";
			fileHeader.style.cursor = "pointer";
			
			const fileName = fileHeader.createEl("span", { text: result.file.path });
			fileName.style.fontWeight = "600";
			fileName.style.fontFamily = "var(--font-monospace)";
			fileName.style.fontSize = "var(--font-ui-small)";
			
			const errorCount = fileHeader.createEl("span", { text: `${result.errors.length} error${result.errors.length > 1 ? 's' : ''}` });
			errorCount.style.backgroundColor = "var(--text-error)";
			errorCount.style.color = "white";
			errorCount.style.padding = "2px 8px";
			errorCount.style.borderRadius = "12px";
			errorCount.style.fontSize = "var(--font-ui-smaller)";
			errorCount.style.fontWeight = "500";

			// Click to open file
			fileHeader.addEventListener("click", () => {
				this.app.workspace.openLinkText(result.file.path, "");
			});

			// Errors list
			const errorsList = fileSection.createEl("div");
			errorsList.style.padding = "12px 16px";
			
			result.errors.forEach((error, index) => {
				const errorItem = errorsList.createEl("div");
				errorItem.style.padding = "8px 0";
				if (index > 0) {
					errorItem.style.borderTop = "1px solid var(--background-modifier-border)";
				}
				errorItem.style.display = "flex";
				errorItem.style.alignItems = "flex-start";
				errorItem.style.gap = "8px";
				
				const errorIcon = errorItem.createEl("span", { text: "❌" });
				errorIcon.style.fontSize = "var(--font-ui-smaller)";
				errorIcon.style.marginTop = "2px";
				
				const errorContent = errorItem.createEl("div");
				errorContent.style.flex = "1";
				
				const propertyName = errorContent.createEl("span", { text: error.property });
				propertyName.style.fontFamily = "var(--font-monospace)";
				propertyName.style.fontWeight = "600";
				propertyName.style.backgroundColor = "var(--background-modifier-border)";
				propertyName.style.padding = "2px 6px";
				propertyName.style.borderRadius = "3px";
				propertyName.style.fontSize = "var(--font-ui-smaller)";
				
				const errorMessage = errorContent.createEl("div", { text: error.message });
				errorMessage.style.fontSize = "var(--font-ui-small)";
				errorMessage.style.color = "var(--text-muted)";
				errorMessage.style.marginTop = "4px";
			});
		});

		// Refresh button at bottom
		const footer = contentEl.createEl("div");
		footer.style.marginTop = "1rem";
		footer.style.textAlign = "center";
		
		const refreshButton = footer.createEl("button", { text: "Refresh" });
		refreshButton.addEventListener("click", () => this.plugin.checkAllFiles());
	}
}