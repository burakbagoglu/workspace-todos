import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags } from '../../src/parser/tags';
import { Language, languageFor } from '../../src/parser/comments';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { Settings } from '../../src/model';
import { highlightCharacters } from '../../src/presentation';

const parse = (text: string, language: Language = 'typescript', patch: Partial<Settings> = {}) => parseTags(text, language, { ...DEFAULT_SETTINGS, ...patch });

test('line, block, JSDoc, owner and multiple tags keep descriptions and positions', () => {
  const text = '// TODO(burak): Arama ekle FIXME: Boş liste\n/* WARNING: Veri yazar */\n/**\n * NOTE: API v2\n */\n// HACK geçici\n// INFO: Önbellekten okunur';
  const matches = parse(text);
  assert.deepEqual(matches.map(match => [match.tag, match.description, match.line]), [
    ['TODO', 'Arama ekle', 0], ['FIXME', 'Boş liste', 0], ['WARNING', 'Veri yazar', 1], ['NOTE', 'API v2', 3], ['HACK', 'geçici', 5], ['INFO', 'Önbellekten okunur', 6]
  ]);
  assert.equal(matches[0].character, 3);
  assert.equal(matches[0].highlightEndCharacter, text.indexOf(' FIXME'));
});

test('strings, regex literals and template text are never comments', () => {
  const text = [
    'const a = "https://TODO.example/ /* FIXME */";',
    "const b = '// WARNING: string';",
    'const c = /[/* TODO FIXME]+/g;',
    'const d = `raw // TODO ${1 /* NOTE: expression */} /* HACK */`;',
    '// FIXME: real'
  ].join('\n');
  assert.deepEqual(parse(text).map(match => [match.tag, match.description]), [['NOTE', 'expression'], ['FIXME', 'real']]);
});

for (const language of ['javascriptreact', 'typescriptreact'] as const) {
  test(`${language}: JSX text and attributes are ignored while expression comments count`, () => {
    const text = 'const el = <div title="/* FIXME */">\n // TODO: text\n {/* NOTE: actual */}<span>// HACK</span></div>;\n// WARNING: after';
    assert.deepEqual(parse(text, language).map(match => match.tag), ['NOTE', 'WARNING']);
  });
}

test('trailing and unfinished comments survive incomplete code', () => {
  assert.equal(parse('const broken = ; // TODO: still typing')[0]?.description, 'still typing');
  assert.equal(parse('function incomplete(\n/* FIXME: fix later')[0]?.description, 'fix later');
  assert.equal(parse('/** TODO: comment only */')[0]?.tag, 'TODO');
  assert.equal(parse('// TODO')[0]?.description, '');
});

test('nested template expressions and comments around operators are parsed', () => {
  const text = 'const x = `outer ${`inner ${2 /* TODO: inner */}`} // FIXME`;\nconst n = a / b; /* NOTE: after division */';
  assert.deepEqual(parse(text).map(match => match.description), ['inner', 'after division']);
});

test('whole Unicode word boundaries and case sensitivity', () => {
  const text = '// TODO_COUNT myTODO TODOx éTODO TODOé _TODO TODO-HERE todo: yes';
  assert.deepEqual(parse(text).map(match => match.description), ['yes']);
  assert.equal(parse(text, 'typescript', { caseSensitive: true }).length, 0);
  assert.equal(parse('// TODO: yes', 'typescript', { tags: [] }).length, 0);
});

test('custom tags are literal and disabled tags are ignored', () => {
  const tags = [{ name: 'REVIEW-ME', color: '#FFFFFF', enabled: true }, { name: 'TODO', color: '#FFFFFF', enabled: false }];
  const matches = parse('// TODO: hidden REVIEW-ME: inspect', 'typescript', { tags });
  assert.deepEqual(matches.map(match => [match.tag, match.description]), [['REVIEW-ME', 'inspect']]);
});

test('UTF-16 positions handle emoji, Turkish and CRLF', () => {
  const matches = parse('const x = 1;\r\n// 😀 Türkçe TODO: çağrı\r\n// FIXME: son');
  assert.equal(matches[0].line, 1);
  assert.equal(matches[0].character, '// 😀 Türkçe '.length);
  assert.equal(matches[0].endCharacter - matches[0].character, 4);
  assert.equal(matches[0].description, 'çağrı');
  assert.equal(matches[1].line, 2);
});

test('Python strings, triple strings, raw strings and f strings are skipped', () => {
  const text = [
    'x = "# TODO: text"',
    'r = r"# FIXME"',
    'doc = """\n# WARNING docstring\n"""',
    'f = f"value {data[\"# HACK\"]}"',
    '# NOTE: actual', 'value = 1 # TODO: inline'
  ].join('\n');
  assert.deepEqual(parse(text, 'python').map(match => match.tag), ['NOTE', 'TODO']);
});

