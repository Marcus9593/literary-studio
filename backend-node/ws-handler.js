import { WebSocketServer } from 'ws';
import * as store from './storage.js';
import { verifyToken } from './auth/token.js';
import { canReadProject, canWriteProject } from './auth/permissions.js';
import { streamChat, streamWriteChapter, streamInlineEdit, buildProjectContext, invalidateProjectContext } from './ai-runtime/orchestrator.js';
import { extractWritePlan } from './write-plan.js';
import { ensureClaudeSessionId } from './conversation-memory.js';
import { describeDefaultSkill, resolveSkillWorkflow } from './skill-config.js';
import { emit, EVENTS } from './event-bus/bus.js';
import { resolveWrittenChapter } from './write-chapter-resolve.js';
import { formatModerationError, isContentModerationText } from './ai-runtime/http-client.js';
import { stripModelToolArtifacts } from './ai-runtime/output-sanitize.js';

const WS_MAX_PAYLOAD = 256 * 1024;
const WS_AUTH_TIMEOUT_MS = 10_000;

/**
 * Attach WebSocket handlers to an HTTP server.
 */
export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: WS_MAX_PAYLOAD });

  wss.on('connection', (ws) => {
    let user = null;
    let authed = false;
    let activeRunner = null;
    let cancelRequested = false;

    const authTimer = setTimeout(() => {
      if (!authed) {
        try {
          ws.send(JSON.stringify({ type: 'error', error: '认证超时' }));
        } catch { /* noop */ }
        ws.close(4401, 'Auth timeout');
      }
    }, WS_AUTH_TIMEOUT_MS);

    const abortActive = () => {
      if (activeRunner) {
        activeRunner.abort();
        activeRunner = null;
      }
    };

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch {
        ws.send(JSON.stringify({ type: 'error', error: '无效的消息格式' }));
        return;
      }

      if (!authed) {
        if (msg.type !== 'auth' || !msg.token) {
          ws.send(JSON.stringify({ type: 'error', error: '请先发送认证消息' }));
          ws.close(4401, 'Unauthorized');
          return;
        }
        user = verifyToken(String(msg.token));
        if (!user) {
          ws.send(JSON.stringify({ type: 'error', error: '未登录或会话已过期' }));
          ws.close(4401, 'Unauthorized');
          return;
        }
        authed = true;
        clearTimeout(authTimer);
        ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
        return;
      }

      if (msg.type === 'cancel') {
        cancelRequested = true;
        abortActive();
        ws.send(JSON.stringify({ type: 'status', status: 'cancelled' }));
        return;
      }

      const { projectId } = msg;
      if (!projectId) {
        ws.send(JSON.stringify({ type: 'error', error: '缺少 projectId' }));
        return;
      }

      let projectMeta;
      try { projectMeta = store.getProject(projectId); } catch {
        ws.send(JSON.stringify({ type: 'error', error: '项目不存在' }));
        return;
      }

      if (!canReadProject(user, projectMeta)) {
        ws.send(JSON.stringify({ type: 'error', error: '无权访问此项目' }));
        return;
      }

      const needsWrite = ['chat', 'write', 'inline_edit'].includes(msg.type);
      if (needsWrite && !canWriteProject(user, projectMeta)) {
        ws.send(JSON.stringify({ type: 'error', error: '无权修改此项目' }));
        return;
      }

      abortActive();
      cancelRequested = false;

      if (msg.type === 'chat') {
        await handleChat(ws, projectId, msg.message, msg.sessionId, msg.regenerate === true, (runner) => {
          activeRunner = runner;
        }, () => cancelRequested, msg.planId, msg.contextOptions);
      } else if (msg.type === 'write') {
        await handleWrite(ws, projectId, msg.chapter, msg.title, msg.outline, (runner) => {
          activeRunner = runner;
        }, () => cancelRequested);
      } else if (msg.type === 'inline_edit') {
        await handleInlineEdit(ws, projectId, msg, (runner) => {
          activeRunner = runner;
        }, () => cancelRequested);
      } else {
        ws.send(JSON.stringify({ type: 'error', error: `未知消息类型: ${msg.type}` }));
      }

      activeRunner = null;
      cancelRequested = false;
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      abortActive();
    });
  });

  return wss;
}

