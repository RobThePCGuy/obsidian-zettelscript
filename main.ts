import { App, Modal, Notice, Platform, Plugin, PluginManifest, TextComponent, TFile, WorkspaceLeaf } from 'obsidian';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  ZettelScriptSettings,
  DEFAULT_SETTINGS,
  ZettelScriptSettingTab,
} from './settings';
import { SuggestionsView, VIEW_TYPE_SUGGESTIONS } from './view';
import type { FocusBundle, ApproveResponse, RejectResponse } from './types';

const execFileAsync = promisify(execFile);

export default class ZettelScriptPlugin extends Plugin {
  settings: ZettelScriptSettings = DEFAULT_SETTINGS;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private fileWatcherDebounce: ReturnType<typeof setTimeout> | null = null;
  private focusDebounce: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0; // For stale refresh handling
  private suggestionsView: SuggestionsView | null = null;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload() {
    await this.loadSettings();

    // Register the suggestions view
    this.registerView(
      VIEW_TYPE_SUGGESTIONS,
      (leaf) => {
        this.suggestionsView = new SuggestionsView(leaf, this);
        return this.suggestionsView;
      }
    );

    // Add settings tab
    this.addSettingTab(new ZettelScriptSettingTab(this.app, this));

    // Register commands
    this.registerCommands();

    // Setup auto-sync for indexing
    this.setupAutoSync();
    this.setupSyncInterval();

    // Setup active file change listener for suggestions panel
    this.setupActiveFileListener();

    // Add ribbon icon to open suggestions panel
    this.addRibbonIcon('links', 'Open ZettelScript Suggestions', () => {
      this.activateSuggestionsView();
    });

    // Add command to open suggestions panel
    this.addCommand({
      id: 'zettelscript-open-suggestions',
      name: 'Open suggestions panel',
      callback: () => this.activateSuggestionsView(),
    });

    // Add status bar item
    this.addStatusBarItem().setText('ZS: Ready');
  }

