import * as vscode from 'vscode';
import { badgeSummary } from './badges';
import { uriKey, WorkspaceIndexer } from './indexer';

export class ExplorerBadges implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this.changes.event;
  private readonly subscriptions: vscode.Disposable[];
  private previous = new Map<string, { uri: vscode.Uri; signature: string }>();

  constructor(private readonly indexer: WorkspaceIndexer) {
    this.subscriptions = [vscode.window.registerFileDecorationProvider(this), indexer.onDidChange(() => this.refresh())];
    this.refresh();
  }
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (!this.indexer.settings.explorerBadges) return undefined;
    const summary = badgeSummary(this.indexer.record(uri)?.matches ?? []);
    if (!summary) return undefined;
    const decoration = new vscode.FileDecoration(summary.badge, summary.tooltip, new vscode.ThemeColor(summary.color));
    decoration.propagate = false;
    return decoration;
  }
  refresh() {
    const next = new Map<string, { uri: vscode.Uri; signature: string }>();
    if (this.indexer.settings.explorerBadges) for (const file of this.indexer.records) {
      const summary = badgeSummary(file.matches);
      if (!summary) continue;
      const uri = vscode.Uri.parse(file.uri);
      next.set(uriKey(uri), { uri, signature: JSON.stringify(summary) });
    }
    const changed: vscode.Uri[] = [];
    for (const [key, value] of next) if (this.previous.get(key)?.signature !== value.signature) changed.push(value.uri);
    for (const [key, value] of this.previous) if (!next.has(key)) changed.push(value.uri);
    this.previous = next;
    if (changed.length) this.changes.fire(changed);
  }
  dispose() { this.subscriptions.forEach(subscription => subscription.dispose()); this.changes.dispose(); }
}
