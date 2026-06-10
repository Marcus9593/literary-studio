#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const S = path.join(__dirname, '..', 'backend-node', 'storage');

const headers = {
  'settings.js': `import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { SETTINGS_PATH, now, readJSON, writeJSON, sqlAdapter } from './core.js';
`,
  'projects.js': `import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  normalizeWorkType,
  normalizeCreationMode,
  manuscriptDirForMode,
} from '../projectProfile.js';
import { resolveProjectCardSummary } from '../project-summary.js';
import { normalizeProjectStatus } from '../project-meta-fields.js';
import { PROJECTS_DIR, now, sqlAdapter } from './core.js';
import { listChapters, listMdFilesInDir, ensureWorkspaceDirs } from './workspace.js';
`,
  'workspace.js': `import fs from 'fs';
import path from 'path';
import { decodeBuffer, decodeUploadFilename, looksLikeMojibake } from '../encoding.js';
import { manuscriptDirForMode } from '../projectProfile.js';
import { sanitizeManuscriptForSave } from '../ai-runtime/output-sanitize.js';
import { getProject, touchProject, workspacePath } from './projects.js';
import { deleteSessionsForManuscript } from './sessions.js';
`,
  'chat.js': `import fs from 'fs';
import path from 'path';
import { workspacePath } from './projects.js';
`,
  'sessions.js': `import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  ARCHIVE_KEEP_MESSAGES,
  MAX_SESSION_MESSAGES,
  buildHeuristicMemorySummary,
  shouldRefreshMemory,
} from '../conversation-memory.js';
import { workspacePath } from './projects.js';
import { loadChatHistory } from './chat.js';
import { now, readJSON, writeJSON, sqlAdapter } from './core.js';
`,
  'jobs.js': `import { randomUUID } from 'crypto';
import { JOBS_PATH, now, readJSON, writeJSON, sqlAdapter } from './core.js';
`,
};

fs.writeFileSync(
  path.join(S, 'core.js'),
  `import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as sqlAdapter from './sqlite/adapter.js';
import { initSqliteStorage } from './sqlite/migrate.js';

initSqliteStorage();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
export const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
export const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
export const JOBS_PATH = path.join(DATA_DIR, 'jobs.json');

for (const dir of [DATA_DIR, PROJECTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

export function now() {
  return new Date().toISOString();
}

export function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

export function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export { sqlAdapter };
`,
);

for (const name of Object.keys(headers)) {
  const raw = fs.readFileSync(path.join(S, name.replace('.js', '-raw.js')), 'utf8');
  let body = raw;
  if (name === 'workspace.js') {
    body = body.replace(/^function listMdFilesInDir/m, 'export function listMdFilesInDir');
  }
  fs.writeFileSync(path.join(S, name), headers[name] + '\n' + body);
}

fs.writeFileSync(
  path.join(S, 'index.js'),
  `export * from './core.js';
export * from './settings.js';
export * from './projects.js';
export * from './workspace.js';
export * from './chat.js';
export * from './sessions.js';
export * from './jobs.js';
`,
);

for (const f of ['fs-store.js', 'settings-raw.js', 'projects-raw.js', 'workspace-raw.js', 'chat-raw.js', 'sessions-raw.js', 'jobs-raw.js']) {
  fs.unlinkSync(path.join(S, f));
}

fs.writeFileSync(
  path.join(__dirname, '..', 'backend-node', 'storage.js'),
  `/** Barrel — implementation lives in ./storage/ */\nexport * from './storage/index.js';\n`,
);

console.log('storage modules assembled');
