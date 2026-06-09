import { getDb } from '../storage/sqlite/db.js';
import { createCanonRule, listCanonRules, getOverrideBudget } from '../storage/sqlite/repos/canon-repo.js';
import { createPipelineRun } from '../storage/sqlite/repos/pipeline-repo.js';
import { decideGovernor } from '../story-governor/decide.js';

const db = getDb();
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
).all().map((r) => r.name);

const awrTables = tables.filter((t) => /canon|pipeline|memory|critic|override|narrative/.test(t));
console.log('awr tables:', awrTables);

const pid = 'test-awr-engine-smoke';
createCanonRule(pid, { title: 'test rule', level: 'immutable', content: 'x' });
console.log('canon rules:', listCanonRules(pid).length);
console.log('budget:', getOverrideBudget(pid, 1));

const run = createPipelineRun(pid, { unit_index: 1 });
console.log('pipeline id:', run.id);
console.log('governor:', decideGovernor(pid, { structure: { level: 'HARD' } }, 1));

console.log('smoke ok');
