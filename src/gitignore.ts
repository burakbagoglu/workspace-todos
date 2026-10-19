import ignore, { Ignore } from 'ignore';

/** One workspace root; readers and cached rules are replaced on every refresh. */
export class GitIgnorePolicy {
  private readonly cache = new Map<string, Promise<Ignore | undefined>>();
  constructor(private readonly read: (directory: string) => Promise<string | undefined>,
    private readonly ignorecase = process.platform === 'win32') {}

  private rules(directory: string): Promise<Ignore | undefined> {
    let pending = this.cache.get(directory);
    if (!pending) {
      pending = (async () => {
        const slash = directory.lastIndexOf('/');
        const parent = directory ? await this.rules(slash < 0 ? '' : directory.slice(0, slash)) : undefined;
        const text = await this.read(directory);
        if (text === undefined) return parent;
        const rules = ignore({ ignorecase: this.ignorecase });
        if (parent) rules.add(parent);
        // Anchor nested patterns at the workspace root before combining them.
        // Keeping all applicable rules together lets a nested directory exception
        // also unignore descendants, as Git does.
        rules.add(directory ? text.split(/\r?\n/).flatMap(line => {
          if (!line || line.startsWith('#')) return [];
          const negative = line.startsWith('!');
          const pattern = negative ? line.slice(1) : line;
          if (!pattern.trim()) return [];
          const anchored = pattern.startsWith('/') || pattern.trimEnd().replace(/\/$/, '').includes('/');
          // A directory can contain literal Gitignore metacharacters.
          const base = directory.replace(/[\\*?\[\]]/g, '\\$&');
          return [`${negative ? '!' : ''}/${base}/${anchored ? '' : '**/'}${pattern.replace(/^\//, '')}`];
        }) : text);
        return rules;
      })();
      this.cache.set(directory, pending);
    }
    return pending;
  }

  async ignored(path: string): Promise<boolean> {
    if (!ignore.isPathValid(path)) return false;
    const parts = path.split('/');
    for (let depth = 0; depth < parts.length; depth++) {
      const directory = parts.slice(0, depth).join('/');
      const rules = await this.rules(directory);
      const target = parts.slice(0, depth + 1).join('/') + (depth < parts.length - 1 ? '/' : '');
      // Git cannot re-include a child of an excluded directory. In particular,
      // that directory's own .gitignore must never override its parent.
      if (rules?.ignores(target)) return true;
    }
    return false;
  }
}
