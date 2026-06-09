import { getStoryIndex, rebuildStoryIndex } from './build.js';

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function matchText(hay, needle) {
  return norm(hay).includes(norm(needle));
}

export function findCharacter(projectId, nameOrQuery) {
  rebuildStoryIndex(projectId);
  const index = getStoryIndex(projectId);
  const q = String(nameOrQuery || '').trim();
  if (!q) return [];

  const results = [];
  for (const [key, char] of index.characters) {
    const names = [key, char.name, ...(char.aliases || [])].filter(Boolean);
    if (names.some((n) => matchText(n, q) || matchText(q, n))) {
      results.push(char);
    }
  }
  return results;
}

export function findRelationship(projectId, query = '') {
  const index = getStoryIndex(projectId);
  const q = norm(query);
  if (!q) return index.relationships;
  return index.relationships.filter((r) => {
    const blob = JSON.stringify(r);
    return matchText(blob, q);
  });
}

export function findTimeline(projectId, query = '') {
  const index = getStoryIndex(projectId);
  const q = norm(query);
  if (!q) return index.timeline;
  return index.timeline.filter((e) => {
    const blob = `${e.title || ''} ${e.description || ''} ${e.chapter || ''}`;
    return matchText(blob, q);
  });
}

export function findForeshadow(projectId, query = '') {
  const index = getStoryIndex(projectId);
  const q = norm(query);
  if (!q) return index.foreshadows;
  return index.foreshadows.filter((f) => {
    const blob = `${f.id || ''} ${f.description || ''} ${f.status || ''}`;
    return matchText(blob, q);
  });
}

export function findLocation(projectId, query = '') {
  const index = getStoryIndex(projectId);
  const q = norm(query);
  if (!q) return index.locations;
  return index.locations.filter((l) => matchText(JSON.stringify(l), q));
}

/** 结构化问答：两人首次见面等 */
export function queryStory(projectId, question) {
  const q = String(question || '');
  const chars = findCharacter(projectId, q);
  const rel = findRelationship(projectId, q);
  const timeline = findTimeline(projectId, q);
  const foreshadows = findForeshadow(projectId, q);
  const locations = findLocation(projectId, q);

  const nameHits = [...q.matchAll(/[\u4e00-\u9fa5]{2,4}/g)].map((m) => m[0]);
  const characterPairs = [];
  for (const n of nameHits) {
    const found = findCharacter(projectId, n);
    if (found.length) characterPairs.push(...found);
  }

  return {
    question: q,
    characters: chars.length ? chars : characterPairs,
    relationships: rel.slice(0, 10),
    timeline: timeline.slice(0, 10),
    foreshadows: foreshadows.slice(0, 10),
    locations: locations.slice(0, 10),
    hint: chars.length || timeline.length
      ? '结果来自 Story Index（知识库），非全文 RAG'
      : '未命中索引，可执行知识库重建或补充 characters.json',
  };
}
