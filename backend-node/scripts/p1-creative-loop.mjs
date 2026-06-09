#!/usr/bin/env node
/**
 * P1 第二段 · 真实创作闭环（HTTP 驱动）
 * 项目默认 583e5628-24b · 需 start.sh 已启动
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.STUDIO_API || 'http://127.0.0.1:8765/api';
const PID = process.env.PID || '583e5628-24b';
const CHAPTER = '第0005章-第5章.md';
const MARKER = '\n\n<!-- P1-Creative-Validation 2026-06-02 -->\n';
const DATA = process.env.LITERARY_STUDIO_DATA
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data');

const log = [];
const results = { steps: {}, identity: {}, measurement: {}, warnings: [] };

function record(step, ok, detail = '') {
  results.steps[step] = { ok, detail };
  log.push(`${ok ? '✓' : '✗'} ${step}${detail ? `: ${detail}` : ''}`);
}

async function api(method, urlPath, body) {
  const url = `${BASE}${urlPath}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body != null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${urlPath} → ${res.status}: ${json.error || text.slice(0, 200)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function readData(rel) {
  return fs.readFileSync(path.join(DATA, 'projects', PID, rel), 'utf8');
}

function statMtime(rel) {
  try {
    return fs.statSync(path.join(DATA, 'projects', PID, rel)).mtime.toISOString();
  } catch {
    return null;
  }
}

async function main() {
  const reviewBefore = statMtime('measurement/review/latest.json');
  const verifyBefore = statMtime('verify/verify_log.json');

  // 1 · 创建版本 A
  let vA;
  try {
    vA = await api('POST', `/projects/${PID}/versions/create`, {
      title: 'P1闭环-版本A',
      notes: '创作验证第二段',
    });
    record('create_version_A', true, vA.id || vA.version?.id);
  } catch (e) {
    record('create_version_A', false, e.message);
    throw e;
  }
  const versionIdA = vA.id || vA.version?.id;

  // 2 · 写章节
  let chapterBefore;
  try {
    const enc = encodeURIComponent(CHAPTER);
    const got = await api('GET', `/projects/${PID}/chapters/${enc}`);
    chapterBefore = got.content ?? got;
    const content = (typeof chapterBefore === 'string' ? chapterBefore : chapterBefore.content || '') + MARKER;
    await api('PUT', `/projects/${PID}/chapters/${enc}`, { content });
    record('write_chapter', true, CHAPTER);
  } catch (e) {
    record('write_chapter', false, e.message);
    throw e;
  }

  // 3 · 理解分析（quick sync）
  try {
    const sync = await api('POST', `/projects/${PID}/story/sync`, { mode: 'quick' });
    record('understanding_sync', true, sync.updated_at || sync.job_id || 'ok');
  } catch (e) {
    record('understanding_sync', false, e.message);
  }

  // 4 · 建议
  try {
    const actions = await api('GET', `/projects/${PID}/story/actions/today?limit=5`);
    const n = (actions.suggestions || []).length;
    record('suggestions', n > 0, `${n} 条建议`);
  } catch (e) {
    record('suggestions', false, e.message);
  }

  // 5 · Planner
  try {
    const planner = await api('POST', `/projects/${PID}/story/planner/generate`, {});
    record('planner_generate', true, planner.generated_at || 'ok');
    results.identity.planner_keys = Object.keys(planner).slice(0, 12);
  } catch (e) {
    record('planner_generate', false, e.message);
  }

  // Identity 抽样
  try {
    const chars = JSON.parse(readData('knowledge/entities/characters.json'));
    const mapping = JSON.parse(readData('migration/id-mapping.json'));
    const arcs = JSON.parse(readData('understanding/character_arcs.json'));
    const catalog = (await api('GET', `/projects/${PID}/story/planner/bundle`)).entityCatalog
      || (await api('GET', `/projects/${PID}/story/planner/bundle`));
    const bundle = await api('GET', `/projects/${PID}/story/planner/bundle`);
    results.identity.entities_id = chars.items?.[0]?.id;
    results.identity.mapping = mapping.mapping;
    results.identity.arc_character_id = arcs.items?.[0]?.character_id;
    results.identity.entityCatalog = bundle.entityCatalog?.map((e) => e.id) || [];
    record('identity_entities', /^char_/.test(chars.items?.[0]?.id || ''), chars.items?.[0]?.id);
    record('identity_arc', /^char_/.test(arcs.items?.[0]?.character_id || ''), arcs.items?.[0]?.character_id);
    const catOk = (bundle.entityCatalog || []).every((e) => !e.id || /^char_/.test(e.id));
    record('identity_catalog', catOk, JSON.stringify(bundle.entityCatalog?.slice(0, 2)));
  } catch (e) {
    record('identity_check', false, e.message);
  }

  // 6 · 创建版本 B
  let vB;
  try {
    vB = await api('POST', `/projects/${PID}/versions/create`, {
      title: 'P1闭环-版本B',
      notes: '章节已写入标记后',
    });
    record('create_version_B', true, vB.id);
  } catch (e) {
    record('create_version_B', false, e.message);
    throw e;
  }
  const versionIdB = vB.id;

  // 7 · Diff
  try {
    const diff = await api('GET', `/projects/${PID}/versions/${versionIdA}/diff`);
    const nChanged = diff.counts?.changed ?? diff.changed?.length ?? 0;
    record('version_diff', nChanged > 0, `${nChanged} 处变更`);
    results.diff_sample = diff;
  } catch (e) {
    record('version_diff', false, e.message);
  }

  // 8 · 恢复版本 A
  try {
    await api('POST', `/projects/${PID}/versions/${versionIdA}/restore`, {});
    const enc = encodeURIComponent(CHAPTER);
    const after = await api('GET', `/projects/${PID}/chapters/${enc}`);
    const content = after.content ?? after;
    const restored = typeof content === 'string' && !content.includes('P1-Creative-Validation');
    record('version_restore', restored, restored ? '标记已移除' : '仍含标记');
    results.restore_ok = restored;
  } catch (e) {
    record('version_restore', false, e.message);
  }

  // 9 · Measurement review
  try {
    await api('POST', `/projects/${PID}/measurement/review/run`, {});
    const reviewAfter = statMtime('measurement/review/latest.json');
    record('measurement_review', reviewAfter !== reviewBefore, `${reviewBefore} → ${reviewAfter}`);
    results.measurement.review = { before: reviewBefore, after: reviewAfter };
  } catch (e) {
    record('measurement_review', false, e.message);
  }

  // 10 · Verify
  try {
    await api('POST', `/projects/${PID}/story/verify/run`, { chapter: 5, filename: CHAPTER });
    const verifyAfter = statMtime('verify/verify_log.json');
    record('measurement_verify', verifyAfter !== verifyBefore, `${verifyBefore} → ${verifyAfter}`);
    results.measurement.verify = { before: verifyBefore, after: verifyAfter };
  } catch (e) {
    record('measurement_verify', false, e.message);
  }

  const hs = path.join(DATA, 'projects', PID, 'verify/health_snapshot.json');
  record('no_health_snapshot', !fs.existsSync(hs));

  // 清理探活版本（保留迁移版本）
  for (const vid of [versionIdA, versionIdB]) {
    if (vid?.startsWith('v_') && vid.includes('p1') === false) {
      try {
        await api('DELETE', `/projects/${PID}/versions/${vid}`);
      } catch {
        /* 探活版本可留档 */
      }
    }
  }

  const failed = Object.values(results.steps).filter((s) => !s.ok).length;
  results.pass = failed === 0;
  results.project_id = PID;
  results.version_ids = { A: versionIdA, B: versionIdB };
  results.generated_at = new Date().toISOString();

  console.log(JSON.stringify(results, null, 2));
  console.error('\n---\n' + log.join('\n'));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
