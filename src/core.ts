import { braceExpand, Minimatch } from 'minimatch';
import { FileRecord, isCompleted, Settings, ViewState } from './model';

// VS Code's file search rejects nested brace alternatives. Expand each user
// pattern before combining exclusions into a single, flat alternative group.
export function discoveryExclude(patterns: string[]): string | null {
  const expanded = [...new Set(patterns.flatMap(pattern => braceExpand(pattern)))];
  return expanded.length === 0 ? null : expanded.length === 1 ? expanded[0] : `{${expanded.join(',')}}`;
}

export class FilePolicy {
  private include: Minimatch[];
  private exclude: Minimatch[];
  constructor(settings: Settings, nocase = process.platform === 'win32') {
    const options = { dot: true, nocase, nonegate: true, nocomment: true, optimizationLevel: 2 };
    this.include = settings.include.map(pattern => new Minimatch(pattern, options));
    this.exclude = settings.exclude.map(pattern => new Minimatch(pattern, options));
  }
  excluded(path: string): boolean { return this.exclude.some(glob => glob.match(path) || glob.match(path + '/')); }
  accepts(path: string): boolean { return !this.excluded(path) && this.include.some(glob => glob.match(path)); }
}

export interface Ticket { key: string; epoch: number; version: number }
export class RevisionStore<T> {
  readonly values = new Map<string, T>();
  private versions = new Map<string, number>();
  private epoch = 0;
  reset(): void { this.epoch++; this.versions.clear(); this.values.clear(); }
  begin(key: string): Ticket {
    const version = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, version);
    return { key, version, epoch: this.epoch };
  }
  current(ticket: Ticket): boolean { return ticket.epoch === this.epoch && ticket.version === this.versions.get(ticket.key); }
  commit(ticket: Ticket, value: T): boolean {
    if (!this.current(ticket)) return false;
    this.values.set(ticket.key, value); return true;
  }
  removePrefix(prefix: string): void {
    for (const key of this.versions.keys()) if (key === prefix || key.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')) {
      this.versions.set(key, this.versions.get(key)! + 1); this.values.delete(key);
    }
  }
}

export class WorkQueue {
  private running = 0;
  private pending: (() => void)[] = [];
  constructor(private concurrency = 4) {}
  run(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending.push(() => {
        this.running++;
        task().then(resolve, reject).finally(() => { this.running--; this.drain(); });
      });
      this.drain();
    });
  }
  private drain() { while (this.running < this.concurrency && this.pending.length) this.pending.shift()!(); }
}

export function filterRecords(records: FileRecord[], state: ViewState, activeUri?: string): FileRecord[] {
  const query = state.query.trim().toLocaleLowerCase();
  const tags = state.tags === null ? undefined : new Set(state.tags);
  return records.filter(file => state.scope !== 'file' || file.uri === activeUri).map(file => ({
    ...file,
    matches: file.matches.filter(match => (state.showCompleted || !isCompleted(match.tag)) && (!tags || tags.has(match.tag)) &&
      (!query || `${file.path}\n${match.tag}\n${match.description}`.toLocaleLowerCase().includes(query)))
  })).filter(file => file.matches.length > 0).sort((a, b) => a.path.localeCompare(b.path) || a.uri.localeCompare(b.uri));
}

export function decodeText(bytes: Uint8Array): string {
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw new Error('Binary file');
  return text;
}
