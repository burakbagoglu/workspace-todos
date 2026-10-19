import * as vscode from 'vscode';
import { decodeText, discoveryExclude, FilePolicy, RevisionStore, WorkQueue } from './core';
import { FileRecord, Settings } from './model';
import { languageFor } from './parser/comments';
import { parseTags } from './parser/tags';

interface IndexedFile { file: FileRecord; skipped?: string }
const SUPPORTED_GLOB = '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,py,pyw,css,scss,html,htm,jsonc}';
export function uriKey(uri: vscode.Uri): string {
  const value = uri.toString();
  return uri.scheme === 'file' && process.platform === 'win32' ? value.toLowerCase() : value;
}

export class WorkspaceIndexer implements vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changes.event;
  private readonly store = new RevisionStore<IndexedFile>();
  private readonly queue = new WorkQueue(4);
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private changeTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private cancellation?: vscode.CancellationTokenSource;
  private generation = 0;
  private disposed = false;
  private policy: FilePolicy;
  scanning = false;
  discoveryError?: string;

  constructor(public settings: Settings, private readonly output: vscode.OutputChannel) {
    this.policy = new FilePolicy(settings);
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    this.subscriptions.push(watcher,
      watcher.onDidChange(uri => this.schedule(uri, 50)),
      watcher.onDidCreate(uri => { void this.created(uri); }),
      watcher.onDidDelete(uri => this.remove(uri)),
      vscode.workspace.onDidOpenTextDocument(doc => this.schedule(doc.uri, 0)),
      vscode.workspace.onDidChangeTextDocument(event => this.schedule(event.document.uri)),
      vscode.workspace.onDidCloseTextDocument(doc => this.schedule(doc.uri, 0)),
      vscode.workspace.onDidSaveTextDocument(doc => this.schedule(doc.uri, 0)),
      vscode.workspace.onDidRenameFiles(event => { for (const file of event.files) this.remove(file.oldUri); this.requestRefresh(); }),
      vscode.workspace.onDidCreateFiles(() => this.requestRefresh()),
      vscode.workspace.onDidDeleteFiles(event => { for (const uri of event.files) this.remove(uri); }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.requestRefresh())
    );
  }

  get records(): FileRecord[] { return [...this.store.values.values()].map(value => value.file); }
  record(uri: vscode.Uri): FileRecord | undefined { return this.store.values.get(uriKey(uri))?.file; }
  get skipped(): { path: string; reason: string }[] {
    return [...this.store.values.values()].filter(value => value.skipped).map(value => ({ path: value.file.path, reason: value.skipped! }));
  }
  private describe(uri: vscode.Uri): { relative: string; display: string } | undefined {
    const root = vscode.workspace.getWorkspaceFolder(uri);
    if (!root) return undefined;
    const relative = uri.path.slice(root.uri.path.replace(/\/$/, '').length + 1);
    return { relative, display: (vscode.workspace.workspaceFolders?.length ?? 0) > 1 ? `${root.name}/${relative}` : relative };
  }
  private document(uri: vscode.Uri) { return vscode.workspace.textDocuments.find(doc => !doc.isClosed && uriKey(doc.uri) === uriKey(uri)); }
  private notify() {
    if (this.disposed || this.changeTimer) return;
    this.changeTimer = setTimeout(() => { this.changeTimer = undefined; if (!this.disposed) this.changes.fire(); }, 25);
  }
  private requestRefresh() {
    if (this.disposed) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => { this.refreshTimer = undefined; void this.refresh(); }, 150);
  }
  private async created(uri: vscode.Uri) {
    const description = this.describe(uri);
    if (!description || this.policy.excluded(description.relative)) return;
    if (languageFor(uri.path)) { this.schedule(uri, 50); return; }
    try { if ((await vscode.workspace.fs.stat(uri)).type & vscode.FileType.Directory) this.requestRefresh(); }
    catch { /* A short-lived created file may already have been removed. */ }
  }
  remove(uri: vscode.Uri) {
    this.store.removePrefix(uriKey(uri));
    for (const [key, timer] of this.timers) if (key === uriKey(uri) || key.startsWith(uriKey(uri) + '/')) {
      clearTimeout(timer); this.timers.delete(key);
    }
    this.notify();
  }
  schedule(uri: vscode.Uri, delay = 250) {
    if (this.disposed) return;
    const key = uriKey(uri);
    const description = this.describe(uri);
    if (!description || !this.policy.accepts(description.relative) || !languageFor(uri.path, this.document(uri)?.languageId)) {
      if (this.store.values.has(key) || this.timers.has(key)) this.remove(uri);
      return;
    }
    const oldTimer = this.timers.get(key);
    if (oldTimer) clearTimeout(oldTimer);
    // Invalidate in-flight disk reads immediately, even while edits are debounced.
    this.store.begin(key);
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      void this.indexUri(uri);
    }, delay));
  }

  async indexUri(uri: vscode.Uri): Promise<void> {
    if (this.disposed) return;
    const key = uriKey(uri);
    const description = this.describe(uri);
    const language = languageFor(uri.path, this.document(uri)?.languageId);
    if (!description || !language || !this.policy.accepts(description.relative)) { this.remove(uri); return; }
    const ticket = this.store.begin(key);
    const settings = this.settings;
    await this.queue.run(async () => {
      if (!this.store.current(ticket) || this.disposed) return;
      const file: FileRecord = { uri: uri.toString(), path: description.display, matches: [] };
      try {
        let document = this.document(uri);
        let text: string;
        if (document) text = document.getText();
        else {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type & vscode.FileType.Directory) return;
          if (stat.size > settings.maxFileSizeKB * 1024) throw new Error(`Larger than ${settings.maxFileSizeKB} KiB`);
          const bytes = await vscode.workspace.fs.readFile(uri);
          if (bytes.byteLength > settings.maxFileSizeKB * 1024) throw new Error(`Larger than ${settings.maxFileSizeKB} KiB`);
          if (!this.store.current(ticket) || this.disposed) return;
          // Opening a document during an async read must not overwrite its edits.
          document = this.document(uri);
          text = document ? document.getText() : decodeText(bytes);
        }
        if (Buffer.byteLength(text, 'utf8') > settings.maxFileSizeKB * 1024) throw new Error(`Larger than ${settings.maxFileSizeKB} KiB`);
        if (text.includes('\0')) throw new Error('Binary file');
        if (!this.store.current(ticket) || this.disposed) return;
        await new Promise<void>(resolve => setImmediate(resolve));
        if (!this.store.current(ticket) || this.disposed) return;
        file.matches = parseTags(text, language, settings);
        if (this.store.commit(ticket, { file })) this.notify();
      } catch (error) {
        if (!this.store.current(ticket) || this.disposed) return;
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') { this.remove(uri); return; }
        const reason = error instanceof Error ? error.message : String(error);
        this.output.appendLine(`Skipped ${description.display}: ${reason}`);
        if (this.store.commit(ticket, { file, skipped: reason })) this.notify();
      }
    });
  }

  async refresh(): Promise<void> {
    if (this.disposed) return;
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = undefined; }
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.cancellation?.cancel(); this.cancellation?.dispose();
    const cancellation = this.cancellation = new vscode.CancellationTokenSource();
    const generation = ++this.generation;
    this.store.reset(); this.scanning = true; this.discoveryError = undefined; this.notify();
    try {
      const excludes = discoveryExclude(this.settings.exclude);
      const candidates = new Map<string, vscode.Uri>();
      if (this.settings.include.length && this.settings.tags.some(tag => tag.enabled)) {
        for (const root of vscode.workspace.workspaceFolders ?? []) {
          const found = await vscode.workspace.findFiles(new vscode.RelativePattern(root, SUPPORTED_GLOB), excludes, undefined, cancellation.token);
          if (cancellation.token.isCancellationRequested || this.disposed) return;
          for (const uri of found) candidates.set(uriKey(uri), uri);
        }
        for (const doc of vscode.workspace.textDocuments) if (this.describe(doc.uri)) candidates.set(uriKey(doc.uri), doc.uri);
      }
      if (generation !== this.generation || this.disposed) return;
      await Promise.all([...candidates.values()].map(uri => this.indexUri(uri)));
    } catch (error) {
      if (generation === this.generation && !cancellation.token.isCancellationRequested) {
        this.discoveryError = error instanceof Error ? error.message : String(error);
        this.output.appendLine(`Workspace scan incomplete: ${this.discoveryError}`);
      }
    } finally {
      if (generation === this.generation && !this.disposed) { this.scanning = false; this.notify(); }
    }
  }

  configure(settings: Settings): Promise<void> {
    this.settings = settings; this.policy = new FilePolicy(settings);
    return this.refresh();
  }
  dispose() {
    this.disposed = true;
    this.store.reset(); this.generation++;
    this.cancellation?.cancel(); this.cancellation?.dispose();
    if (this.changeTimer) clearTimeout(this.changeTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.subscriptions.forEach(subscription => subscription.dispose()); this.changes.dispose();
  }
}
