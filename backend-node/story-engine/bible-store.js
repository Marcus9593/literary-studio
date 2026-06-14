import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { knowledgeDir } from '../story-kb/paths.js';

const BIBLE_FILE = 'bible.json';

function biblePath(projectId) {
  return path.join(knowledgeDir(projectId), BIBLE_FILE);
}

function now() {
  return new Date().toISOString();
}

export function emptyBible() {
  return {
    version: 1,
    updated_at: now(),
    title: '',
    genre: '',
    logline: '',
    setting: '',
    tone: '',
    themes: '',
    sections: [],
    changelog: [],
  };
}

export function loadBible(projectId) {
  const fp = biblePath(projectId);
  if (!fs.existsSync(fp)) return emptyBible();
  try {
    return { ...emptyBible(), ...JSON.parse(fs.readFileSync(fp, 'utf8')) };
  } catch {
    return emptyBible();
  }
}

function appendChangelog(bible, entries) {
  const changelog = [...(bible.changelog || [])];
  for (const e of entries) {
    changelog.unshift({
      at: now(),
      field: e.field,
      section_id: e.section_id || null,
      old_value: e.old_value ?? '',
      new_value: e.new_value ?? '',
    });
  }
  return changelog.slice(0, 100);
}

export function saveBible(projectId, patch) {
  const current = loadBible(projectId);
  const changes = [];

  for (const key of ['title', 'genre', 'logline', 'setting', 'tone', 'themes']) {
    if (patch[key] !== undefined && patch[key] !== current[key]) {
      changes.push({ field: key, old_value: current[key], new_value: patch[key] });
      current[key] = patch[key];
    }
  }

  if (patch.sections) {
    changes.push({ field: 'sections', old_value: `${(current.sections || []).length} sections`, new_value: `${patch.sections.length} sections` });
    current.sections = patch.sections;
  }

  // 合并外部传入的 changelog（来自 upsertBibleSection/deleteBibleSection）
  const externalChangelog = Array.isArray(patch.changelog) ? patch.changelog : [];
  const allChanges = [...changes, ...externalChangelog];

  if (allChanges.length) {
    current.changelog = appendChangelog(current, allChanges);
  }

  current.updated_at = now();
  fs.mkdirSync(knowledgeDir(projectId), { recursive: true });
  fs.writeFileSync(biblePath(projectId), JSON.stringify(current, null, 2), 'utf8');
  return current;
}

export function upsertBibleSection(projectId, section) {
  const bible = loadBible(projectId);
  const sections = [...(bible.sections || [])];
  const id = section.id || `sec_${randomUUID().slice(0, 8)}`;
  const idx = sections.findIndex((s) => s.id === id);

  const next = {
    id,
    title: section.title || '',
    type: section.type || 'custom',
    content: section.content || '',
    updated_at: now(),
  };

  const changelogEntries = [];

  if (idx >= 0) {
    // 收集变更记录
    const oldSec = sections[idx];
    if (oldSec.content !== next.content) {
      changelogEntries.push({
        field: 'section_content',
        section_id: oldSec.id,
        old_value: (oldSec.content || '').slice(0, 80),
        new_value: (next.content || '').slice(0, 80),
      });
    }
    sections[idx] = next;
  } else {
    sections.push(next);
    changelogEntries.push({ field: 'section_add', section_id: id, new_value: next.title });
  }

  // 将 changelog 条目作为 patch 的一部分传递给 saveBible
  return saveBible(projectId, { ...bible, sections, changelog: changelogEntries });
}

export function deleteBibleSection(projectId, sectionId) {
  const bible = loadBible(projectId);
  const sections = (bible.sections || []).filter((s) => s.id !== sectionId);
  // 将 changelog 条目作为 patch 的一部分传递给 saveBible
  return saveBible(projectId, {
    ...bible,
    sections,
    changelog: [{ field: 'section_delete', section_id: sectionId }],
  });
}
