import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { chunkText, upsertChunks, search } from './vector-store.js';
import { emit, EVENTS } from '../event-bus/bus.js';

const INDEX_DIRS = [
  { source: 'manuscript', dirs: ['正文', '试验稿'] },
  { source: 'outline', dirs: ['大纲'] },
  { source: 'settings', dirs: ['设定集'] },
];

function listMdFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

export async function indexProject(projectId) {
  const ws = storage.workspacePath(projectId);
  let total = 0;

  for (const group of INDEX_DIRS) {
    for (const sub of group.dirs) {
      const dir = path.join(ws, sub);
      const files = listMdFiles(dir);
      const allChunks = [];

      for (const file of files) {
        let text = '';
        try {
          text = decodeBuffer(fs.readFileSync(path.join(dir, file)));
        } catch { continue; }

        const parts = chunkText(text);
        parts.forEach((part, idx) => {
          allChunks.push({
            id: `${projectId}:${group.source}:${file}:${idx}`,
            source: group.source,
            path: `${sub}/${file}`,
            text: part,
          });
        });
      }

      if (allChunks.length) {
        const res = await upsertChunks(projectId, allChunks);
        total += res.count;
      }
    }
  }

  return { project_id: projectId, chunks_indexed: total };
}

export async function indexIfStale(projectId) {
  try {
    const result = await indexProject(projectId);
    if (result.chunks_indexed > 0) {
      await emit(EVENTS.MEMORY_INDEXED, { projectId, ...result });
    }
    return result;
  } catch (err) {
    return { project_id: projectId, error: err.message, chunks_indexed: 0 };
  }
}

export async function retrieveContext(projectId, query, { limit = 6 } = {}) {
  const results = await search(projectId, query, { limit });
  if (!results.length) return '';

  const blocks = results
    .filter((r) => r.text?.trim())
    .map((r, i) => `[${i + 1}] ${r.path || r.source}\n${r.text.trim()}`);

  if (!blocks.length) return '';

  return `相关记忆检索（RAG，${blocks.length} 条）：\n${blocks.join('\n\n')}`;
}
