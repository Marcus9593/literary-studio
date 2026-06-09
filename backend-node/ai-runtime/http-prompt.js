import fs from 'fs';
import path from 'path';
import { selectHistoryAsMessages } from '../conversation-memory.js';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';

const HTTP_HISTORY_MAX = 8;
const HTTP_SYSTEM_MAX = 12000;

export const HTTP_MODE_RULES = `【API 推理模式 — 必读】
- 你无法调用任何工具，不能读写本地文件系统。
- 禁止输出 <tool_call>、<function=...>、parameter= 等标记；不要假装「正在 glob/读取文件」。
- 上下文中若已提供大纲/文稿节选，请直接基于其创作或回答。
- 若需写新章节，直接输出 Markdown 正文或清晰写作提纲，勿描述工具步骤。`;

/** Load outline + manuscript excerpt for HTTP models (server-side, no tools). */
export function loadHttpWorkspaceExcerpt(projectId, focusFilename = null) {
  const ws = storage.workspacePath(projectId);
  const parts = [];

  const outlinePath = path.join(ws, '大纲', '总纲.md');
  try {
    if (fs.existsSync(outlinePath)) {
      parts.push(`【大纲摘要】\n${decodeBuffer(fs.readFileSync(outlinePath)).slice(0, 2800)}`);
    }
  } catch {}

  const chapters = storage.listChapters(projectId);
  let target = null;
  if (focusFilename) {
    target = chapters.find((c) => c.filename === focusFilename) || { filename: focusFilename, title: focusFilename };
  } else if (chapters.length) {
    target = chapters[chapters.length - 1];
  }
  if (target?.filename) {
    try {
      const fp = storage.resolveManuscriptPath(projectId, target.filename);
      const text = decodeBuffer(fs.readFileSync(fp));
      const tail = text.length > 2800 ? text.slice(-2800) : text;
      const label = focusFilename ? '当前章节' : '最近文稿';
      parts.push(`【${label} · ${target.title || target.filename} 节选】\n${tail}`);
    } catch {}
  }

  return parts.join('\n\n');
}

/** Build OpenAI/Anthropic-style messages for API models (avoids one giant user blob). */
export function buildHttpChatMessages({
  systemPrompt,
  storyContext = '',
  memoryBlock = '',
  contextRefreshBlock = '',
  ragBlock = '',
  sessionMessages = [],
  userMessage,
  excludeTail = 0,
}) {
  const systemParts = [
    HTTP_MODE_RULES,
    systemPrompt,
    storyContext ? storyContext.slice(0, 3500) : '',
    memoryBlock ? memoryBlock.slice(0, 1200) : '',
    contextRefreshBlock,
    ragBlock ? ragBlock.slice(0, 1500) : '',
  ].filter(Boolean);

  let systemContent = systemParts.join('\n\n');
  if (systemContent.length > HTTP_SYSTEM_MAX) {
    systemContent = `${systemContent.slice(0, HTTP_SYSTEM_MAX)}\n\n[上下文已截断以符合 API 长度限制]`;
  }

  const history = selectHistoryAsMessages(sessionMessages, {
    maxMessages: HTTP_HISTORY_MAX,
    excludeTail,
  });

  return [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: String(userMessage || '').trim() },
  ];
}

/** Minimal retry payload after content moderation block. */
export function buildHttpChatMessagesSlim({ systemPrompt, userMessage }) {
  return [
    {
      role: 'system',
      content: `${HTTP_MODE_RULES}\n\n${systemPrompt}\n\n请直接回答，勿输出工具标记。`,
    },
    { role: 'user', content: String(userMessage || '').trim() },
  ];
}