function sendSessionMeta(ws, projectId, sessionId, { syncMessages = false } = {}) {
  try {
    const session = store.getSessionWithMessages(projectId, sessionId);
    const payload = {
      type: 'session',
      sessionId,
      message_count: session.messages?.length || 0,
      memory_summary: session.memory_summary || '',
      has_memory: !!(session.memory_summary?.trim()),
    };
    if (syncMessages) payload.messages = session.messages || [];
    ws.send(JSON.stringify(payload));
  } catch {}
}

async function handleChat(ws, projectId, message, sessionId, regenerate, setRunner, isCancelled, planId, contextOptions) {
  if (!message?.trim()) {
    ws.send(JSON.stringify({ type: 'error', error: '消息不能为空' }));
    return;
  }

  let sid = sessionId;
  if (!sid) {
    try { sid = store.getActiveSessionId(projectId); } catch {}
    if (!sid) {
      const session = store.createSession(projectId, '默认会话');
      sid = session.id;
    }
  }

  store.setActiveSession(projectId, sid);
  ws.send(JSON.stringify({ type: 'session', sessionId: sid }));

  let session;
  try {
    session = store.getSessionWithMessages(projectId, sid);
  } catch {
    ws.send(JSON.stringify({ type: 'error', error: '会话不存在' }));
    return;
  }

  try {
    const ctx = buildProjectContext(projectId);
    const skillDesc = describeDefaultSkill();
    const binding = skillDesc?.valid ? { skill_id: skillDesc.skill_id, sub_skill: skillDesc.sub_skill } : null;
    const workflow = resolveSkillWorkflow(binding);
    ws.send(JSON.stringify({
      type: 'context_summary',
      chapter_count: ctx.chapter_count,
      next_chapter_suggestion: ctx.next_chapter_suggestion,
      latest_chapter_title: ctx.latest_chapter_title,
      default_skill: skillDesc?.valid ? skillDesc.label : null,
      workflow: workflow?.type === 'workflow' ? workflow.name : null,
    }));
  } catch {}

  ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));

  const trimmed = message.trim();
  const lastMsg = session.messages[session.messages.length - 1];
  const isRetrySameUser = regenerate
    && lastMsg?.role === 'user'
    && lastMsg.content?.trim() === trimmed;
  const isRegenerateAssistant = regenerate && lastMsg?.role === 'assistant';

  if (!regenerate || !isRetrySameUser) {
    if (!isRegenerateAssistant) {
      store.appendSessionMessage(projectId, sid, 'user', trimmed);
      session = store.getSessionWithMessages(projectId, sid);
      emit(EVENTS.MESSAGE_RECEIVED, { projectId, sessionId: sid, role: 'user' });
    }
  }

  if (isRegenerateAssistant) {
    store.removeLastSessionMessage(projectId, sid, 'assistant');
    session = store.getSessionWithMessages(projectId, sid);
  }

  if (!session.claude_session_id) {
    const claudeId = ensureClaudeSessionId(session);
    store.updateSessionFields(projectId, sid, { claude_session_id: claudeId });
    session.claude_session_id = claudeId;
  }

  let fullText = '';
  let error = null;
  let resumeFailed = false;
  let usedWorkflow = false;

  const isRecoverableSessionError = (msg) => /no conversation found|invalid session/i.test(String(msg || ''));

  const runStream = async (forceFullHistory = false, clearClaudeSession = false) => {
    if (clearClaudeSession) {
      const newId = ensureClaudeSessionId({});
      store.updateSessionFields(projectId, sid, { claude_session_id: newId });
      session = store.getSessionWithMessages(projectId, sid);
    }

    fullText = '';
    error = null;
    for await (const event of streamChat(projectId, trimmed, session, {
      onRunner: setRunner,
      regenerate,
      forceFullHistory,
      planId: planId || undefined,
      contextOptions: contextOptions || undefined,
    })) {
      if (event.type === 'session_meta' && event.claude_session_id) {
        if (session.claude_session_id !== event.claude_session_id) {
          store.updateSessionFields(projectId, sid, {
            claude_session_id: event.claude_session_id,
          });
          session.claude_session_id = event.claude_session_id;
        }
      } else if (event.type === 'story_plan') {
        ws.send(JSON.stringify({
          type: 'story_plan',
          plan: event.plan,
          plan_type: event.plan_type,
          summary: event.summary,
        }));
        if (event.summary) fullText = event.summary;
      } else if (event.type === 'task_execute') {
        ws.send(JSON.stringify({
          type: 'task_execute',
          task: event.task,
          plan: event.plan,
          user_message: event.user_message,
          summary: event.summary,
        }));
        if (event.summary) fullText = event.summary;
      } else if (event.type === 'story_tasks_today') {
        ws.send(JSON.stringify({
          type: 'story_tasks_today',
          today: event.today,
        }));
      } else if (event.type === 'planner_result') {
        ws.send(JSON.stringify({
          type: 'planner_result',
          intent: event.intent,
          story_goal: event.story_goal,
          chapter_roadmap: event.chapter_roadmap,
          today: event.today,
        }));
      } else if (event.type === 'write_completed') {
        const created = resolveWrittenChapter(
          projectId,
          event.chapter,
          event.title || '未命名',
        );
        store.touchProject(projectId);
        invalidateProjectContext(projectId);
        emit(EVENTS.PROJECT_UPDATED, { projectId });
        emit(EVENTS.WRITE_FINISHED, {
          projectId,
          chapter: event.chapter,
          title: created?.title || event.title,
          filename: created?.filename,
        });
        ws.send(JSON.stringify({
          type: 'write_result',
          filename: created?.filename,
          title: created?.title,
          words: created?.words,
        }));
        if (created?.title) fullText = fullText || `已完成写稿：${created.title}`;
      } else if (event.type === 'status') {
        ws.send(JSON.stringify({
          type: 'status',
          status: event.status,
          step: event.step,
          phase: event.phase,
          label: event.label,
        }));
      } else if (event.type === 'content') {
        ws.send(JSON.stringify({ type: 'status', status: 'streaming' }));
        fullText += event.text;
        ws.send(JSON.stringify({ type: 'content', text: event.text }));
      } else if (event.type === 'error') {
        error = event.error;
        if (!event.recoverable) {
          ws.send(JSON.stringify({ type: 'error', error: event.error }));
        }
        if (event.recoverable) break;
      }
    }
  };

  try {
    const binding = describeDefaultSkill();
    usedWorkflow = !!resolveSkillWorkflow(binding?.valid ? binding : null);
    await runStream(false);

    const shouldRetrySession = !fullText && (
      isRecoverableSessionError(error)
      || (session.claude_session_id && !error)
    );
    if (shouldRetrySession && !resumeFailed) {
      resumeFailed = true;
      await runStream(true, true);
      if (fullText) error = null;
    }
  } catch (err) {
    if (session.claude_session_id && !resumeFailed) {
      resumeFailed = true;
      try {
        await runStream(true, true);
        error = null;
      } catch (retryErr) {
        error = retryErr.message;
        ws.send(JSON.stringify({ type: 'error', error: retryErr.message }));
      }
    } else {
      error = err.message;
      ws.send(JSON.stringify({ type: 'error', error: err.message }));
    }
  }

  const cancelled = isCancelled?.() ?? false;

  if (!fullText && !cancelled && !error) {
    error = '助手未返回内容，请重试';
    ws.send(JSON.stringify({ type: 'error', error }));
  }

  if (fullText && isContentModerationText(fullText)) {
    const friendly = formatModerationError({ error: { message: fullText } }) || fullText;
    error = friendly;
    fullText = '';
    ws.send(JSON.stringify({ type: 'error', error: friendly }));
  }

  if (fullText) {
    fullText = stripModelToolArtifacts(fullText);
  }

  if (fullText) {
    const body = cancelled ? `${fullText}\n\n[已停止生成]` : fullText;
    const writePlan = extractWritePlan(body);
    const extra = writePlan ? { write_plan: writePlan } : {};
    store.appendSessionMessage(projectId, sid, 'assistant', body, extra);
    store.refreshSessionMemory(projectId, sid);
    emit(EVENTS.MESSAGE_RECEIVED, { projectId, sessionId: sid, role: 'assistant' });
    if (usedWorkflow) {
      emit(EVENTS.WORKFLOW_FINISHED, { projectId, sessionId: sid });
    }
  }

  sendSessionMeta(ws, projectId, sid, { syncMessages: true });

  ws.send(JSON.stringify({
    type: 'status',
    status: cancelled ? 'cancelled' : (error && !fullText) ? 'error' : 'done',
  }));
}

