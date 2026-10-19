import * as vscode from 'vscode';
import { normalizeSettings } from './settings';

export function readSettings(output: vscode.OutputChannel) {
  const config = vscode.workspace.getConfiguration('workspaceTodos');
  const result = normalizeSettings({
    tags: config.get('tags'), include: config.get('include'), exclude: config.get('exclude'),
    caseSensitive: config.get('caseSensitive'), highlightMode: config.get('highlightMode'),
    highlightCommentPrefix: config.get('highlightCommentPrefix'), multiline: config.get('multiline'), maxFileSizeKB: config.get('maxFileSizeKB')
  });
  for (const warning of result.warnings) output.appendLine(warning);
  return result;
}
