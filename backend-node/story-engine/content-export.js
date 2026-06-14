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
 * NOTE: This is an MVP placeholder. The output is plain text wrapped with a
 * .docx extension — it is NOT a real OOXML document. Most word processors will
 * open it as plain text rather than a formatted document. A future iteration
 * should use a library (e.g. docx, officegen) to produce a genuine .docx file.
 */
export function exportDocx(projectId, options = {}) {
  const md = exportMarkdown(projectId, options);
  const mvpNotice = '[MVP 限制] 当前 DOCX 导出为纯文本格式，尚未生成完整的 Word 文档。如需正式排版，请使用「导出 MD」后在 Word 中手动导入。\n\n';
  return {
    filename: md.filename.replace(/\.md$/, '.docx'),
    content: mvpNotice + md.content,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    _mvp: true,
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
