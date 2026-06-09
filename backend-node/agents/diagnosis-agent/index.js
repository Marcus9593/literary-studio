import * as storage from '../../storage.js';
import { analyzeStoryDiff } from '../../story-diff/analyzer.js';
import { createRewritePlan } from '../../rewrite-engine/engine.js';
import { createPlanFromUserRequest } from '../../story-actions/to-plan.js';
import { queryStory } from '../../story-index/query.js';
import { runQuickSync } from '../../story-kb/rebuild.js';
import { buildStoryContextBlocks } from '../chief-editor/context.js';

export function routeDiagnosisIntent(projectId, message, intent) {
  const msg = String(message || '').trim();

  switch (intent) {
    case 'story_diff': {
      const plan = analyzeStoryDiff(projectId, message);
      return {
        action: 'plan',
        plan_type: 'story_diff',
        plan,
        message: plan.summary,
      };
    }
    case 'rewrite': {
      const plan = createPlanFromUserRequest(projectId, message)
        || createRewritePlan(projectId, message);
      return {
        action: 'plan',
        plan_type: 'rewrite',
        plan,
        message: plan.summary,
      };
    }
    case 'review': {
      const chapters = storage.listChapters(projectId);
      const latest = chapters[chapters.length - 1];
      return {
        action: 'chat',
        intent: 'review',
        user_message: message,
        contextBlocks: [
          ...buildStoryContextBlocks(projectId),
          `\n\n---\n\n【总编辑 · 审稿任务】
用户请求对当前文稿进行专业审稿。
请先 Read 正文目录下最新章节（${latest?.filename || '暂无'}），再按 manuscript-review-master 技能流程输出审稿报告：
1. 总体评价（节奏、结构、可读性）
2. 人物与对白
3. AI 味与套话
4. 可执行的修改建议（分条，不要直接重写全文）`,
        ],
      };
    }
    case 'story_query': {
      const indexResult = queryStory(projectId, message);
      return {
        action: 'index_answer',
        indexResult,
        contextBlocks: [
          `\n\n---\n\n【Story Index 查询结果】\n${JSON.stringify(indexResult, null, 2)}`,
        ],
        message: '已命中故事索引，将结合索引结果回答。',
      };
    }
    case 'rebuild_kb': {
      const result = runQuickSync(projectId);
      return {
        action: 'notify',
        message: `已完成快速同步：分析 ${result.manifest.chapters_scanned} 章，生成 ${result.stats.actions} 条诊断建议。`,
      };
    }
    default:
      return null;
  }
}
