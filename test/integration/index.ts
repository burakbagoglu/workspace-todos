import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { activate } from '../../src/extension';

type Api = ReturnType<typeof activate>;
const waitFor = async (predicate: () => boolean, message: string, timeout = 10000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error(`Timed out: ${message}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

export async function run(): Promise<void> {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const extension = vscode.extensions.getExtension<Api>('burak-local.workspace-todos');
  assert.ok(extension);
  const api = await extension.activate();
  await api.ready;
  const folders = vscode.workspace.workspaceFolders!;
  assert.equal(folders.length, 2);
  const app = folders[0].uri;
  const library = folders[1].uri;
  const main = vscode.Uri.joinPath(app, 'main.ts');
  const record = (uri: vscode.Uri) => api.indexer.record(uri);
  const check = async (name: string, action: () => Promise<void>) => {
    try { await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
    catch (error) { const message = error instanceof Error ? error.stack ?? error.message : String(error); results.push({ name, passed: false, error: message }); console.error(`FAIL ${name}\n${message}`); }
  };

  await check('closed workspace files and multiple roots are indexed without string false positives', async () => {
    assert.deepEqual(record(main)?.matches.map(match => match.tag), ['TODO', 'NOTE']);
    assert.deepEqual(record(vscode.Uri.joinPath(library, 'main.py'))?.matches.map(match => match.tag), ['WARNING']);
    assert.equal(record(main)?.path, 'app/main.ts');
    assert.equal(record(vscode.Uri.joinPath(app, 'node_modules', 'ignored.ts')), undefined);
  });

  await check('Activity Bar view opens and all commands are registered', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.workspaceTodos');
    await vscode.commands.executeCommand('workspaceTodos.list.focus');
    await waitFor(() => api.tree.view.visible, 'TODOs view visible');
    const commands = await vscode.commands.getCommands(true);
    for (const command of ['refresh', 'search', 'filter', 'group', 'scope', 'open', 'clearFilters', 'settings', 'guide', 'complete', 'reopen', 'showCompleted', 'hideCompleted']) assert.ok(commands.includes(`workspaceTodos.${command}`));
    assert.equal(api.tree.getChildren().length, 2);
  });

  await check('selecting a result opens the exact tag and editor decorations use the same locations', async () => {
    const file = record(main)!;
    await vscode.commands.executeCommand('workspaceTodos.open', file.uri, file.matches[0]);
    const editor = vscode.window.activeTextEditor!;
    assert.equal(editor.document.uri.toString(), main.toString());
    assert.equal(editor.document.getText(editor.selection), 'TODO');
    assert.equal(api.decorations.ranges(main, 'TODO').length, 1);
    assert.equal(api.decorations.ranges(main, 'FIXME').length, 0);
  });

  await check('unsaved edits update the index, positions and decorations', async () => {
    const document = await vscode.workspace.openTextDocument(main);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(main, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), '\n// 😀 Türkçe FIXME: Kaydetmeden\n');
    assert.ok(await vscode.workspace.applyEdit(edit));
    await waitFor(() => record(main)?.matches.length === 1 && record(main)?.matches[0].tag === 'FIXME', 'dirty buffer indexed');
    assert.equal(document.isDirty, true);
    assert.equal(record(main)!.matches[0].line, 1);
    assert.equal(record(main)!.matches[0].character, '// 😀 Türkçe '.length);
    assert.equal(api.decorations.ranges(main, 'TODO').length, 0);
    assert.deepEqual(api.decorations.ranges(main, 'FIXME').map(range => document.getText(range)), ['//', 'FIXME']);
    await fs.writeFile(main.fsPath, '// TODO: older disk content\n');
    await api.indexer.refresh();
    assert.equal(record(main)!.matches[0].description, 'Kaydetmeden');
  });

  await check('search, tag filters, scope and both groupings combine correctly', async () => {
    await api.tree.setState({ scope: 'file', tags: ['FIXME'], query: 'KAYDETMEDEN', group: 'tag' });
    assert.equal(api.tree.filtered.length, 1);
    assert.equal(api.tree.getChildren()[0].kind, 'tag');
    await api.tree.setState({ tags: ['TODO'] });
    assert.equal(api.tree.filtered.length, 0);
    await vscode.commands.executeCommand('workspaceTodos.clearFilters');
    await api.tree.setState({ group: 'file' });
    assert.equal(api.tree.filtered.length, 2);
  });

  await check('excluded open documents stay excluded and language changes remove stale highlights', async () => {
    const excluded = vscode.Uri.joinPath(app, 'node_modules', 'ignored.ts');
    await vscode.workspace.openTextDocument(excluded);
    await api.indexer.indexUri(excluded);
    assert.equal(record(excluded), undefined);
    assert.equal(api.decorations.ranges(excluded, 'TODO').length, 0);
    let document = await vscode.workspace.openTextDocument(main);
    document = await vscode.languages.setTextDocumentLanguage(document, 'plaintext');
    await waitFor(() => record(main) === undefined, 'unsupported language removed');
    await vscode.languages.setTextDocumentLanguage(document, 'typescript');
    await waitFor(() => record(main)?.matches[0]?.tag === 'FIXME', 'language restored');
  });

  await check('external creation, folder rename and deletion update the real file watcher', async () => {
    const folder = vscode.Uri.joinPath(app, 'feature');
    const source = vscode.Uri.joinPath(folder, 'new.ts');
    await fs.mkdir(folder.fsPath, { recursive: true });
    await fs.writeFile(source.fsPath, '// HACK: Watcher test\n');
    await waitFor(() => record(source)?.matches[0]?.tag === 'HACK', 'external file creation');
    const renamed = vscode.Uri.joinPath(app, 'feature-renamed');
    const target = vscode.Uri.joinPath(renamed, 'new.ts');
    const edit = new vscode.WorkspaceEdit();
    edit.renameFile(folder, renamed);
    assert.ok(await vscode.workspace.applyEdit(edit));
    await waitFor(() => record(source) === undefined && record(target)?.matches[0]?.tag === 'HACK', 'directory rename');
    await fs.unlink(target.fsPath);
    await waitFor(() => record(target) === undefined, 'external file deletion');
  });

  await check('size limits report skipped files while the rest of the workspace remains visible', async () => {
    const config = vscode.workspace.getConfiguration('workspaceTodos');
    await config.update('maxFileSizeKB', 1, vscode.ConfigurationTarget.Workspace);
    const big = vscode.Uri.joinPath(library, 'large.py');
    await fs.writeFile(big.fsPath, '# TODO: too large\n' + '#'.repeat(2048));
    await waitFor(() => api.indexer.skipped.some(item => item.path.endsWith('large.py')), 'oversized file reported');
    assert.ok(api.indexer.records.some(file => file.matches.length > 0));
    await config.update('maxFileSizeKB', 1024, vscode.ConfigurationTarget.Workspace);
    await waitFor(() => record(big)?.matches[0]?.tag === 'TODO', 'size limit restored');
    await fs.unlink(big.fsPath);
    await waitFor(() => record(big) === undefined, 'large test file removed');
  });

  await check('refresh command preserves view filters and Ctrl+B remains the built-in sidebar toggle', async () => {
    await api.tree.setState({ tags: ['WARNING'], query: 'Library' });
    await vscode.commands.executeCommand('workspaceTodos.refresh');
    assert.deepEqual(api.tree.state.tags, ['WARNING']);
    assert.equal(api.tree.state.query, 'Library');
    assert.equal(api.tree.filtered.length, 1);
    const manifest = extension.packageJSON;
    assert.equal(manifest.contributes.keybindings, undefined);
    await api.tree.clearFilters();
    await vscode.commands.executeCommand('workbench.view.extension.workspaceTodos');
    await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
    await waitFor(() => !api.tree.view.visible, 'Ctrl+B sidebar hidden');
    await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
    await waitFor(() => api.tree.view.visible, 'Ctrl+B sidebar shown');
  });

  await check('V2 completion preserves multiline text, supports undo and updates Explorer counts', async () => {
    const uri = vscode.Uri.joinPath(app, 'v2-completion.ts');
    const original = '// TODO(burak): First line\n// continuation\n';
    await fs.writeFile(uri.fsPath, original);
    await api.indexer.refresh();
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    assert.equal(api.explorer.provideFileDecoration(uri)?.badge, '1');
    const file = record(uri)!;
    const node = { kind: 'match', file, match: file.matches[0] };
    await vscode.commands.executeCommand('workspaceTodos.complete', node);
    assert.equal(document.getText(), original.replace('TODO', 'DONE'));
    assert.equal(document.isDirty, true);
    assert.equal(await fs.readFile(uri.fsPath, 'utf8'), original);
    assert.equal(api.explorer.provideFileDecoration(uri), undefined);
    await vscode.commands.executeCommand('workspaceTodos.hideCompleted');
    assert.equal(api.tree.filtered.some(file => file.uri === uri.toString()), false);
    await vscode.commands.executeCommand('workspaceTodos.showCompleted');
    assert.equal(api.tree.filtered.some(file => file.uri === uri.toString()), true);
    await vscode.commands.executeCommand('undo');
    await waitFor(() => record(uri)?.matches[0]?.tag === 'TODO', 'completion undone');
    assert.equal(document.getText(), original);
    assert.equal(api.explorer.provideFileDecoration(uri)?.badge, '1');
    await vscode.commands.executeCommand('workspaceTodos.hideCompleted');
  });

  await check('V2 live nested gitignore rules affect open files and can be disabled', async () => {
    const directory = vscode.Uri.joinPath(app, 'v2-ignore');
    const uri = vscode.Uri.joinPath(directory, 'hidden.ts');
    const ignoreUri = vscode.Uri.joinPath(directory, '.gitignore');
    await fs.mkdir(directory.fsPath, { recursive: true });
    await fs.writeFile(uri.fsPath, '// FIXME: Hidden by nested rule\n');
    await fs.writeFile(ignoreUri.fsPath, 'hidden.ts\n');
    await vscode.workspace.openTextDocument(uri);
    await api.indexer.refresh();
    assert.equal(record(uri), undefined);
    assert.equal(api.decorations.ranges(uri, 'FIXME').length, 0);
    assert.equal(api.explorer.provideFileDecoration(uri), undefined);
    const rules = await vscode.workspace.openTextDocument(ignoreUri);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(ignoreUri, rules.positionAt(rules.getText().length), '!hidden.ts\n');
    assert.ok(await vscode.workspace.applyEdit(edit));
    await waitFor(() => record(uri)?.matches[0]?.tag === 'FIXME', 'dirty ignore exception applied');
    assert.equal(rules.isDirty, true);
    await vscode.commands.executeCommand('workspaceTodos.refresh');
    assert.equal(record(uri)?.matches[0]?.tag, 'FIXME');
    await vscode.window.showTextDocument(rules);
    await vscode.commands.executeCommand('undo');
    await waitFor(() => record(uri) === undefined, 'ignore edit undone');
    const config = vscode.workspace.getConfiguration('workspaceTodos');
    try {
      await config.update('respectGitIgnore', false, vscode.ConfigurationTarget.Workspace);
      await waitFor(() => record(uri)?.matches[0]?.tag === 'FIXME', 'ignore rules disabled');
      await config.update('explorerBadges', false, vscode.ConfigurationTarget.Workspace);
      await waitFor(() => api.indexer.settings.explorerBadges === false, 'Explorer badges disabled');
      assert.equal(api.explorer.provideFileDecoration(uri), undefined);
    } finally {
      await config.update('respectGitIgnore', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('explorerBadges', undefined, vscode.ConfigurationTarget.Workspace);
    }
  });

  const project = process.env.WORKSPACE_TODOS_PROJECT!;
  await fs.mkdir(path.join(project, 'test-results'), { recursive: true });
  await fs.writeFile(path.join(project, 'test-results', 'integration.json'), JSON.stringify({ vscode: vscode.version, results }, null, 2));
  const failures = results.filter(result => !result.passed);
  if (failures.length) throw new Error(`${failures.length} integration tests failed`);
}
