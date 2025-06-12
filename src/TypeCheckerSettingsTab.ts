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


    containerEl.createEl("h3", { text: "Property Types" });

    const description = containerEl.createEl("p");
    description.addClass("setting-item-description");
    description.setText("Property types are configured in ");
    description.createEl("code", { text: ".obsidian/types.json" });
    description.appendText(
      ". The plugin will validate frontmatter properties against these type definitions. Built-in Obsidian properties (aliases, tags) are handled internally and not validated by this plugin."
    );

    if (Object.keys(this.plugin.propertyTypes).length > 0) {
      const tableContainer = containerEl.createEl("div");
      tableContainer.style.marginTop = "1em";
      tableContainer.style.border =
        "1px solid var(--background-modifier-border)";
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
      propertyHeader.style.borderBottom =
        "1px solid var(--background-modifier-border)";

      const typeHeader = header.createEl("th", { text: "Type" });
      typeHeader.style.padding = "8px 12px";
      typeHeader.style.textAlign = "left";
      typeHeader.style.fontWeight = "600";
      typeHeader.style.borderBottom =
        "1px solid var(--background-modifier-border)";

      const statusHeader = header.createEl("th", { text: "" });
      statusHeader.style.padding = "8px 12px";
      statusHeader.style.textAlign = "left";
      statusHeader.style.fontWeight = "600";
      statusHeader.style.borderBottom =
        "1px solid var(--background-modifier-border)";

      Object.entries(this.plugin.propertyTypes).forEach(
        ([property, type], index) => {
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
          typeSpan.style.backgroundColor = isBuiltIn
            ? "var(--background-modifier-border)"
            : "var(--interactive-accent)";
          typeSpan.style.color = isBuiltIn
            ? "var(--text-muted)"
            : "var(--text-on-accent)";
          typeSpan.style.padding = "2px 6px";
          typeSpan.style.borderRadius = "4px";
          typeSpan.style.fontSize = "var(--font-ui-smaller)";
          typeSpan.style.fontWeight = "500";

          // Status column
          const statusCell = row.createEl("td");
          statusCell.style.padding = "8px 12px";

          if (isBuiltIn) {
            const statusText = statusCell.createEl("span", {
              text: "not checked",
            });
            statusText.style.fontSize = "var(--font-ui-smaller)";
            statusText.style.color = "var(--text-muted)";
            statusText.style.fontStyle = "italic";
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
