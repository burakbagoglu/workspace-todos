# Changelog

## 0.2.0

- Respect workspace and nested `.gitignore` rules by default, including negation and live rule updates. New `workspaceTodos.respectGitIgnore` setting.
- New green DONE tag; mark results completed with an undoable tag-only edit that preserves multiline descriptions and owners.
- Show/hide completed entries per workspace and reopen completed entries as a chosen tag. Re-validate results against the live document before editing.
- Explorer file badges count active tags, exclude DONE entries and clear when files are deleted or no longer eligible. New `workspaceTodos.explorerBadges` setting.
- Updated English/Turkish READMEs, bundled Turkish guide and sample comments for V2.

## 0.1.3

- Multiline tag descriptions in aligned # / // comments and block comments, enabled by default.
- Line highlights include continuation lines and respect the comment-prefix setting.
- Multiline results display line ranges and complete descriptions in tooltips; search includes continuation text.
- New workspaceTodos.multiline setting and updated Turkish guide.

## 0.1.2

- INFO tag with teal editor highlights and a theme-aware information icon.
- Separate note icon for NOTE tags.
- Turkish usage guide bundled with the extension, available through TODOs: Usage Guide and the view menu.

## 0.1.1

- Colored tag icons with separate palettes for light, dark and high contrast themes.
- Compact file labels with muted folder paths and explicit tag counts.
- Distinct tag/line labels, muted descriptions and expanded result tooltips.
- Optional comment-prefix highlights for #, //, /*, <!-- and JSDoc * leaders (enabled by default).

## 0.1.0

- TODOs Activity Bar view with workspace-wide comment tag search.
- TODO, FIXME, WARNING, NOTE and HACK highlights and custom tag settings.
- Live indexing of unsaved edits, multi-root workspaces and file changes.
- File/tag grouping, text and tag filters, active-file scope and jump to line.
