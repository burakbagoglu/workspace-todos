import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeText, FilePolicy, filterRecords, RevisionStore, WorkQueue } from '../../src/core';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/settings';
import { DEFAULT_VIEW_STATE, FileRecord } from '../../src/model';

test('new edits, refreshes and deletions invalidate pending reads', () => {
  const store = new RevisionStore<string>();
  const old = store.begin('file:///src/a.ts');
  const edited = store.begin('file:///src/a.ts');
  assert.equal(store.commit(old, 'stale disk'), false);
  assert.equal(store.commit(edited, 'new buffer'), true);
  const pending = store.begin('file:///src/a.ts');
  store.removePrefix('file:///src');
  assert.equal(store.commit(pending, 'deleted'), false);
  assert.equal(store.values.size, 0);
  const beforeRefresh = store.begin('file:///src/a.ts');
  store.reset();
  store.begin('file:///src/a.ts');
  assert.equal(store.commit(beforeRefresh, 'previous scan'), false);
});

test('directory deletion respects URI path boundaries', () => {
  const store = new RevisionStore<string>();
  for (const path of ['file:///app/a.ts', 'file:///app/child/b.ts', 'file:///apple/a.ts']) store.commit(store.begin(path), path);
  store.removePrefix('file:///app');
  assert.deepEqual([...store.values.keys()], ['file:///apple/a.ts']);
});

test('work queue bounds concurrency and keeps draining after errors', async () => {
  const queue = new WorkQueue(3);
  let active = 0; let maximum = 0; let finished = 0;
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => queue.run(async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise<void>(resolve => setImmediate(resolve));
    active--; finished++;
    if (i === 2) throw new Error('expected');
  })));
  assert.equal(maximum, 3); assert.equal(finished, 20);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
});

test('file policy handles hidden files, root/nested excluded folders and include globs', () => {
  const policy = new FilePolicy(DEFAULT_SETTINGS);
  for (const file of ['src/app.ts', '.config/example.ts', 'app.ts']) assert.equal(policy.accepts(file), true, file);
  for (const file of ['node_modules/a.ts', '.git/index', 'src/node_modules/b.ts', 'dist/app.js', 'public/main.min.js', 'src/a.js.map']) assert.equal(policy.accepts(file), false, file);
  assert.equal(policy.excluded('node_modules'), true);
  const restricted = new FilePolicy({ ...DEFAULT_SETTINGS, include: ['src/**/*.ts'], exclude: ['**/generated/**'] });
  assert.equal(restricted.accepts('src/a.ts'), true);
  assert.equal(restricted.accepts('test/a.ts'), false);
  assert.equal(restricted.accepts('src/generated/a.ts'), false);
});

test('filters combine query, tag and active-file scope without mutating the index', () => {
  const match = { tag: 'TODO', description: 'Türkçe search', line: 0, character: 3, endCharacter: 7, highlightEndCharacter: 20 };
  const files: FileRecord[] = [
    { uri: 'a', path: 'src/a.ts', matches: [match, { ...match, tag: 'FIXME', description: 'Crash' }] },
    { uri: 'b', path: 'lib/b.py', matches: [match] }
  ];
  assert.equal(filterRecords(files, { ...DEFAULT_VIEW_STATE, tags: [] }).length, 0);
  assert.equal(filterRecords(files, { ...DEFAULT_VIEW_STATE, scope: 'file' }).length, 0);
  assert.deepEqual(filterRecords(files, { ...DEFAULT_VIEW_STATE, scope: 'file', query: 'CRASH', tags: ['FIXME'] }, 'a')[0].matches.map(item => item.tag), ['FIXME']);
  assert.equal(filterRecords(files, { ...DEFAULT_VIEW_STATE, query: 'lib/' })[0].uri, 'b');
  assert.equal(files[0].matches.length, 2);
});

test('invalid settings fall back safely and valid empty lists disable features', () => {
  const result = normalizeSettings({ tags: [{ name: '.*', color: 'red' }], maxFileSizeKB: NaN, highlightMode: 'oops', include: [42] });
  assert.ok(result.warnings.length >= 4);
  assert.equal(result.settings.tags[0].name, 'TODO');
  assert.equal(result.settings.maxFileSizeKB, 1024);
  const empty = normalizeSettings({ tags: [], include: [], exclude: [] });
  assert.deepEqual(empty.warnings, []);
  assert.deepEqual(empty.settings.tags, []);
  assert.deepEqual(empty.settings.include, []);
});

test('duplicate tags cannot create overlapping highlights', () => {
  const result = normalizeSettings({ tags: [{ name: 'TODO', color: '#FFFFFF' }, { name: 'todo', color: '#000000' }] });
  assert.equal(result.settings.tags.length, 1);
  assert.equal(result.warnings.length, 1);
});

test('comment-prefix preference defaults on, preserves false and rejects invalid types', () => {
  assert.equal(normalizeSettings({}).settings.highlightCommentPrefix, true);
  assert.equal(normalizeSettings({ highlightCommentPrefix: false }).settings.highlightCommentPrefix, false);
  const invalid = normalizeSettings({ highlightCommentPrefix: 'false' });
  assert.equal(invalid.settings.highlightCommentPrefix, true);
  assert.ok(invalid.warnings.some(warning => warning.includes('highlightCommentPrefix')));
});

test('text decoding supports UTF-8/UTF-16 BOM and rejects binary/invalid bytes', () => {
  assert.equal(decodeText(Buffer.from('Türkçe 😀')), 'Türkçe 😀');
  assert.equal(decodeText(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('// TODO', 'utf16le')])), '// TODO');
  assert.throws(() => decodeText(Buffer.from([0, 1, 2])), /Binary/);
  assert.throws(() => decodeText(Buffer.from([0xff, 0xff, 0xff])));
});
