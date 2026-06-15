import { randomUUID } from 'crypto';
import { stripWritePlan } from '../workflow/write-plan.js';

export const MAX_SESSION_MESSAGES = 120;
export const ARCHIVE_KEEP_MESSAGES = 80;
export const HISTORY_MAX_MESSAGES = 20;
export const HISTORY_MAX_CHARS = 18000;
export const MEMORY_UPDATE_INTERVAL = 8;

/**
 * Build a compact note from a write_plan block for history context.
 */
function formatWritePlanNote(plan) {
  if (!plan || typeof plan !== 'object') return '';
  const ch = plan.chapter ?? '—';
  const title = plan.title || '未命名';
  const outline = (plan.outline || '').slice(0, 200);
  return `[写作方案：第${ch}章「${title}」${outline ? ` — ${outline}` : ''}]`;
}

/**
 * Normalize a stored message for prompt inclusion.
 */
export function messageForPrompt(message) {
  if (!message?.content?.trim()) return null;
  if (message.role !== 'user' && message.role !== 'assistant') return null;

  let text = stripWritePlan(message.content).trim();
  if (message.role === 'assistant' && text.includes('[已停止生成]')) {
    text = text.replace(/\n\n\[已停止生成\]/g, '').trim();
    if (!text) return null;
    text = `${text.slice(0, 800)}… [回复未完成]`;
  }

  const planNote = message.write_plan ? formatWritePlanNote(message.write_plan) : '';
  if (planNote && message.role === 'assistant') {
    text = planNote + (text ? `\n${text}` : '');
  }

  return {
    role: message.role,
    text: text.slice(0, 2800),
    at: message.at,
  };
}

/**
 * Select recent turns for the prompt, respecting char budget.
 * Keeps the most recent messages first; drops oldest when over budget.
 */
export function selectHistoryTurns(messages, {
  maxMessages = HISTORY_MAX_MESSAGES,
  maxChars = HISTORY_MAX_CHARS,
  excludeTail = 0,
} = {}) {
  const pool = (messages || [])
    .map(messageForPrompt)
    .filter(Boolean);

  const end = pool.length - excludeTail;
  const candidates = end > 0 ? pool.slice(0, end) : [];
  const selected = candidates.slice(-maxMessages);

  const lines = [];
  let total = 0;
  for (const item of selected) {
    const label = item.role === 'user' ? '用户' : '助手';
    const block = `${label}：${item.text}`;
    if (total + block.length > maxChars && lines.length > 0) break;
    lines.push(block);
    total += block.length;
  }

  if (!lines.length) return '';
  return `\n\n---\n\n对话历史（最近 ${lines.length} 条）：\n${lines.join('\n\n')}`;
}

/** Recent turns as API messages (for HTTP model providers). */
export function selectHistoryAsMessages(messages, {
  maxMessages = 10,
  excludeTail = 0,
} = {}) {
  const pool = (messages || [])
    .map(messageForPrompt)
    .filter(Boolean);

  const end = pool.length - excludeTail;
  const candidates = end > 0 ? pool.slice(0, end) : [];
  return candidates.slice(-maxMessages).map((m) => ({
    role: m.role,
    content: m.text,
  }));
}

/**
 * Heuristic rolling memory — no extra LLM call.
 * Merges prior summary with recent user intents and assistant decisions.
 */
export function buildHeuristicMemorySummary(messages, previousSummary = '') {
  const recent = (messages || []).slice(-MEMORY_UPDATE_INTERVAL * 2);
  const userPoints = [];
  const assistantPoints = [];

  for (const m of recent) {
    const normalized = messageForPrompt(m);
    if (!normalized) continue;
    const snippet = normalized.text.replace(/\s+/g, ' ').slice(0, 160);
    if (!snippet) continue;
    if (m.role === 'user') userPoints.push(snippet);
    else assistantPoints.push(snippet);
  }

  const sections = [];
  if (previousSummary?.trim()) {
    sections.push(`【延续记忆】\n${previousSummary.trim().slice(0, 1200)}`);
  }
  if (userPoints.length) {
    sections.push(`【作者近期关注】\n${userPoints.slice(-4).map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }
  if (assistantPoints.length) {
    sections.push(`【已达成共识】\n${assistantPoints.slice(-3).map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }

  const plans = recent
    .filter((m) => m.write_plan)
    .map((m) => formatWritePlanNote(m.write_plan))
    .slice(-2);
  if (plans.length) {
    sections.push(`【写作方案记录】\n${plans.join('\n')}`);
  }

  return sections.join('\n\n').slice(0, 3500);
}

export function shouldRefreshMemory(messageCount, lastMemoryAtCount = 0) {
  if (messageCount < 6) return false;
  return messageCount - lastMemoryAtCount >= MEMORY_UPDATE_INTERVAL;
}

export function ensureClaudeSessionId(session) {
  if (session.claude_session_id) return session.claude_session_id;
  return randomUUID();
}

export function buildMemoryBlock(memorySummary) {
  if (!memorySummary?.trim()) return '';
  return `\n\n---\n\n会话记忆摘要（跨轮次保留的关键上下文）：\n${memorySummary.trim()}`;
}

/**
 * Full prompt context for a chat turn.
 */
export function buildChatPromptContext(session, currentMessage, options = {}) {
  const { regenerate = false } = options;
  const messages = session?.messages || [];
  const excludeTail = regenerate ? 1 : 0;

  const historyBlock = selectHistoryTurns(messages, { excludeTail });
  const memoryBlock = buildMemoryBlock(session?.memory_summary);

  return {
    historyBlock,
    memoryBlock,
    messageCount: messages.length,
    claudeSessionId: session?.claude_session_id || null,
    isFirstClaudeTurn: !session?.claude_session_id,
  };
}
