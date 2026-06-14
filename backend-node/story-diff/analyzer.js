import * as storage from '../storage.js';
import { findCharacter, findRelationship, findForeshadow } from '../story-index/query.js';
import { loadKnowledgeBundle } from '../story-kb/store.js';
import { createPlan } from '../story-plans/store.js';

const DIFF_PATTERNS = [
  { re: /删除|去掉|移除/, type: 'remove_character', role: 'target' },
  { re: /改.*?第一人称|人称/, type: 'pov_change' },
  { re: /前三章|第\d+章/, type: 'chapter_scope' },
  { re: /男二|女主|配角|角色/, type: 'character_change' },
];

export function analyzeStoryDiff(projectId, userRequest) {
  const msg = String(userRequest || '').trim();
  const meta = storage.getProject(projectId);
  const chapters = storage.listChapters(projectId);
  const kb = loadKnowledgeBundle(projectId);

  let changeType = 'general_edit';
  for (const p of DIFF_PATTERNS) {
    if (p.re.test(msg)) {
      changeType = p.type;
      break;
    }
  }

  const nameTokens = [...msg.matchAll(/[\u4e00-\u9fa5]{2,6}/g)].map((m) => m[0]);
  const affectedCharacters = [];
  for (const token of nameTokens) {
    const hits = findCharacter(projectId, token);
    affectedCharacters.push(...hits);
  }

  const uniqueChars = [...new Map(affectedCharacters.map((c) => [c.id || c.name, c])).values()];

  const impactedChapters = chapters
    .filter((ch) => {
      if (!uniqueChars.length) return changeType.includes('chapter') || /章/.test(msg);
      return true;
    })
    .slice(0, 20)
    .map((c) => ({ filename: c.filename, title: c.title, words: c.words }));

  const impactedRelationships = uniqueChars.length
    ? findRelationship(projectId, uniqueChars[0]?.name || '')
    : [];

  const impactedForeshadows = uniqueChars.length
    ? findForeshadow(projectId, uniqueChars[0]?.name || '')
    : kb.foreshadows?.items || [];

  const steps = [
    { step: 1, action: '分析影响范围', detail: '已完成索引与知识库对照' },
    { step: 2, action: '生成修改计划', detail: '等待作者确认后执行' },
    { step: 3, action: '调用 Claude 执行改写', detail: '按计划在 Workspace 内修改文件' },
    { step: 4, action: '更新知识库与摘要', detail: '执行后自动 rebuild KB / summaries / index' },
    { step: 5, action: '输出变更报告', detail: '写入 plans 记录与 chapter-review' },
  ];

  const plan = createPlan(projectId, {
    type: 'story_diff',
    change_type: changeType,
    user_request: msg,
    project_title: meta.title,
    impact: {
      characters: uniqueChars,
      chapters: impactedChapters,
      relationships: impactedRelationships.slice(0, 15),
      foreshadows: impactedForeshadows.slice(0, 15),
      settings_files: [],
    },
    steps,
    execution_prompt: buildDiffExecutionPrompt(msg, uniqueChars, impactedChapters, changeType),
    summary: `「${msg.slice(0, 40)}」将影响约 ${impactedChapters.length} 个章节、${uniqueChars.length} 个相关人物。确认后由总编辑调度 Claude 执行。`,
  });

  return plan;
}

function buildDiffExecutionPrompt(request, characters, chapters, changeType) {
  return `【Story Diff 已确认 — 请执行修改】

用户请求：${request}
变更类型：${changeType}

涉及人物：${JSON.stringify(characters.map((c) => c.name || c.id), null, 2)}
涉及章节：${JSON.stringify(chapters.map((c) => c.filename), null, 2)}

要求：
1. 先 Read 相关章节与设定集
2. 按影响范围修改，勿擅自扩大范围
3. 同步更新 knowledge/ 下 JSON（若人物/伏笔有变）
4. 完成后简要列出变更文件清单`;
}
