import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitIgnorePolicy } from '../../src/gitignore';
import { badgeSummary } from '../../src/badges';
import { filterRecords } from '../../src/core';
import { DEFAULT_VIEW_STATE, Settings } from '../../src/model';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/settings';
import { Language } from '../../src/parser/comments';
import { parseTags } from '../../src/parser/tags';
import { tagReplacement } from '../../src/workflow';

const policy = (files: Record<string, string>) => new GitIgnorePolicy(async directory => files[directory], false);

test('gitignore handles root anchors, directory rules, wildcards and negation', async () => {
  const rules = policy({ '': '/root.ts\ncache/\n*.generated.ts\n!keep.generated.ts\n' });
  for (const file of ['root.ts', 'cache/a.ts', 'src/cache/a.ts', 'a.generated.ts']) assert.equal(await rules.ignored(file), true, file);
  for (const file of ['src/root.ts', 'keep.generated.ts', 'src/keep.generated.ts', 'cache.ts']) assert.equal(await rules.ignored(file), false, file);
});

test('nested rules override matching file rules and apply only in their own subtree', async () => {
  const rules = policy({ '': '*.ts', src: '!keep.ts\nlocal.py', 'src/deeper': '*.py\n!keep.py' });
  for (const file of ['other/keep.ts', 'src/other.ts', 'src/local.py', 'src/deeper/other.py']) assert.equal(await rules.ignored(file), true, file);
  for (const file of ['src/keep.ts', 'src/deeper/keep.ts', 'other/local.py', 'src/deeper/keep.py']) assert.equal(await rules.ignored(file), false, file);
});

test('an excluded parent cannot be re-included by a nested gitignore', async () => {
  const rules = policy({ '': 'private/\n!private/keep.ts', private: '!keep.ts' });
  assert.equal(await rules.ignored('private/keep.ts'), true);
  const traversable = policy({ '': 'private/*\n!private/open/\n', 'private/open': '!keep.ts' });
  assert.equal(await traversable.ignored('private/open/keep.ts'), false);
  assert.equal(await traversable.ignored('private/closed/keep.ts'), true);
});

test('nested negation does not undo an earlier excluded parent directory', async () => {
  const rules = policy({ '': 'src/build/', src: '!build/file.ts', 'src/build': '!file.ts' });
  assert.equal(await rules.ignored('src/build/file.ts'), true);
});

test('a directory unignored by nested rules keeps its descendants included', async () => {
  const rules = policy({ '': '*.cache/', src: '!folder.cache/' });
  assert.equal(await rules.ignored('src/folder.cache/file.ts'), false);
  assert.equal(await rules.ignored('src/other.cache/file.ts'), true);
  assert.equal(await rules.ignored('other/folder.cache/file.ts'), true);
});

test('nested anchors, recursive patterns and literal folder metacharacters remain scoped', async () => {
  const rules = policy({ src: '/root.ts\nchild/*.py\n**/generated.ts\n\\#literal.ts\ncache/   ', 'app[1]': 'local.ts' });
  for (const file of ['src/root.ts', 'src/child/a.py', 'src/deep/generated.ts', 'src/#literal.ts', 'app[1]/local.ts', 'src/deep/cache/a.ts']) {
    assert.equal(await rules.ignored(file), true, file);
  }
  for (const file of ['src/deep/root.ts', 'src/deep/child/a.py', 'other/generated.ts', 'app1/local.ts']) {
    assert.equal(await rules.ignored(file), false, file);
  }
});

test('gitignore supports escaped comment/negation names, spaces and CRLF', async () => {
  const rules = policy({ '': '# comment\r\n\\#file.ts\r\n\\!file.ts\r\nwith space.py\r\ntrailing.py   \r\n' });
  for (const file of ['#file.ts', '!file.ts', 'with space.py', 'trailing.py']) assert.equal(await rules.ignored(file), true, file);
  assert.equal(await rules.ignored('comment'), false);
});

test('ignore readers are shared across concurrent checks and stop at excluded directories', async () => {
  const reads: string[] = [];
  const rules = new GitIgnorePolicy(async directory => {
    reads.push(directory);
    await new Promise<void>(resolve => setImmediate(resolve));
    return directory === '' ? 'hidden/' : undefined;
  });
  await Promise.all(['src/a.ts', 'src/b.ts', 'hidden/a.ts'].map(file => rules.ignored(file)));
  assert.deepEqual(reads.sort(), ['', 'src']);
});

test('workspace roots and refreshed snapshots do not share cached rules', async () => {
  let content = 'old.ts';
  const old = new GitIgnorePolicy(async () => content);
  assert.equal(await old.ignored('old.ts'), true);
  content = 'new.ts';
  const refreshed = new GitIgnorePolicy(async () => content);
  assert.equal(await refreshed.ignored('old.ts'), false);
  assert.equal(await refreshed.ignored('new.ts'), true);
  assert.equal(await policy({}).ignored('new.ts'), false);
});

