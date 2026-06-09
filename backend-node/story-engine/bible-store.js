import fs from 'fs';
import path from 'path';
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

  if (changes.length) {
    current.changelog = appendChangelog(current, changes);
  }

  current.updated_at = now();
  fs.mkdirSync(knowledgeDir(projectId), { recursive: true });
  fs.writeFileSync(biblePath(projectId), JSON.stringify(current, null, 2), 'utf8');
  return current;
}

export function upsertBibleSection(projectId, section) {
  const bible = loadBible(projectId);
  const sections = [...(bible.sections || [])];
  const id = section.id || `sec_${Date.now()}`;
  const idx = sections.findIndex((s) => s.id === id);

  const next = {
    id,
    title: section.title || '',
    type: section.type || 'custom',
    content: section.content || '',
    updated_at: now(),
  };

  if (idx >= 0) {
    changesPush(bible, sections[idx], next);
    sections[idx] = next;
  } else {
    sections.push(next);
    bible.changelog = appendChangelog(bible, [{ field: 'section_add', section_id: id, new_value: next.title }]);
  }

  return saveBible(projectId, { ...bible, sections });
}

function changesPush(bible, oldSec, newSec) {
  if (oldSec.content !== newSec.content) {
    bible.changelog = appendChangelog(bible, [{
      field: 'section_content',
      section_id: oldSec.id,
      old_value: (oldSec.content || '').slice(0, 80),
      new_value: (newSec.content || '').slice(0, 80),
    }]);
  }
}

export function deleteBibleSection(projectId, sectionId) {
  const bible = loadBible(projectId);
  const sections = (bible.sections || []).filter((s) => s.id !== sectionId);
  bible.changelog = appendChangelog(bible, [{ field: 'section_delete', section_id: sectionId }]);
  return saveBible(projectId, { ...bible, sections });
}
