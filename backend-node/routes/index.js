import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as store from '../storage.js';
import { createWorkspaceZip } from '../export/zip-export.js';
import creativeCenterRoutes from '../creative-center/routes.js';
import { streamChat, streamWriteChapter, buildProjectContext, invalidateProjectContext, checkHealth } from '../ai-runtime/orchestrator.js';
import * as tools from '../skill-adapter/tools-service.js';
import * as skillConfig from '../skill-adapter/skill-config.js';
import {
  invokeSkill,
  getSkillCapabilities,
  getDefaultSkillCapabilities,
  runSkillPreflight,
} from '../skill-adapter/index.js';
import * as mcpAdapter from '../mcp-adapter/index.js';
import { decodeBuffer, isTextFile, decodeUploadFilename } from '../lib/encoding.js';
import {
  getWorkspaceSummary,
  normalizeStrayWorkspaceFiles,
  readWorkspaceFileByMeta,
} from '../lib/workspace-sync.js';
import {
  convertUpload,
  getSupportedFormats,
  isTextExtension,
  needsPythonConversion,
} from '../export/document-convert.js';
import {
  createChaptersDocxZip,
  getExportFormatsHint,
  markdownToDocxFile,
  probeDocxExportAvailable,
} from '../export/document-export.js';
import { createProjectEpub } from '../export/epub-export.js';
import { getUsageSummary } from '../ai-runtime/token-usage.js';
import storyRouter from './story.js';
import measurementRouter from './measurement.js';
import versionsRouter from './versions.js';
import screenplayRouter from './screenplay.js';
import storyEngineRouter from './story-engine.js';
import { bootstrapFromWorkspace } from '../story-kb/sync.js';
import { notifyProjectContentChanged } from '../event-bus/manuscript-events.js';
import { searchProjectManuscripts } from '../search/manuscript-search.js';
import {
  buildUrl,
  formatModelTestError,
  validateModelProtocol,
  postWithAuth,
  buildAnthropicTestPayload,
  extractAnthropicResponseText,
} from '../ai-runtime/http-client.js';
import { assessClaudeCliCompatibility, getCcSwitchPresetCatalogMeta, listCcSwitchClaudePresets, listCliPresetTemplates } from '../../shared/cli-model-compat.js';
import { syncClaudeSettingsFromActiveModel } from '../ai-runtime/runtime.js';
import guestbookRouter from '../guestbook/guestbook-routes.js';
import authRouter from '../auth/auth-routes.js';
import { bootstrapAuth } from '../auth/bootstrap.js';
import { bootstrapToolsConfig } from '../skill-adapter/tools-bootstrap.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import {
  enrichMetaForResponse,
  ensureProjectAccess,
  requireProjectManage,
  requireProjectWrite,
} from '../auth/project-access.js';
import { canReadProject, canWriteProject, filterProjectsForUser, getProjectAccess } from '../auth/permissions.js';
import { listUsers as listAllUsers } from '../auth/user-store.js';
import { isProduction } from '../auth/env.js';

bootstrapAuth();
bootstrapToolsConfig();

