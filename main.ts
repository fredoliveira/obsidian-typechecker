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
		let totalErrors = 0;
		let filesWithErrors = 0;

		for (const file of files) {
			const errors = await this.validateFile(file);
			if (errors.length > 0) {
				filesWithErrors++;
				totalErrors += errors.length;
			}
		}

		if (totalErrors === 0) {
			new Notice("✅ No frontmatter type errors found in any files");
		} else {
			new Notice(`❌ Found ${totalErrors} errors in ${filesWithErrors} files`);
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
			// Skip position metadata
			if (property === "position") continue;

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
		description.setText("Property types are configured in ");
		description.createEl("code", { text: ".obsidian/types.json" });
		description.appendText(". The plugin will validate frontmatter properties against these type definitions.");

		if (Object.keys(this.plugin.propertyTypes).length > 0) {
			const table = containerEl.createEl("table");
			table.style.width = "100%";
			table.style.marginTop = "1em";
			
			const header = table.createEl("tr");
			header.createEl("th", { text: "Property" });
			header.createEl("th", { text: "Type" });

			Object.entries(this.plugin.propertyTypes).forEach(([property, type]) => {
				const row = table.createEl("tr");
				row.createEl("td", { text: property });
				row.createEl("td", { text: type });
			});
		} else {
			containerEl.createEl("p", { 
				text: "No property types found. Create .obsidian/types.json to define property types.",
				cls: "setting-item-description"
			});
		}
	}
}
