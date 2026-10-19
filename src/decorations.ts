import * as vscode from 'vscode';
import { WorkspaceIndexer } from './indexer';
import { highlightSegments } from './presentation';

export class Decorations implements vscode.Disposable {
  private types = new Map<string, vscode.TextEditorDecorationType>();
  private subscriptions: vscode.Disposable[];
  constructor(private readonly indexer: WorkspaceIndexer) {
    this.subscriptions = [indexer.onDidChange(() => this.refresh()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.refresh())];
    this.configure();
  }
  configure() {
    for (const type of this.types.values()) type.dispose();
    this.types.clear();
    for (const tag of this.indexer.settings.tags.filter(tag => tag.enabled)) {
      const r = parseInt(tag.color.slice(1, 3), 16) / 255;
      const g = parseInt(tag.color.slice(3, 5), 16) / 255;
      const b = parseInt(tag.color.slice(5, 7), 16) / 255;
      const linear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      this.types.set(tag.name, vscode.window.createTextEditorDecorationType({
        backgroundColor: tag.color, color: luminance > 0.179 ? '#171717' : '#FFFFFF',
        fontWeight: '600', borderRadius: '3px', border: '1px solid', borderColor: tag.color,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        overviewRulerColor: tag.color, overviewRulerLane: vscode.OverviewRulerLane.Right
      }));
    }
    this.refresh();
  }
  ranges(uri: vscode.Uri, tag: string): vscode.Range[] {
    if (this.indexer.settings.highlightMode === 'off') return [];
    const file = this.indexer.record(uri);
    return (file?.matches ?? []).filter(match => match.tag === tag).flatMap(match =>
      highlightSegments(match, this.indexer.settings).map(segment => new vscode.Range(segment.line, segment.start, segment.line, segment.end)));
  }
  refresh() {
    for (const editor of vscode.window.visibleTextEditors) {
      for (const [tag, type] of this.types) editor.setDecorations(type, this.ranges(editor.document.uri, tag));
    }
  }
  dispose() { this.subscriptions.forEach(subscription => subscription.dispose()); for (const type of this.types.values()) type.dispose(); }
}
