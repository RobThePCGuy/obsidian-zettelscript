import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type ZettelScriptPlugin from './main';
import type { FocusBundle, CandidateLink, RelatedNote, OrphanEntry } from './types';

export const VIEW_TYPE_SUGGESTIONS = 'zettelscript-suggestions';

export class SuggestionsView extends ItemView {
  plugin: ZettelScriptPlugin;
  private focusBundle: FocusBundle | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ZettelScriptPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_SUGGESTIONS;
  }

  getDisplayText(): string {
    return 'ZettelScript Suggestions';
  }

  getIcon(): string {
    return 'links';
  }

  async onOpen() {
    this.renderEmptyState('Open a note to see suggestions');
  }

  async onClose() {
    // Cleanup
  }

  setFocusBundle(bundle: FocusBundle | null) {
    this.focusBundle = bundle;
    this.render();
  }

  private render() {
    const container = this.containerEl.children[1];
    container.empty();

    if (!this.focusBundle) {
      this.renderEmptyState('No focus data available');
      return;
    }

    const { suggestions, health, meta } = this.focusBundle;

    // Header with focus node title
    const header = container.createEl('div', { cls: 'zs-header' });
    header.createEl('h4', { text: meta.scope.focusNodeTitle });

    // Health indicator
    const healthBadge = header.createEl('span', {
      cls: `zs-health-badge zs-health-${health.level}`,
      text: health.level.toUpperCase()
    });

    // Related Notes section
    this.renderSection(
      container,
      'Related Notes',
      suggestions.relatedNotes,
      suggestions.relatedNotes.length,
      (note: RelatedNote) => this.renderRelatedNote(note),
      this.getRelatedEmptyState(health)
    );

    // Candidate Links section
    this.renderSection(
      container,
      'Suggested Links',
      suggestions.candidateLinks,
      suggestions.candidateLinks.length,
      (link: CandidateLink) => this.renderCandidateLink(link),
      'No link suggestions for this view.'
    );

    // Orphans section
    this.renderSection(
      container,
      'Orphans',
      suggestions.orphans,
      suggestions.orphans.length,
      (orphan: OrphanEntry) => this.renderOrphan(orphan),
      'No orphans detected. Your notes are well-connected!'
    );
  }

  private renderSection<T>(
    container: Element,
    title: string,
    items: T[],
    count: number,
    renderItem: (item: T) => HTMLElement,
    emptyMessage: string
  ) {
    const section = container.createEl('div', { cls: 'zs-section' });

    const sectionHeader = section.createEl('div', { cls: 'zs-section-header' });
    sectionHeader.createEl('h5', { text: `${title} (${count})` });

    if (items.length === 0) {
      section.createEl('div', { cls: 'zs-empty-state', text: emptyMessage });
      return;
    }

    const list = section.createEl('div', { cls: 'zs-list' });
    for (const item of items) {
      const el = renderItem.call(this, item);
      list.appendChild(el);
    }
  }

  private renderRelatedNote(note: RelatedNote): HTMLElement {
    const row = createEl('div', { cls: 'zs-row zs-related-row' });

    const info = row.createEl('div', { cls: 'zs-row-info' });
    const titleEl = info.createEl('span', { cls: 'zs-row-title', text: note.title });

    if (note.path) {
      titleEl.onclick = () => this.openFile(note.path!);
      titleEl.addClass('zs-clickable');
    }

    const score = row.createEl('span', {
      cls: 'zs-score',
      text: `${Math.round(note.score * 100)}%`
    });

    // Tooltip with reasons
    if (note.reasons.length > 0) {
      row.setAttribute('aria-label', note.reasons.join('\n'));
      row.addClass('has-tooltip');
    }

    return row;
  }

  private renderCandidateLink(link: CandidateLink): HTMLElement {
    const row = createEl('div', { cls: 'zs-row zs-candidate-row' });

    const info = row.createEl('div', { cls: 'zs-row-info' });

    // From -> To display
    const linkText = info.createEl('span', { cls: 'zs-link-text' });
    linkText.createEl('span', { text: link.fromTitle, cls: 'zs-from-title' });
    linkText.createEl('span', { text: ' → ', cls: 'zs-arrow' });
    const toSpan = linkText.createEl('span', { text: link.toTitle, cls: 'zs-to-title' });

    if (link.isGhostTarget) {
      toSpan.addClass('zs-ghost');
      toSpan.setAttribute('aria-label', 'Ghost node (file does not exist)');
    }

    // Reasons on hover
    if (link.reasons.length > 0) {
      row.setAttribute('aria-label', link.reasons.join('\n'));
    }

    // Action buttons
    const actions = row.createEl('div', { cls: 'zs-actions' });

    const approveBtn = actions.createEl('button', { cls: 'zs-btn zs-btn-approve' });
    setIcon(approveBtn, 'check');
    approveBtn.setAttribute('aria-label', 'Approve link');
    approveBtn.onclick = (e) => {
      e.stopPropagation();
      this.plugin.handleApprove(link.suggestionId);
    };

    const rejectBtn = actions.createEl('button', { cls: 'zs-btn zs-btn-reject' });
    setIcon(rejectBtn, 'x');
    rejectBtn.setAttribute('aria-label', 'Reject link');
    rejectBtn.onclick = (e) => {
      e.stopPropagation();
      this.plugin.handleReject(link.suggestionId);
    };

    return row;
  }

  private renderOrphan(orphan: OrphanEntry): HTMLElement {
    const row = createEl('div', { cls: 'zs-row zs-orphan-row' });

    const warningIcon = row.createEl('span', { cls: 'zs-warning-icon' });
    setIcon(warningIcon, 'alert-triangle');

    const info = row.createEl('div', { cls: 'zs-row-info' });
    const titleEl = info.createEl('span', { cls: 'zs-row-title', text: orphan.title });

    if (orphan.path) {
      titleEl.onclick = () => this.openFile(orphan.path!);
      titleEl.addClass('zs-clickable');
    }

    const score = row.createEl('span', {
      cls: 'zs-orphan-score',
      text: `${Math.round(orphan.orphanScore * 100)}%`
    });

    if (orphan.reasons.length > 0) {
      row.setAttribute('aria-label', orphan.reasons.join('\n'));
    }

    return row;
  }

  private renderEmptyState(message: string) {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl('div', { cls: 'zs-empty-state zs-centered', text: message });
  }

  private getRelatedEmptyState(health: FocusBundle['health']): string {
    if (health.embeddings.level === 'fail') {
      return 'Embeddings incomplete. Run: zs embed compute';
    }
    if (health.embeddings.coverageInView < 50) {
      return `Embeddings ${health.embeddings.coverageInView}% complete. Run: zs embed compute`;
    }
    return 'No related notes found for this view.';
  }

  private async openFile(path: string) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) {
      await this.app.workspace.openLinkText(path, '', false);
    }
  }
}
