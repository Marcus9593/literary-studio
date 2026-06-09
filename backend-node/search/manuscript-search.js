import fs from 'fs';
import path from 'path';
import { workspacePath, listChapters } from '../storage.js';
import { decodeBuffer } from '../encoding.js';

const SEARCH_DIRS = [
  { category: 'manuscript', subdir: '正文' },
  { category: 'draft', subdir: '试验稿' },
  { category: 'outline', subdir: '大纲' },
  { category: 'settings', subdir: '设定集' },
  { category: 'archive', subdir: 'archive' },
];

function walkMdFiles(dir, ws, category, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMdFiles(abs, ws, category, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
    out.push({
      category,
      filename: entry.name,
      relPath: path.relative(ws, abs),
      absPath: abs,
    });
  }
}

function listSearchableFiles(projectId) {
  const ws = workspacePath(projectId);
  const files = [];
  for (const { category, subdir } of SEARCH_DIRS) {
    walkMdFiles(path.join(ws, subdir), ws, category, files);
  }
  return files;
}

function buildMatcher(query, useRegex) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (useRegex) {
    try {
      return { re: new RegExp(q, 'gi'), literal: null };
    } catch {
      throw new Error('无效的正则表达式');
    }
  }
  return { re: null, literal: q.toLowerCase() };
}

function excerptLine(line, matchIndex, matchLen) {
  const pad = 40;
  const start = Math.max(0, matchIndex - pad);
  const end = Math.min(line.length, matchIndex + matchLen + pad);
  let text = line.slice(start, end);
  if (start > 0) text = `…${text}`;
  if (end < line.length) text = `${text}…`;
  return text;
}

/**
 * 跨章节全文搜索
 * @returns {{ query, regex, hits: Array, total }}
 */
export function searchProjectManuscripts(projectId, query, { regex = false, limit = 80 } = {}) {
  const matcher = buildMatcher(query, regex);
  if (!matcher) return { query: '', regex: false, hits: [], total: 0 };

  const files = listSearchableFiles(projectId);
  const chapterMeta = listChapters(projectId);
  const titleByFile = new Map(chapterMeta.map((c) => [c.filename, c.title]));

  const hits = [];
  let total = 0;

  for (const file of files) {
    let text;
    try {
      text = decodeBuffer(fs.readFileSync(file.absPath));
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
      const line = lines[lineNo];
      if (matcher.re) {
        matcher.re.lastIndex = 0;
        let m = matcher.re.exec(line);
        while (m) {
          total += 1;
          if (hits.length < limit) {
            hits.push({
              category: file.category,
              filename: file.filename,
              title: titleByFile.get(file.filename) || file.filename.replace(/\.md$/i, ''),
              line: lineNo + 1,
              column: m.index + 1,
              excerpt: excerptLine(line, m.index, m[0].length),
              match: m[0],
            });
          }
          m = matcher.re.exec(line);
        }
      } else {
        const lower = line.toLowerCase();
        let idx = lower.indexOf(matcher.literal);
        while (idx !== -1) {
          total += 1;
          if (hits.length < limit) {
            hits.push({
              category: file.category,
              filename: file.filename,
              title: titleByFile.get(file.filename) || file.filename.replace(/\.md$/i, ''),
              line: lineNo + 1,
              column: idx + 1,
              excerpt: excerptLine(line, idx, matcher.literal.length),
              match: line.slice(idx, idx + matcher.literal.length),
            });
          }
          idx = lower.indexOf(matcher.literal, idx + 1);
        }
      }
    }
  }

  return {
    query: String(query).trim(),
    regex: Boolean(regex),
    hits,
    total,
    truncated: total > hits.length,
  };
}
