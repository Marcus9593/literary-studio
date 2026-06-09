import { randomUUID } from 'crypto';

/** 分析器未产出建议时的兜底（保证同步后有可见反馈） */
export function buildFallbackActions({ kb, manifest }) {
  const total = manifest.chapters_total || 0;
  const actions = [];

  if (total === 0) {
    actions.push({
      id: `act_fb_${randomUUID().slice(0, 8)}`,
      type: 'plan_chapter',
      source: 'fallback',
      source_id: 'no_chapters',
      title: '导入或撰写第一章',
      diagnosis: '项目尚无正文章节，无法进行作品理解',
      proposal: '在工作台导入 docx/md，或新建第一章开始写作；完成后再次快速同步',
      execution_mode: 'manual',
      priority: 90,
      impact_estimate: { metric: '可分析性', delta: '—', risk: 'low' },
    });
    return actions;
  }

  const charCount = kb.characters?.items?.length || 0;
  if (charCount === 0) {
    actions.push({
      id: `act_fb_${randomUUID().slice(0, 8)}`,
      type: 'arc_enhance',
      source: 'fallback',
      source_id: 'no_characters',
      title: '补全人物设定',
      diagnosis: '知识库中暂无人物，成长线/关系分析无法展开',
      proposal: '在「设定集」补充主要人物（姓名、目标、缺陷），或在正文中强化人物称呼后再次快速同步',
      execution_mode: 'manual',
      priority: 75,
      impact_estimate: { metric: '人物覆盖', delta: '+30%', risk: 'low' },
    });
  }

  actions.push({
    id: `act_fb_${randomUUID().slice(0, 8)}`,
    type: 'plan_chapter',
    source: 'fallback',
    source_id: 'continue_writing',
    title: '续写并设置章末钩子',
    diagnosis: `已扫描 ${manifest.chapters_scanned}/${total} 章，建议保持更新节奏`,
    proposal: '续写下一章，确保章末有悬念或未解问题；写完后系统会自动快速同步',
    execution_mode: 'write_continue',
    priority: 60,
    execution_prompt: '【Story Action · 续写建议】请 Read 最新章节与大纲，续写下一章并在章末设置悬念钩子。',
    impact_estimate: { metric: '更新频率', delta: '—', risk: 'low' },
  });

  return actions;
}
