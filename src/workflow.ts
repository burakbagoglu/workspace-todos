import { Settings, TagMatch } from './model';
import { Language } from './parser/comments';
import { parseTags } from './parser/tags';

/** Re-parse the live buffer before editing a sidebar result that may be stale. */
export function tagReplacement(text: string, language: Language, settings: Settings, expected: TagMatch, target: string) {
  const definition = settings.tags.find(tag => tag.enabled && tag.name === target);
  if (!definition) throw new Error(`Enable ${target} in Workspace TODOs: Tags first.`);
  const current = parseTags(text, language, settings).find(match => match.line === expected.line &&
    match.character === expected.character && match.endCharacter === expected.endCharacter &&
    match.tag === expected.tag && match.description === expected.description);
  if (!current) throw new Error('This result changed. Refresh TODOs and try again.');
  return { line: current.line, start: current.character, end: current.endCharacter, text: definition.name };
}