  onunload() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    if (this.fileWatcherDebounce) {
      clearTimeout(this.fileWatcherDebounce);
    }
    if (this.focusDebounce) {
      clearTimeout(this.focusDebounce);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async activateSuggestionsView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_SUGGESTIONS);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_SUGGESTIONS, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }

    // Refresh with current file
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.refreshFocusBundle(activeFile.path);
    }
  }

  private setupActiveFileListener() {
    // Listen for active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf) return;

        const view = leaf.view;
        if (view.getViewType() === 'markdown') {
          const file = this.app.workspace.getActiveFile();
          if (file) {
            // Debounce to 500ms per design Section 8.1
            if (this.focusDebounce) {
              clearTimeout(this.focusDebounce);
            }
            this.focusDebounce = setTimeout(() => {
              this.refreshFocusBundle(file.path);
            }, 500);
          }
        }
      })
    );
  }

  async refreshFocusBundle(filePath: string) {
    // Stale refresh handling per design Section 8.4
    const localId = ++this.requestId;

    const vaultPath = this.getVaultPath();
    if (!vaultPath) return;

    try {
      const result = await this.execZs(['focus', filePath, '--json-stdout']);

      // Only apply if still latest request
      if (localId === this.requestId) {
        const bundle: FocusBundle = JSON.parse(result);
        if (this.suggestionsView) {
          this.suggestionsView.setFocusBundle(bundle);
        }
      }
    } catch (error) {
      if (localId === this.requestId) {
        console.error('ZettelScript focus error:', error);
        if (this.suggestionsView) {
          this.suggestionsView.setFocusBundle(null);
        }
      }
    }
  }

  // Direct approve execution per design Section 8.2
  async handleApprove(suggestionId: string) {
    if (Platform.isMobile) {
      // Mobile: copy to clipboard (Atlas behavior)
      const command = `zs approve --suggestion-id ${suggestionId}`;
      await navigator.clipboard.writeText(command);
      new Notice('Command copied to clipboard');
      return;
    }

    // Desktop: direct execution
    try {
      const result = await this.execZs(['approve', '--suggestion-id', suggestionId, '--json']);
      const response: ApproveResponse = JSON.parse(result);

      if (response.success) {
        new Notice(`Linked to ${response.toTitle}`);

        if (response.writeback === 'failed') {
          new Notice(`Writeback warning: ${response.writebackReason}`, 5000);
        }

        // Refresh the bundle
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          this.refreshFocusBundle(activeFile.path);
        }
      } else {
        new Notice(`Approve failed: ${response.error}`);
      }
    } catch (error) {
      const err = error as Error;
      new Notice(`Error: ${err.message}`);
    }
  }

  // Direct reject execution per design Section 8.2
  async handleReject(suggestionId: string) {
    if (Platform.isMobile) {
      // Mobile: copy to clipboard (Atlas behavior)
      const command = `zs reject --suggestion-id ${suggestionId}`;
      await navigator.clipboard.writeText(command);
      new Notice('Command copied to clipboard');
      return;
    }

    // Desktop: direct execution
    try {
      const result = await this.execZs(['reject', '--suggestion-id', suggestionId, '--json']);
      const response: RejectResponse = JSON.parse(result);

      if (response.success) {
        new Notice(`Rejected suggestion for ${response.toTitle}`);

        // Refresh the bundle
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          this.refreshFocusBundle(activeFile.path);
        }
      } else {
        new Notice(`Reject failed: ${response.error}`);
      }
    } catch (error) {
      const err = error as Error;
      new Notice(`Error: ${err.message}`);
    }
  }

  private buildCommand(args: string[]): { command: string; args: string[] } {
    const cliParts = this.settings.cliPath.split(' ');
    if (this.settings.useWsl) {
      return { command: 'wsl', args: ['-e', ...cliParts, ...args] };
    }
    return { command: cliParts[0], args: [...cliParts.slice(1), ...args] };
  }

  private async execZs(args: string[]): Promise<string> {
    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      throw new Error('Could not determine vault path');
    }

    const { command, args: cmdArgs } = this.buildCommand(args);

    // WSL auto-translates the Windows CWD to /mnt/c/...
    const { stdout } = await execFileAsync(command, cmdArgs, {
      cwd: vaultPath,
      timeout: 120000,
      shell: true,
    });

    return stdout;
  }

  private registerCommands() {
    // Index vault
    this.addCommand({
      id: 'zettelscript-index',
      name: 'Index vault',
      callback: () => this.runCommand('index'),
    });

    // Run discovery
    this.addCommand({
      id: 'zettelscript-discover',
      name: 'Run discovery',
      callback: () => this.runCommand('discover'),
    });

    // Focus on current file
    this.addCommand({
      id: 'zettelscript-focus',
      name: 'Focus on current file',
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          this.refreshFocusBundle(file.path);
          this.activateSuggestionsView();
        } else {
          new Notice('No active file');
        }
      },
    });

    // Generate all
    this.addCommand({
      id: 'zettelscript-generate-all',
      name: 'Generate all notes',
      callback: () => this.runCommand('generate all'),
    });

    // Generate characters
    this.addCommand({
      id: 'zettelscript-generate-characters',
      name: 'Generate character notes',
      callback: () => this.runCommand('generate characters'),
    });

    // Generate chapters
    this.addCommand({
      id: 'zettelscript-generate-chapters',
      name: 'Generate chapter notes',
      callback: async () => {
        const manuscriptPath = await this.promptForPath('Enter manuscript path:');
        if (manuscriptPath) {
          this.runCommand(`generate chapters -m "${manuscriptPath}"`);
        }
      },
    });

    // Generate locations
    this.addCommand({
      id: 'zettelscript-generate-locations',
      name: 'Generate location notes',
      callback: () => this.runCommand('generate locations'),
    });

    // Generate objects
    this.addCommand({
      id: 'zettelscript-generate-objects',
      name: 'Generate object notes',
      callback: () => this.runCommand('generate objects'),
    });

    // Generate lore
    this.addCommand({
      id: 'zettelscript-generate-lore',
      name: 'Generate lore notes',
      callback: () => this.runCommand('generate lore'),
    });

    // Generate timeline
    this.addCommand({
      id: 'zettelscript-generate-timeline',
      name: 'Generate timeline notes',
      callback: () => this.runCommand('generate timeline'),
    });

    // Generate arcs
    this.addCommand({
      id: 'zettelscript-generate-arcs',
      name: 'Generate arc notes',
      callback: () => this.runCommand('generate arcs'),
    });

    // Inject links
    this.addCommand({
      id: 'zettelscript-inject-links',
      name: 'Inject wikilinks',
      callback: () => this.runCommand('inject-links'),
    });

    // Inject links (preview)
    this.addCommand({
      id: 'zettelscript-inject-links-preview',
      name: 'Preview link injection',
      callback: () => this.runCommand('inject-links --preview'),
    });

    // Validate
    this.addCommand({
      id: 'zettelscript-validate',
      name: 'Validate vault',
      callback: () => this.runCommand('validate'),
    });

    // Embed compute
    this.addCommand({
      id: 'zettelscript-embed-compute',
      name: 'Compute embeddings',
      callback: () => this.runCommand('embed compute'),
    });
  }

  setupAutoSync() {
    if (this.settings.autoSync) {
      this.registerEvent(
        this.app.vault.on('modify', () => {
          if (this.fileWatcherDebounce) {
            clearTimeout(this.fileWatcherDebounce);
          }
          this.fileWatcherDebounce = setTimeout(() => {
            this.runCommand('index', true);
          }, 5000);
        })
      );
    }
  }

  setupSyncInterval() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    if (this.settings.syncInterval > 0) {
      const ms = this.settings.syncInterval * 60 * 1000;
      this.syncIntervalId = setInterval(() => {
        this.runCommand('index', true);
      }, ms);
    }
  }

  private async runCommand(command: string, silent: boolean = false) {
    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      if (!silent) {
        new Notice('Could not determine vault path');
      }
      return;
    }

    const statusBar = this.addStatusBarItem();
    statusBar.setText('ZS: Running...');

    try {
      const { command: cmd, args: cmdArgs } = this.buildCommand(command.split(' '));

      const { stdout, stderr } = await execFileAsync(cmd, cmdArgs, {
        cwd: vaultPath,
        timeout: 120000,
        shell: true,
      });

      statusBar.setText('ZS: Ready');

      if (this.settings.showNotifications && !silent) {
        if (stdout) {
          new Notice(`ZettelScript: ${command} completed\n${this.truncate(stdout, 200)}`);
        }
      }

      if (stderr && !silent) {
        console.warn('ZettelScript stderr:', stderr);
      }
    } catch (error) {
      statusBar.setText('ZS: Error');

      if (!silent) {
        const err = error as Error;
        new Notice(`ZettelScript error: ${err.message}`);
        console.error('ZettelScript error:', error);
      }
    }
  }

  private getVaultPath(): string | null {
    const adapter = this.app.vault.adapter;
    if ('basePath' in adapter) {
      return (adapter as { basePath: string }).basePath;
    }
    return null;
  }

  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
  }

  private async promptForPath(message: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new PathPromptModal(this.app, message, (result) => {
        resolve(result);
      });
      modal.open();
    });
  }
}

class PathPromptModal extends Modal {
  private result: string = '';
  private onSubmit: (result: string | null) => void;
  private message: string;

  constructor(app: App, message: string, onSubmit: (result: string | null) => void) {
    super(app);
    this.message = message;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: this.message });

    const inputContainer = contentEl.createDiv();
    const input = new TextComponent(inputContainer);
    input.setPlaceholder('path/to/manuscript.md');
    input.onChange((value) => {
      this.result = value;
    });
    input.inputEl.style.width = '100%';

    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const submitBtn = buttonContainer.createEl('button', { text: 'Submit' });
    submitBtn.onclick = () => {
      this.close();
      this.onSubmit(this.result || null);
    };

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.onclick = () => {
      this.close();
      this.onSubmit(null);
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
