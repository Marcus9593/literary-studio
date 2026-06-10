#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.join(__dirname, '..', 'frontend', 'src', 'api');
const srcPath = path.join(__dirname, '..', 'frontend', 'src', 'api.js');
const L = fs.readFileSync(srcPath, 'utf8').split('\n');
const pick = (a, b) => L.slice(a - 1, b).join('\n');

fs.mkdirSync(API_DIR, { recursive: true });

const client = pick(1, 29);
fs.writeFileSync(path.join(API_DIR, 'client.js'), client.replace('const API =', 'export const API =').replace('async function request', 'export async function request'));

const modules = [
  ['auth.js', 31, 50, `import { request } from './client.js';\n`],
  ['models.js', 51, 69, `import { request } from './client.js';\n`],
  ['projects.js', 70, 134, `import { request } from './client.js';\n`],
  ['sessions.js', 135, 163, `import { request } from './client.js';\n`],
  ['files.js', 164, 226, `import { authHeaders } from '../auth/token.js';\nimport { API, request } from './client.js';\n`],
  ['tools.js', 227, 249, `import { request } from './client.js';\n`],
  ['mcp.js', 251, 281, `import { request } from './client.js';\n`],
  ['guestbook.js', 283, 311, `import { request } from './client.js';\n`],
  ['versions.js', 313, 325, `import { request } from './client.js';\n`],
  ['studio.js', 327, 435, `import { request } from './client.js';\nimport { getJob } from './files.js';\n`],
  ['story.js', 441, 727, `import { request } from './client.js';\n`],
  ['screenplay.js', 729, 812, `import { API, request } from './client.js';\n`],
];

for (const [name, start, end, header] of modules) {
  fs.writeFileSync(path.join(API_DIR, name), header + '\n' + pick(start, end));
}

fs.writeFileSync(
  path.join(API_DIR, 'ws.js'),
  `export { createWebSocket } from '../services/ws.ts';\n`,
);

fs.writeFileSync(
  path.join(API_DIR, 'index.js'),
  `export * from './client.js';
export * from './auth.js';
export * from './models.js';
export * from './projects.js';
export * from './sessions.js';
export * from './files.js';
export * from './tools.js';
export * from './mcp.js';
export * from './guestbook.js';
export * from './versions.js';
export * from './studio.js';
export * from './story.js';
export * from './screenplay.js';
export * from './ws.js';
`,
);

fs.writeFileSync(
  srcPath,
  `/** Barrel — implementation lives in ./api/ */\nexport * from './api/index.js';\n`,
);

console.log('api modules assembled');
