export interface TagDefinition { name: string; color: string; enabled: boolean }
export interface Settings {
  tags: TagDefinition[];
  include: string[];
  exclude: string[];
  caseSensitive: boolean;
  highlightMode: 'tag' | 'line' | 'off';
  highlightCommentPrefix: boolean;
  multiline: boolean;
  respectGitIgnore: boolean;
  explorerBadges: boolean;
  maxFileSizeKB: number;
}
export interface TagMatch {
  tag: string;
  description: string;
  line: number;
  character: number;
  endCharacter: number;
  highlightEndCharacter: number;
  commentPrefix?: { character: number; endCharacter: number; adjacent: boolean };
  continuationLines?: {
    line: number;
    character: number;
    endCharacter: number;
    commentPrefix?: { character: number; endCharacter: number; adjacent: boolean };
  }[];
}
export interface FileRecord { uri: string; path: string; matches: TagMatch[] }
export interface ViewState { group: 'file' | 'tag'; query: string; tags: string[] | null; scope: 'workspace' | 'file'; showCompleted: boolean }
export const DEFAULT_VIEW_STATE: ViewState = { group: 'file', query: '', tags: null, scope: 'workspace', showCompleted: false };
export const isCompleted = (tag: string): boolean => tag.toUpperCase() === 'DONE';
export const TAG_ICONS: Record<string, string> = {
  TODO: 'checklist', FIXME: 'bug', WARNING: 'warning', INFO: 'info', NOTE: 'note', HACK: 'tools', DONE: 'pass'
};
export const TAG_COLOR_IDS: Record<string, string> = {
  TODO: 'workspaceTodos.todoForeground', FIXME: 'workspaceTodos.fixmeForeground',
  WARNING: 'workspaceTodos.warningForeground', INFO: 'workspaceTodos.infoForeground', NOTE: 'workspaceTodos.noteForeground',
  HACK: 'workspaceTodos.hackForeground', DONE: 'workspaceTodos.doneForeground'
};
