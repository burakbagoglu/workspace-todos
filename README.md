# Workspace TODOs

Highlight comment tags and browse them across your VS Code workspace.

English · [Türkçe](README.tr.md) · [Turkish user guide](KULLANIM_KILAVUZU.md) · [Contributing](CONTRIBUTING.md)

Workspace TODOs brings **TODO**, **FIXME**, **WARNING**, **INFO**, **NOTE** and **HACK** comments into a native Activity Bar view. Jump to the right line, filter by tag or text, and keep the results in sync with unsaved edits.

## Features

- **Workspace-wide indexing:** Includes closed files and multiple workspace folders.
- **Comment-aware matching:** Strings, regex literals, JSX text and Python docstrings do not become tasks.
- **Distinct highlights:** Per-tag editor colors, theme-aware sidebar icons and optional comment-prefix highlights.
- **Multiline entries:** Continue descriptions in adjacent comments and search their full text.
- **Native sidebar:** Group by file or tag, filter tags, search descriptions and paths, or focus on the active file.
- **Live updates:** Tracks edits, file creation, deletion and renaming. Unsaved edits are indexed after a short debounce.
- **Local processing:** No account, API key or server is required to use the extension.

## Installation

Requires **VS Code 1.95+**. Build a VSIX from source using **Node.js 22+** and npm:

```sh
git clone https://github.com/burakbagoglu/workspace-todos.git
cd workspace-todos
npm ci
npm run package
```

This creates `workspace-todos-<version>.vsix` in the project folder. In VS Code:

1. Open **Extensions** with **Ctrl+Shift+X**.
2. Select **… → Install from VSIX…** and choose the generated file.
3. Open a project folder and select **TODOs** in the Activity Bar.

