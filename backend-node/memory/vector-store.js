import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedText, EMBEDDING_DIM } from './embedding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
const LANCE_DIR = path.join(DATA_DIR, 'memory', 'lance');
const FALLBACK_PATH = path.join(DATA_DIR, 'memory', 'vectors.json');

let lanceTable = null;
let lanceAvailable = false;
let fallbackRows = [];

async function initLance() {
  if (lanceTable !== null) return lanceAvailable;
  try {
    // 添加超时保护，防止 LanceDB 初始化挂起
    const initPromise = (async () => {
      const lancedb = await import('@lancedb/lancedb');
      fs.mkdirSync(LANCE_DIR, { recursive: true });
      const db = await lancedb.connect(LANCE_DIR);
      const names = await db.tableNames();
      if (names.includes('chunks')) {
        lanceTable = await db.openTable('chunks');
      } else {
        lanceTable = await db.createTable('chunks', [{
          id: '__init__',
          project_id: '',
          source: '',
          path: '',
          text: '',
          vector: embedText('init'),
        }]);
        await lanceTable.delete('id = "__init__"');
      }
      lanceAvailable = true;
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LanceDB 初始化超时')), 10000)
    );

    await Promise.race([initPromise, timeoutPromise]);
  } catch (err) {
    lanceAvailable = false;
    lanceTable = null;
    loadFallback();
  }
  return lanceAvailable;
}

function loadFallback() {
  try {
    if (fs.existsSync(FALLBACK_PATH)) {
      fallbackRows = JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf-8'));
    }
  } catch {
    fallbackRows = [];
  }
}

function saveFallback() {
  fs.mkdirSync(path.dirname(FALLBACK_PATH), { recursive: true });
  fs.writeFileSync(FALLBACK_PATH, JSON.stringify(fallbackRows, null, 2), 'utf-8');
}

export async function upsertChunks(projectId, chunks) {
  await initLance();
  const rows = chunks.map((c) => ({
    id: c.id,
    project_id: projectId,
    source: c.source,
    path: c.path || '',
    text: c.text.slice(0, 4000),
    vector: embedText(c.text),
  }));

  if (lanceAvailable && lanceTable) {
    try {
      await lanceTable.delete(`project_id = "${projectId}" AND source = "${rows[0]?.source || ''}"`);
    } catch {}
    if (rows.length) await lanceTable.add(rows);
    return { backend: 'lance', count: rows.length };
  }

  fallbackRows = fallbackRows.filter(
    (r) => !(r.project_id === projectId && r.source === (rows[0]?.source || '')),
  );
  fallbackRows.push(...rows);
  if (fallbackRows.length > 50000) fallbackRows = fallbackRows.slice(-50000);
  saveFallback();
  return { backend: 'json', count: rows.length };
}

export async function search(projectId, query, { limit = 8 } = {}) {
  await initLance();
  const qVec = embedText(query);

  if (lanceAvailable && lanceTable) {
    try {
      const results = await lanceTable
        .vectorSearch(qVec)
        .where(`project_id = "${projectId}"`)
        .limit(limit)
        .toArray();
      return results.map((r) => ({
        text: r.text,
        path: r.path,
        source: r.source,
        score: r._distance != null ? 1 - r._distance : null,
      }));
    } catch {
      /* fall through */
    }
  }

  const candidates = fallbackRows.filter((r) => r.project_id === projectId);
  const { cosineSimilarity } = await import('./embedding.js');
  return candidates
    .map((r) => ({
      text: r.text,
      path: r.path,
      source: r.source,
      score: cosineSimilarity(qVec, r.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function chunkText(text, { size = 800, overlap = 120 } = {}) {
  const chunks = [];
  const t = String(text || '');
  if (!t.trim()) return chunks;
  for (let i = 0; i < t.length; i += size - overlap) {
    chunks.push(t.slice(i, i + size));
    if (i + size >= t.length) break;
  }
  return chunks;
}

export async function getStoreInfo() {
  await initLance();
  return {
    lance_available: lanceAvailable,
    lance_dir: LANCE_DIR,
    fallback_path: FALLBACK_PATH,
    fallback_count: fallbackRows.length,
    embedding_dim: EMBEDDING_DIM,
  };
}
