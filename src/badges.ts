import { isCompleted, TAG_COLOR_IDS, TagMatch } from './model';

/** Counts are independent of view filters; completed entries never add work. */
export function badgeSummary(matches: TagMatch[]) {
  const active = matches.filter(match => !isCompleted(match.tag));
  if (!active.length) return undefined;
  const priority = ['FIXME', 'WARNING', 'TODO', 'HACK', 'INFO', 'NOTE'];
  const dominant = priority.find(tag => active.some(match => match.tag.toUpperCase() === tag));
  return {
    badge: active.length > 9 ? '9+' : String(active.length),
    tooltip: `${active.length} active comment ${active.length === 1 ? 'tag' : 'tags'}`,
    color: TAG_COLOR_IDS[dominant ?? ''] ?? 'workspaceTodos.customForeground'
  };
}