You can also download the `workspace-todos-vsix` artifact from a successful [CI run](https://github.com/burakbagoglu/workspace-todos/actions/workflows/ci.yml), extract the ZIP and install its VSIX. GitHub may require you to sign in to download workflow artifacts.

The extension uses VS Code's existing sidebar behavior: **Ctrl+B** on Windows/Linux and **Cmd+B** on macOS. It does not override keybindings. Installing a newer VSIX updates the same extension; reload the window if VS Code requests it.

## Quick start

Add tags to comments in a supported file:

```typescript
// TODO: Add input validation
// FIXME: Handle an expired session
// WARNING: This operation writes to the database
// INFO: Results are served from the cache
// NOTE: Coordinates are measured in pixels
// HACK: Temporary workaround for a legacy driver
```

Click a result to open its file and select the tag. The sidebar shows the file name, result count, location and description. Hover over an entry to read its full description and path.

| Tag | Suggested use | Default editor color |
| --- | --- | --- |
| TODO | Work still to do | Yellow |
| FIXME | A bug to fix | Red |
| WARNING | A side effect or caution | Orange |
| INFO | Information about the code's behavior | Teal |
| NOTE | A developer note or reminder | Blue |
| HACK | A temporary workaround | Purple |

Tags match whole words. `TODO_COUNT` is not a tag. Matching is case-insensitive by default, and the colon is optional. An owner can be included, for example `// TODO(name): Add tests`; the extension does not assign tasks to that person.

## Multiline comments

Write the tag once and continue on following comment lines:

```python
# INFO: Preview the configuration
# config.create_file()
# model = config.get("CORE", "Model")
# print(model)
```

This becomes one entry with a line range such as **INFO · L1–4**. The tooltip preserves line breaks, and search includes continuation text.

To highlight the full entry, use:

```json
{
  "workspaceTodos.multiline": true,
  "workspaceTodos.highlightMode": "line",
  "workspaceTodos.highlightCommentPrefix": true
}
```

Multiline descriptions are enabled by default. Consecutive `#` or `//` comment markers must align. A blank line/comment, source code, different alignment or another configured tag ends the entry. Block comments (`/* ... */`, JSDoc and HTML `<!-- ... -->`) support continuation inside the same block; separate blocks are not merged. Untagged comments do not create entries by themselves.

## Sidebar commands

The toolbar contains **Search**, **Filter Tags** and **Refresh**. Additional commands are in the view's **…** menu and the Command Palette under **TODOs:**.

| Command | Action |
| --- | --- |
| Search | Plain-text search across tag names, descriptions and file paths |
| Filter Tags | Select one or more tags to display |
| Refresh | Rescan the workspace while preserving filters |
| Group By… | Group results by file or tag |
| Choose Scope… | Show the entire workspace or only the active file |
| Clear Filters | Clear search/tag filters and restore workspace scope |
| Collapse All | Collapse result groups |
| Settings | Open extension settings |
| Show Scan Details | Inspect skipped files and indexing errors |
| Usage Guide | Open the bundled Turkish user guide |

Filters combine and are remembered per workspace. They affect the sidebar, while editor highlights continue to show enabled tags. Deselecting every tag in **Filter Tags** hides all results.

## Configuration

Open **TODOs → … → Settings**, or search for **Workspace TODOs** in VS Code Settings.

| Setting | Default | Behavior |
| --- | --- | --- |
| `workspaceTodos.tags` | The six tags above | Define tag names, editor colors and enabled state |
| `workspaceTodos.include` | `["**/*"]` | Include globs relative to each workspace root |
| `workspaceTodos.exclude` | Dependency, build and generated-file globs | Exclude files from indexing and highlights |
| `workspaceTodos.caseSensitive` | `false` | Require exact tag casing when enabled |
| `workspaceTodos.highlightMode` | `"tag"` | `tag`, `line` (description and continuations), or `off` |
| `workspaceTodos.highlightCommentPrefix` | `true` | Also highlight `#`, `//`, `/*`, `<!--` or a JSDoc `*` on tag/continuation lines |
| `workspaceTodos.multiline` | `true` | Include adjacent comment lines in descriptions |
| `workspaceTodos.maxFileSizeKB` | `1024` | Skip files larger than the configured size in KiB |

Custom tag lists replace the defaults. Keep every tag you want to use in the array:

```json
{
  "workspaceTodos.tags": [
    { "name": "TODO", "color": "#E5C07B", "enabled": true },
    { "name": "FIXME", "color": "#F07178", "enabled": true },
    { "name": "WARNING", "color": "#F5A45D", "enabled": true },
    { "name": "INFO", "color": "#56D4C2", "enabled": true },
    { "name": "NOTE", "color": "#82AAFF", "enabled": true },
    { "name": "HACK", "color": "#C792EA", "enabled": true },
    { "name": "REVIEW", "color": "#A8D8A8", "enabled": true }
  ]
}
```

Tag names are literal text, not regular expressions. They must start with an ASCII letter, contain only letters, digits, `_` or `-`, and be at most 32 characters long. Colors use six-digit hex notation. Setting `enabled` to `false` removes that tag from both indexing and highlights.

Sidebar icon colors are independent of editor highlight colors. Customize them through `workbench.colorCustomizations` using `workspaceTodos.todoForeground`, `fixmeForeground`, `warningForeground`, `infoForeground`, `noteForeground`, `hackForeground` or `customForeground`, each with the `workspaceTodos.` prefix. Custom tags share the custom icon color.

## Supported languages and scope

JavaScript (`js`, `mjs`, `cjs`), TypeScript (`ts`, `mts`, `cts`), JSX, TSX, Python (`py`, `pyw`), CSS, SCSS, HTML (`html`, `htm`) and JSONC are supported. Open documents use the selected VS Code language mode.

Python f-string contents, HTML script/style/textarea/title contents, Markdown task lists, notebook cells and other languages are outside the current scope. Files are read as UTF-8 or BOM-marked UTF-16. Binary, unreadable and oversized files are skipped and reported in **Show Scan Details**.

The extension uses its own include/exclude rules. It does not import `.gitignore`, `files.exclude` or `search.exclude`. Custom exclude arrays replace the defaults, so retain the dependency/build exclusions you need. The same rules apply to open and closed files.

## Development

```sh
npm ci
npm test
npm run build
```

Open the repository in VS Code and press **F5** to start an Extension Development Host with `examples/`. `npm run watch` rebuilds during development. `npm run package` runs the type check and creates a VSIX.

Unit tests cover comment parsing, Unicode positions, multiline ranges, filtering, file exclusions and stale indexing results. `npm run test:integration` launches a separate VS Code process using a disposable profile; see [CONTRIBUTING.md](CONTRIBUTING.md) for runtime selection and prerequisites. CI runs unit tests and packages the VSIX on pushes and pull requests.

Bug reports and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Bundled dependency licenses are included in `THIRD_PARTY_NOTICES.txt` and in the VSIX.
