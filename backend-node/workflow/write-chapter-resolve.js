import * as store from '../storage.js';

/** Resolve the manuscript file created by a write-chapter job. */
export function resolveWrittenChapter(projectId, chapter, title) {
  const expectedName = `第${String(chapter).padStart(4, '0')}章-${title || '未命名'}.md`;
  const chapterPrefix = `第${String(chapter).padStart(4, '0')}章`;

  const chapters = store.listChapters(projectId);
  let hit = chapters.find((c) => c.filename === expectedName);
  if (hit) return hit;

  let drafts = [];
  try {
    drafts = store.listWorkspaceFiles(projectId, 'draft');
  } catch {}

  hit = drafts.find((c) => c.filename === expectedName);
  if (hit) return hit;

  hit = chapters.find((c) => c.filename.startsWith(chapterPrefix));
  if (hit) return hit;

  hit = drafts.find((c) => c.filename.startsWith(chapterPrefix));
  if (hit) return hit;

  return chapters[chapters.length - 1] || drafts[drafts.length - 1] || null;
}
