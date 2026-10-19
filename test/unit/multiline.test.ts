import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags } from '../../src/parser/tags';
import { Language } from '../../src/parser/comments';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/settings';
import { DEFAULT_VIEW_STATE, Settings } from '../../src/model';
import { highlightSegments } from '../../src/presentation';
import { filterRecords } from '../../src/core';

const parse = (text: string, language: Language = 'python', patch: Partial<Settings> = {}) => parseTags(text, language, { ...DEFAULT_SETTINGS, ...patch });
const highlighted = (text: string, index = 0, language: Language = 'python', prefix = true, mode: Settings['highlightMode'] = 'line') => {
  const lines = text.split('\n');
  return highlightSegments(parse(text, language)[index], { highlightMode: mode, highlightCommentPrefix: prefix })
    .map(segment => ({ line: segment.line, text: lines[segment.line].slice(segment.start, segment.end) }));
};

test('Python commented-out code follows the first tag as one entry', () => {
  const text = 'def main():\n    # INFO: Yapılandırma kontrolü\n    #ayarlar.create_config_file()\n    #test = ayarlar.get("CORE", "Model")\n    #print(test)\n    return None';
  const matches = parse(text);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].description, 'Yapılandırma kontrolü\nayarlar.create_config_file()\ntest = ayarlar.get("CORE", "Model")\nprint(test)');
  assert.equal(matches[0].line, 1);
  assert.equal(matches[0].character, 6);
  assert.deepEqual(matches[0].continuationLines?.map(line => line.line), [2, 3, 4]);
  assert.deepEqual(highlighted(text).map(line => line.text), [
    '# INFO: Yapılandırma kontrolü', '#ayarlar.create_config_file()', '#test = ayarlar.get("CORE", "Model")', '#print(test)'
  ]);
});

test('multiline is optional and tag/off modes do not paint continuation lines', () => {
  const text = '# TODO: first\n# second';
  const single = parse(text, 'python', { multiline: false })[0];
  assert.equal(single.description, 'first');
  assert.equal(single.continuationLines, undefined);
  assert.deepEqual(highlighted(text, 0, 'python', true, 'tag').map(line => line.text), ['# TODO']);
  assert.deepEqual(highlighted(text, 0, 'python', true, 'off'), []);
});

test('prefix toggle applies to every line without painting surrounding indentation', () => {
  const text = '    # TODO: first\n    # second';
  assert.deepEqual(highlighted(text, 0, 'python', false).map(line => line.text), ['TODO: first', 'second']);
  assert.deepEqual(highlighted(text).map(line => line.text), ['# TODO: first', '# second']);
});

test('empty first-line descriptions take text from subsequent comments and preserve code indentation', () => {
  const text = '# TODO:\n# for value in values:\n#     print(value)';
  assert.equal(parse(text)[0].description, 'for value in values:\n    print(value)');
});

for (const [name, text] of [
  ['blank source line', '# TODO: first\n\n# separate'],
  ['blank comment', '# TODO: first\n#\n# separate'],
  ['real code', '# TODO: first\nprint(1)\n# separate'],
  ['different indentation', '    # TODO: first\n# separate'],
  ['code with trailing comment', '# TODO: first\nprint(1) # separate'],
  ['docstring', '# TODO: first\n"""separate"""\n# separate']
]) test(`continuation stops at ${name}`, () => {
  assert.equal(parse(text)[0].description, 'first');
  assert.equal(parse(text)[0].continuationLines, undefined);
});

test('new tags start new multiline entries; only the last same-line tag owns following lines', () => {
  const matches = parse('# TODO: first FIXME: second\n# second detail\n# INFO: third\n# third detail');
  assert.deepEqual(matches.map(match => match.description), ['first', 'second\nsecond detail', 'third\nthird detail']);
  assert.equal(matches[0].continuationLines, undefined);
  assert.ok(matches[0].commentPrefix);
  assert.equal(matches[1].commentPrefix, undefined);
});

test('disabled tags end preceding entries and their text does not inherit highlights', () => {
  const tags = DEFAULT_SETTINGS.tags.map(tag => ({ ...tag, enabled: tag.name !== 'FIXME' }));
  const matches = parse('# TODO: first\n# FIXME: hidden\n# hidden detail', 'python', { tags });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].description, 'first');
  assert.equal(matches[0].continuationLines, undefined);
});

for (const language of ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'scss', 'jsonc'] as const) {
  test(`${language}: aligned // comments continue and stop before the next statement`, () => {
    const text = '// TODO: first\n// second\nconst value = 1;\n// separate';
    assert.equal(parse(text, language)[0].description, 'first\nsecond');
    assert.deepEqual(highlighted(text, 0, language).map(line => line.text), ['// TODO: first', '// second']);
  });
}

test('JSDoc continuations strip leaders and stop at new tags and closing delimiters', () => {
  const text = '/**\n * TODO: first\n * second\n * FIXME: third\n * fourth\n */\nconst value = 1;';
  const matches = parse(text, 'typescript');
  assert.deepEqual(matches.map(match => match.description), ['first\nsecond', 'third\nfourth']);
  assert.deepEqual(highlighted(text, 0, 'typescript').map(line => line.text), ['* TODO: first', '* second']);
  assert.deepEqual(highlighted(text, 1, 'typescript', false).map(line => line.text), ['FIXME: third', 'fourth']);
});

test('plain block comments and HTML comments preserve their boundaries', () => {
  const css = '/* INFO: first\nsecond\n*/\n/* separate */';
  assert.equal(parse(css, 'css')[0].description, 'first\nsecond');
  assert.deepEqual(highlighted(css, 0, 'css').map(line => line.text), ['/* INFO: first', 'second']);
  const html = '<!-- INFO: first\nsecond\n--><div>separate</div>';
  assert.equal(parse(html, 'html')[0].description, 'first\nsecond');
  assert.deepEqual(highlighted(html, 0, 'html').map(line => line.text), ['<!-- INFO: first', 'second']);
});

test('separate block comments and changes in comment syntax are not merged', () => {
  assert.equal(parse('/* TODO: first */\n/* separate */', 'typescript')[0].description, 'first');
  assert.equal(parse('// TODO: first\n/* separate */', 'typescript')[0].description, 'first');
});

test('CRLF and emoji keep navigation and every continuation range correct', () => {
  const text = '# 😀 INFO: çağrı\r\n# devam 😀\r\n# son\r\n';
  const match = parse(text)[0];
  assert.equal(match.character, '# 😀 '.length);
  assert.equal(match.description, 'çağrı\ndevam 😀\nson');
  assert.deepEqual(highlighted(text).map(line => line.text), ['#', 'INFO: çağrı', '# devam 😀', '# son']);
});

test('search matches continuation text and deleting the tag removes the whole entry', () => {
  const text = '# TODO: first\n# unique continuation';
  const records = [{ uri: 'file:///app.py', path: 'app.py', matches: parse(text) }];
  assert.equal(filterRecords(records, { ...DEFAULT_VIEW_STATE, query: 'UNIQUE' }).length, 1);
  assert.equal(parse('# heading\n# unique continuation').length, 0);
});

test('multiline preference defaults on and validates saved values', () => {
  assert.equal(normalizeSettings({}).settings.multiline, true);
  assert.equal(normalizeSettings({ multiline: false }).settings.multiline, false);
  const invalid = normalizeSettings({ multiline: 'false' });
  assert.equal(invalid.settings.multiline, true);
  assert.ok(invalid.warnings.some(warning => warning.includes('multiline')));
});
