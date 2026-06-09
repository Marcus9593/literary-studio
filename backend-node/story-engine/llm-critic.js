import { resolveActiveModelConfig, usesHttpRuntime } from '../ai-runtime/model-resolver.js';
import * as httpProvider from '../ai-runtime/providers/http-provider.js';
import { loadCriticContext } from './content-loader.js';

const SYSTEM_PROMPT = `你是专业叙事审稿人（剧本/小说）。只输出合法 JSON，不要 markdown 代码块：
{
  "overall": "APPROVE 或 REVISE 或 REJECT",
  "score": 0到10的数字,
  "summary": "一两句总评",
  "strengths": ["优点1"],
  "issues": [{"severity":"hard或soft","dimension":"structure|character|scene|pressure|voice|continuity|theme","problem":"问题描述"}],
  "revision_tasks": [{"priority":1,"target":"修改位置","action":"具体改法","reason":"原因"}]
}`;

function extractJson(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('语义审稿未返回有效 JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * LLM semantic critic — requires HTTP API model in settings.
 */
export async function runLlmCritic(projectId, { filename, unitIndex } = {}) {
  const ctx = loadCriticContext(projectId, { filename });
  const content = String(ctx.content || '').trim();
  if (!content) throw new Error('尚无正文可语义审稿');

  const cfg = resolveActiveModelConfig();
  if (!cfg?.api_key || !usesHttpRuntime(cfg)) {
    return {
      skipped: true,
      reason: '语义审稿需要先在 AI 中心配置并激活 HTTP API 模型',
    };
  }

  const excerpt = content.length > 10000 ? `${content.slice(0, 10000)}\n\n[正文已截断]` : content;
  const userMsg = `请审稿以下正文（体裁：${ctx.work_type || 'novel'}，单元：${unitIndex || ctx.chapter || 1}）。

角色：${(ctx.character_names || []).join('、') || '未指定'}
主题参考：${ctx.bible_themes || '无'}

---正文---
${excerpt}`;

  const text = await httpProvider.generate({
    modelConfig: cfg,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ],
  });

  const parsed = extractJson(text);
  return {
    skipped: false,
    scoring_method: 'llm',
    model: cfg.model,
    professional_review: {
      summary: parsed.summary || '',
      strengths: (parsed.strengths || []).map((s) => ({ description: s })),
      hard_issues: (parsed.issues || []).filter((i) => i.severity === 'hard'),
      soft_issues: (parsed.issues || []).filter((i) => i.severity !== 'hard'),
      revision_tasks: parsed.revision_tasks || [],
      verdict: parsed.overall || 'REVISE',
    },
    critic_report: {
      overall: parsed.overall || 'REVISE',
      score: Number(parsed.score) || 0,
      llm: true,
    },
    raw: parsed,
  };
}
