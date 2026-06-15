import path from 'path';
import fs from 'fs';
import * as storage from '../storage.js';
import { decodeBuffer } from '../lib/encoding.js';
import {
  buildChatPromptContext,
  ensureClaudeSessionId,
  selectHistoryTurns,
} from '../lib/conversation-memory.js';
import {
  buildSkillInstructionBlock,
  resolveSkillForMessage,
  describeDefaultSkill,
  resolveSkillWorkflow,
} from '../skill-adapter/skill-config.js';
import { WORK_TYPES, CREATION_MODES, manuscriptDirForMode } from '../lib/projectProfile.js';
import * as runtime from './runtime.js';
import { usesHttpRuntime } from './model-resolver.js';
import { buildHttpChatMessages, buildHttpChatMessagesSlim, loadHttpWorkspaceExcerpt } from './http-prompt.js';
import { stripModelToolArtifacts } from './output-sanitize.js';
import { isContentModerationText } from './http-client.js';
import { retrieveContext } from '../memory/retriever.js';
import { executeWorkflow } from '../workflow/engine.js';
import { routeRequest, buildStoryContextBlocks, resolvePlanExecuteRoute } from '../agents/chief-editor/index.js';
import {
  recordTokenUsage,
} from './token-usage.js';

const contextCache = new Map();

export function buildSystemPrompt(projectContext, skillBlock = '', modelConfig = null) {
  const {
    title, genre, chapter_count, latest_chapter_title,
    work_type, work_type_label, creation_mode_label, unit_label, rewrite_note,
  } = projectContext;
  const modeHint = creation_mode_label === '重新创作'
    ? `当前为重新创作：新稿优先写入「试验稿」，勿擅自覆盖正文/archive 中的旧稿。${rewrite_note ? `作者备注：${rewrite_note}` : ''}`
    : creation_mode_label === '续写半成品'
      ? '当前为续写半成品：严格遵循已有正文，勿改写已发布章节，除非作者明确要求。'
      : '当前从零开始：可先讨论大纲与人物，再落笔。';

  // 剧本类型专用提示词
  let screenplayHint = '';
  if (work_type === 'screenplay_film') {
    screenplayHint = `

你是一位专业的电影编剧助手。请注意：
- 使用标准剧本格式：INT/EXT 场景头、角色名居中大写、对白缩进
- 每场戏应有明确功能：推进剧情、揭示人物、制造转折
- 对白要有潜台词，避免直白说教
- 注意节奏控制：建置→对抗→解决的三幕结构
- 场景描写要可拍（避免内心独白，多用动作和画面）`;
  } else if (work_type === 'screenplay_series') {
    screenplayHint = `

你是一位剧集编剧助手。请注意：
- 每集结尾需要强钩子（hook）吸引观众看下一集
- 注意跨集伏笔的埋设与回收
- 角色弧线要连贯，性格变化有铺垫
- 多条故事线（A线/B线）需要合理交织
- 对白要符合角色声线，不同角色说话风格要有区分`;
  } else if (work_type === 'web_short') {
    screenplayHint = `

你是一位短视频脚本创作助手。请注意：
- 前3秒必须有强钩子，抓住观众注意力
- 节奏要紧凑，避免拖沓
- 字幕要精炼，一句话传递一个信息
- 结尾CTA（行动号召）要自然
- 注意平台调性：抖音偏快节奏、B站可稍长、小红书偏生活化`;
  }

  return `你是「文匠 Studio」的创作引擎，运行在 ${title}（${genre}，${work_type_label}）项目的工作目录中。
你有以下能力：
- 读写项目目录下的所有文件（正文、试验稿、archive、大纲、设定集）
- 根据作者指令续写、改写、扩写、审稿
- 分析情节、人物、伏笔/铺垫
- 调用已安装的 skill 完成专业任务

当前项目状态：${chapter_count} ${unit_label}已写${latest_chapter_title ? `，最新：${latest_chapter_title}` : ''}。
创作模式：${creation_mode_label}。${modeHint}${screenplayHint}

工作原则：
- 回复简洁，像编辑搭档一样直给
- 讨论方向时不要直接输出整章/场正文
- 需要动笔时，直接写入文件并告知作者
- 写完后简要说明写了什么、字数、需要注意的地方${modelConfig?.name ? `

当前推理后端：${modelConfig.name}（${modelConfig.model}）。作者询问模型身份时，如实说明此后端名称，不要自称 Anthropic Claude。` : ''}${skillBlock}`;
}

