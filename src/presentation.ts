import { Settings, TagMatch } from './model';

/** Same-line UTF-16 spans; navigation always uses the original tag position. */
export function highlightCharacters(match: TagMatch, settings: Pick<Settings, 'highlightMode' | 'highlightCommentPrefix'>): [number, number][] {
  if (settings.highlightMode === 'off') return [];
  const end = settings.highlightMode === 'line' ? match.highlightEndCharacter : match.endCharacter;
  const prefix = settings.highlightCommentPrefix ? match.commentPrefix : undefined;
  if (!prefix) return [[match.character, end]];
  if (prefix.adjacent) return [[prefix.character, end]];
  return [[prefix.character, prefix.endCharacter], [match.character, end]];
}

/** Separate line ranges keep indentation and unrelated source code unpainted. */
export function highlightSegments(match: TagMatch, settings: Pick<Settings, 'highlightMode' | 'highlightCommentPrefix'>): { line: number; start: number; end: number }[] {
  const segments = highlightCharacters(match, settings).map(([start, end]) => ({ line: match.line, start, end }));
  if (settings.highlightMode === 'line') {
    for (const continuation of match.continuationLines ?? []) {
      segments.push({ line: continuation.line,
        start: settings.highlightCommentPrefix && continuation.commentPrefix ? continuation.commentPrefix.character : continuation.character,
        end: continuation.endCharacter });
    }
  }
  return segments;
}
