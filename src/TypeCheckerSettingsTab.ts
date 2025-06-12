import { App, PluginSettingTab, Setting } from "obsidian";
import type { TypeCheckerPlugin } from "./main";

export class TypeCheckerSettingTab extends PluginSettingTab {
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

    containerEl.createEl("h3", {
      text: "Existing property types",
      cls: "typechecker-settings-header",
    });

    const description = containerEl.createEl("p");
    description.addClass("setting-item-description");
    description.setText("Property types are configured in ");
    description.createEl("code", { text: ".obsidian/types.json" });
    description.appendText(
      ". The plugin will validate frontmatter properties against these type definitions. Built-in Obsidian properties (aliases, tags) are handled internally and not validated by this plugin."
    );

    if (Object.keys(this.plugin.propertyTypes).length > 0) {
      const table = containerEl.createEl("table", {
        cls: "typechecker-table",
      });

      // Table header
      const thead = table.createEl("thead");
      const headerRow = thead.createEl("tr", { cls: "typechecker-table-header" });

      headerRow.createEl("th", { text: "Property" });
      headerRow.createEl("th", { text: "Type" });
      headerRow.createEl("th", { text: "" });

      // Table body
      const tbody = table.createEl("tbody");
      Object.entries(this.plugin.propertyTypes).forEach(
        ([property, type]) => {
          const row = tbody.createEl("tr", { cls: "typechecker-table-row" });

          const isBuiltIn = property === "aliases" || property === "tags";

          // Property name column
          const propertyCell = row.createEl("td", {
            text: property,
            cls: "typechecker-settings-property-cell",
          });
          if (isBuiltIn) {
            propertyCell.addClass("typechecker-settings-builtin");
          }

          // Type column
          const typeCell = row.createEl("td", {
            cls: "typechecker-settings-type-cell",
          });

          const typeSpan = typeCell.createEl("span", {
            text: type,
            cls: isBuiltIn
              ? "typechecker-settings-type-builtin"
              : "typechecker-settings-type-custom",
          });

          // Status column
          const statusCell = row.createEl("td", {
            cls: "typechecker-settings-status-cell",
          });

          if (isBuiltIn) {
            statusCell.createEl("span", {
              text: "not checked",
              cls: "typechecker-settings-status-text",
            });
          }
        }
      );
    } else {
      containerEl.createEl("p", {
        text: "No property types found. Create .obsidian/types.json to define property types.",
        cls: "setting-item-description",
      });
    }
  }
}
