import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { manuscriptDirForMode } from '../projectProfile.js';
import { isPlausibleCharacterName } from './character-name-filter.js';

/** 扫描 workspace 源文件，供快速同步 / 全书理解使用 */
export function scanSources(projectId, { latestChapters = 10 } = {}) {
  const ws = storage.workspacePath(projectId);
  const meta = storage.getProject(projectId);
  const primaryDir = manuscriptDirForMode(meta.creation_mode || 'scratch');

  const chapters = storage.listChapters(projectId);
  const recent = chapters.slice(-Math.max(1, latestChapters));

  const readMdDir = (subdir) => {
    const dir = path.join(ws, subdir);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((filename) => {
        const fp = path.join(dir, filename);
        try {
          const text = decodeBuffer(fs.readFileSync(fp));
          return { filename, path: `${subdir}/${filename}`, text, words: text.length };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  };

  const chapterTexts = recent.map((ch) => {
    let fp = path.join(ws, primaryDir, ch.filename);
    if (!fs.existsSync(fp)) {
      for (const sub of ['正文', '试验稿']) {
        const alt = path.join(ws, sub, ch.filename);
        if (fs.existsSync(alt)) {
          fp = alt;
          break;
        }
      }
    }
    try {
      const text = decodeBuffer(fs.readFileSync(fp));
      return {
        filename: ch.filename,
        title: ch.title,
        index: chapters.findIndex((c) => c.filename === ch.filename) + 1,
        text,
        words: text.length,
      };
    } catch {
      return { filename: ch.filename, title: ch.title, index: 0, text: '', words: 0 };
    }
  });

  return {
    project_id: projectId,
    scanned_at: new Date().toISOString(),
    mode_hint: latestChapters >= chapters.length ? 'full' : 'quick',
    chapters_total: chapters.length,
    chapters_scanned: chapterTexts.length,
    chapters: chapterTexts,
    outline: readMdDir('大纲'),
    settings: readMdDir('设定集'),
    summaries_dir: path.join(ws, '.webnovel', 'summaries'),
  };
}

/** 统计角色名在章节中的出现次数 */
export function countNameMentions(chapters, name) {
  if (!name) return 0;
  let n = 0;
  for (const ch of chapters) {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    n += (ch.text.match(re) || []).length;
  }
  return n;
}

/** 章节序号（从 filename 或列表 index） */
export function chapterNumber(chapters, filename) {
  const idx = chapters.findIndex((c) => c.filename === filename);
  return idx >= 0 ? idx + 1 : null;
}

/** 正文对话启发式提取人物名（KB 为空时兜底） */
export function inferCharacterNames(chapters, { limit = 4, minMentions = 2 } = {}) {
  const freq = new Map();
  const skip = new Set(['什么', '怎么', '为什么', '可以', '不是', '这个', '那个', '自己', '他们', '我们', '你们', '大家', '这时', '此时', '一声', '一句', '只见', '突然', '然后', '不过', '因为', '所以', '如果', '已经', '没有', '知道', '觉得', '看着', '一声', '淡淡', '冷冷', '轻轻', '默默']);

  for (const ch of chapters) {
    const text = ch.text || '';
    const patterns = [
      /[\u4e00-\u9fa5]{2,4}(?=说|道|问|答|喊|叫|笑|怒|叹|回|提|想)/g,
      /[「『][^」』]{0,12}[」』]\s*([\u4e00-\u9fa5]{2,4})/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text))) {
        const name = (m[1] || m[0]).replace(/[说道问答喊叫笑怒叹回提想]$/, '').trim();
        if (name.length < 2 || name.length > 4 || skip.has(name)) continue;
        freq.set(name, (freq.get(name) || 0) + 1);
      }
    }
  }

  return [...freq.entries()]
    .filter(([name, count]) => count >= minMentions && isPlausibleCharacterName(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}
