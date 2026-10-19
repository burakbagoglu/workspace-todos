import { Settings, TagDefinition } from './model';

export const DEFAULT_SETTINGS: Settings = {
  tags: [
    { name: 'TODO', color: '#E5C07B', enabled: true },
    { name: 'FIXME', color: '#F07178', enabled: true },
    { name: 'WARNING', color: '#F5A45D', enabled: true },
    { name: 'INFO', color: '#56D4C2', enabled: true },
    { name: 'NOTE', color: '#82AAFF', enabled: true },
    { name: 'HACK', color: '#C792EA', enabled: true }
  ],
  include: ['**/*'],
  exclude: [
    '**/{.git,node_modules,dist,build,out,coverage,.venv,venv,__pycache__,.next,.nuxt,.vscode-test,.test-profile,.test-extensions,.test-runs,.npm-cache,build-test}/**',
    '**/*.{min.js,min.css,map}', '**/{package-lock.json,yarn.lock,pnpm-lock.yaml}'
  ],
  caseSensitive: false, highlightMode: 'tag', highlightCommentPrefix: true, multiline: true, maxFileSizeKB: 1024
};

export function normalizeSettings(raw: Partial<Record<keyof Settings, unknown>>): { settings: Settings; warnings: string[] } {
  const warnings: string[] = [];
  const warn = (name: string) => { warnings.push(`Invalid workspaceTodos.${name}; using a safe default.`); };
  let tags: TagDefinition[] = DEFAULT_SETTINGS.tags.map(tag => ({ ...tag }));
  if (raw.tags !== undefined) {
    if (!Array.isArray(raw.tags)) warn('tags');
    else {
      tags = [];
      const seen = new Set<string>();
      for (const item of raw.tags) {
        if (!item || typeof item !== 'object') { warn('tags entry'); continue; }
        const tag = item as Record<string, unknown>;
        if (typeof tag.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(tag.name) ||
            typeof tag.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(tag.color) ||
            (tag.enabled !== undefined && typeof tag.enabled !== 'boolean') || seen.has(tag.name.toUpperCase())) {
          warn('tags entry'); continue;
        }
        seen.add(tag.name.toUpperCase());
        tags.push({ name: tag.name, color: tag.color, enabled: tag.enabled !== false });
      }
      if (raw.tags.length > 0 && tags.length === 0) tags = DEFAULT_SETTINGS.tags.map(tag => ({ ...tag }));
    }
  }
  const patterns = (key: 'include' | 'exclude'): string[] => {
    const value = raw[key];
    if (value === undefined) return [...DEFAULT_SETTINGS[key]];
    if (Array.isArray(value) && value.every(pattern => typeof pattern === 'string' && pattern.length > 0 && pattern.length <= 1024)) return [...value];
    warn(key); return [...DEFAULT_SETTINGS[key]];
  };
  let highlightMode = raw.highlightMode ?? DEFAULT_SETTINGS.highlightMode;
  if (!['tag', 'line', 'off'].includes(String(highlightMode))) { warn('highlightMode'); highlightMode = 'tag'; }
  let maxFileSizeKB = raw.maxFileSizeKB ?? DEFAULT_SETTINGS.maxFileSizeKB;
  if (typeof maxFileSizeKB !== 'number' || !Number.isFinite(maxFileSizeKB) || maxFileSizeKB < 1 || maxFileSizeKB > 10240) {
    warn('maxFileSizeKB'); maxFileSizeKB = DEFAULT_SETTINGS.maxFileSizeKB;
  }
  if (raw.caseSensitive !== undefined && typeof raw.caseSensitive !== 'boolean') warn('caseSensitive');
  if (raw.highlightCommentPrefix !== undefined && typeof raw.highlightCommentPrefix !== 'boolean') warn('highlightCommentPrefix');
  if (raw.multiline !== undefined && typeof raw.multiline !== 'boolean') warn('multiline');
  return {
    settings: { tags, include: patterns('include'), exclude: patterns('exclude'), caseSensitive: typeof raw.caseSensitive === 'boolean' ? raw.caseSensitive : false,
      highlightMode: highlightMode as Settings['highlightMode'], highlightCommentPrefix: typeof raw.highlightCommentPrefix === 'boolean' ? raw.highlightCommentPrefix : true,
      multiline: typeof raw.multiline === 'boolean' ? raw.multiline : true,
      maxFileSizeKB: maxFileSizeKB as number },
    warnings: [...new Set(warnings)]
  };
}
