import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	CachedMetadata,
	getFrontMatterInfo,
	normalizePath,
	WorkspaceLeaf,
} from "obsidian";

import { TypeCheckerView, TYPE_CHECKER_VIEW_TYPE } from "./TypeCheckerView";
import { TypeCheckerSettingTab } from "./TypeCheckerSettingsTab";
import type { TypeCheckerSettings, PropertyTypes, ValidationError } from "./types";

const DEFAULT_SETTINGS: TypeCheckerSettings = {
	enableAutoCheck: true,
	showInlineWarnings: true,
};

export class TypeCheckerPlugin extends Plugin {
	settings: TypeCheckerSettings;
	propertyTypes: PropertyTypes;

	async onload() {
		await this.loadSettings();
		await this.loadPropertyTypes();

		// Register the custom view
		this.registerView(
			TYPE_CHECKER_VIEW_TYPE,
			(leaf) => new TypeCheckerView(leaf, this)
		);

		// Add ribbon icon for type checking
		const ribbonIconEl = this.addRibbonIcon(
			"shield-check",
			"Type Checker",
			(evt: MouseEvent) => {
				this.checkCurrentFile();
			}
		);
		ribbonIconEl.addClass("typechecker-ribbon-class");

		// Add commands
		this.addCommand({
			id: "check-current-file",
			name: "Check current file frontmatter",
			callback: () => {
				this.checkCurrentFile();
			},
		});

		this.addCommand({
			id: "check-all-files",
			name: "Check all files frontmatter",
			callback: () => {
				this.checkAllFiles();
			},
		});

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
				this.app.workspace.on("active-leaf-change", () => {
					if (this.settings.enableAutoCheck) {
						this.checkCurrentFile();
					}
				})
			);
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
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

	async checkCurrentFile() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			new Notice("No markdown file is currently active");
			return;
		}

		const errors = await this.validateFile(activeFile);
		if (errors.length === 0) {
			new Notice("✅ No frontmatter type errors found");
		} else {
			const errorMessage = `❌ Found ${errors.length} frontmatter error${errors.length > 1 ? 's' : ''}:\n${errors.map(e => `• ${e.message}`).join('\n')}`;
			new Notice(errorMessage);
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
			leaf.view.updateResults(allResults);
		}

		if (allResults.length === 0) {
			new Notice("✅ No frontmatter type errors found in any files");
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
			await leaf.setViewState({ type: TYPE_CHECKER_VIEW_TYPE, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}

	async validateFile(file: TFile): Promise<ValidationError[]> {
		const errors: ValidationError[] = [];
		const metadata = this.app.metadataCache.getFileCache(file);
		const frontmatter = metadata?.frontmatter;

		if (!frontmatter) {
			return errors;
		}

		for (const [property, value] of Object.entries(frontmatter)) {
			// Skip position metadata and built-in Obsidian properties
			if (property === "position" || property === "aliases" || property === "tags") continue;

			const expectedType = this.propertyTypes[property];
			if (!expectedType) continue; // No type defined for this property

			const actualType = this.getValueType(value);
			const isValid = this.validatePropertyType(value, expectedType);

			if (!isValid) {
				errors.push({
					property,
					expected: expectedType,
					actual: actualType,
					message: `Property '${property}' should be ${expectedType} but got ${actualType}`,
				});
			}
		}

		return errors;
	}

	validatePropertyType(value: any, expectedType: string): boolean {
		switch (expectedType) {
			case "text":
				return typeof value === "string";
			case "multitext":
				return typeof value === "string" || (Array.isArray(value) && value.every(v => typeof v === "string"));
			case "date":
				return this.isValidDate(value);
			case "tags":
				return Array.isArray(value) && value.every(v => typeof v === "string" && v.startsWith("#"));
			case "aliases":
				return Array.isArray(value) && value.every(v => typeof v === "string");
			default:
				return true; // Unknown type, assume valid
		}
	}

	getValueType(value: any): string {
		if (value === null || value === undefined) return "null";
		if (typeof value === "string") {
			if (this.isValidDate(value)) return "date";
			return "text";
		}
		if (Array.isArray(value)) {
			if (value.every(v => typeof v === "string" && v.startsWith("#"))) return "tags";
			if (value.every(v => typeof v === "string")) return "multitext";
			return "array";
		}
		return typeof value;
	}

	isValidDate(value: any): boolean {
		if (typeof value !== "string") return false;
		// Check for common date formats
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
		const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z?$/; // ISO datetime
		return dateRegex.test(value) || datetimeRegex.test(value) || !isNaN(Date.parse(value));
	}
}

export default TypeCheckerPlugin;