test('unreadable gitignore rules report failures instead of silently including files', async () => {
  const rules = new GitIgnorePolicy(async () => { throw new Error('permission denied'); });
  await assert.rejects(rules.ignored('src/a.ts'), /permission denied/);
});

for (const [language, text] of [
  ['python', '# TODO(burak): Türkçe 😀\r\n#     print(value)\r\nvalue = 1\r\n'],
  ['typescript', '// TODO(burak): Add search\n// and a filter\nconst value = 1;\n'],
  ['css', '/* TODO(burak): Mobile\n * preserve layout\n */'],
  ['html', '<!-- TODO(burak): Title\nkeep markup\n-->']
] as [Language, string][]) {
  test(`completion changes only the tag in a multiline ${language} comment`, () => {
    const match = parseTags(text, language, DEFAULT_SETTINGS)[0];
    const edit = tagReplacement(text, language, DEFAULT_SETTINGS, match, 'DONE');
    const lines = text.split('\n');
    lines[edit.line] = lines[edit.line].slice(0, edit.start) + edit.text + lines[edit.line].slice(edit.end);
    const changed = lines.join('\n');
    assert.equal(changed, text.replace('TODO', 'DONE'));
    const done = parseTags(changed, language, DEFAULT_SETTINGS)[0];
    assert.equal(done.tag, 'DONE');
    assert.equal(done.description, match.description);
    const reopen = tagReplacement(changed, language, DEFAULT_SETTINGS, done, 'FIXME');
    assert.equal(reopen.text, 'FIXME');
  });
}

test('completion rejects results moved, edited, disabled or replaced by string contents', () => {
  const text = '// TODO: Old description';
  const match = parseTags(text, 'typescript', DEFAULT_SETTINGS)[0];
  for (const changed of ['\n' + text, '// TODO: New description', '"// TODO: Old description"', '// DONE: Old description']) {
    assert.throws(() => tagReplacement(changed, 'typescript', DEFAULT_SETTINGS, match, 'DONE'), /result changed/);
  }
  const settings = { ...DEFAULT_SETTINGS, tags: DEFAULT_SETTINGS.tags.filter(tag => tag.name !== 'DONE') };
  assert.throws(() => tagReplacement(text, 'typescript', settings, match, 'DONE'), /Enable DONE/);
});

test('completing the second tag on a shared line preserves the first tag and its owner', () => {
  const text = '// TODO(alice): One FIXME(bob): Two';
  const match = parseTags(text, 'typescript', DEFAULT_SETTINGS)[1];
  const edit = tagReplacement(text, 'typescript', DEFAULT_SETTINGS, match, 'DONE');
  assert.equal(text.slice(0, edit.start) + edit.text + text.slice(edit.end), '// TODO(alice): One DONE(bob): Two');
});

test('DONE is hidden by default; show completed combines with search, tags and file scope', () => {
  const matches = parseTags('// TODO: Work\n// DONE: Finished', 'typescript', DEFAULT_SETTINGS);
  const files = [{ uri: 'a', path: 'a.ts', matches }];
  assert.deepEqual(filterRecords(files, DEFAULT_VIEW_STATE)[0].matches.map(match => match.tag), ['TODO']);
  assert.equal(filterRecords(files, { ...DEFAULT_VIEW_STATE, query: 'Finished' }).length, 0);
  assert.equal(filterRecords(files, { ...DEFAULT_VIEW_STATE, showCompleted: true, query: 'Finished', tags: ['DONE'], scope: 'file' }, 'a')[0].matches[0].tag, 'DONE');
  assert.equal(files[0].matches.length, 2);
});

test('Explorer badges exclude DONE, cap the label and choose the highest priority color', () => {
  const matches = parseTags('// INFO: Details\n// DONE: Finished\n// FIXME: Crash', 'typescript', DEFAULT_SETTINGS);
  assert.deepEqual(badgeSummary(matches), { badge: '2', tooltip: '2 active comment tags', color: 'workspaceTodos.fixmeForeground' });
  assert.equal(badgeSummary([matches[1]]), undefined);
  assert.equal(badgeSummary([]), undefined);
  assert.equal(badgeSummary(Array(12).fill(matches[0]))?.badge, '9+');
  assert.equal(badgeSummary([{ ...matches[0], tag: 'REVIEW' }])?.color, 'workspaceTodos.customForeground');
});

test('V2 preferences default on, preserve false and reject invalid values', () => {
  for (const key of ['respectGitIgnore', 'explorerBadges'] as (keyof Settings)[]) {
    assert.equal(normalizeSettings({}).settings[key], true);
    assert.equal(normalizeSettings({ [key]: false }).settings[key], false);
    const invalid = normalizeSettings({ [key]: 'false' });
    assert.equal(invalid.settings[key], true);
    assert.equal(invalid.warnings.length, 1);
  }
});
