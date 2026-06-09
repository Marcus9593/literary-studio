import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import {
  writeSummaryFile,
  readSummaryFile,
  chapterSummaryPath,
  ensureSummariesDir,
} from './store.js';

function excerpt(text, max = 400) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** 章节完成后级联更新摘要（启发式；精修由 Chief Editor 调 Claude） */
export function updateSummariesAfterChapter(projectId, { filename, title, content } = {}) {
  ensureSummariesDir(projectId);
  const chapters = storage.listChapters(projectId);
  const chNum = chapters.findIndex((c) => c.filename === filename) + 1 || chapters.length;

  const chapterKey = String(chNum).padStart(4, '0');
  const body = content || '';
  const chapterSummary = `# 第${chNum}章摘要 · ${title || '未命名'}

更新时间：${new Date().toISOString()}

## 情节要点
${excerpt(body, 600) || '（待补充）'}

## 人物动向
（待 AI 或作者补充）

## 伏笔/悬念
（待 AI 或作者补充）
`;

  writeSummaryFile(projectId, `chapter_${chapterKey}.md`, chapterSummary);

  const recent = chapters.slice(-5);
  const volumeLines = recent.map((c, i) => {
    const idx = chapters.length - recent.length + i + 1;
    const sum = readSummaryFile(projectId, `chapter_${String(idx).padStart(4, '0')}.md`);
    const line = sum.split('\n').find((l) => l.startsWith('## 情节要点')) || '';
    return `- 第${idx}章 ${c.title}：${excerpt(line.replace('## 情节要点', ''), 120)}`;
  });

  writeSummaryFile(projectId, 'volume_summary.md', `# 当前卷摘要

共 ${chapters.length} 章（截至第 ${chNum} 章）

${volumeLines.join('\n')}
`);

  const meta = storage.getProject(projectId);
  writeSummaryFile(projectId, 'book_summary.md', `# 全书摘要 · ${meta.title}

类型：${meta.genre}
章节数：${chapters.length}

## 一句话
${excerpt(readSummaryFile(projectId, 'volume_summary.md'), 300)}

## 卷级进展
${volumeLines.slice(-8).join('\n')}
`);

  return { chapter_key: chapterKey, chapter_count: chapters.length };
}

export function rebuildAllSummaries(projectId) {
  const ws = storage.workspacePath(projectId);
  const chapters = storage.listChapters(projectId);
  for (const ch of chapters) {
    try {
      const text = decodeBuffer(fs.readFileSync(path.join(ws, '正文', ch.filename)));
      updateSummariesAfterChapter(projectId, {
        filename: ch.filename,
        title: ch.title,
        content: text,
      });
    } catch {}
  }
  return { rebuilt: chapters.length };
}