function attachProjectParam(req, res, next, projectId) {
  let meta;
  try {
    meta = store.getProject(projectId);
  } catch (e) {
    res.status(404).json({ error: e.message || '项目不存在' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ error: '请先登录' });
    return;
  }
  if (!canReadProject(req.user, meta)) {
    res.status(403).json({ error: '无权访问此项目' });
    return;
  }
  req.projectId = projectId;
  req.projectMeta = meta;
  req.projectAccess = getProjectAccess(req.user, meta);
  next();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.param('id', attachProjectParam);
router.param('projectId', attachProjectParam);

function maskKey(key) {
  const k = String(key || '');
  return k.length > 8 ? `${k.slice(0, 4)}…${k.slice(-4)}` : '';
}

function trySyncClaudeSettings() {
  try {
    return syncClaudeSettingsFromActiveModel();
  } catch (err) {
    console.warn('[models] 同步 ~/.claude/settings.json 失败:', err.message);
    return { synced: false, error: err.message };
  }
}

async function testModelConnection(cfg) {
  const baseUrl = String(cfg.base_url || '').trim();
  const model = String(cfg.model || '').trim();
  const apiKey = String(cfg.api_key || '').trim();
  const protocol = validateModelProtocol(
    baseUrl,
    String(cfg.protocol || '').trim() || (baseUrl.includes('/anthropic') ? 'anthropic' : 'openai'),
  );
  if (!baseUrl) throw new Error('Base URL 不能为空');
  if (!model) throw new Error('模型名称不能为空');
  if (!apiKey) throw new Error('请填写 API Key');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    if (protocol === 'anthropic') {
      const { res, data } = await postWithAuth(
        buildUrl(baseUrl, '/v1/messages'),
        buildAnthropicTestPayload(model, baseUrl),
        apiKey,
        protocol,
        controller.signal,
      );
      if (!res.ok) throw new Error(formatModelTestError(null, data, res));
      const text = extractAnthropicResponseText(data);
      if (!text) {
        return {
          ok: false,
          reply_preview: '',
          warning: '模型 API 已响应 HTTP 200，但未返回可见文本。DeepSeek V4 默认开启 Thinking 模式，Claude Code 对话可能因此无输出；请确认账户已开通 V4、有余额，或尝试 deepseek-v4-flash / 关闭 thinking。',
        };
      }
      return { ok: true, reply_preview: text.slice(0, 80) };
    }

    const { res, data } = await postWithAuth(
      buildUrl(baseUrl, '/chat/completions'),
      {
        model,
        max_tokens: 64,
        messages: [{ role: 'system', content: '你是助手。' }, { role: 'user', content: '回复 OK' }],
      },
      apiKey,
      protocol,
      controller.signal,
    );
    if (!res.ok) throw new Error(formatModelTestError(null, data, res));
    const text = String(
      data?.choices?.[0]?.message?.content
        || data?.choices?.[0]?.message?.reasoning_content
        || '',
    ).trim();
    return { ok: true, reply_preview: text.slice(0, 80) || '（模型已响应，但未返回文本内容）' };
  } catch (e) {
    throw new Error(formatModelTestError(e));
  } finally {
    clearTimeout(timeout);
  }
}

// ── Health & Auth ──

// 带超时的健康检查
async function healthCheckWithTimeout(timeoutMs = 5000) {
  return Promise.race([
    (async () => {
      const aiHealth = await checkHealth({ skipRemoteProbe: true });
      let memory = {};
      try {
        const { getStoreInfo } = await import('../memory/vector-store.js');
        memory = await getStoreInfo();
      } catch {}
      let runtime_providers = [];
      try {
        runtime_providers = (await import('../ai-runtime/runtime.js')).getProviderIds();
      } catch {}
      let cli_compat = null;
      try {
        const active = store.getActiveModel();
        if (active?.base_url) {
          cli_compat = assessClaudeCliCompatibility({
            name: active.name,
            protocol: active.protocol,
            base_url: active.base_url,
            model: active.model,
          });
        }
      } catch {}
      return {
        status: 'ok',
        version: '2.7.0',
        inference: aiHealth.inference,
        claude_code: aiHealth.claude_code,
        api_model: aiHealth.api_model,
        cli_compat,
        memory,
        runtime_providers,
      };
    })(),
    new Promise((resolve) => setTimeout(() => resolve({
      status: 'ok',
      version: '2.7.0',
      inference: { mode: 'unknown' },
      claude_code: { available: false },
      api_model: null,
      memory: {},
      runtime_providers: [],
      _partial: true,
    }), timeoutMs)),
  ]);
}

router.get('/health', async (_req, res) => {
  try {
    const result = await healthCheckWithTimeout(5000);
    res.json(result);
  } catch (err) {
    res.json({ status: 'ok', version: '2.7.0', error: err.message });
  }
});

router.use('/auth', authRouter);
router.use(requireAuth);

router.use('/guestbook', guestbookRouter);

