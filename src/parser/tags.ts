import { Settings, TagMatch } from '../model';
import { commentRanges, Language } from './comments';

interface CommentLine {
  line: number;
  end: number;
  contentStart: number;
  block: number;
  lineComment: boolean;
  standalone: boolean;
  prefix?: { start: number; end: number };
  tags: { start: number; end: number; name: string; enabled: boolean }[];
}

export function parseTags(text: string, language: Language, settings: Settings): TagMatch[] {
  if (!settings.tags.some(tag => tag.enabled)) return [];
  // Disabled tags end preceding multiline entries rather than inheriting color.
  const names = [...settings.tags].sort((a, b) => b.name.length - a.name.length).map(tag => tag.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_-])(${names.join('|')})(?![\\p{L}\\p{N}_-])`, settings.caseSensitive ? 'gu' : 'giu');
  const normalize = (name: string) => settings.caseSensitive ? name : name.toUpperCase();
  const lookup = new Map(settings.tags.map(tag => [normalize(tag.name), tag]));
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lineAt = (offset: number) => {
    let lo = 0; let hi = starts.length;
    while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= offset) lo = mid; else hi = mid; }
    return lo;
  };
  const fragments: CommentLine[] = [];
  for (const [block, range] of commentRanges(text, language).entries()) {
    const firstLine = lineAt(range.start);
    const lineComment = text[range.markerStart] === '#' || text.startsWith('//', range.markerStart);
    for (let line = firstLine; line < starts.length && starts[line] <= range.end; line++) {
      const start = Math.max(range.start, starts[line]);
      let end = Math.min(range.end, starts[line + 1] === undefined ? text.length : starts[line + 1] - 1);
      const last = end === range.end;
      while (end > start && /[\t \r]/.test(text[end - 1])) end--;
      let prefix: CommentLine['prefix'];
      if (line === firstLine) {
        const marker = /^(?:\/\/+|#+|\/\*+|<!--)/.exec(text.slice(range.markerStart, end));
        if (marker) prefix = { start: range.markerStart, end: range.markerStart + marker[0].length };
      } else {
        const leader = /^[\t ]*(\*+)(?!\/)/.exec(text.slice(start, end));
        if (leader) prefix = { start: start + leader[0].length - leader[1].length, end: start + leader[0].length };
      }
      // Strip one separator space; preserve indentation in '#     print(value)'.
      let contentStart = prefix ? prefix.end : start;
      if (prefix && /[\t ]/.test(text[contentStart] ?? '')) contentStart++;
      const fragment: CommentLine = { line, end, contentStart, block, lineComment,
        standalone: /^[\t ]*$/.test(text.slice(starts[line], prefix?.start ?? start)), prefix, tags: [] };
      for (const match of text.slice(contentStart, end).matchAll(pattern)) {
        const tag = lookup.get(normalize(match[0]))!;
        fragment.tags.push({ start: contentStart + match.index!, end: contentStart + match.index! + match[0].length, name: tag.name, enabled: tag.enabled });
      }
      fragments.push(fragment);
      if (last) break;
    }
  }

  const results: TagMatch[] = [];
  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    for (let j = 0; j < fragment.tags.length; j++) {
      const tag = fragment.tags[j];
      if (!tag.enabled) continue;
      let descriptionEnd = fragment.tags[j + 1]?.start ?? fragment.end;
      while (descriptionEnd > tag.end && /\s/.test(text[descriptionEnd - 1])) descriptionEnd--;
      const match: TagMatch = {
        tag: tag.name, description: text.slice(tag.end, descriptionEnd).replace(/^\s*(?:\([^\r\n)]*\))?\s*:?\s*/, '').trim(),
        line: fragment.line, character: tag.start - starts[fragment.line], endCharacter: tag.end - starts[fragment.line],
        highlightEndCharacter: Math.max(tag.end, descriptionEnd) - starts[fragment.line]
      };
      if (j === 0 && fragment.prefix) match.commentPrefix = {
        character: fragment.prefix.start - starts[fragment.line], endCharacter: fragment.prefix.end - starts[fragment.line],
        adjacent: /^\s*$/.test(text.slice(fragment.prefix.end, tag.start))
      };

      if (settings.multiline && j === fragment.tags.length - 1) {
        const descriptions = match.description ? [match.description] : [];
        let previous = fragment;
        for (let k = i + 1; k < fragments.length; k++) {
          const next = fragments[k];
          if (next.line !== previous.line + 1 || next.tags.length || !text.slice(next.contentStart, next.end).trim()) break;
          const sameBlock = next.block === previous.block;
          const alignedLineComment = previous.lineComment && next.lineComment && next.standalone &&
            previous.prefix !== undefined && next.prefix !== undefined &&
            previous.prefix.start - starts[previous.line] === next.prefix.start - starts[next.line] &&
            text[previous.prefix.start] === text[next.prefix.start];
          if (!sameBlock && !alignedLineComment) break;
          (match.continuationLines ??= []).push({
            line: next.line, character: next.contentStart - starts[next.line], endCharacter: next.end - starts[next.line],
            ...(next.prefix ? { commentPrefix: { character: next.prefix.start - starts[next.line],
              endCharacter: next.prefix.end - starts[next.line], adjacent: true } } : {})
          });
          descriptions.push(text.slice(next.contentStart, next.end));
          previous = next;
        }
        match.description = descriptions.join('\n');
      }
      results.push(match);
    }
  }
  return results.sort((a, b) => a.line - b.line || a.character - b.character);
}
