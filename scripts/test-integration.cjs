const fs = require('node:fs');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

(async () => {
  const project = path.resolve(__dirname, '..');
  const run = path.join(project, '.test-runs', String(Date.now()));
  const app = path.join(run, 'app');
  const library = path.join(run, 'library');
  fs.mkdirSync(path.join(app, 'node_modules'), { recursive: true });
  fs.mkdirSync(library, { recursive: true });
  fs.writeFileSync(path.join(app, 'main.ts'), 'const fake = "// FIXME: string";\n// TODO: Workspace araması\n// NOTE: Açıklama\n');
  fs.writeFileSync(path.join(app, 'node_modules', 'ignored.ts'), '// TODO: excluded\n');
  fs.writeFileSync(path.join(library, 'main.py'), 'fake = "# TODO: string"\n# WARNING: Library uyarısı\n');
  const workspace = path.join(run, 'test.code-workspace');
  fs.writeFileSync(workspace, JSON.stringify({ folders: [{ path: app, name: 'app' }, { path: library, name: 'library' }], settings: {
    'security.workspace.trust.enabled': false, 'workbench.startupEditor': 'none', 'window.restoreWindows': 'none', 'files.autoSave': 'off',
    'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'extensions.autoCheckUpdates': false, 'extensions.autoUpdate': false
  } }, null, 2));
  const candidates = [process.env.VSCODE_EXECUTABLE_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft VS Code', 'Code.exe'),
    ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean).map(directory => path.resolve(directory.replace(/^"|"$/g, ''), '..', 'Code.exe'))];
  const executable = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (!executable && !process.env.VSCODE_TEST_VERSION) throw new Error('Set VSCODE_EXECUTABLE_PATH or VSCODE_TEST_VERSION to run integration tests.');
  const result = await runTests({
    ...(process.env.VSCODE_TEST_VERSION ? { version: process.env.VSCODE_TEST_VERSION } : { vscodeExecutablePath: executable }),
    extensionDevelopmentPath: project,
    extensionTestsPath: path.join(project, 'build-test', 'test', 'integration', 'index.js'),
    launchArgs: [workspace, '--user-data-dir', path.join(run, 'profile'), '--extensions-dir', path.join(run, 'extensions'),
      '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--disable-gpu', '--new-window'],
    extensionTestsEnv: { WORKSPACE_TODOS_PROJECT: project }
  });
  if (typeof result === 'number' && result !== 0) process.exitCode = result;
})().catch(error => { console.error(error); process.exitCode = 1; });
