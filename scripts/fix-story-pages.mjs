#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const pages = [
  'StorySuggestionsPage', 'StoryKnowledgePage', 'StoryPlansPage', 'StoryHealthPage',
  'StoryRoadmapPage', 'StorySuspensePage', 'StoryCharactersPage', 'StoryBiblePage',
  'StoryBeatsPage', 'StoryEnginePage',
];
const dir = path.join(ROOT, 'frontend', 'src', 'features', 'story', 'pages');

for (const name of pages) {
  const raw = execSync(`git show HEAD:frontend/src/pages/${name}.jsx`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const fixed = raw
    .replace(/from '\.\.\/api\.js'/g, "from '../../../api.js'")
    .replace(/from '\.\.\/components\//g, "from '../../../components/")
    .replace(/from '\.\.\/features\//g, "from '../../");
  fs.writeFileSync(path.join(dir, `${name}.jsx`), fixed, 'utf8');
}
console.log('restored', pages.length, 'story pages');
