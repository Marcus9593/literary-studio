import * as storage from '../storage.js';
import { createPlan } from '../story-plans/store.js';

const REWRITE_MODES = {
  conflict: { label: '增强冲突', focus: '升级对立、阻碍与抉择' },
  emotion: { label: '增强情绪', focus: '强化内心波动与氛围' },
  dialogue: { label: '优化对白', focus: '更口语、更有角色区分度' },
  pacing: { label: '调整节奏', focus: '删减拖沓、加重节拍' },
  character: { label: '强化人物塑造', focus: '动机、行为一致性' },
  logic: { label: '修复逻辑漏洞', focus: '因果、设定自洽' },
};

function detectRewriteMode(message) {
  const msg = String(message || '');
  if (/冲突|张力/.test(msg)) return 'conflict';
  if (/情绪|情感/.test(msg)) return 'emotion';
  if (/对白|对话/.test(msg)) return 'dialogue';
  if (/节奏/.test(msg)) return 'pacing';
  if (/人物|角色|成长/.test(msg)) return 'character';
  if (/逻辑|漏洞|bug/.test(msg)) return 'logic';
  return 'conflict';
}

function parseChapterRef(message, chapters) {
  const m = String(message).match(/第\s*(\d+)\s*[章节场集]/);
  if (m) {
    const num = parseInt(m[1], 10);
    const ch = chapters[num - 1];
    if (ch) return ch;
  }
  return chapters[chapters.length - 1] || null;
}

export function createRewritePlan(projectId, userRequest) {
  const msg = String(userRequest || '').trim();
  const mode = detectRewriteMode(msg);
  const modeInfo = REWRITE_MODES[mode];
  const chapters = storage.listChapters(projectId);
  const target = parseChapterRef(msg, chapters);

  const plan = createPlan(projectId, {
    type: 'rewrite',
    rewrite_mode: mode,
    user_request: msg,
    target_chapter: target
      ? { filename: target.filename, title: target.title, words: target.words }
      : null,
    steps: [
      { step: 1, action: '分析目标章节', detail: modeInfo.focus },
      { step: 2, action: '生成修改建议', detail: '输出要点供作者预览' },
      { step: 3, action: '执行重写', detail: '写入原文件或试验稿（重新创作模式）' },
      { step: 4, action: '生成 Diff 摘要', detail: '对比改前改后要点' },
    ],
    execution_prompt: buildRewritePrompt(msg, mode, modeInfo, target),
    summary: `${modeInfo.label}：${target ? target.title : '最新章节'} — 确认后执行改稿`,
  });

  return plan;
}

function buildRewritePrompt(request, mode, modeInfo, chapter) {
  return `【Rewrite Engine 已确认 — 改稿任务】

用户请求：${request}
改稿模式：${modeInfo.label}（${modeInfo.focus}）

目标章节：${chapter ? `${chapter.filename} · ${chapter.title}` : '（由你根据上下文确定）'}

要求：
1. Read 目标章节全文
2. Read 故事知识库 knowledge/ 与 summaries/ 相关摘要
3. 在保持剧情走向前提下重写，优先${modeInfo.focus}
4. 写回文件并说明主要改动点
5. 勿改动未涉及章节`;
}

export { REWRITE_MODES };
