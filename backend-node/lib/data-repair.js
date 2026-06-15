import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decodeBuffer } from './encoding.js';
import { isCorruptedManuscript } from '../ai-runtime/output-sanitize.js';
import { filterInferredCharacterItems, isPlausibleCharacterName } from '../story-kb/character-name-filter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = process.env.LITERARY_STUDIO_DATA
  || path.resolve(__dirname, '../data');
const PROJECTS_DIR = path.join(DATA_ROOT, 'projects');

const RECOVERY_STUB = `# 第5章（待重写）

> 本章内容因历史写稿管道错误（AI 工具调用残留）已损坏，且无可用版本快照。
> 请在工作台重新撰写本章正文。

`;

/** 启动时修复已知损坏数据 */
export function runStartupDataRepairs() {
  let manuscripts = 0;
  let characters = 0;

  if (!fs.existsSync(PROJECTS_DIR)) {
    return { manuscripts, characters };
  }

  for (const projectId of fs.readdirSync(PROJECTS_DIR)) {
    const ws = path.join(PROJECTS_DIR, projectId, 'workspace');
    if (!fs.existsSync(ws)) continue;

    for (const sub of ['正文', '试验稿']) {
      const dir = path.join(ws, sub);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const fp = path.join(dir, file);
        try {
          const text = decodeBuffer(fs.readFileSync(fp));
          if (!isCorruptedManuscript(text)) continue;
          fs.writeFileSync(fp, RECOVERY_STUB.replace('第5章', file.replace(/\.md$/, '')), 'utf-8');
          manuscripts += 1;
        } catch { /* skip */ }
      }
    }

    let removed = 0;

    const legacyCharsPath = path.join(PROJECTS_DIR, projectId, 'knowledge', 'characters.json');
    if (fs.existsSync(legacyCharsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(legacyCharsPath, 'utf-8'));
        const before = data.items?.length || 0;
        const filtered = filterInferredCharacterItems(data.items || []);
        if (filtered.length < before) {
          fs.writeFileSync(legacyCharsPath, JSON.stringify({
            ...data,
            items: filtered,
            updated_at: new Date().toISOString(),
          }, null, 2), 'utf-8');
          removed += before - filtered.length;
        }
      } catch { /* skip */ }
    }

    const entitiesCharsPath = path.join(PROJECTS_DIR, projectId, 'knowledge', 'entities', 'characters.json');
    if (fs.existsSync(entitiesCharsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(entitiesCharsPath, 'utf-8'));
        const before = data.items?.length || 0;
        const filtered = (data.items || []).filter((c) => {
          if (c.source !== 'inferred') return true;
          return isPlausibleCharacterName(c.name || c.legacy_id);
        });
        if (filtered.length < before) {
          fs.writeFileSync(entitiesCharsPath, JSON.stringify({
            ...data,
            items: filtered,
            updated_at: new Date().toISOString(),
          }, null, 2), 'utf-8');
          removed += before - filtered.length;
        }
      } catch { /* skip */ }
    }

    characters += removed;
  }

  if (manuscripts || characters) {
    console.log(`  [repair] 已修复损坏文稿 ${manuscripts} 个，清理推断人物 ${characters} 条`);
  }

  return { manuscripts, characters };
}
