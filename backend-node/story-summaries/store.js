import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { summariesDir } from '../story-kb/paths.js';

const SUMMARY_FILES = {
  book: 'book_summary.md',
  volume: 'volume_summary.md',
};

export function ensureSummariesDir(projectId) {
  const dir = summariesDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function chapterSummaryPath(projectId, chapterKey) {
  return path.join(ensureSummariesDir(projectId), `chapter_${chapterKey}.md`);
}

export function readSummaryFile(projectId, filename) {
  const fp = path.join(ensureSummariesDir(projectId), filename);
  if (!fs.existsSync(fp)) return '';
  try {
    return decodeBuffer(fs.readFileSync(fp));
  } catch {
    return '';
  }
}

export function writeSummaryFile(projectId, filename, content) {
  const fp = path.join(ensureSummariesDir(projectId), filename);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf-8');
  return fp;
}

export function listChapterSummaries(projectId) {
  const dir = ensureSummariesDir(projectId);
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith('chapter_') && f.endsWith('.md'))
    .sort();
}

export function loadSummaryHierarchy(projectId) {
  return {
    book: readSummaryFile(projectId, SUMMARY_FILES.book),
    volume: readSummaryFile(projectId, SUMMARY_FILES.volume),
    chapters: listChapterSummaries(projectId).map((f) => ({
      file: f,
      content: readSummaryFile(projectId, f),
    })),
  };
}

export function getSummaryPromptBlock(projectId, { maxChars = 5000 } = {}) {
  const book = readSummaryFile(projectId, SUMMARY_FILES.book);
  const volume = readSummaryFile(projectId, SUMMARY_FILES.volume);
  const chapters = listChapterSummaries(projectId);
  const latestChapter = chapters.length
    ? readSummaryFile(projectId, chapters[chapters.length - 1])
    : '';

  const parts = [];
  if (book) parts.push(`## 全书摘要\n${book}`);
  if (volume) parts.push(`## 卷摘要\n${volume}`);
  if (latestChapter) parts.push(`## 最新章节摘要\n${latestChapter}`);

  if (!parts.length) return '';

  let block = `【摘要体系 — 创作前优先阅读顺序：全书 → 卷 → 章 → 正文】\n\n${parts.join('\n\n')}`;
  if (block.length > maxChars) block = `${block.slice(0, maxChars)}…`;
  return `\n\n---\n\n${block}`;
}
