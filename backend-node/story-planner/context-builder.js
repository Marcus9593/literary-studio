import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../lib/encoding.js';
import { loadUnderstandingBundle } from '../story-understanding/store.js';
import { loadKnowledgeBundle } from '../story-kb/store.js';
import { listCharacters } from '../story-kb/entity-resolver.js';
import { loadPreferences } from './store.js';

function readOutlineExcerpt(projectId, maxLen = 2000) {
  const ws = storage.workspacePath(projectId);
  const fp = path.join(ws, '大纲', '总纲.md');
  if (!fs.existsSync(fp)) return '';
  try {
    const text = decodeBuffer(fs.readFileSync(fp));
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  } catch {
    return '';
  }
}

function latestChapterSnippet(projectId) {
  const chapters = storage.listChapters(projectId);
  if (!chapters.length) return { index: 0, title: '', excerpt: '' };
  const ch = chapters[chapters.length - 1];
  try {
    const fp = storage.resolveManuscriptPath(projectId, ch.filename);
    const text = decodeBuffer(fs.readFileSync(fp));
    const tail = text.length > 600 ? text.slice(-600) : text;
    return {
      index: chapters.length,
      title: ch.title || ch.filename,
      filename: ch.filename,
      excerpt: tail.replace(/\s+/g, ' ').trim(),
    };
  } catch {
    return { index: chapters.length, title: ch.title, filename: ch.filename, excerpt: '' };
  }
}

/**
 * 只读组装规划上下文（不写 understanding）
 */
export function buildPlannerContext(projectId, opts = {}) {
  const chapters = storage.listChapters(projectId);
  const currentChapter = chapters.length;
  const prefs = loadPreferences(projectId);
  const horizon = ALLOWED_HORIZON(opts.horizon ?? prefs.default_horizon);

  let understanding = {};
  let kb = {};
  try {
    understanding = loadUnderstandingBundle(projectId);
  } catch {}
  try {
    kb = loadKnowledgeBundle(projectId);
  } catch {}

  const dna = understanding.story_dna || {};
  const latest = latestChapterSnippet(projectId);

  let entityCatalog = [];
  try {
    entityCatalog = listCharacters(projectId).map((r) => ({
      id: r.canonicalId,
      name: r.canonicalName,
      status: r.status,
      aliases: r.aliases,
    }));
  } catch {}

  return {
    projectId,
    currentChapter,
    horizon,
    preferences: prefs,
    storyDna: dna,
    arcs: understanding.arcs?.items || [],
    conflicts: understanding.conflicts?.items || [],
    entityCatalog,
    kb,
    outlineExcerpt: readOutlineExcerpt(projectId),
    latestChapter: latest,
    meta: storage.getProject(projectId),
  };
}

function ALLOWED_HORIZON(h) {
  const n = parseInt(h, 10);
  if ([5, 10, 20, 50].includes(n)) return n;
  return 5;
}
