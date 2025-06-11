import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	CachedMetadata,
	getFrontMatterInfo,
	normalizePath,
} from "obsidian";

interface TypeCheckerSettings {
	enableAutoCheck: boolean;
	showInlineWarnings: boolean;
}

const DEFAULT_SETTINGS: TypeCheckerSettings = {
	enableAutoCheck: true,
	showInlineWarnings: true,
};

interface PropertyTypes {
	[key: string]: string;
}

interface ValidationError {
	property: string;
	expected: string;
	actual: string;
	message: string;
}

export default class TypeCheckerPlugin extends Plugin {
	settings: TypeCheckerSettings;
	propertyTypes: PropertyTypes;

	async onload() {
		await this.loadSettings();
		await this.loadPropertyTypes();

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

		if (allResults.length === 0) {
			new Notice("✅ No frontmatter type errors found in any files");
		} else {
			new TypeCheckResultsModal(this.app, allResults).open();
		}
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

class TypeCheckResultsModal extends Modal {
	constructor(app: App, private results: { file: TFile; errors: ValidationError[] }[]) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		const header = contentEl.createEl("div");
		header.style.marginBottom = "1rem";
		
		const title = header.createEl("h2", { text: "Frontmatter Type Check Results" });
		title.style.margin = "0 0 0.5rem 0";
		
		const totalErrors = this.results.reduce((sum, result) => sum + result.errors.length, 0);
		const summary = header.createEl("p", { 
			text: `Found ${totalErrors} errors in ${this.results.length} files`
		});
		summary.style.margin = "0";
		summary.style.color = "var(--text-muted)";

		// Results container
		const resultsContainer = contentEl.createEl("div");
		resultsContainer.style.maxHeight = "60vh";
		resultsContainer.style.overflowY = "auto";
		resultsContainer.style.border = "1px solid var(--background-modifier-border)";
		resultsContainer.style.borderRadius = "6px";

		this.results.forEach((result, index) => {
			const fileSection = resultsContainer.createEl("div");
			fileSection.style.borderBottom = index < this.results.length - 1 ? "1px solid var(--background-modifier-border)" : "none";
			
			// File header
			const fileHeader = fileSection.createEl("div");
			fileHeader.style.padding = "12px 16px 8px 16px";
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
				this.close();
			});

			// Errors list
			const errorsList = fileSection.createEl("div");
			errorsList.style.padding = "8px 16px 12px 16px";
			
			result.errors.forEach((error) => {
				const errorItem = errorsList.createEl("div");
				errorItem.style.padding = "6px 0";
				errorItem.style.display = "flex";
				errorItem.style.alignItems = "flex-start";
				errorItem.style.gap = "8px";
				
				const errorIcon = errorItem.createEl("span", { text: "❌" });
				errorIcon.style.fontSize = "var(--font-ui-smaller)";
				errorIcon.style.marginTop = "1px";
				
				const errorContent = errorItem.createEl("div");
				errorContent.style.flex = "1";
				
				const propertyName = errorContent.createEl("span", { text: error.property });
				propertyName.style.fontFamily = "var(--font-monospace)";
				propertyName.style.fontWeight = "600";
				propertyName.style.backgroundColor = "var(--background-modifier-border)";
				propertyName.style.padding = "1px 4px";
				propertyName.style.borderRadius = "3px";
				propertyName.style.fontSize = "var(--font-ui-smaller)";
				
				const errorMessage = errorContent.createEl("div", { text: error.message });
				errorMessage.style.fontSize = "var(--font-ui-small)";
				errorMessage.style.color = "var(--text-muted)";
				errorMessage.style.marginTop = "2px";
			});
		});

		// Footer with close button
		const footer = contentEl.createEl("div");
		footer.style.marginTop = "1rem";
		footer.style.textAlign = "right";
		
