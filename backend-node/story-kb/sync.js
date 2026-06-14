import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { loadKnowledgeBundle, saveKnowledgeFile } from './store.js';
import { listCharacters } from './entity-resolver.js';
import { rebuildStoryIndex } from '../story-index/build.js';
import { isPlausibleCharacterName } from './character-name-filter.js';

function now() {
  return new Date().toISOString();
}

/** 从设定集 Markdown 粗提取人物名（启发式，后续由 Claude 精修） */
function extractNamesFromSettings(text) {
  const names = new Set();
  const patterns = [
    /(?:姓名|名字|角色)[：:]\s*([^\n，,。]{2,8})/g,
    /^#{1,3}\s*([^\n#]{2,10})$/gm,
    /\*\*([^*]{2,8})\*\*/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const n = m[1].trim();
      if (n.length >= 2 && n.length <= 12 && isPlausibleCharacterName(n)) {
        names.add(n);
      }
    }
  }
  return [...names];
}

export function bootstrapFromWorkspace(projectId) {
  const ws = storage.workspacePath(projectId);
  const bundle = loadKnowledgeBundle(projectId);
  const characters = bundle.characters || { items: [] };
  const existingIds = new Set((characters.items || []).map((c) => c.id || c.name));

  const settingsDir = path.join(ws, '设定集');
  if (fs.existsSync(settingsDir)) {
    for (const file of fs.readdirSync(settingsDir).filter((f) => f.endsWith('.md'))) {
      try {
        const text = decodeBuffer(fs.readFileSync(path.join(settingsDir, file)));
        for (const name of extractNamesFromSettings(text)) {
          if (existingIds.has(name)) continue;
          existingIds.add(name);
          characters.items.push({
            id: name,
            name,
            role: 'unknown',
            source_file: `设定集/${file}`,
            notes: '',
          });
        }
      } catch {}
    }
  }

  const outlinePath = path.join(ws, '大纲', '总纲.md');
  let logline = bundle.story_summary?.logline || '';
  if (fs.existsSync(outlinePath)) {
    try {
      const outline = decodeBuffer(fs.readFileSync(outlinePath));
      const firstLine = outline.split('\n').find((l) => l.trim() && !l.startsWith('#'));
      if (firstLine && !logline) logline = firstLine.trim().slice(0, 200);
    } catch {}
  }

  saveKnowledgeFile(projectId, 'characters', characters);
  saveKnowledgeFile(projectId, 'story_summary', {
    ...bundle.story_summary,
    logline,
    updated_at: now(),
  });

  rebuildStoryIndex(projectId);
  return loadKnowledgeBundle(projectId);
}

export function getKnowledgePromptBlock(projectId, { maxChars = 6000 } = {}) {
  const kb = loadKnowledgeBundle(projectId);
  const compact = {
    story_summary: kb.story_summary,
    characters: (() => {
      const resolved = listCharacters(projectId);
      const source = resolved.length
        ? resolved.map((r) => ({ id: r.canonicalId, name: r.canonicalName, role: r.entity?.role, traits: r.entity?.traits }))
        : (kb.characters?.items || []).slice(0, 40).map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          traits: c.traits,
        }));
      return source.slice(0, 40);
    })(),
    relationships: (kb.relationships?.items || []).slice(0, 30),
    timeline: (kb.timeline?.events || []).slice(-20),
    locations: (kb.locations?.items || []).slice(0, 20),
    foreshadows: (kb.foreshadows?.items || []).slice(0, 20),
  };

  let text = `【故事知识库 Story KB — 优先于向量检索】\n${JSON.stringify(compact, null, 2)}`;
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}…`;
  }
  return `\n\n---\n\n${text}`;
}
