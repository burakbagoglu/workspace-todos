import * as vscode from 'vscode';
import { posix } from 'node:path';
import { filterRecords } from './core';
import { FileRecord, TAG_COLOR_IDS, TAG_ICONS, TagMatch, ViewState } from './model';
import { WorkspaceIndexer } from './indexer';

export type TodoNode =
  | { kind: 'file'; file: FileRecord; tag?: string }
  | { kind: 'tag'; tag: string; files: FileRecord[] }
  | { kind: 'match'; file: FileRecord; match: TagMatch; groupTag?: string };

export class TodoTree implements vscode.TreeDataProvider<TodoNode>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<TodoNode | undefined>();
  readonly onDidChangeTreeData = this.changes.event;
  readonly view: vscode.TreeView<TodoNode>;
  private readonly subscriptions: vscode.Disposable[] = [];
  state: ViewState;

  constructor(readonly indexer: WorkspaceIndexer, private readonly workspaceState: vscode.Memento) {
    const saved = workspaceState.get<Partial<ViewState>>('viewState', {});
    this.state = {
      group: saved.group === 'tag' ? 'tag' : 'file', query: typeof saved.query === 'string' ? saved.query : '',
      tags: Array.isArray(saved.tags) && saved.tags.every(tag => typeof tag === 'string') ? saved.tags : null,
      scope: saved.scope === 'file' ? 'file' : 'workspace'
    };
    this.view = vscode.window.createTreeView('workspaceTodos.list', { treeDataProvider: this, showCollapseAll: true });
    this.subscriptions.push(this.view, indexer.onDidChange(() => this.refresh()),
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()));
    this.refresh();
  }
  get filtered(): FileRecord[] {
    const active = vscode.window.activeTextEditor?.document.uri;
    const activeFile = active && this.indexer.record(active);
    return filterRecords(this.indexer.records, this.state, activeFile?.uri);
  }
  async setState(patch: Partial<ViewState>) {
    this.state = { ...this.state, ...patch };
    this.refresh(); await this.workspaceState.update('viewState', this.state);
  }
  async clearFilters() { await this.setState({ query: '', tags: null, scope: 'workspace' }); }
  refresh() {
    const count = this.filtered.reduce((sum, file) => sum + file.matches.length, 0);
    const details = [this.state.scope === 'file' ? 'Active file' : 'Workspace'];
    if (this.state.query) details.push(`Search: ${this.state.query}`);
    if (this.state.tags !== null) details.push(this.state.tags.length ? this.state.tags.join(', ') : 'No tags selected');
    const skipped = this.indexer.skipped.length;
    if (skipped) details.push(`${skipped} skipped — see Scan Details`);
    if (this.indexer.discoveryError) details.push('Scan incomplete — see Scan Details');
    if (!(vscode.workspace.workspaceFolders?.length)) this.view.message = 'Open a folder or workspace to find comment tags.';
    else if (this.indexer.scanning) this.view.message = `Scanning… ${count} results · ${details.join(' · ')}`;
    else if (count === 0) {
      const total = this.indexer.records.some(file => file.matches.length);
      this.view.message = `${total ? 'No tags match the current filters.' : 'No comment tags found in supported files.'} · ${details.join(' · ')}`;
    } else this.view.message = `${count} ${count === 1 ? 'result' : 'results'} · ${details.join(' · ')}`;
    this.view.badge = { value: count, tooltip: `${count} matching comment tags` };
    this.changes.fire(undefined);
  }
  getChildren(node?: TodoNode): TodoNode[] {
    if (!node) {
      const files = this.filtered;
      if (this.state.group === 'file') return files.map(file => ({ kind: 'file', file }));
      return this.indexer.settings.tags.filter(tag => tag.enabled).flatMap(tag => {
        const matching = files.map(file => ({ ...file, matches: file.matches.filter(match => match.tag === tag.name) })).filter(file => file.matches.length);
        return matching.length ? [{ kind: 'tag' as const, tag: tag.name, files: matching }] : [];
      });
    }
    if (node.kind === 'tag') return node.files.map(file => ({ kind: 'file', file, tag: node.tag }));
    if (node.kind === 'file') return node.file.matches.map(match => ({ kind: 'match', file: node.file, match, groupTag: node.tag }));
    return [];
  }
  getTreeItem(node: TodoNode): vscode.TreeItem {
    if (node.kind === 'tag') {
      const item = new vscode.TreeItem(node.tag, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `tag:${node.tag}`;
      const count = node.files.reduce((sum, file) => sum + file.matches.length, 0);
      item.description = `${count} ${count === 1 ? 'tag' : 'tags'} · ${node.files.length} ${node.files.length === 1 ? 'file' : 'files'}`;
      item.iconPath = this.tagIcon(node.tag);
      item.tooltip = `${node.tag} — ${item.description}`;
      return item;
    }
    if (node.kind === 'file') {
      const item = new vscode.TreeItem(posix.basename(node.file.path), vscode.TreeItemCollapsibleState.Expanded);
      item.id = `file:${node.tag ?? ''}:${node.file.uri}`;
      item.resourceUri = vscode.Uri.parse(node.file.uri);
      item.iconPath = vscode.ThemeIcon.File;
      const count = node.file.matches.length;
      const directory = posix.dirname(node.file.path);
      item.description = `${count} ${count === 1 ? 'tag' : 'tags'}${directory === '.' ? '' : ` · ${directory}`}`;
      const summary = this.indexer.settings.tags.filter(tag => tag.enabled).flatMap(tag => {
        const total = node.file.matches.filter(match => match.tag === tag.name).length;
        return total ? [`${tag.name}: ${total}`] : [];
      });
      item.tooltip = `${node.file.path}\n${summary.join(' · ')}`;
      item.accessibilityInformation = { label: `${node.file.path}, ${count} comment tags` };
      return item;
    }
    const { file, match } = node;
    const lastLine = match.continuationLines?.at(-1)?.line ?? match.line;
    const location = lastLine > match.line ? `L${match.line + 1}–${lastLine + 1}` : `L${match.line + 1}`;
    const item = new vscode.TreeItem(`${match.tag} · ${location}`);
    item.id = `match:${node.groupTag ?? ''}:${file.uri}:${match.line}:${match.character}`;
    item.description = match.description.replace(/\s+/g, ' ').trim() || '(no description)';
    item.iconPath = this.tagIcon(match.tag);
    const tooltip = new vscode.MarkdownString().appendMarkdown(`**${match.tag.replace(/[_*]/g, '\\$&')}** · ${location}\n\n`);
    if (match.continuationLines?.length) tooltip.appendCodeblock(match.description, 'text');
    else tooltip.appendText(match.description || '(no description)');
    item.tooltip = tooltip.appendMarkdown('\n\n').appendCodeblock(`${file.path}:${match.line + 1}:${match.character + 1}`, 'text');
    item.command = { command: 'workspaceTodos.open', title: 'Open Tag', arguments: [file.uri, match] };
    item.accessibilityInformation = { label: `${match.tag}, ${match.description}, ${file.path}, ${location}` };
    return item;
  }
  private tagIcon(tag: string): vscode.ThemeIcon {
    const name = tag.toUpperCase();
    return new vscode.ThemeIcon(TAG_ICONS[name] ?? 'tag', new vscode.ThemeColor(TAG_COLOR_IDS[name] ?? 'workspaceTodos.customForeground'));
  }
  dispose() { this.subscriptions.forEach(subscription => subscription.dispose()); this.changes.dispose(); }
}