		const closeButton = footer.createEl("button", { text: "Close" });
		closeButton.classList.add("mod-cta");
		closeButton.addEventListener("click", () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TypeCheckerSettingTab extends PluginSettingTab {
	plugin: TypeCheckerPlugin;

	constructor(app: App, plugin: TypeCheckerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Type Checker Settings" });

		new Setting(containerEl)
			.setName("Enable auto-check")
			.setDesc("Automatically check frontmatter types when switching files")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableAutoCheck)
					.onChange(async (value) => {
						this.plugin.settings.enableAutoCheck = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show inline warnings")
			.setDesc("Show warning indicators next to invalid properties (coming soon)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showInlineWarnings)
					.onChange(async (value) => {
						this.plugin.settings.showInlineWarnings = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Property Types" });
		
		const description = containerEl.createEl("p");
		description.addClass("setting-item-description");
		description.setText("Property types are configured in ");
		description.createEl("code", { text: ".obsidian/types.json" });
		description.appendText(". The plugin will validate frontmatter properties against these type definitions. Built-in Obsidian properties (aliases, tags) are handled internally and not validated by this plugin.");

		if (Object.keys(this.plugin.propertyTypes).length > 0) {
			const tableContainer = containerEl.createEl("div");
			tableContainer.style.marginTop = "1em";
			tableContainer.style.border = "1px solid var(--background-modifier-border)";
			tableContainer.style.borderRadius = "6px";
			tableContainer.style.overflow = "hidden";
			
			const table = tableContainer.createEl("table");
			table.style.width = "100%";
			table.style.borderCollapse = "collapse";
			table.style.fontSize = "var(--font-ui-small)";
			
			const header = table.createEl("tr");
			header.style.backgroundColor = "var(--background-modifier-border)";
			
			const propertyHeader = header.createEl("th", { text: "Property" });
			propertyHeader.style.padding = "8px 12px";
			propertyHeader.style.textAlign = "left";
			propertyHeader.style.fontWeight = "600";
			propertyHeader.style.borderBottom = "1px solid var(--background-modifier-border)";
			
			const typeHeader = header.createEl("th", { text: "Type" });
			typeHeader.style.padding = "8px 12px";
			typeHeader.style.textAlign = "left";
			typeHeader.style.fontWeight = "600";
			typeHeader.style.borderBottom = "1px solid var(--background-modifier-border)";

			const statusHeader = header.createEl("th", { text: "" });
			statusHeader.style.padding = "8px 12px";
			statusHeader.style.textAlign = "left";
			statusHeader.style.fontWeight = "600";
			statusHeader.style.borderBottom = "1px solid var(--background-modifier-border)";

			Object.entries(this.plugin.propertyTypes).forEach(([property, type], index) => {
				const row = table.createEl("tr");
				if (index % 2 === 1) {
					row.style.backgroundColor = "var(--background-modifier-hover)";
				}
				
				const isBuiltIn = property === "aliases" || property === "tags";
				
				// Property name column
				const propertyCell = row.createEl("td", { text: property });
				propertyCell.style.padding = "8px 12px";
				propertyCell.style.fontFamily = "var(--font-monospace)";
				propertyCell.style.fontSize = "var(--font-ui-smaller)";
				if (isBuiltIn) {
					propertyCell.style.opacity = "0.6";
				}
				
				// Type column
				const typeCell = row.createEl("td");
				typeCell.style.padding = "8px 12px";
				
				const typeSpan = typeCell.createEl("span", { text: type });
				typeSpan.style.backgroundColor = isBuiltIn ? "var(--background-modifier-border)" : "var(--interactive-accent)";
				typeSpan.style.color = isBuiltIn ? "var(--text-muted)" : "var(--text-on-accent)";
				typeSpan.style.padding = "2px 6px";
				typeSpan.style.borderRadius = "4px";
				typeSpan.style.fontSize = "var(--font-ui-smaller)";
				typeSpan.style.fontWeight = "500";
				
				// Status column
				const statusCell = row.createEl("td");
				statusCell.style.padding = "8px 12px";
				
				if (isBuiltIn) {
					const statusText = statusCell.createEl("span", { text: "not checked" });
					statusText.style.fontSize = "var(--font-ui-smaller)";
					statusText.style.color = "var(--text-muted)";
					statusText.style.fontStyle = "italic";
				}
			});
		} else {
			containerEl.createEl("p", { 
				text: "No property types found. Create .obsidian/types.json to define property types.",
				cls: "setting-item-description"
			});
		}
	}
}