function getContextCacheKey(projectId) {
  const ws = storage.workspacePath(projectId);
  const parts = [];
  const stamp = (p) => {
    try { parts.push(`${p}:${fs.statSync(p).mtimeMs}`); } catch { parts.push(`${p}:0`); }
  };
  stamp(path.join(ws, '大纲', '总纲.md'));
  const chapters = storage.listChapters(projectId);
  parts.push(`count:${chapters.length}`);
  if (chapters.length) {
    stamp(path.join(ws, '正文', chapters[chapters.length - 1].filename));
  }
  const settingsDir = path.join(ws, '设定集');
  try {
    if (fs.existsSync(settingsDir)) {
      fs.readdirSync(settingsDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .slice(0, 5)
        .forEach((f) => stamp(path.join(settingsDir, f)));
    }
  } catch {}
  return parts.join('|');
}

export function invalidateProjectContext(projectId) {
  contextCache.delete(projectId);
}

function buildProjectContextUncached(projectId) {
  const meta = storage.normalizeProjectMeta(storage.getProject(projectId));
  const ws = storage.workspacePath(projectId);
  const chapters = storage.listChapters(projectId);
  const wt = WORK_TYPES[meta.work_type] || WORK_TYPES.novel_long;
  const cm = CREATION_MODES[meta.creation_mode] || CREATION_MODES.scratch;

  let outlineExcerpt = '';
  const outlinePath = path.join(ws, '大纲', '总纲.md');
  try { outlineExcerpt = decodeBuffer(fs.readFileSync(outlinePath)).slice(0, 3000); } catch {}

  let settingsExcerpt = '';
  const settingsDir = path.join(ws, '设定集');
  try {
    if (fs.existsSync(settingsDir)) {
      const files = fs.readdirSync(settingsDir).filter((f) => f.endsWith('.md')).sort().slice(0, 3);
      settingsExcerpt = files.map((f) => decodeBuffer(fs.readFileSync(path.join(settingsDir, f))).slice(0, 800)).join('\n\n').slice(0, 2000);
    }
  } catch {}

  let latestExcerpt = '';
  let latestTitle = '';
  if (chapters.length) {
    const latest = chapters[chapters.length - 1];
    latestTitle = latest.title;
    try {
      const text = decodeBuffer(fs.readFileSync(path.join(ws, '正文', latest.filename)));
      latestExcerpt = text.length > 3500 ? text.slice(-3500) : text;
    } catch {}
  }

  // 剧本类型专用上下文
  let screenplayContext = null;
  if (['screenplay_film', 'screenplay_series', 'web_short'].includes(meta.work_type)) {
    try {
      const screenplayData = storage.loadScreenplay(projectId);
      if (screenplayData) {
        if (meta.work_type === 'screenplay_film') {
          screenplayContext = {
            type: 'screenplay_film',
            scene_count: (screenplayData.scenes || []).length,
            storylines: (screenplayData.storylines || []).map(sl => sl.label),
            characters: Object.keys(screenplayData.characters || {}),
            acts: {
              1: (screenplayData.scenes || []).filter(s => s.act === 1).length,
              2: (screenplayData.scenes || []).filter(s => s.act === 2).length,
              3: (screenplayData.scenes || []).filter(s => s.act === 3).length,
            },
          };
        } else if (meta.work_type === 'screenplay_series') {
          screenplayContext = {
            type: 'screenplay_series',
            episode_count: (screenplayData.episodes || []).length,
            foreshadows_open: (screenplayData.foreshadows || []).filter(f => f.status === 'open').length,
            timelines: (screenplayData.timelines || []).map(tl => tl.label),
          };
        } else if (meta.work_type === 'web_short') {
          screenplayContext = {
            type: 'web_short',
            platform: screenplayData.platform,
            target_duration: screenplayData.target_duration,
            shot_count: (screenplayData.shots || []).length,
            sections: (screenplayData.sections || []).map(s => s.label),
          };
        }
      }
    } catch {}
  }

  return {
    title: meta.title,
    genre: meta.genre,
    work_type: meta.work_type,
    work_type_label: wt.label,
    creation_mode: meta.creation_mode,
    creation_mode_label: cm.label,
    unit_label: wt.unitPlural,
    rewrite_note: meta.rewrite_note,
    manuscript_dir: manuscriptDirForMode(meta.creation_mode),
    chapter_count: chapters.length,
    next_chapter_suggestion: chapters.length + 1,
    latest_chapter_title: latestTitle,
    latest_chapter_excerpt: latestExcerpt,
    outline_excerpt: outlineExcerpt,
    settings_excerpt: settingsExcerpt,
    chapters: chapters.slice(-12).map((c) => ({ title: c.title, words: c.words })),
    screenplay_context: screenplayContext,
  };
}

export function buildProjectContext(projectId) {
  const key = getContextCacheKey(projectId);
  const cached = contextCache.get(projectId);
  if (cached?.key === key) return cached.context;
  const context = buildProjectContextUncached(projectId);
  contextCache.set(projectId, { key, context });
  return context;
}

/** 按用户勾选项拼装可选上下文块 */
export async function buildOptionalContextBlock(projectId, contextOptions = {}, { queryForRag = '' } = {}) {
  const defaults = { outline: true, settings: true, knowledge: true, rag: true, recent_chapters: true };
  const opts = { ...defaults, ...contextOptions };
  const ctx = buildProjectContext(projectId);
  const blocks = [];

  if (opts.outline && ctx.outline_excerpt) {
    blocks.push(`【大纲摘要】\n${ctx.outline_excerpt.slice(0, 2200)}`);
  }
  if (opts.settings && ctx.settings_excerpt) {
    blocks.push(`【设定集摘要】\n${ctx.settings_excerpt.slice(0, 1800)}`);
  }
  if (opts.recent_chapters && ctx.latest_chapter_excerpt) {
    blocks.push(`【最近章节节选】\n${ctx.latest_chapter_excerpt.slice(0, 2000)}`);
  }
  if (opts.knowledge) {
    try {
      const kb = buildStoryContextBlocks(projectId).join('\n');
      if (kb.trim()) blocks.push(kb.slice(0, 2200));
    } catch {}
  }
  if (opts.rag && queryForRag) {
    try {
      const rag = await retrieveContext(projectId, queryForRag, { limit: 4 });
      if (rag) blocks.push(rag);
    } catch {}
  }

  if (!blocks.length) return '';
  return `\n\n--- 参考资料（作者勾选）---\n${blocks.join('\n\n')}`;
}

function buildContextRefreshBlock(context) {
  return `【项目上下文更新】
${JSON.stringify({
    title: context.title,
    chapter_count: context.chapter_count,
    latest_chapter_title: context.latest_chapter_title,
    next_chapter_suggestion: context.next_chapter_suggestion,
    chapters: context.chapters?.slice(-5),
  }, null, 2)}`;
}

function buildFocusChapterBlock(projectId, session) {
  const fn = session?.bound_filename;
  if (!fn || fn === storage.SESSION_SCOPE_PROJECT) return '';
  try {
    const fp = storage.resolveManuscriptPath(projectId, fn);
    const text = decodeBuffer(fs.readFileSync(fp));
    const chapters = storage.listChapters(projectId);
    const meta = chapters.find((c) => c.filename === fn);
    const title = meta?.title || fn;
    const excerpt = text.length > 4000 ? text.slice(-4000) : text;
    return `\n\n【作者当前正在完善的章节 · ${title}】\n请优先围绕本章讨论与修改，跨章问题可简要说明后回到本章。\n\n${excerpt}`;
  } catch {
    return '';
  }
}

function computeExcludeTail(session, currentMessage, regenerate) {
  const msgs = session?.messages || [];
  if (!msgs.length) return 0;
  const last = msgs[msgs.length - 1];
  const current = String(currentMessage || '').trim();
  if (last.role === 'user' && last.content?.trim() === current) return 1;
  if (!regenerate) return 0;
  if (last.role === 'assistant') return 1;
  return 0;
}

async function* streamPrompt(prompt, ws, options = {}) {
  const runnerWrapper = { abort: () => {} };
  if (options.onRunner) {
    options.onRunner(runnerWrapper);
  }

  const makeReq = (extra = {}) => runtime.enrichStreamRequest({
    prompt: extra.messages ? undefined : prompt,
    messages: extra.messages,
    cwd: ws,
    allowedTools: options.allowedTools || ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
    sessionId: options.claudeSessionId,
    resume: options.resume,
    modelConfig: options.modelConfig,
    onRunner: (runner) => {
      runnerWrapper.abort = () => runner.abort();
      runtime.trackRunner(runner);
      options.onRunner?.(runner);
    },
  });

  async function* run(req) {
    for await (const evt of runtime.stream(req)) {
      yield evt;
    }
  }

  const primary = makeReq({ messages: options.messages });
  let hadContent = false;
  let moderationError = null;

  for await (const evt of run(primary)) {
    if (evt.type === 'content' && evt.text) hadContent = true;
    if (evt.type === 'error') {
      if (evt.moderation || isContentModerationText(evt.error)) {
        moderationError = evt.error;
        if (options.retryOnModeration && options.slimMessages && !hadContent) {
          break;
        }
      }
    }
    yield evt;
  }

  if (moderationError && !hadContent && options.retryOnModeration && options.slimMessages) {
    for await (const evt of run(makeReq({ messages: options.slimMessages }))) {
      yield evt;
    }
  }
}

export async function* streamChat(projectId, message, session = {}, options = {}) {
  const ws = storage.workspacePath(projectId);
  const context = buildProjectContext(projectId);
  const regenerate = options.regenerate ?? false;

  const modelConfig = runtime.resolveActiveModelConfig();
  const httpMode = usesHttpRuntime(modelConfig);

  let chiefRoute = options.chiefRoute;
  if (!chiefRoute && options.planId) {
    try {
      chiefRoute = resolvePlanExecuteRoute(projectId, options.planId, message, { httpMode });
    } catch {}
  }
  if (!chiefRoute && !options.skipChiefRoute) {
    try {
      chiefRoute = await routeRequest(projectId, message, { session });
    } catch {}
  }

  if (chiefRoute?.intent === 'plan_execute' && chiefRoute?.planId && httpMode) {
    try {
      chiefRoute = resolvePlanExecuteRoute(
        projectId,
        chiefRoute.planId,
        chiefRoute.user_message || message,
        { httpMode: true },
      );
    } catch {}
  }

  if (chiefRoute?.action === 'plan') {
    yield {
      type: 'story_plan',
      plan: chiefRoute.plan,
      plan_type: chiefRoute.plan_type,
      summary: chiefRoute.message,
    };
    yield { type: 'done' };
    return;
  }

  if (chiefRoute?.action === 'notify') {
    yield { type: 'content', text: chiefRoute.message };
    yield { type: 'done' };
    return;
  }

  if (chiefRoute?.action === 'tasks_today') {
    yield { type: 'content', text: chiefRoute.message || '今日创作任务已更新' };
    yield {
      type: 'story_tasks_today',
      today: chiefRoute.today,
    };
    yield { type: 'done' };
    return;
  }

  if (chiefRoute?.action === 'planner_result') {
    const summary = chiefRoute.message || '创作路线已生成';
    yield { type: 'content', text: summary };
    yield {
      type: 'planner_result',
      intent: chiefRoute.intent,
      story_goal: chiefRoute.story_goal,
      chapter_roadmap: chiefRoute.chapter_roadmap,
      today: chiefRoute.today,
    };
    yield { type: 'done' };
    return;
  }

  if (chiefRoute?.action === 'task_execute') {
    if (chiefRoute.message) {
      yield { type: 'content', text: chiefRoute.message };
    }
    yield {
      type: 'task_execute',
      task: chiefRoute.task,
      plan: chiefRoute.plan,
      user_message: chiefRoute.user_message,
      summary: chiefRoute.message,
    };
    yield { type: 'done' };
    return;
  }

  if (chiefRoute?.action === 'write') {
    yield* streamWriteChapter(
      projectId,
      chiefRoute.chapter,
      chiefRoute.title || '未命名',
      chiefRoute.outline || message,
      options,
    );
    yield {
      type: 'write_completed',
      chapter: chiefRoute.chapter,
      title: chiefRoute.title,
    };
    yield { type: 'done' };
    return;
  }

  const effectiveMessage = chiefRoute?.user_message || message;
  const ctxOpts = options.contextOptions || null;

  const storyBlocks = chiefRoute?.contextBlocks?.length
    ? chiefRoute.contextBlocks
    : (ctxOpts?.knowledge === false ? [] : buildStoryContextBlocks(projectId));
  const storyContext = storyBlocks.join('');
  const isPlanExecute = chiefRoute?.intent === 'plan_execute'
    || /【Rewrite Engine|【Story Action|改稿计划 ·/.test(storyContext);

  const { binding, isOverride } = resolveSkillForMessage(effectiveMessage);
  const workflow = isPlanExecute ? null : resolveSkillWorkflow(binding);

  if (isPlanExecute) {
    yield {
      type: 'status',
      status: 'thinking',
      phase: 'chief_editor',
      label: '总编辑：加载作品理解与改稿任务…',
    };
  }

  if (workflow?.type === 'workflow' && workflow.steps?.length) {
    yield* executeWorkflow({
      projectId,
      message: effectiveMessage,
      session,
      context,
      workflow,
      binding,
      options,
    });
    return;
  }

  const skillBlock = binding
    ? buildSkillInstructionBlock(binding, { override: isOverride })
    : '';

  const systemPrompt = buildSystemPrompt(context, skillBlock, modelConfig);
  const excludeTail = computeExcludeTail(session, effectiveMessage, regenerate);
  const promptCtx = buildChatPromptContext(session, effectiveMessage, { regenerate });
  const { memoryBlock } = promptCtx;

  const currentModelId = modelConfig?.id || '';
  let claudeSessionId = session.claude_session_id || ensureClaudeSessionId(session);
  let claudeSessionReset = false;
  const hasAssistantTurns = (session.messages || []).some((m) => m.role === 'assistant');
  if (!httpMode && currentModelId) {
    const claudeBoundModelId = String(session.claude_bound_model_id || '').trim();
    const needsModelRebind = claudeBoundModelId !== currentModelId;
    if (needsModelRebind) {
      claudeSessionReset = true;
      claudeSessionId = ensureClaudeSessionId({});
      if (session.id) {
        storage.updateSessionFields(projectId, session.id, {
          claude_session_id: claudeSessionId,
          inference_model_id: currentModelId,
          claude_bound_model_id: currentModelId,
        });
        session.claude_session_id = claudeSessionId;
        session.inference_model_id = currentModelId;
        session.claude_bound_model_id = currentModelId;
      }
    }
  }
  const useResume = !httpMode
    && !!session.claude_session_id
    && hasAssistantTurns
    && String(session.claude_bound_model_id || '') === currentModelId
    && !options.forceFullHistory
    && !claudeSessionReset;

  let historyBlock = '';
  if (!useResume || options.forceFullHistory) {
    historyBlock = selectHistoryTurns(session.messages || [], { excludeTail });
  }

  let ragBlock = '';
  const ragEnabled = !ctxOpts || ctxOpts.rag !== false;
  if (ragEnabled) {
    try {
      const rag = await retrieveContext(projectId, effectiveMessage, { limit: 4 });
      if (rag) ragBlock = `\n\n---\n\n${rag}`;
    } catch {}
  }

  let userContextBlock = '';
  if (ctxOpts) {
    userContextBlock = await buildOptionalContextBlock(projectId, ctxOpts, { queryForRag: effectiveMessage });
  }

  let fullPrompt;
  let httpMessages;
  let slimMessages;

  if (httpMode) {
    const compactContext = {
      title: context.title,
      genre: context.genre,
      chapter_count: context.chapter_count,
      latest_chapter_title: context.latest_chapter_title,
      creation_mode_label: context.creation_mode_label,
      next_chapter_suggestion: context.next_chapter_suggestion,
    };
    const focusFile = session.bound_filename
      && session.bound_filename !== storage.SESSION_SCOPE_PROJECT
      ? session.bound_filename
      : null;
    const workspaceExcerpt = loadHttpWorkspaceExcerpt(projectId, focusFile);
    const httpSystem = `${systemPrompt}\n\n项目概要：${JSON.stringify(compactContext)}`;
    let httpUserMessage = effectiveMessage;
    if (chiefRoute?.httpUserPrefix) {
      httpUserMessage = `${chiefRoute.httpUserPrefix}\n\n【输出要求】当前为 API 推理模式，无法调用 Read/Edit 等工具。请直接基于上文已附文稿节选，输出可执行的改稿要点与建议改写，禁止输出 <function=...> 或 tool_call 标记。\n\n---\n\n${effectiveMessage}`;
    }
    httpMessages = buildHttpChatMessages({
      systemPrompt: httpSystem,
      storyContext: [storyContext, workspaceExcerpt, userContextBlock].filter(Boolean).join('\n\n'),
      memoryBlock,
      contextRefreshBlock: buildContextRefreshBlock(context),
      ragBlock: ragBlock.slice(0, 1500),
      sessionMessages: session.messages || [],
      userMessage: httpUserMessage,
      excludeTail,
    });
    slimMessages = buildHttpChatMessagesSlim({
      systemPrompt: buildSystemPrompt(context, skillBlock, modelConfig),
      userMessage: httpUserMessage,
    });
    fullPrompt = effectiveMessage;
  } else if (useResume) {
    const focusBlock = buildFocusChapterBlock(projectId, session);
    fullPrompt = `${skillBlock}${storyContext}${buildContextRefreshBlock(context)}${focusBlock}${memoryBlock}${ragBlock}${userContextBlock}

---

用户消息：${effectiveMessage}`;
  } else {
    const focusBlock = buildFocusChapterBlock(projectId, session);
    fullPrompt = `${systemPrompt}

---

项目上下文（JSON）：
${JSON.stringify(context, null, 2)}${storyContext}${focusBlock}${memoryBlock}${historyBlock}${ragBlock}${userContextBlock}

---

用户消息：${effectiveMessage}`;
  }

  if (!httpMode) {
    yield { type: 'session_meta', claude_session_id: claudeSessionId };
  } else {
    yield {
      type: 'inference_meta',
      mode: 'http',
      model: modelConfig.model,
      name: modelConfig.name,
    };
  }

  if (isPlanExecute) {
    yield {
      type: 'status',
      status: 'thinking',
      phase: 'ai_stream',
      label: 'AI 正在执行改稿方案…',
    };
  }

  let responseText = '';
  for await (const evt of streamPrompt(fullPrompt, ws, {
    ...options,
    claudeSessionId,
    resume: useResume,
    modelConfig,
    messages: httpMessages,
    slimMessages,
    retryOnModeration: httpMode,
  })) {
    if (evt.type === 'content' && evt.text) responseText += evt.text;
    yield evt;
  }
  try {
    recordTokenUsage({
      projectId,
      kind: isPlanExecute ? 'plan_execute' : 'chat',
      promptText: httpMode && httpMessages
        ? httpMessages.map((m) => m.content).join('\n')
        : fullPrompt,
      responseText,
    });
  } catch {}
}

export async function* streamWriteChapter(projectId, chapter, title, outline, options = {}) {
  const ws = storage.workspacePath(projectId);
  const context = buildProjectContext(projectId);
  const saveDir = context.manuscript_dir || '正文';
  const modelConfig = runtime.resolveActiveModelConfig();
  const httpMode = usesHttpRuntime(modelConfig);

  const defaultDesc = describeDefaultSkill();
  let skillBlock = '';
  if (defaultDesc?.valid) {
    skillBlock = buildSkillInstructionBlock({
      skill_id: defaultDesc.skill_id,
      sub_skill: defaultDesc.sub_skill || 'webnovel-write',
    });
  }

  const isScreenplay = context.work_type?.startsWith('screenplay');
  const lengthHint = isScreenplay
    ? '按剧本格式撰写本场戏，控制篇幅适中'
    : context.work_type === 'novel_short'
      ? '短篇体量，控制整体篇幅，建议 1500-4000 字'
      : '写出 2000-2800 字的正文';
  const formatHint = isScreenplay
    ? '标准剧本排版：场景标头、动作、对白分行'
    : '中文网文排版，段首缩进两字符；对话用引号';

  const storyContext = buildStoryContextBlocks(projectId).join('');

  const httpWriteHint = httpMode
    ? `\n\n【输出要求】请直接输出本章完整正文（Markdown），不要解释步骤，不要用工具。文首可用一级标题。`
    : '';

  const prompt = `${skillBlock}${storyContext}

你是文学创作引擎。在当前项目中生成新稿。

项目：${context.title}（${context.genre}，${context.work_type_label}）
创作模式：${context.creation_mode_label}
已写：${context.chapter_count} ${context.unit_label}
${context.latest_chapter_title ? `最新稿：${context.latest_chapter_title}` : ''}
${context.rewrite_note ? `重写说明：${context.rewrite_note}` : ''}

${context.outline_excerpt ? `大纲摘要：\n${context.outline_excerpt.slice(0, 2000)}` : ''}
${context.latest_chapter_excerpt ? `\n最近文稿节选：\n${context.latest_chapter_excerpt}` : ''}

任务：
- 序号：第${chapter}${context.unit_label.replace(/章|篇|场|集|稿/, '') || '章'}
- 标题：${title}
- 目标：${outline || '推进主线，段末/场末留悬念或情绪点'}

要求：
1. ${httpMode ? '结合上文大纲与最近文稿续写' : '先读取 大纲/ 了解故事方向'}
2. ${httpMode ? '保持人物与设定一致' : '读取最近 1-2 个已有文稿了解进度（正文或试验稿）'}
3. ${lengthHint}
4. ${formatHint}
5. 减少 AI 味套话
6. ${httpMode ? '只输出正文内容' : `写完后保存到 ${saveDir}/第${String(chapter).padStart(4, '0')}章-${title}.md（勿覆盖 archive 内旧稿）`}
7. ${httpMode ? '' : '如存在 .webnovel/state.json 可更新进度字段'}${httpWriteHint}

直接执行，不要询问确认。`;

  let fullText = '';
  for await (const evt of streamPrompt(prompt, ws, { ...options, modelConfig })) {
    if (evt.type === 'content') fullText += evt.text;
    yield evt;
  }

  if (httpMode && fullText.trim()) {
    const saved = storage.saveChapterByNumber(projectId, chapter, title || '未命名', fullText.trim());
    yield { type: 'write_saved', filename: saved.filename, title: saved.title, words: saved.words };
  }
  try {
    recordTokenUsage({ projectId, kind: 'write', promptText: prompt, responseText: fullText });
  } catch {}
}

const INLINE_ACTIONS = {
  rewrite: '改写选中片段：保持原意与叙事风格，输出可直接替换选区的文本',
  expand: '扩写选中片段：增加细节、动作或环境描写，输出扩写后的完整替换文本',
  polish: '润色选中片段：提升文笔、减少 AI 套话，输出润色后的替换文本',
};

/** 行内 AI：选中片段改写/扩写/润色（同一套 Claude runtime） */
export async function* streamInlineEdit(projectId, payload = {}) {
  const selectedText = String(payload.selectedText || '').trim();
  if (!selectedText) throw new Error('缺少选中文字');
  if (selectedText.length > 8000) throw new Error('选中文字过长，请缩短选区');

  const action = String(payload.action || 'rewrite').trim();
  const instruction = String(payload.instruction || '').trim();
  const actionHint = instruction || INLINE_ACTIONS[action] || INLINE_ACTIONS.rewrite;

  const context = buildProjectContext(projectId);
  const chapterTitle = String(payload.chapterTitle || '').trim();
  const contextBefore = String(payload.contextBefore || '');
  const contextAfter = String(payload.contextAfter || '');
  const modelConfig = runtime.resolveActiveModelConfig();

  const extraContext = await buildOptionalContextBlock(
    projectId,
    payload.contextOptions || {},
    { queryForRag: selectedText.slice(0, 300) },
  );

  const prompt = `你是中文网文编辑助手。${actionHint}

【作品】${context.title}（${context.genre}，${context.work_type_label || '小说'}）
${chapterTitle ? `【当前章节】${chapterTitle}` : ''}
${extraContext}

${contextBefore ? `【前文上下文】\n${contextBefore.slice(-500)}\n` : ''}
【待处理文字】
${selectedText}
${contextAfter ? `\n【后文上下文】\n${contextAfter.slice(0, 500)}` : ''}

严格要求：
1. 只输出替换「待处理文字」的新文本
2. 不要解释、不要标题、不要用 markdown 代码块或引号包裹全文
3. 保持与前后文人称、时态、语气一致
4. 减少「不禁」「心头一紧」等 AI 套话`;

  const ws = storage.workspacePath(projectId);
  let fullText = '';
  for await (const evt of streamPrompt(prompt, ws, { modelConfig })) {
    if (evt.type === 'content') fullText += evt.text;
    yield evt;
  }

  let replacement = stripModelToolArtifacts(fullText).trim();
  if (replacement.startsWith('```')) {
    replacement = replacement.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  if (!replacement) throw new Error('AI 未返回有效内容');

  yield { type: 'inline_edit_result', replacement, action };
  try {
    recordTokenUsage({ projectId, kind: 'inline_edit', promptText: prompt, responseText: fullText });
  } catch {}
}

export async function checkHealth() {
  const inference = runtime.getActiveInferenceMode();
  const claude = await runtime.providers.claude.checkHealth();
  let api = null;
  const cfg = runtime.resolveActiveModelConfig();
  if (cfg) {
    api = await runtime.checkHealth('http');
  }
  return { inference, claude_code: claude, api_model: api };
}