test('CSS skips strings and unquoted URL tokens', () => {
  const text = 'a { content: "/* TODO */"; background: url(https://host/FIXME); } /* NOTE: actual */';
  assert.deepEqual(parse(text, 'css').map(match => match.tag), ['NOTE']);
});

test('SCSS supports line comments without confusing URLs', () => {
  const text = 'a { background: url(https://host/TODO); }\n// FIXME: actual\n/* WARNING: block */';
  assert.deepEqual(parse(text, 'scss').map(match => match.tag), ['FIXME', 'WARNING']);
});

test('HTML attributes and raw text elements do not contain HTML comments', () => {
  const text = '<div title="<!-- TODO -->"></div><script>const x = "<!-- FIXME -->"; // TODO</script><style>/* NOTE */</style><textarea><!-- HACK --></textarea><!-- WARNING: actual -->';
  assert.deepEqual(parse(text, 'html').map(match => [match.tag, match.description]), [['WARNING', 'actual']]);
});

test('JSONC comments and unfinished block comments', () => {
  assert.deepEqual(parse('{"url":"https://TODO" /* FIXME: actual */}\n// NOTE: final', 'jsonc').map(match => match.tag), ['FIXME', 'NOTE']);
  assert.equal(parse('/* TODO: unfinished', 'css')[0]?.description, 'unfinished');
});

test('file extensions and explicit language modes define support', () => {
  assert.equal(languageFor('/src/A.TSX'), 'typescriptreact');
  assert.equal(languageFor('/file.unknown', 'python'), 'python');
  assert.equal(languageFor('/file.ts', 'plaintext'), undefined);
  assert.equal(languageFor('/notes.md'), undefined);
});

test('comment-prefix highlights include each supported language leader while navigation stays on the tag', () => {
  const examples: [Language, string, string][] = [
    ['python', '  # TODO: açıklama', '# TODO'],
    ['python', '  ## TODO: açıklama', '## TODO'],
    ['typescript', 'const value = 1; // TODO: açıklama', '// TODO'],
    ['javascript', '/// TODO: açıklama', '/// TODO'],
    ['css', '/* TODO: açıklama */', '/* TODO'],
    ['scss', '// TODO: açıklama', '// TODO'],
    ['html', '<!-- TODO: açıklama -->', '<!-- TODO'],
    ['jsonc', '// TODO: açıklama', '// TODO'],
    ['typescript', '/**\n * TODO: açıklama\n */', '* TODO']
  ];
  for (const [language, text, expected] of examples) {
    const match = parse(text, language)[0];
    assert.ok(match, language);
    const line = text.split('\n')[match.line];
    const highlighted = highlightCharacters(match, { highlightMode: 'tag', highlightCommentPrefix: true }).map(([start, end]) => line.slice(start, end));
    assert.deepEqual(highlighted, [expected], language);
    assert.equal(line.slice(match.character, match.endCharacter), 'TODO', 'navigation selects only the tag');
  }
});

test('prefix setting is independent of tag/line/off highlight mode', () => {
  const text = '# TODO: açıklama';
  const match = parse(text, 'python')[0];
  const highlighted = (mode: Settings['highlightMode'], prefix: boolean) => highlightCharacters(match, {
    highlightMode: mode, highlightCommentPrefix: prefix
  }).map(([start, end]) => text.slice(start, end));
  assert.deepEqual(highlighted('tag', false), ['TODO']);
  assert.deepEqual(highlighted('line', false), ['TODO: açıklama']);
  assert.deepEqual(highlighted('line', true), ['# TODO: açıklama']);
  assert.deepEqual(highlighted('off', true), []);
});

test('prefix decoration never sweeps over unrelated prose or source code', () => {
  const text = 'const value = 1; // 😀 açıklama TODO: sonra';
  const match = parse(text)[0];
  assert.deepEqual(highlightCharacters(match, { highlightMode: 'tag', highlightCommentPrefix: true })
    .map(([start, end]) => text.slice(start, end)), ['//', 'TODO']);
});

test('multiple tags on a comment line do not give the prefix competing colors', () => {
  const matches = parse('# TODO: first FIXME: second', 'python');
  assert.ok(matches[0].commentPrefix);
  assert.equal(matches[1].commentPrefix, undefined);
  const first = highlightCharacters(matches[0], { highlightMode: 'line', highlightCommentPrefix: true });
  const second = highlightCharacters(matches[1], { highlightMode: 'line', highlightCommentPrefix: true });
  assert.ok(first[0][1] <= second[0][0]);
});

test('multiline blocks do not color a closing delimiter or an earlier line', () => {
  const text = '/*\n TODO: middle\n */';
  const match = parse(text)[0];
  assert.equal(match.commentPrefix, undefined);
  assert.equal(match.line, 1);
});
