import { randomUUID } from 'crypto';

/**
 * 伏笔 intelligence（升级 KB foreshadows + 理解层动作）
 */
export function analyzeForeshadows({ kb, manifest }) {
  const chapters = manifest.chapters || [];
  const total = manifest.chapters_total || chapters.length;
  const upgraded = (kb.foreshadows?.items || []).map((fs) => upgradeForeshadow(fs, total));
  return { items: upgraded, kbItems: upgraded };
}

function upgradeForeshadow(fs, totalChapters) {
  const intro = fs.introduced?.chapter || fs.introduced || fs.source_chapter || '';
  const introNum = parseChapterNum(intro) || 1;
  const suspended = Math.max(0, totalChapters - introNum);
  const status = fs.status || (fs.resolved ? 'resolved' : 'unresolved');
  const importance = fs.importance
    || (suspended > 30 ? 'high' : suspended > 15 ? 'medium' : 'low');

  return {
    ...fs,
    item: fs.item || fs.description?.slice(0, 30) || fs.id,
    introduced: typeof fs.introduced === 'object' ? fs.introduced : { chapter: intro },
    expected_payoff: fs.expected_payoff || '待明确回收点',
    importance,
    status: status === 'resolved' ? 'resolved' : suspended > 20 ? 'unresolved' : status,
    suspended_chapters: suspended,
    confidence: fs.confidence ?? 0.75,
  };
}

function parseChapterNum(ref) {
  const m = String(ref).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export function buildForeshadowActions(foreshadows) {
  const actions = [];
  const open = (foreshadows?.items || foreshadows || [])
    .filter((f) => f.status !== 'resolved' && f.importance === 'high')
    .sort((a, b) => (b.suspended_chapters || 0) - (a.suspended_chapters || 0));

  for (const fs of open.slice(0, 2)) {
    const suspended = fs.suspended_chapters || 0;
    if (suspended < 10) continue;

    actions.push({
      id: `act_fs_${randomUUID().slice(0, 8)}`,
      type: 'foreshadow_payoff',
      source: 'foreshadows',
      source_id: fs.id,
      title: `伏笔回收：${fs.item}`,
      diagnosis: `「${fs.item}」已悬置约 ${suspended} 章`,
      proposal: fs.expected_payoff
        ? `在后续 5 章内完成「${fs.expected_payoff}」的首次回收`
        : '在后续章节安排首次呼应或部分揭晓',
      execution_mode: 'rewrite_plan',
      impact_estimate: {
        metric: '伏笔回收率',
        delta: '+8%',
        chapters: [],
        risk: 'low',
      },
      priority: 70 + Math.min(15, Math.floor(suspended / 5)),
      execution_prompt: `【Story Action · 伏笔回收】
伏笔：${fs.item}
悬置：约 ${suspended} 章
预期 payoff：${fs.expected_payoff}
请 Read 引入章节与最新正文，设计一次自然回收（揭示/呼应/反转），输出改稿方案。`,
    });
  }
  return actions;
}

/**
 * @deprecated V2.8 — 使用 understanding/foreshadows.json（engine 内直接 saveUnderstandingFile）
 */
export function syncForeshadowsToKb() {
  throw new Error('syncForeshadowsToKb removed; write to understanding/foreshadows.json');
}
