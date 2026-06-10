import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src', 'features', 'story', 'pages', 'StorySuspensePage.jsx');
let t = fs.readFileSync(p, 'utf8');
t = t.replace(/^const LEVEL_LABEL.*$/m, "const LEVEL_LABEL = { low: '低', medium: '中', high: '高', critical: '危急' }");
t = t.replace(/^const THREAD_LABEL.*$/m, "const THREAD_LABEL = { mystery: '谜团', danger: '危险', relationship: '关系', revelation: '揭示' }");
fs.writeFileSync(p, t, 'utf8');
console.log('fixed StorySuspensePage labels');