async function handleWrite(ws, projectId, chapter, title, outline, setRunner, isCancelled) {
  if (!chapter || chapter < 1) {
    ws.send(JSON.stringify({ type: 'error', error: '章节号无效' }));
    return;
  }

  ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));

  const job = store.createJob(projectId, 'write_chapter', { chapter, title, outline });
  store.updateJob(job.id, { status: 'running' });
  store.appendJobStep(job.id, 'start', 'running', `开始写第${chapter}章：${title || '未命名'}`);

  let fullText = '';
  let error = null;

  try {
    for await (const event of streamWriteChapter(projectId, chapter, title || '未命名', outline || '', {
      onRunner: setRunner,
    })) {
      if (event.type === 'content') {
        ws.send(JSON.stringify({ type: 'status', status: 'streaming' }));
        fullText += event.text;
        ws.send(JSON.stringify({ type: 'content', text: event.text }));
      } else if (event.type === 'error') {
        error = event.error;
        ws.send(JSON.stringify({ type: 'error', error: event.error }));
      }
    }
  } catch (err) {
    error = err.message;
    ws.send(JSON.stringify({ type: 'error', error: err.message }));
  }

  const cancelled = isCancelled?.() ?? false;

  if (cancelled) {
    store.appendJobStep(job.id, 'write', 'failed', '用户已停止');
    store.updateJob(job.id, { status: 'failed', error: 'cancelled' });
    ws.send(JSON.stringify({ type: 'status', status: 'cancelled' }));
    return;
  }

  if (error) {
    store.appendJobStep(job.id, 'write', 'failed', error);
    store.updateJob(job.id, { status: 'failed', error });
  } else {
    let created = resolveWrittenChapter(projectId, chapter, title || '未命名');
    if (!created?.filename && fullText.trim()) {
      try {
        created = store.saveChapterByNumber(projectId, chapter, title || '未命名', fullText.trim());
      } catch {}
    }

    store.appendJobStep(job.id, 'write', 'done', `完成，约 ${fullText.length} 字`);
    store.updateJob(job.id, {
      status: 'completed',
      result: {
        filename: created?.filename,
        title: created?.title,
        words: created?.words || fullText.length,
      },
    });

    if (created?.filename) {
      store.touchProject(projectId);
      invalidateProjectContext(projectId);
      emit(EVENTS.PROJECT_UPDATED, { projectId });
      emit(EVENTS.WRITE_FINISHED, {
        projectId,
        chapter,
        title: created?.title || title,
        filename: created?.filename,
      });
      ws.send(JSON.stringify({
        type: 'write_result',
        filename: created?.filename,
        title: created?.title,
        words: created?.words || fullText.length,
      }));
    }
  }

  ws.send(JSON.stringify({ type: 'status', status: error ? 'error' : 'done' }));
}

