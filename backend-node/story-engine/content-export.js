import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { readManuscriptText } from './content-loader.js';

function sanitizeFilename(name) {
  return String(name || 'untitled').replace(/[/\\:*?"<>|]/g, '_');
}

/**
 * Export manuscript as Markdown string.
 */
export function exportMarkdown(projectId, { filename, chapter, title } = {}) {
  const loaded = readManuscriptText(projectId, filename, chapter);
  const unit = loaded.chapter ?? chapter ?? 1;
  const t = title || loaded.title || `Unit_${unit}`;
  const header = `# ${t}\n\n> 单元 ${unit}\n\n`;
  return {
    filename: `${sanitizeFilename(t)}_unit${unit}.md`,
    content: header + (loaded.content || ''),
    mime: 'text/markdown',
  };
}

/**
 * MVP DOCX: plain text with .docx extension (matches AWR stub).
 */
export function exportDocx(projectId, options = {}) {
  const md = exportMarkdown(projectId, options);
  return {
    filename: md.filename.replace(/\.md$/, '.docx'),
    content: md.content,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

/**
 * Write export file to project exports folder.
 */
export function writeExportFile(projectId, { format = 'md', filename, chapter, title } = {}) {
  const exporter = format === 'docx' ? exportDocx : exportMarkdown;
  const result = exporter(projectId, { filename, chapter, title });
  const dir = path.join(storage.workspacePath(projectId), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, result.filename);
  fs.writeFileSync(outPath, result.content, 'utf8');
  return { path: outPath, filename: result.filename, format };
}
