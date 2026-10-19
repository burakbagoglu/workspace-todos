import * as vscode from 'vscode';
import { TodoNode, TodoTree } from './tree';
import { isCompleted, TagMatch } from './model';
import { languageFor } from './parser/comments';
import { tagReplacement } from './workflow';

export function registerCommands(tree: TodoTree, output: vscode.OutputChannel, extensionUri: vscode.Uri): vscode.Disposable[] {
  const register = (name: string, handler: (...args: any[]) => unknown) => vscode.commands.registerCommand(`workspaceTodos.${name}`, handler);
  const changeTag = async (node: TodoNode, target: string) => {
    try {
      const uri = vscode.Uri.parse(node.kind === 'match' ? node.file.uri : '');
      if (node.kind !== 'match' || !vscode.workspace.getWorkspaceFolder(uri) || !tree.indexer.record(uri)) return;
      if (vscode.workspace.fs.isWritableFileSystem(uri.scheme) === false) throw new Error('This file system is read-only.');
      const document = await vscode.workspace.openTextDocument(uri);
      const language = languageFor(uri.path, document.languageId);
      if (!language) return;
      const replacement = tagReplacement(document.getText(), language, tree.indexer.settings, node.match, target);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(replacement.line, replacement.start, replacement.line, replacement.end), replacement.text);
      if (!await vscode.workspace.applyEdit(edit)) throw new Error('VS Code could not apply the edit.');
      // Keep the buffer unsaved: completion remains a normal undoable edit.
      await tree.indexer.indexUri(uri);
    } catch (error) { void vscode.window.showWarningMessage(`Workspace TODOs: ${error instanceof Error ? error.message : error}`); }
  };
  return [
    register('complete', async (node?: TodoNode) => {
      if (node?.kind !== 'match' || isCompleted(node.match.tag)) return;
      const done = tree.indexer.settings.tags.find(tag => tag.enabled && isCompleted(tag.name));
      if (!done) { void vscode.window.showWarningMessage('Add an enabled DONE tag in Workspace TODOs: Tags to mark results completed.'); return; }
      await changeTag(node, done.name);
    }),
    register('reopen', async (node?: TodoNode) => {
      if (node?.kind !== 'match' || !isCompleted(node.match.tag)) return;
      const tags = tree.indexer.settings.tags.filter(tag => tag.enabled && !isCompleted(tag.name));
      if (!tags.length) { void vscode.window.showWarningMessage('Enable a tag other than DONE in Workspace TODOs: Tags to reopen this result.'); return; }
      const selected = await vscode.window.showQuickPick(tags.map(tag => ({ label: tag.name })),
        { title: 'Reopen completed tag as…', placeHolder: 'Choose the replacement tag' });
      if (selected) await changeTag(node, selected.label);
    }),
    register('showCompleted', () => tree.setState({ showCompleted: true })),
    register('hideCompleted', () => tree.setState({ showCompleted: false })),
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
