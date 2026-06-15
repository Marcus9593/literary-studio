import fs from 'fs';
import path from 'path';
import { knowledgePath } from '../story-kb/paths.js';

const PLACEHOLDER_RE = /^(待补充|暂无|未填写|tbd|todo|-+|\.*)$/i;

export function cleanSummaryText(text) {
  return String(text || '')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function isUsableSummary(text) {
  const s = cleanSummaryText(text);
  if (s.length < 4) return false;
  if (PLACEHOLDER_RE.test(s)) return false;
  return true;
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readOutlineLogline(workspace) {
  if (!workspace) return '';
  const fp = path.join(workspace, '大纲', '总纲.md');
  if (!fs.existsSync(fp)) return '';
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    const m = raw.match(/一句话概述\s*\n+([^#\n][\s\S]*?)(?=\n##|\n#|$)/);
    if (m?.[1]) return cleanSummaryText(m[1]);
    const afterTitle = raw.replace(/^#[^\n]*\n+/, '').trim();
    const block = afterTitle.split(/\n##/)[0] || '';
    return cleanSummaryText(block);
  } catch {
    return '';
  }
}

function readKbLogline(projectId) {
  const fp = knowledgePath(projectId, 'story_summary.json');
  if (!fs.existsSync(fp)) return '';
  const data = readJsonSafe(fp);
  return cleanSummaryText(data?.logline || '');
}

/** 项目卡片简述：自定义 > 重写备注 > 知识库 > 大纲 > 最新章节摘录 */
export function resolveProjectCardSummary(meta, chapters = []) {
  const custom = cleanSummaryText(meta.summary);
  if (isUsableSummary(custom)) {
    return { text: custom, source: 'custom' };
  }

  const rewrite = cleanSummaryText(meta.rewrite_note);
  if (isUsableSummary(rewrite)) {
    return { text: rewrite, source: 'rewrite' };
  }

  const kb = readKbLogline(meta.id);
  if (isUsableSummary(kb)) {
    return { text: kb, source: 'kb' };
  }

  const outline = readOutlineLogline(meta.workspace);
  if (isUsableSummary(outline)) {
    return { text: outline, source: 'outline' };
  }

  const last = chapters[chapters.length - 1];
  if (last?.preview) {
    const excerpt = cleanSummaryText(last.preview);
    if (excerpt.length >= 12) {
      return { text: excerpt, source: 'chapter' };
    }
  }

  return { text: '', source: 'empty' };
}
