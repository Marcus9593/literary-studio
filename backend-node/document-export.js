import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWorkspaceZip } from './zip-export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EXPORT_CLI = path.join(ROOT, 'backend', 'export_cli.py');

function findPython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const venvPython = path.join(ROOT, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPython)) return venvPython;
  return 'python3';
}

let docxExportAvailableCache = null;

export function isDocxExportAvailable() {
  if (docxExportAvailableCache !== null) return docxExportAvailableCache;
  const py = findPython();
  if (!fs.existsSync(EXPORT_CLI)) {
    docxExportAvailableCache = false;
    return false;
  }
  try {
    const probe = spawnSync(py, [EXPORT_CLI, '--mode', 'check'], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    if (probe.status === 0) {
      const data = JSON.parse(probe.stdout?.trim() || '{}');
      docxExportAvailableCache = !!data.available;
      return docxExportAvailableCache;
    }
  } catch {}
  docxExportAvailableCache = false;
  return false;
}

export function getExportFormatsHint() {
  return {
    zip: 'Markdown 项目包（含正文、大纲、设定等）',
    docx: '合并为一份 Word 文档（需 Python：pip install -r backend/requirements.txt）',
    zip_docx: 'ZIP 包，每章一个 Word 文件',
    epub: 'EPUB 电子书（可在 Apple Books / Kindle 预览）',
    md: '当前章节 Markdown 原文件',
    chapter_docx: '当前章节 Word（由 Markdown 转换）',
  };
}

/**
 * Convert markdown string to .docx bytes via Python CLI.
 */
export function markdownToDocxFile(markdown, { title = '', outputPath } = {}) {
  if (!isDocxExportAvailable()) {
    throw new Error(
      'Word 导出需要 Python 环境。请运行：pip install -r backend/requirements.txt',
    );
  }
  const py = findPython();
  const tmpMd = path.join(
    os.tmpdir(),
    `ls-export-${Date.now()}-${Math.random().toString(36).slice(2)}.md`,
  );
  fs.writeFileSync(tmpMd, markdown, 'utf-8');
  try {
    const result = spawnSync(
      py,
      [
        EXPORT_CLI,
        '--mode', 'md_to_docx',
        '--md-file', tmpMd,
        '--output', outputPath,
        '--title', title || '',
      ],
      { encoding: 'utf-8', timeout: 120000, maxBuffer: 50 * 1024 * 1024 },
    );
    const stderr = result.stderr?.trim() || '';
    const stdout = result.stdout?.trim() || '';
    if (result.status !== 0) {
      let message = stderr || stdout;
      try {
        message = JSON.parse(stderr || stdout).error || message;
      } catch {}
      throw new Error(message || 'Word 导出失败');
    }
    if (!fs.existsSync(outputPath)) {
      throw new Error('Word 导出未生成文件');
    }
    return outputPath;
  } finally {
    try { fs.unlinkSync(tmpMd); } catch {}
  }
}

/**
 * Build a zip of per-chapter docx files under exportDir.
 */
export async function createChaptersDocxZip(chapters, { readChapter, exportDir, zipBasename }) {
  if (!isDocxExportAvailable()) {
    throw new Error(
      'Word 导出需要 Python 环境。请运行：pip install -r backend/requirements.txt',
    );
  }
  const workDir = path.join(exportDir, `docx-${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const written = [];
  for (const ch of chapters) {
    const content = await readChapter(ch.filename);
    const base = String(ch.title || ch.filename).replace(/\.md$/i, '');
    const safe = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'chapter';
    const outDocx = path.join(workDir, `${safe}.docx`);
    markdownToDocxFile(content, { title: ch.title || safe, outputPath: outDocx });
    written.push(outDocx);
  }
  if (!written.length) {
    throw new Error('没有可导出的章节');
  }
  const zipPath = path.join(exportDir, zipBasename);
  try { fs.unlinkSync(zipPath); } catch {}
  await createWorkspaceZip(workDir, zipPath);
  try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  return zipPath;
}
