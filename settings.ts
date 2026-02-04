import { App, PluginSettingTab, Setting } from 'obsidian';
import type ZettelScriptPlugin from './main';

export interface ZettelScriptSettings {
  /** Path to ZettelScript CLI or 'npx' to use npx */
  cliPath: string;
  /** Auto-sync on file change */
  autoSync: boolean;
  /** Sync interval in minutes (0 = disabled) */
  syncInterval: number;
  /** Path to KB directory */
  kbPath: string;
  /** Show notifications */
  showNotifications: boolean;
}

export const DEFAULT_SETTINGS: ZettelScriptSettings = {
  cliPath: 'npx zettelscript',
  autoSync: false,
  syncInterval: 0,
  kbPath: '.narrative-project/kb',
  showNotifications: true,
};

export class ZettelScriptSettingTab extends PluginSettingTab {
  plugin: ZettelScriptPlugin;

  constructor(app: App, plugin: ZettelScriptPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'ZettelScript Settings' });

    // CLI Path
    new Setting(containerEl)
      .setName('CLI Path')
      .setDesc('Path to ZettelScript CLI. Use "npx zettelscript" to run via npx.')
      .addText((text) =>
        text
          .setPlaceholder('npx zettelscript')
          .setValue(this.plugin.settings.cliPath)
          .onChange(async (value) => {
            this.plugin.settings.cliPath = value;
            await this.plugin.saveSettings();
          })
      );

    // KB Path
    new Setting(containerEl)
      .setName('Knowledge Base Path')
      .setDesc('Relative path to KB directory from vault root.')
      .addText((text) =>
        text
          .setPlaceholder('.narrative-project/kb')
          .setValue(this.plugin.settings.kbPath)
          .onChange(async (value) => {
            this.plugin.settings.kbPath = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl('h3', { text: 'Auto-Sync' });

    // Auto-sync
    new Setting(containerEl)
      .setName('Auto-sync on file change')
      .setDesc('Automatically run index when files are modified.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
          this.plugin.setupAutoSync();
        })
      );

    // Sync interval
    new Setting(containerEl)
      .setName('Sync interval (minutes)')
      .setDesc('Periodically run index. Set to 0 to disable.')
      .addSlider((slider) =>
        slider
          .setLimits(0, 60, 5)
          .setValue(this.plugin.settings.syncInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.syncInterval = value;
            await this.plugin.saveSettings();
            this.plugin.setupSyncInterval();
          })
      );

    containerEl.createEl('h3', { text: 'Notifications' });

    // Show notifications
    new Setting(containerEl)
      .setName('Show notifications')
      .setDesc('Display notifications when commands complete.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showNotifications).onChange(async (value) => {
          this.plugin.settings.showNotifications = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
