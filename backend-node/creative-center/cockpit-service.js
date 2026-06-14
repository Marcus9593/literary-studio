import fs from 'fs';
import path from 'path';
import { listProjects, normalizeProjectMeta, workspacePath } from '../storage.js';
import { filterProjectsForUser } from '../auth/permissions.js';

const MANUSCRIPT_DIRS = ['正文', '试验稿'];

function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function countWords(text) {
  return String(text || '').replace(/[\s\n]/g, '').length;
}

function collectManuscriptFiles(ws) {
  const files = [];
  for (const dir of MANUSCRIPT_DIRS) {
    const absDir = path.join(ws, dir);
    if (!fs.existsSync(absDir)) continue;
    walkMarkdown(absDir, files);
  }
  return files;
}

function walkMarkdown(currentDir, out) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(abs, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
    let words = 0;
    try {
      words = countWords(fs.readFileSync(abs, 'utf-8'));
    } catch {
      words = 0;
    }
    const stat = fs.statSync(abs);
    out.push({
      path: abs,
      mtime: stat.mtime,
      date: localDateKey(stat.mtime),
      words,
    });
  }
}

/** 按本地日历日聚合某项目的文稿改动 */
function scanProjectWritingActivity(projectId) {
  let ws;
  try {
    ws = workspacePath(projectId);
  } catch {
    return { by_date: {}, files: [] };
  }
  const files = collectManuscriptFiles(ws);
  const by_date = {};
  for (const f of files) {
    if (!by_date[f.date]) {
      by_date[f.date] = { chapters_updated: 0, words_updated: 0 };
    }
    by_date[f.date].chapters_updated += 1;
    by_date[f.date].words_updated += f.words;
  }
  return { by_date, files };
}

const STALE_DAYS = 14;

function daysSince(isoOrMs) {
  if (!isoOrMs) return Infinity;
  const t = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function latestManuscriptMtime(activity) {
  const files = activity.files || [];
  if (!files.length) return null;
  return files.reduce((max, f) => (f.mtime > max ? f.mtime : max), files[0].mtime);
}

function buildActivityTrend(allByDateMaps, dayCount = 7) {
  const days = [];
  const today = new Date();
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = localDateKey(d);
    days.push({
      date,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      chapters_updated: 0,
      words_updated: 0,
      projects_active: 0,
    });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  const activeProjectsPerDay = days.map(() => new Set());

  for (const { by_date, projectId } of allByDateMaps) {
    for (const [date, stats] of Object.entries(by_date)) {
      const idx = dayIndex.get(date);
      if (idx == null) continue;
      days[idx].chapters_updated += stats.chapters_updated;
      days[idx].words_updated += stats.words_updated;
      activeProjectsPerDay[idx].add(projectId);
    }
  }

  return days.map((d, i) => ({
    ...d,
    projects_active: activeProjectsPerDay[i].size,
  }));
}

/** 创作看板 Dashboard：跨项目今日改稿与全局统计 */
export function getDashboardStats(user = null) {
  const today = localDateKey(new Date());
  const rawProjects = user ? filterProjectsForUser(user, listProjects()) : listProjects();
  const activityInputs = [];
  const projectRows = [];

  let manuscriptsTotal = 0;
  let wordsTotal = 0;
  let todayChaptersTotal = 0;
  let todayWordsTotal = 0;
  let projectsActiveToday = 0;
  const staleProjects = [];

  for (const raw of rawProjects) {
    const meta = normalizeProjectMeta(raw);
    const activity = scanProjectWritingActivity(meta.id);
    activityInputs.push({ projectId: meta.id, by_date: activity.by_date });

    const latestMtime = latestManuscriptMtime(activity);
    const staleDays = latestMtime
      ? daysSince(latestMtime)
      : daysSince(meta.updated_at);
    if (!meta.archived && staleDays >= STALE_DAYS) {
      staleProjects.push({
        id: meta.id,
        title: meta.title,
        days_since_update: Math.floor(staleDays),
        last_activity: latestMtime instanceof Date ? latestMtime.toISOString() : meta.updated_at,
      });
    }

    const todayStats = activity.by_date[today] || { chapters_updated: 0, words_updated: 0 };
    if (todayStats.chapters_updated > 0) projectsActiveToday += 1;
    todayChaptersTotal += todayStats.chapters_updated;
    todayWordsTotal += todayStats.words_updated;

    manuscriptsTotal += meta.stats?.manuscript_count || 0;
    wordsTotal += meta.stats?.total_words || 0;

    projectRows.push({
      id: meta.id,
      title: meta.title,
      genre: meta.genre,
      status: meta.status,
      archived: Boolean(meta.archived),
      total_words: meta.stats?.total_words || 0,
      manuscript_count: meta.stats?.manuscript_count || 0,
      updated_at: meta.updated_at,
      today_chapters_updated: todayStats.chapters_updated,
      today_words_updated: todayStats.words_updated,
    });
  }

  projectRows.sort((a, b) => {
    const act = b.today_words_updated - a.today_words_updated
      || b.today_chapters_updated - a.today_chapters_updated;
    if (act !== 0) return act;
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  });

  return {
    schema: 'writing_dashboard',
    date: today,
    summary: {
      projects_count: rawProjects.length,
      projects_active_today: projectsActiveToday,
      manuscripts_count: manuscriptsTotal,
      total_words: wordsTotal,
      today_chapters_updated: todayChaptersTotal,
      today_words_updated: todayWordsTotal,
    },
    projects: projectRows,
    stale_projects: staleProjects.sort((a, b) => b.days_since_update - a.days_since_update),
    activity_7d: buildActivityTrend(activityInputs),
  };
}

/**
 * @deprecated 使用 getDashboardStats(user) 替代。
 * 注意：此函数不传 user 参数，将返回空数据。
 * 保留仅为向后兼容，新代码请勿使用。
 */
export function getCockpitOverview() {
  const dash = getDashboardStats();
  return {
    projects_count: dash.summary.projects_count,
    manuscripts_count: dash.summary.manuscripts_count,
    total_words: dash.summary.total_words,
    active_projects: dash.projects.slice(0, 8).map((p) => ({
      id: p.id,
      title: p.title,
      words: p.total_words,
      manuscripts: p.manuscript_count,
    })),
    activity_7d: dash.activity_7d.map((d) => ({
      date: d.date,
      label: d.label,
      project_updates: d.projects_active,
    })),
  };
}
