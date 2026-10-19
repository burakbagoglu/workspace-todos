import * as vscode from 'vscode';
import { readSettings } from './config';
import { registerCommands } from './commands';
import { Decorations } from './decorations';
import { WorkspaceIndexer } from './indexer';
import { TodoTree } from './tree';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Workspace TODOs');
  const initial = readSettings(output);
  const indexer = new WorkspaceIndexer(initial.settings, output);
  const tree = new TodoTree(indexer, context.workspaceState);
  const decorations = new Decorations(indexer);
  context.subscriptions.push(output, indexer, tree, decorations, ...registerCommands(tree, output, context.extensionUri));
  if (initial.warnings.length) void vscode.window.showWarningMessage('Workspace TODOs: some settings are invalid. See Scan Details for the defaults used.');
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (!event.affectsConfiguration('workspaceTodos')) return;
    const next = readSettings(output);
    void indexer.configure(next.settings);
    decorations.configure();
    if (next.warnings.length) void vscode.window.showWarningMessage('Workspace TODOs: invalid settings. See Scan Details.');
  }));
  const ready = indexer.refresh();
  return { indexer, tree, decorations, ready };
}