async function handleInlineEdit(ws, projectId, msg, setRunner, isCancelled) {
  const selectedText = String(msg.selectedText || '').trim();
  if (!selectedText) {
    ws.send(JSON.stringify({ type: 'error', error: '缺少选中文字' }));
    return;
  }

  ws.send(JSON.stringify({
    type: 'status',
    status: 'thinking',
    phase: 'inline_edit',
    label: '行内 AI 处理中…',
  }));

  let replacement = '';
  let error = null;

  try {
    for await (const event of streamInlineEdit(projectId, {
      selectedText,
      action: msg.action,
      instruction: msg.instruction,
      chapterTitle: msg.chapterTitle,
      contextBefore: msg.contextBefore,
      contextAfter: msg.contextAfter,
      contextOptions: msg.contextOptions,
      onRunner: setRunner,
    })) {
      if (isCancelled?.()) break;
      if (event.type === 'content') {
        ws.send(JSON.stringify({ type: 'status', status: 'streaming' }));
        ws.send(JSON.stringify({ type: 'content', text: event.text }));
      } else if (event.type === 'inline_edit_result') {
        replacement = event.replacement;
        ws.send(JSON.stringify({
          type: 'inline_edit_result',
          replacement: event.replacement,
          action: event.action,
        }));
      } else if (event.type === 'error') {
        error = event.error;
        ws.send(JSON.stringify({ type: 'error', error: event.error }));
      }
    }
  } catch (err) {
    error = err.message;
    ws.send(JSON.stringify({ type: 'error', error: err.message }));
  }

  if (isCancelled?.()) {
    ws.send(JSON.stringify({ type: 'status', status: 'cancelled' }));
    return;
  }

  if (!replacement && !error) {
    ws.send(JSON.stringify({ type: 'error', error: 'AI 未返回有效内容' }));
  }

  ws.send(JSON.stringify({ type: 'status', status: error ? 'error' : 'done' }));
}
