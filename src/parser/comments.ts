import * as ts from 'typescript';

export interface CommentRange { start: number; end: number; markerStart: number }
export type Language = 'javascript' | 'typescript' | 'javascriptreact' | 'typescriptreact' | 'python' | 'css' | 'scss' | 'html' | 'jsonc';
const extensions: Record<string, Language> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascriptreact',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescriptreact',
  py: 'python', pyw: 'python', css: 'css', scss: 'scss', html: 'html', htm: 'html', jsonc: 'jsonc'
};
export function languageFor(path: string, languageId?: string): Language | undefined {
  if (languageId !== undefined) return Object.values(extensions).includes(languageId as Language) ? languageId as Language : undefined;
  return extensions[path.slice(path.lastIndexOf('.') + 1).toLowerCase()];
}

// The TypeScript parser owns regex/template/JSX rescanning. Only scan trivia gaps
// between real syntax tokens, never strings, regex bodies or JSX text.
function scriptComments(text: string, language: Language): CommentRange[] {
  const kind = language === 'typescriptreact' ? ts.ScriptKind.TSX : language === 'javascriptreact' ? ts.ScriptKind.JSX : language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile('file', text, ts.ScriptTarget.Latest, false, kind);
  const tokens: { start: number; end: number }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJSDoc(node)) return;
    if (node.kind >= ts.SyntaxKind.FirstToken && node.kind <= ts.SyntaxKind.LastToken) {
      const start = node.kind === ts.SyntaxKind.JsxText || node.kind === ts.SyntaxKind.JsxTextAllWhiteSpaces ? node.pos : node.getStart(source, false);
      if (node.end > start) tokens.push({ start, end: node.end });
      return;
    }
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  tokens.sort((a, b) => a.start - b.start);
  const ranges: CommentRange[] = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
  let previous = 0;
  const gap = (end: number) => {
    if (end <= previous) return;
    scanner.setText(text, previous, end - previous);
    let token: ts.SyntaxKind;
    while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
      if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
        const start = scanner.getTokenPos() + 2;
        const finish = scanner.getTextPos();
        ranges.push({ start, markerStart: scanner.getTokenPos(), end: token === ts.SyntaxKind.MultiLineCommentTrivia && text.slice(finish - 2, finish) === '*/' ? finish - 2 : finish });
      }
    }
  };
  for (const token of tokens) { gap(token.start); previous = Math.max(previous, token.end); }
  gap(text.length);
  return ranges;
}

function quotedEnd(text: string, start: number, triple = false): number {
  const quote = triple ? text.slice(start, start + 3) : text[start];
  let i = start + quote.length;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text.startsWith(quote, i)) return i + quote.length;
    i++;
  }
  return text.length;
}

function pythonStringEnd(text: string, start: number): number {
  const triple = text.slice(start, start + 3) === text[start].repeat(3);
  let prefixStart = start;
  while (prefixStart > 0 && /[a-z]/i.test(text[prefixStart - 1])) prefixStart--;
  const prefix = text.slice(prefixStart, start);
  if (!/^[rubf]*$/i.test(prefix) || !/f/i.test(prefix)) return quotedEnd(text, start, triple);
  const quote = triple ? text.slice(start, start + 3) : text[start];
  let i = start + quote.length;
  let depth = 0;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (depth === 0 && text.startsWith(quote, i)) return i + quote.length;
    if (depth === 0 && (text.startsWith('{{', i) || text.startsWith('}}', i))) { i += 2; continue; }
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && depth > 0) depth--;
    else if (depth > 0 && (text[i] === '"' || text[i] === "'")) { i = pythonStringEnd(text, i); continue; }
    i++;
  }
  return text.length;
}

function simpleComments(text: string, language: 'python' | 'css' | 'scss' | 'jsonc'): CommentRange[] {
  const ranges: CommentRange[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"' || text[i] === "'") { i = language === 'python' ? pythonStringEnd(text, i) : quotedEnd(text, i); continue; }
    // CSS unquoted URL tokens can legitimately contain // and /* sequences.
    if ((language === 'css' || language === 'scss') && (i === 0 || !/[\w-]/.test(text[i - 1])) && /^url\(/i.test(text.slice(i, i + 4))) {
      i += 4;
      while (i < text.length && text[i] !== ')') {
        if (text[i] === '"' || text[i] === "'") i = quotedEnd(text, i);
        else if (text[i] === '\\') i += 2;
        else i++;
      }
      i++; continue;
    }
    const line = language === 'python' ? text[i] === '#' : language !== 'css' && text.startsWith('//', i);
    if (line) {
      const start = i + (language === 'python' ? 1 : 2);
      const newline = text.indexOf('\n', start);
      const end = newline < 0 ? text.length : newline;
      ranges.push({ start, end, markerStart: i }); i = end; continue;
    }
    if (language !== 'python' && text.startsWith('/*', i)) {
      const close = text.indexOf('*/', i + 2);
      ranges.push({ start: i + 2, end: close < 0 ? text.length : close, markerStart: i });
      i = close < 0 ? text.length : close + 2; continue;
    }
    i++;
  }
  return ranges;
}

function htmlComments(text: string): CommentRange[] {
  const ranges: CommentRange[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      ranges.push({ start: i + 4, end: end < 0 ? text.length : end, markerStart: i });
      i = end < 0 ? text.length : end + 3; continue;
    }
    if (text[i] === '<') {
      const raw = /^<(script|style|textarea|title)\b/i.exec(text.slice(i));
      while (i < text.length && text[i] !== '>') {
        if (text[i] === '"' || text[i] === "'") {
          const quote = text[i++];
          while (i < text.length && text[i] !== quote) i++;
        }
        i++;
      }
      i++;
      if (raw) {
        const close = new RegExp(`</${raw[1]}\\s*>`, 'ig');
        close.lastIndex = i;
        const match = close.exec(text);
        i = match ? match.index + match[0].length : text.length;
      }
      continue;
    }
    i++;
  }
  return ranges;
}

export function commentRanges(text: string, language: Language): CommentRange[] {
  if (language === 'python' || language === 'css' || language === 'scss' || language === 'jsonc') return simpleComments(text, language);
  if (language === 'html') return htmlComments(text);
  return scriptComments(text, language);
}
