#!/usr/bin/env node
/**
 * 迁移脚本：将 studio.json 中的 legacy assets 迁入各项目的 knowledge/ 目录
 *
 * 运行方式：node scripts/migrate-assets-to-knowledge.js [--dry-run]
 *
 * 迁移映射：
 *   type=角色  → knowledge/characters.json items[]
 *   type=地点  → knowledge/locations.json items[]
 *   type=设定  → knowledge/story_summary.json (追加到 themes)
 *   type=待补充 → knowledge/characters.json items[] (默认当角色)
 *
 * 安全策略：
 *   - 不删除 studio.json 原始数据
 *   - 迁移项标记 source: 'legacy_asset' 和原始 asset_id
 *   - 生成迁移报告到 data/migration/assets-migration-report.json
 *   - 支持 --dry-run 模式（不写盘）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');
const STUDIO_PATH = path.join(DATA_DIR, 'studio.json');
const REPORT_DIR = path.join(DATA_DIR, 'migration');
const REPORT_PATH = path.join(REPORT_DIR, 'assets-migration-report.json');

const DRY_RUN = process.argv.includes('--dry-run');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function now() {
  return new Date().toISOString();
}

// ── 类型映射 ──
const TYPE_MAP = {
  '角色': 'characters',
  '地点': 'locations',
  '设定': 'story_summary',
  '待补充': 'characters', // 默认当角色
};

function knowledgeDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'knowledge');
}

function knowledgePath(projectId, filename) {
  return path.join(knowledgeDir(projectId), filename);
}

const KB_FILE_MAP = {
  characters: 'characters.json',
  locations: 'locations.json',
  story_summary: 'story_summary.json',
};

function emptySlice(key) {
  if (key === 'story_summary') {
    return { version: 1, updated_at: null, logline: '', themes: [], arcs: [], factions: [] };
  }
  return { version: 1, updated_at: null, items: [] };
}

// ── 迁移单个项目 ──
function migrateProjectAssets(projectId, assets) {
  const result = { project_id: projectId, migrated: 0, skipped: 0, errors: [] };
  const grouped = {};

  for (const asset of assets) {
    const targetType = TYPE_MAP[asset.type] || 'characters';
    if (!grouped[targetType]) grouped[targetType] = [];
    grouped[targetType].push(asset);
  }

  for (const [kbKey, items] of Object.entries(grouped)) {
    const filePath = knowledgePath(projectId, KB_FILE_MAP[kbKey]);
    const existing = readJson(filePath, emptySlice(kbKey));

    if (kbKey === 'story_summary') {
      // 设定类型 → 追加到 themes
      const newThemes = [...(existing.themes || [])];
      for (const asset of items) {
        const label = asset.name || '未命名设定';
        const desc = asset.note ? `${label}：${asset.note}` : label;
        if (!newThemes.includes(desc)) {
          newThemes.push(desc);
          result.migrated += 1;
        } else {
          result.skipped += 1;
        }
      }
      if (!DRY_RUN) {
        existing.themes = newThemes;
        existing.updated_at = now();
        writeJson(filePath, existing);
      }
    } else {
      // 角色/地点类型 → 追加到 items[]
      const existingItems = existing.items || [];
      const existingNames = new Set(existingItems.map((it) => it.name || it.id));

      for (const asset of items) {
        const name = asset.name || `未命名${asset.type}`;
        if (existingNames.has(name)) {
          result.skipped += 1;
          continue;
        }
        const newItem = {
          id: `legacy_${asset.id}`,
          name,
          notes: asset.note || '',
          source: 'legacy_asset',
          asset_id: asset.id,
          asset_type: asset.type,
          migrated_at: now(),
        };
        existingItems.push(newItem);
        existingNames.add(name);
        result.migrated += 1;
      }

      if (!DRY_RUN) {
        existing.items = existingItems;
        existing.updated_at = now();
        writeJson(filePath, existing);
      }
    }
  }

  return result;
}

// ── 主流程 ──
function main() {
  console.log(`[migrate-assets] DATA_DIR = ${DATA_DIR}`);
  console.log(`[migrate-assets] DRY_RUN = ${DRY_RUN}`);

  if (!fs.existsSync(STUDIO_PATH)) {
    console.log('[migrate-assets] studio.json 不存在，无需迁移');
    return;
  }

  const studio = readJson(STUDIO_PATH, {});
  const assets = studio.assets || {};
  const projectIds = Object.keys(assets);

  if (projectIds.length === 0) {
    console.log('[migrate-assets] 无素材数据，无需迁移');
    return;
  }

  console.log(`[migrate-assets] 发现 ${projectIds.length} 个项目有素材数据`);

  const report = {
    run_at: now(),
    dry_run: DRY_RUN,
    projects: [],
    totals: { projects: 0, migrated: 0, skipped: 0, errors: 0 },
  };

  for (const projectId of projectIds) {
    const projectAssets = assets[projectId] || [];
    if (projectAssets.length === 0) continue;

    console.log(`[migrate-assets] 项目 ${projectId}: ${projectAssets.length} 个素材`);

    try {
      // 确保 knowledge 目录存在
      const kDir = knowledgeDir(projectId);
      fs.mkdirSync(kDir, { recursive: true });

      const result = migrateProjectAssets(projectId, projectAssets);
      report.projects.push(result);
      report.totals.projects += 1;
      report.totals.migrated += result.migrated;
      report.totals.skipped += result.skipped;
      report.totals.errors += result.errors.length;

      console.log(`  → 迁移 ${result.migrated}，跳过 ${result.skipped}，错误 ${result.errors.length}`);
    } catch (e) {
      console.error(`  → 错误: ${e.message}`);
      report.projects.push({ project_id: projectId, migrated: 0, skipped: 0, errors: [e.message] });
      report.totals.errors += 1;
    }
  }

  // 写入迁移报告
  if (!DRY_RUN) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    writeJson(REPORT_PATH, report);
    console.log(`[migrate-assets] 报告已写入 ${REPORT_PATH}`);
  }

  console.log(`[migrate-assets] 完成: ${report.totals.projects} 个项目, ${report.totals.migrated} 条迁移, ${report.totals.skipped} 条跳过, ${report.totals.errors} 个错误`);
}

main();
