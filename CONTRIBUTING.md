# Contributing

Bug reports, documentation improvements and focused pull requests are welcome.

## Report a bug

Open an issue with your VS Code version, file language, relevant Workspace TODOs settings, a minimal code sample, and the expected and actual behavior. For indexing problems, include the relevant message from **TODOs → … → Show Scan Details**.

## Development setup

Use Node.js 22 or newer and npm. CI uses Node.js 24.

```sh
git clone https://github.com/burakbagoglu/workspace-todos.git
cd workspace-todos
npm ci
npm test
npm run build
```

Open this folder in VS Code and press **F5** to launch an Extension Development Host with the sample workspace. Select **TODOs** in the Activity Bar. Use `npm run watch` when iterating on the extension.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/parser/` | Language-aware comment ranges and tag extraction |
| `src/indexer.ts` | Workspace discovery, dirty buffers and live file events |
| `src/core.ts` | File policy, revision guards, work queue and filtering |
| `src/gitignore.ts` | Cached hierarchical Gitignore rules per workspace root |
| `src/workflow.ts`, `src/commands.ts` | Validated, undoable tag edits and view commands |
| `src/explorer.ts`, `src/badges.ts` | Explorer decoration lifecycle and active tag counts |
| `src/tree.ts` | Native Tree View, grouping and result presentation |
| `src/decorations.ts`, `src/presentation.ts` | Editor highlights and multiline ranges |
| `src/settings.ts`, `src/config.ts` | Defaults and setting validation |
| `test/unit/` | Parser, highlight, filtering and indexing-state tests |
| `test/integration/` | Tests that run inside a VS Code extension host |
| `examples/` | Sample files used when debugging with F5 |

## Validation

Before opening a pull request, run:

```sh
npm test
npm run package
```

Packaging includes a type check and builds the extension bundle. The VSIX contains the bundle, user documentation, icons and license notices. Dependencies, test profiles, generated test output and local notes are excluded from version control.

For parser or indexing changes, cover the relevant behavior with tests. Keep comment detection language-aware: strings, regex literals, JSX text and Python docstrings must not produce tags. Keep `package.json` configuration defaults aligned with `src/settings.ts`.

## VS Code integration tests

These tests launch a separate VS Code process with a disposable profile and a two-folder workspace under `.test-runs/`. Use a locally installed VS Code:

```sh
npm run test:integration
```

On Windows the standard installation is detected automatically. Elsewhere, set `VSCODE_EXECUTABLE_PATH` to the application executable. To download the supported test version instead, use:

```sh
VSCODE_TEST_VERSION=1.95.3 npm run test:integration
```

PowerShell equivalent:

```powershell
$env:VSCODE_TEST_VERSION = '1.95.3'
npm run test:integration
```

Results are written to `test-results/integration.json`. GUI tests are separate from CI unit tests and require an available desktop session. When changing the view or highlight styles, also inspect light, dark and high contrast themes in the extension host.

For V2 manual checks, complete and reopen a multiline entry, undo the edit, toggle completed visibility, edit a nested `.gitignore` without saving, and confirm Explorer counts clear after completion or deletion. Also check `respectGitIgnore: false` and `explorerBadges: false`. A custom tag array must include an enabled DONE definition for completion.

## Pull requests

Describe the problem, resulting behavior and validation. Update the README, user guide and changelog when behavior or settings change. Keep generated VSIX files out of commits. Contributions are distributed under the project's [MIT license](LICENSE).