router.get('/usage', (_req, res) => {
  try {
    res.json(getUsageSummary());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/projects/:id/usage', (req, res) => {
  try {
    res.json(getUsageSummary(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Models ──

router.get('/models', (_req, res) => {
  res.json(store.listModelsPublic());
});

router.get('/models/presets/cc-switch', (_req, res) => {
  res.json({
    ...getCcSwitchPresetCatalogMeta(),
    presets: listCcSwitchClaudePresets(),
    templates: listCliPresetTemplates(),
  });
});

router.post('/models', (req, res) => {
  try {
    const created = store.createModel(req.body);
    trySyncClaudeSettings();
    res.json(created);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/models/:modelId', (req, res) => {
  try {
    const updated = store.updateModel(req.params.modelId, req.body);
    trySyncClaudeSettings();
    res.json(updated);
  } catch (e) { res.status(e.message.includes('不存在') ? 404 : 400).json({ error: e.message }); }
});

router.delete('/models/:modelId', (req, res) => {
  try {
    const result = store.deleteModel(req.params.modelId);
    const sync = trySyncClaudeSettings();
    res.json({ ...result, claude_settings_sync: sync });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/models/:modelId/activate', (req, res) => {
  try {
    const raw = store.getModelById(req.params.modelId);
    const compat = assessClaudeCliCompatibility({
      name: raw.name,
      protocol: raw.protocol || (String(raw.base_url || '').includes('/anthropic') ? 'anthropic' : 'openai'),
      base_url: raw.base_url,
      model: raw.model,
    });
    if (!compat.cli_ready) {
      return res.status(400).json({
        error: compat.title || '该模型无法用于 Claude Code CLI 注入',
        cli_compat: compat,
      });
    }
    const result = store.setActiveModel(req.params.modelId);
    const sync = trySyncClaudeSettings();
    res.json({ ...result, claude_settings_sync: sync });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.get('/models/import/cc-switch', (req, res) => {
  try {
    const cfg = store.readCcSwitchConfig();
    res.json({
      name: cfg.name,
      protocol: cfg.protocol,
      base_url: cfg.base_url,
      model: cfg.model,
      api_key: cfg.api_key,
      api_key_preview: maskKey(cfg.api_key),
      source: cfg.source,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/models/test', async (req, res) => {
  try {
    const body = req.body || {};
    const cfg = {
      protocol: body.protocol,
      base_url: String(body.base_url || '').trim(),
      model: String(body.model || '').trim(),
      api_key: String(body.api_key || '').trim(),
    };
    if (!cfg.api_key && body.model_id) {
      cfg.api_key = String(store.getModelById(String(body.model_id)).api_key || '').trim();
    }
    res.json(await testModelConnection(cfg));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/models/:modelId/test', async (req, res) => {
  try {
    const cfg = store.getModelById(req.params.modelId);
    res.json(await testModelConnection(cfg));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Projects ──

router.get('/projects', (req, res) => {
  try {
    const items = filterProjectsForUser(req.user, store.listProjects())
      .map((p) => enrichMetaForResponse(req.user, store.normalizeProjectMeta(p)));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects', (req, res) => {
  const { title, genre, work_type, creation_mode, rewrite_note, summary } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: '标题不能为空' });
  const project = store.createProject(title.trim(), genre?.trim() || '通用', {
    work_type,
    creation_mode,
    rewrite_note,
    summary,
    owner_id: req.user.id,
  });
  try {
    bootstrapFromWorkspace(project.id);
  } catch {}
  res.json(enrichMetaForResponse(req.user, project));
});

/** @deprecated REST 写章已弃用，请使用 WebSocket */
router.post('/projects/:id/write', ensureProjectAccess, (_req, res) => {
  res.status(400).json({ error: '写章已迁移至 WebSocket，请通过创作助手对话写章' });
});

router.get('/projects/:id/shares', requireProjectManage, (req, res) => {
  try {
    const users = listAllUsers().filter((u) => u.id !== req.user.id);
    res.json({
      shares: req.projectMeta.shares || [],
      candidates: users,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/projects/:id/shares', requireProjectManage, (req, res) => {
  try {
    const shares = Array.isArray(req.body?.shares) ? req.body.shares : [];
    const usersById = new Map(listAllUsers().map((u) => [u.id, u]));
    const normalized = shares
      .filter((s) => s.user_id && s.user_id !== req.user.id && usersById.has(s.user_id))
      .map((s) => {
        const u = usersById.get(s.user_id);
        return {
          user_id: u.id,
          username: u.username,
          role: s.role === 'write' ? 'write' : 'read',
        };
      });
    const meta = store.updateProjectShares(req.params.id, normalized);
    res.json(enrichMetaForResponse(req.user, store.normalizeProjectMeta(meta)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/projects/:id', requireProjectWrite, (req, res) => {
  try {
    const meta = store.updateProject(req.params.id, req.body);
    meta.chapters = store.listChapters(req.params.id);
    res.json(enrichMetaForResponse(req.user, meta));
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.get('/projects/:id/takeover', (req, res) => {
  try {
    res.json(store.buildTakeoverReport(req.params.id));
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.get('/projects/:id', (req, res) => {
  try {
    const meta = store.normalizeProjectMeta(store.getProject(req.params.id));
    meta.chapters = store.listChapters(req.params.id);
    res.json(enrichMetaForResponse(req.user, meta));
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.delete('/projects/:id', requireProjectManage, (req, res) => {
  try { store.deleteProject(req.params.id); res.json({ status: 'deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/projects/:id/search', (req, res) => {
  try {
    store.getProject(req.params.id);
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: '缺少 q' });
    const regex = req.query.regex === '1' || req.query.regex === 'true';
    const limit = Math.min(200, parseInt(req.query.limit || '80', 10) || 80);
    res.json(searchProjectManuscripts(req.params.id, q, { regex, limit }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/projects/:id/chapters', (req, res) => {
  try { res.json(store.listChapters(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/projects/:id/workspace/refresh', (req, res) => {
  try {
    let moved = [];
    if (canWriteProject(req.user, req.projectMeta)) {
      moved = normalizeStrayWorkspaceFiles(req.params.id);
      invalidateProjectContext(req.params.id);
      store.touchProject(req.params.id);
    }
    res.json({
      ok: true,
      moved,
      summary: getWorkspaceSummary(req.params.id),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/projects/:id/workspace/file', (req, res) => {
  try {
    const relPath = String(req.query.rel_path || '').trim();
    if (relPath) {
      const data = readWorkspaceFileByMeta(req.params.id, { rel_path: relPath });
      return res.json(data);
    }
    const category = String(req.query.category || '').trim();
    const filename = String(req.query.filename || '').trim();
    if (category && filename) {
      return res.json(store.readWorkspaceFile(req.params.id, category, filename));
    }
    return res.status(400).json({ error: '缺少 rel_path 或 category+filename' });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.get('/projects/:id/chapters/:filename', (req, res) => {
  try {
    const filePath = store.resolveManuscriptPath(req.params.id, req.params.filename);
    const buf = fs.readFileSync(filePath);
    res.json({ filename: path.basename(filePath), content: decodeBuffer(buf) });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.put('/projects/:id/chapters/:filename', requireProjectWrite, (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: '缺少 content' });
    const saved = store.writeManuscriptFile(req.params.id, req.params.filename, content);
    invalidateProjectContext(req.params.id);
    notifyProjectContentChanged(req.params.id, { kind: 'manuscript', filename: saved.filename });
    res.json(saved);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.delete('/projects/:id/chapters/:filename', requireProjectWrite, async (req, res) => {
  try {
    const result = await store.deleteManuscriptFile(req.params.id, req.params.filename);
    invalidateProjectContext(req.params.id);
    notifyProjectContentChanged(req.params.id, { kind: 'manuscript_delete', filename: req.params.filename });
    res.json(result);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

function readManuscriptText(projectId, filename) {
  const filePath = store.resolveManuscriptPath(projectId, filename);
  return decodeBuffer(fs.readFileSync(filePath));
}

function safeExportBasename(meta, fallback = 'project') {
  return String(meta?.title || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
}

router.get('/export/formats', async (_req, res) => {
  try {
    res.json({
      docx_export_available: await probeDocxExportAvailable(),
      hints: getExportFormatsHint(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/projects/:id/chapters/:filename/export', async (req, res) => {
  try {
    store.getProject(req.params.id);
    const format = String(req.query.format || 'md').toLowerCase();
    const filename = path.basename(req.params.filename);
    const content = readManuscriptText(req.params.id, filename);
    const chapter = store.listChapters(req.params.id).find((c) => c.filename === filename);
    const title = chapter?.title || filename.replace(/\.md$/i, '');
    const base = safeExportBasename({ title }, 'chapter');

    if (format === 'md') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.md`)}`);
      return res.send(content);
    }

    if (format === 'docx') {
      const exportDir = path.join(store.projectDir(req.params.id), 'export');
      fs.mkdirSync(exportDir, { recursive: true });
      const docxPath = path.join(exportDir, `${base}.docx`);
      try { fs.unlinkSync(docxPath); } catch {}
      await markdownToDocxFile(content, { title, outputPath: docxPath });
      return res.download(docxPath, `${base}.docx`);
    }

    return res.status(400).json({ error: 'format 须为 md 或 docx' });
  } catch (e) {
    res.status(e.message?.includes('不存在') ? 404 : 500).json({ error: e.message });
  }
});

router.post('/projects/:id/manuscripts', requireProjectWrite, (req, res) => {
  try {
    const { title, content } = req.body || {};
    const saved = store.createManuscriptFile(req.params.id, title, content);
    invalidateProjectContext(req.params.id);
    notifyProjectContentChanged(req.params.id, { kind: 'manuscript_create', filename: saved.filename });
    res.json(saved);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/projects/:id/files/:category', (req, res) => {
  try {
    store.getProject(req.params.id);
    res.json(store.listWorkspaceFiles(req.params.id, req.params.category));
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.get('/projects/:id/files/:category/:filename', (req, res) => {
  try {
    store.getProject(req.params.id);
    res.json(store.readWorkspaceFile(req.params.id, req.params.category, req.params.filename));
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.put('/projects/:id/files/:category/:filename', requireProjectWrite, (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: '缺少 content' });
    const saved = store.writeWorkspaceFile(
      req.params.id,
      req.params.category,
      req.params.filename,
      content,
    );
    invalidateProjectContext(req.params.id);
    notifyProjectContentChanged(req.params.id, {
      kind: 'workspace_file',
      category: req.params.category,
      filename: saved.filename,
    });
    res.json(saved);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// ── Chat (REST fallback — primary interaction is via WebSocket) ──

router.get('/projects/:id/chat', (req, res) => {
  try {
    store.getProject(req.params.id);
    const messages = store.loadChatHistory(req.params.id);
    const context = buildProjectContext(req.params.id);
    res.json({
      messages,
      context_summary: {
        chapter_count: context.chapter_count,
        next_chapter_suggestion: context.next_chapter_suggestion,
        latest_chapter_title: context.latest_chapter_title,
      },
    });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/projects/:id/chat', requireProjectWrite, async (req, res) => {
  try {
    store.getProject(req.params.id);
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: '消息不能为空' });

    let session = {};
    try {
      const sid = store.getActiveSessionId(req.params.id);
      if (sid) session = store.getSessionWithMessages(req.params.id, sid);
    } catch {}

    const replyParts = [];
    for await (const evt of streamChat(req.params.id, message, session)) {
      if (evt.type === 'content' && evt.text) replyParts.push(evt.text);
      if (evt.type === 'error') throw new Error(evt.error || '聊天失败');
    }
    const reply = replyParts.join('').trim();
    const ts = new Date().toISOString();
    const history = store.loadChatHistory(req.params.id);
    const updated = store.saveChatHistory(req.params.id, [
      ...history,
      { role: 'user', content: message, at: ts },
      { role: 'assistant', content: reply, at: ts },
    ]);
    const context = buildProjectContext(req.params.id);
    res.json({
      messages: updated,
      context_summary: {
        chapter_count: context.chapter_count,
        next_chapter_suggestion: context.next_chapter_suggestion,
        latest_chapter_title: context.latest_chapter_title,
      },
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/projects/:id/chat', requireProjectWrite, (req, res) => {
  try {
    store.getProject(req.params.id);
    store.clearChatHistory(req.params.id);
    res.json({ status: 'cleared' });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// ── Sessions ──

router.get('/projects/:id/sessions', (req, res) => {
  try {
    store.getProject(req.params.id);
    const index = store.listSessions(req.params.id);
    res.json(index);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/projects/:id/sessions', requireProjectWrite, async (req, res) => {
  try {
    store.getProject(req.params.id);
    const session = await store.createSession(req.params.id, req.body?.title, {
      bound_filename: req.body?.bound_filename ?? null,
    });
    res.json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects/:id/sessions/focus', requireProjectWrite, async (req, res) => {
  try {
    store.getProject(req.params.id);
    const { scope, filename, title } = req.body || {};
    const result = scope === 'chapter' && filename
      ? await store.focusChapterSession(req.params.id, filename, title)
      : await store.focusProjectSession(req.params.id);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/projects/:id/sessions/:sid', (req, res) => {
  try {
    store.getProject(req.params.id);
    const session = store.getSessionWithMessages(req.params.id, req.params.sid);
    res.json(session);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.patch('/projects/:id/sessions/:sid', requireProjectWrite, async (req, res) => {
  try {
    store.getProject(req.params.id);
    if (req.body?.active === true) {
      const index = await store.setActiveSession(req.params.id, req.params.sid);
      return res.json(index);
    }
    const session = await store.renameSession(req.params.id, req.params.sid, req.body?.title || '未命名');
    res.json(session);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.get('/projects/:id/sessions/:sid/memory', (req, res) => {
  try {
    store.getProject(req.params.id);
    const session = store.getSessionWithMessages(req.params.id, req.params.sid);
    const archive = store.getSessionArchive(req.params.id, req.params.sid);
    res.json({
      memory_summary: session.memory_summary || '',
      memory_updated_at: session.memory_updated_at,
      message_count: session.messages?.length || 0,
      archived_count: archive.messages?.length || 0,
      claude_session_id: session.claude_session_id ? 'bound' : null,
    });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.delete('/projects/:id/sessions/:sid', requireProjectWrite, async (req, res) => {
  try {
    store.getProject(req.params.id);
    const index = await store.deleteSession(req.params.id, req.params.sid);
    res.json(index);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

router.delete('/projects/:id/sessions/:sid/messages', requireProjectWrite, async (req, res) => {
  try {
    store.getProject(req.params.id);
    const session = await store.clearSessionMessages(req.params.id, req.params.sid);
    res.json(session);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// ── Upload ──

router.post('/projects/:id/upload', requireProjectWrite, upload.single('file'), async (req, res) => {
  try {
    store.getProject(req.params.id);
    if (!req.file) return res.status(400).json({ error: '缺少文件' });

    const subdir = req.query.subdir || '正文';
    const allowed = ['正文', '大纲', '设定集', 'archive', '试验稿'];
    if (!allowed.includes(subdir)) {
      return res.status(400).json({ error: `subdir 须为：${allowed.join('、')}` });
    }

    const ws = store.workspacePath(req.params.id);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const originalName = decodeUploadFilename(req.file.originalname);
    let uploadType = 'document';
    let converted = [];

    if (needsPythonConversion(ext)) {
      const result = await convertUpload(ws, originalName, req.file.buffer, subdir);
      uploadType = result.upload_type || (ext === '.zip' ? 'zip' : 'document');
      converted = result.converted || [];
      if (uploadType === 'zip') {
        store.normalizeImportedWorkspace(req.params.id);
        store.ensureWorkspaceDirs(ws);
      }
    } else if (isTextExtension(ext) || isTextFile(ext)) {
      const targetDir = path.join(ws, subdir);
      fs.mkdirSync(targetDir, { recursive: true });
      const text = decodeBuffer(req.file.buffer);
      const outName = ext === '.txt' && !originalName.endsWith('.md')
        ? `${path.basename(originalName, ext)}.md`
        : originalName;
      const outPath = path.join(targetDir, outName);
      fs.writeFileSync(outPath, text, 'utf-8');
      converted = [{
        source: originalName,
        output: `${subdir}/${outName}`,
        converter: ext === '.txt' ? 'txt' : 'native_md',
        words: text.replace(/[\s\n]/g, '').length,
      }];
    } else {
      const targetDir = path.join(ws, subdir);
      fs.mkdirSync(targetDir, { recursive: true });
      const outPath = path.join(targetDir, originalName);
      fs.writeFileSync(outPath, req.file.buffer);
      converted = [{
        source: originalName,
        output: `${subdir}/${originalName}`,
        converter: 'direct',
        words: req.file.buffer.length,
      }];
    }

    const meta = store.getProject(req.params.id);
    if ((subdir === '正文' || uploadType === 'zip') && store.listChapters(req.params.id).length > 0) {
      if (meta.creation_mode === 'scratch') meta.creation_mode = 'continue';
      meta.onboarding_completed = false;
      store.saveProjectMeta(meta);
    }
    store.touchProject(req.params.id);
    invalidateProjectContext(req.params.id);
    notifyProjectContentChanged(req.params.id, { kind: 'upload', subdir, converted_count: converted.length });

    let takeover = null;
    try { takeover = store.buildTakeoverReport(req.params.id); } catch {}

    const chapters = store.listChapters(req.params.id);
    let import_warning = null;
    if (uploadType === 'zip' && chapters.length === 0) {
      import_warning =
        'zip 已解压，但未在「正文/」下找到 .md 章节。请确认压缩包内含 正文/*.md，或先导出本项目 zip 作参考结构。';
    }

    res.json({
      status: 'ok',
      upload_type: uploadType,
      result: uploadType === 'zip' ? 'extracted' : 'converted',
      converted,
      chapters,
      import_warning,
      takeover,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Download ──

router.get('/projects/:id/download', async (req, res) => {
  try {
    const projectId = req.params.id;
    const ws = store.workspacePath(projectId);
    const meta = store.getProject(projectId);
    const format = String(req.query.format || 'zip').toLowerCase();
    const exportDir = path.join(store.projectDir(projectId), 'export');
    fs.mkdirSync(exportDir, { recursive: true });
    const safeTitle = safeExportBasename(meta, 'project');

    if (format === 'zip' || format === 'zip_md') {
      const zipPath = path.join(exportDir, `${safeTitle}.zip`);
      try { fs.unlinkSync(zipPath); } catch {}
      await createWorkspaceZip(ws, zipPath);
      return res.download(zipPath, `${safeTitle}.zip`);
    }

    if (format === 'docx') {
      const chapters = store.listChapters(projectId);
      if (!chapters.length) {
        return res.status(400).json({ error: '项目尚无正文章节，无法导出 Word' });
      }
      const parts = chapters.map((ch) => {
        const text = readManuscriptText(projectId, ch.filename);
        const heading = ch.title || ch.filename.replace(/\.md$/i, '');
        return `# ${heading}\n\n${text}`;
      });
      const merged = parts.join('\n\n---\n\n');
      const docxPath = path.join(exportDir, `${safeTitle}.docx`);
      try { fs.unlinkSync(docxPath); } catch {}
      await markdownToDocxFile(merged, { title: meta.title, outputPath: docxPath });
      return res.download(docxPath, `${safeTitle}.docx`);
    }

    if (format === 'zip_docx') {
      const chapters = store.listChapters(projectId);
      if (!chapters.length) {
        return res.status(400).json({ error: '项目尚无正文章节，无法导出 Word' });
      }
      const zipPath = await createChaptersDocxZip(chapters, {
        readChapter: (filename) => Promise.resolve(readManuscriptText(projectId, filename)),
        exportDir,
        zipBasename: `${safeTitle}-word.zip`,
      });
      return res.download(zipPath, `${safeTitle}-word.zip`);
    }

    if (format === 'epub') {
      const chapters = store.listChapters(projectId);
      if (!chapters.length) {
        return res.status(400).json({ error: '项目尚无正文章节，无法导出 EPUB' });
      }
      const epubPath = path.join(exportDir, `${safeTitle}.epub`);
      try { fs.unlinkSync(epubPath); } catch {}
      await createProjectEpub({ projectId, outputPath: epubPath });
      return res.download(epubPath, `${safeTitle}.epub`);
    }

    return res.status(400).json({
      error: 'format 须为 zip、docx、zip_docx 或 epub',
      docx_export_available: await probeDocxExportAvailable(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/jobs/:id', (req, res) => {
  try { res.json(store.getJob(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// ── Settings legacy compat ──

router.get('/settings', (_req, res) => { res.json(store.listModelsPublic()); });

router.put('/settings', (req, res) => {
  try {
    const active = store.getActiveModel();
    const protocol = req.body.protocol || req.body.provider;
    if (active) {
      const payload = {};
      if (req.body.base_url) payload.base_url = req.body.base_url;
      if (req.body.model) payload.model = req.body.model;
      if (req.body.api_key) payload.api_key = req.body.api_key;
      if (protocol) payload.protocol = protocol;
      const updated = store.updateModel(active.id, payload);
      const sync = trySyncClaudeSettings();
      res.json({ ...updated, claude_settings_sync: sync });
    } else {
      const created = store.createModel({
        name: req.body.model || '默认模型',
        protocol: protocol || 'openai',
        base_url: req.body.base_url || '',
        model: req.body.model || '',
        api_key: req.body.api_key || '',
      });
      const sync = trySyncClaudeSettings();
      res.json({ ...created, claude_settings_sync: sync });
    }
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Tools (Skills / literary-writer) ──

router.get('/tools/overview', (_req, res) => {
  try {
    const mcp = mcpAdapter.getMcpOverview();
    res.json({
      ...tools.getToolsOverview(),
      default_skill: skillConfig.describeDefaultSkill(),
      mcp: {
        enabled_count: mcp.enabled_count,
        total_count: mcp.total_count,
        runtime_server_count: mcp.runtime_server_count,
        cli_injection: mcp.cli_injection,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tools/skills', (_req, res) => {
  try {
    res.json(tools.scanInstalledSkills());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tools/skills/search', (req, res) => {
  try {
    const q = String(req.query.q || '');
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    res.json(tools.searchCatalogue(q, { page, limit }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tools/skills/install', requireAdmin, async (req, res) => {
  try {
    res.json(await tools.installSkill(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/tools/skills/catalogue/update', requireAdmin, async (_req, res) => {
  try {
    res.json(await tools.updateCatalogue());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/tools/literary-writer', (req, res) => {
  try {
    res.json(tools.setLiteraryWriterRoot(req.body?.path || ''));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/tools/default-skill', (req, res) => {
  try {
    const result = skillConfig.setDefaultSkillBinding(req.body || {});
    res.json({
      ...result,
      default_skill: skillConfig.describeDefaultSkill(),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/tools/default-skill', (_req, res) => {
  try {
    res.json({ default_skill: skillConfig.describeDefaultSkill() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Skill 适配器 — 发现能力 */
router.get('/tools/skills/capabilities/default', (_req, res) => {
  try {
    const data = getDefaultSkillCapabilities();
    if (!data) {
      res.status(404).json({ error: '未配置默认 Skill' });
      return;
    }
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/tools/skills/:skillId/capabilities', (req, res) => {
  try {
    const skillId = decodeURIComponent(req.params.skillId);
    const subSkill = req.query.sub_skill ? String(req.query.sub_skill) : null;
    res.json(getSkillCapabilities(skillId, subSkill));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Skill 适配器 — 无项目上下文调用 */
router.post('/tools/skills/invoke', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await invokeSkill({
      skillId: body.skill_id,
      subSkill: body.sub_skill,
      command: body.command,
      args: body.args,
      argv: body.argv,
      script: body.script,
      projectRoot: body.project_root,
      cwd: body.cwd,
      timeoutMs: body.timeout_ms,
      useDefaultSkill: body.use_default_skill,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Skill 适配器 — 项目内调用（注入 workspace 为 project-root） */
router.post('/projects/:projectId/skill/invoke', requireProjectWrite, async (req, res) => {
  try {
    const project = store.getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }
    const body = req.body || {};
    const result = await invokeSkill({
      skillId: body.skill_id,
      subSkill: body.sub_skill,
      command: body.command,
      args: body.args,
      argv: body.argv,
      script: body.script,
      projectId: req.params.projectId,
      cwd: body.cwd,
      timeoutMs: body.timeout_ms,
      useDefaultSkill: body.use_default_skill !== false,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── MCP ──

router.get('/mcp/overview', (_req, res) => {
  try {
    res.json(mcpAdapter.getMcpOverview());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/mcp/servers', (_req, res) => {
  try {
    res.json(mcpAdapter.listAllServers());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/mcp/servers/:serverId/enabled', (req, res) => {
  try {
    const serverId = decodeURIComponent(req.params.serverId);
    res.json(mcpAdapter.setServerEnabled(serverId, req.body?.enabled !== false));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/mcp/servers/:serverId/tools', async (req, res) => {
  try {
    const serverId = decodeURIComponent(req.params.serverId);
    res.json(await mcpAdapter.listServerTools(serverId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/mcp/call', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.server_id || !body.tool) {
      res.status(400).json({ error: '需要 server_id 与 tool' });
      return;
    }
    res.json(await mcpAdapter.callServerTool(
      body.server_id,
      body.tool,
      body.arguments || {},
    ));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/mcp/health', async (req, res) => {
  try {
    const serverId = req.body?.server_id ? String(req.body.server_id) : null;
    if (serverId) {
      res.json(await mcpAdapter.checkServerHealth(serverId));
    } else {
      res.json(await mcpAdapter.checkAllEnabledHealth());
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/mcp/studio', (_req, res) => {
  try {
    res.json(mcpAdapter.readStudioMcpFile());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/mcp/studio', (req, res) => {
  try {
    res.json(mcpAdapter.saveStudioMcpFile(req.body?.content || req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/mcp/runtime/refresh', (_req, res) => {
  try {
    res.json(mcpAdapter.writeRuntimeSnapshot());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/mcp/registry/search', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    const limit = parseInt(req.query.limit || '20', 10);
    const cursor = String(req.query.cursor || '');
    res.json(await mcpAdapter.searchRegistry(q, { limit, cursor }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/mcp/registry/meta', (_req, res) => {
  try {
    res.json(mcpAdapter.getRegistryCacheMeta());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/mcp/registry/install', async (req, res) => {
  try {
    res.json(await mcpAdapter.installFromRegistry(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/projects/:projectId/skill/preflight', async (req, res) => {
  try {
    const project = store.getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }
    const skillId = req.query.skill_id ? String(req.query.skill_id) : null;
    res.json(await runSkillPreflight(req.params.projectId, skillId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Creative Center（创作中心）──
router.use('/studio', creativeCenterRoutes);

router.use(measurementRouter);
router.use(versionsRouter);

// ── Upload formats ──

router.get('/upload/formats', async (_req, res) => {
  try {
    res.json(await getSupportedFormats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.use(storyRouter);
router.use(screenplayRouter);
router.use(storyEngineRouter);

export default router;
