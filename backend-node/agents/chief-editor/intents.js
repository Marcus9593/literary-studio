export const STORY_OS_INTENT_RULES = [
  { re: /今天写什么|今日创作|今天该写|今天干什么|今天做什么/, intent: 'plan_today', priority: 12 },
  { re: /下一步做什么|下一章写什么|继续推进|往下写|^开始写|接着写/, intent: 'plan_next', priority: 12 },
  { re: /接下来\s*\d+\s*章|未来\s*\d+\s*章|短期规划|章节规划|创作路线/, intent: 'plan_roadmap', priority: 11 },
  { re: /重新规划|规划作废|路线.*重/, intent: 'rebuild_planner', priority: 11 },
  { re: /故事目标|往哪走|创作目标|作品方向/, intent: 'plan_goal', priority: 10 },
];

export const INTENT_RULES = [
  { re: /删除|去掉|移除|改成.*?人称|前三章/, intent: 'story_diff', priority: 10 },
  { re: /审核|审稿|检视|去\s*AI|AI\s*味/, intent: 'review', priority: 9 },
  { re: /增强|提高|优化|改稿|重写|冲突|情绪|对白|节奏|逻辑/, intent: 'rewrite', priority: 8 },
  {
    re: /续写|下一[章节场]|写第\s*[\d一二三四五六七八九十百]+|第\s*[\d一二三四五六七八九十百]+\s*[章节场篇稿]|开始.*第\s*[\d一二三四五六七八九十百]+|[章节场]\s*稿/,
    intent: 'write_continue',
    priority: 7,
  },
  { re: /重建|刷新|同步.*知识/, intent: 'rebuild_kb', priority: 5 },
  { re: /(.+?)在哪里|第一次|何时|初见/, intent: 'story_query', priority: 9 },
];

const PLANNER_INTENTS = new Set([
  'plan_today', 'plan_next', 'plan_roadmap', 'rebuild_planner', 'plan_goal',
]);

const DIAGNOSIS_INTENTS = new Set([
  'story_diff', 'rewrite', 'review', 'story_query', 'rebuild_kb',
]);

const EXECUTION_INTENTS = new Set(['write_continue']);

export function classifyIntent(message) {
  const msg = String(message || '').trim();
  let best = { intent: 'chat', priority: 0 };
  for (const rule of STORY_OS_INTENT_RULES) {
    if (rule.re.test(msg) && rule.priority >= best.priority) {
      best = { intent: rule.intent, priority: rule.priority };
    }
  }
  for (const rule of INTENT_RULES) {
    if (rule.re.test(msg) && rule.priority >= best.priority) {
      best = { intent: rule.intent, priority: rule.priority };
    }
  }
  return best.intent;
}

export function delegateAgentForIntent(intent) {
  if (PLANNER_INTENTS.has(intent)) return 'planner';
  if (DIAGNOSIS_INTENTS.has(intent)) return 'diagnosis';
  if (EXECUTION_INTENTS.has(intent)) return 'execution';
  return 'chat';
}
