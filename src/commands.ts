import * as vscode from 'vscode';
import { TodoTree } from './tree';
import { TagMatch } from './model';

export function registerCommands(tree: TodoTree, output: vscode.OutputChannel, extensionUri: vscode.Uri): vscode.Disposable[] {
  const register = (name: string, handler: (...args: any[]) => unknown) => vscode.commands.registerCommand(`workspaceTodos.${name}`, handler);
  return [
    register('refresh', () => vscode.window.withProgress({ location: { viewId: 'workspaceTodos.list' } }, () => tree.indexer.refresh())),
    register('open', async (uri: string, match: TagMatch) => {
      if (typeof uri !== 'string' || !match || !Number.isInteger(match.line) || !Number.isInteger(match.character)) return;
      try {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
        const selection = new vscode.Range(match.line, match.character, match.line, match.endCharacter);
        const editor = await vscode.window.showTextDocument(document, { selection, preview: true });
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      } catch (error) { void vscode.window.showWarningMessage(`Could not open TODO: ${error instanceof Error ? error.message : error}`); }
    }),
    register('search', async () => {
      const query = await vscode.window.showInputBox({ title: 'Search workspace TODOs', prompt: 'Filter descriptions, tag names and file paths. Leave empty to clear.', value: tree.state.query });
      if (query !== undefined) await tree.setState({ query });
    }),
    register('filter', async () => {
      const selected = await vscode.window.showQuickPick(tree.indexer.settings.tags.filter(tag => tag.enabled).map(tag => ({
        label: tag.name, picked: tree.state.tags === null || tree.state.tags.includes(tag.name)
      })), { canPickMany: true, title: 'Filter tags', placeHolder: 'Choose tags to show' });
      if (selected !== undefined) {
        const all = tree.indexer.settings.tags.filter(tag => tag.enabled).length;
        await tree.setState({ tags: selected.length === all ? null : selected.map(tag => tag.label) });
      }
    }),
    register('clearFilters', () => tree.clearFilters()),
    register('group', async () => {
      const selected = await vscode.window.showQuickPick([
        { label: 'File', description: 'Group tags under their files', value: 'file' as const },
        { label: 'Tag', description: 'Group files under TODO, FIXME, …', value: 'tag' as const }
      ], { title: 'Group TODOs by', placeHolder: `Current: ${tree.state.group}` });
      if (selected) await tree.setState({ group: selected.value });
    }),
    register('scope', async () => {
      const selected = await vscode.window.showQuickPick([
        { label: 'Entire workspace', value: 'workspace' as const }, { label: 'Active file', value: 'file' as const }
      ], { title: 'TODOs scope' });
      if (selected) await tree.setState({ scope: selected.value });
    }),
    register('collapse', () => vscode.commands.executeCommand('workbench.actions.treeView.workspaceTodos.list.collapseAll')),
    register('settings', () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:burak-local.workspace-todos')),
    register('showOutput', () => output.show(true)),
    register('guide', async () => {
      const uri = vscode.Uri.joinPath(extensionUri, 'KULLANIM_KILAVUZU.md');
      try { await vscode.commands.executeCommand('markdown.showPreview', uri); }
      catch { await vscode.window.showTextDocument(uri, { preview: true }); }
    })
  ];
}
