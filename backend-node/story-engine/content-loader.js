import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../lib/encoding.js';
import { loadKnowledgeBundle } from '../story-kb/store.js';
import { loadUnderstandingBundle } from '../story-understanding/store.js';

export function readManuscriptText(projectId, filename, chapter) {
  const chapters = storage.listChapters(projectId);
  const safe = filename ? path.basename(filename) : null;

  if (!safe && chapter != null) {
    const chNum = parseInt(chapter, 10);
    const byNum = chapters.find((c) => c.number === chNum)
      || chapters.find((c) => String(c.filename || '').includes(`第${chNum}`));
    if (byNum) {
      const fp = storage.resolveManuscriptPath(projectId, byNum.filename);
      return {
        content: decodeBuffer(fs.readFileSync(fp)),
        filename: byNum.filename,
        chapter: byNum.number ?? chNum,
        title: byNum.title,
      };
    }
  }

  if (safe) {
    const fp = storage.resolveManuscriptPath(projectId, safe);
    const ch = chapters.find((c) => c.filename === safe);
    return {
      content: fs.existsSync(fp) ? decodeBuffer(fs.readFileSync(fp)) : '',
      filename: safe,
      chapter: ch?.number ?? null,
      title: ch?.title ?? safe,
    };
  }

  if (!chapters.length) {
    return { content: '', filename: null, chapter: null, title: null };
  }

  const last = chapters[chapters.length - 1];
  const fp = storage.resolveManuscriptPath(projectId, last.filename);
  return {
    content: decodeBuffer(fs.readFileSync(fp)),
    filename: last.filename,
    chapter: last.number ?? chapters.length,
    title: last.title,
  };
}

export function loadCriticContext(projectId, { filename, chapter } = {}) {
  const meta = storage.getProject(projectId);
  const loaded = readManuscriptText(projectId, filename, chapter);

  const kb = loadKnowledgeBundle(projectId);
  const characterNames = (kb.characters?.items || [])
    .map((c) => c.name)
    .filter(Boolean);

  let bibleThemes = '';
  try {
    const u = loadUnderstandingBundle(projectId);
    bibleThemes = u?.story_dna?.themes?.join?.(' ') || u?.story_dna?.one_liner || '';
  } catch {
    bibleThemes = '';
  }

  return {
    ...loaded,
    work_type: meta.work_type || 'novel_long',
    character_names: characterNames,
    bible_themes: bibleThemes,
  };
}
