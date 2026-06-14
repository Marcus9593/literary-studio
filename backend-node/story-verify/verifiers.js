import fs from 'fs';
import path from 'path';
import * as storage from '../storage.js';
import { decodeBuffer } from '../encoding.js';
import { loadUnderstandingBundle } from '../story-understanding/store.js';
import { getPlan } from '../story-plans/store.js';
import { manuscriptDirForMode } from '../projectProfile.js';

const MIN_WRITE_WORDS = 800;
const MIN_REWRITE_WORDS = 200;

function resolveChapterFile(projectId, chapter, filenameHint) {
  if (filenameHint) {
    try {
      const fp = storage.resolveManuscriptPath(projectId, filenameHint);
      if (fs.existsSync(fp)) return { fp, filename: path.basename(filenameHint) };
    } catch {}
  }
  const chapters = storage.listChapters(projectId);
  const byNum = chapters.find((c) => {
    const m = String(c.filename || '').match(/第0*(\d+)/);
    return m && parseInt(m[1], 10) === chapter;
  });
  if (byNum) {
    try {
      const fp = storage.resolveManuscriptPath(projectId, byNum.filename);
      return { fp, filename: byNum.filename };
    } catch {}
  }
  const meta = storage.getProject(projectId);
  const dir = manuscriptDirForMode(meta.creation_mode || 'scratch');
  const ws = storage.workspacePath(projectId);
  const padded = String(chapter).padStart(4, '0');
  const candidates = fs.existsSync(path.join(ws, dir))
    ? fs.readdirSync(path.join(ws, dir)).filter((f) => f.includes(padded) || f.includes(`第${chapter}`))
    : [];
  if (candidates[0]) {
    const fp = path.join(ws, dir, candidates[0]);
    return { fp, filename: candidates[0] };
  }
  return null;
}

function readChapterText(projectId, chapter, filenameHint) {
  const resolved = resolveChapterFile(projectId, chapter, filenameHint);
  if (!resolved?.fp || !fs.existsSync(resolved.fp)) {
    return { text: '', words: 0, filename: null };
  }
  const text = decodeBuffer(fs.readFileSync(resolved.fp));
  return { text, words: text.replace(/\s/g, '').length, filename: resolved.filename };
}

function aggregateStatus(checks) {
  if (!checks.length) return 'fail';
  if (checks.every((c) => c.pass)) return 'pass';
  if (checks.some((c) => c.pass)) return 'partial';
  return 'fail';
}

function buildResult({ kind, subject, checks, message, taskId, planId, chapter, suggestAction }) {
  const status = aggregateStatus(checks);
  return {
    schema: 'verify_result',
    kind,
    status,
    subject: subject || '',
    checks,
    message: message || defaultMessage(status, subject),
    task_id: taskId || null,
    plan_id: planId || null,
    chapter: chapter ?? null,
    suggest_action: suggestAction || (status === 'fail' ? buildSuggestAction(kind, subject) : null),
    verified_at: new Date().toISOString(),
  };
}

function defaultMessage(status, subject) {
  if (status === 'pass') return `验收通过：${subject}`;
  if (status === 'partial') return `部分达成：${subject}，建议人工复核`;
  return `验收未通过：${subject}`;
}

function buildSuggestAction(kind, subject) {
  return {
    title: `复核：${subject}`,
    diagnosis: kind === 'write_chapter'
      ? '写章验收未完全达标，请检查字数或章末钩子'
      : '改稿验收未完全达标，请对照修改计划复核',
    type: 'verify_followup',
  };
}

/**
 * 写章验收：文件存在 + 最低字数
 */
export function verifyWriteChapter(projectId, { chapter, filename, taskId, minWords = MIN_WRITE_WORDS } = {}) {
  const ch = parseInt(chapter, 10);
  if (Number.isNaN(ch)) {
    return buildResult({
      kind: 'write_chapter',
      subject: '章节号无效',
      checks: [{ id: 'chapter_number', label: '章节号有效', pass: false, detail: `无效的章节号: ${chapter}` }],
      message: `验收失败：章节号无效 (${chapter})`,
      taskId,
      chapter: null,
    });
  }
  const { words, filename: resolved } = readChapterText(projectId, ch, filename);
  const checks = [
    {
      id: 'chapter_file',
      label: '章节文件已落盘',
      pass: !!resolved && words > 0,
      detail: resolved || '未找到对应章节文件',
    },
    {
      id: 'min_words',
      label: `正文字数 ≥ ${minWords}`,
      pass: words >= minWords,
      detail: `${words} 字`,
    },
  ];
  return buildResult({
    kind: 'write_chapter',
    subject: `第 ${ch} 章写章`,
    checks,
    taskId,
    chapter: ch,
  });
}

/**
 * 改稿 / 计划验收：关联章节可读 + 理解层仍有效
 */
export function verifyPlanExecution(projectId, plan, { taskId } = {}) {
  const kind = plan.type === 'chapter_plan' ? 'write_chapter' : 'rewrite_plan';
  const chapter = plan.chapter ? parseInt(plan.chapter, 10) : null;
  const checks = [
    {
      id: 'plan_completed',
      label: '计划已标记完成',
      pass: plan.status === 'completed',
      detail: plan.status,
    },
  ];

  if (chapter) {
    const { words, filename } = readChapterText(projectId, chapter);
    checks.push({
      id: 'chapter_file',
      label: '关联章节可读取',
      pass: words > 0,
      detail: filename || '—',
    });
    const minW = kind === 'write_chapter' ? MIN_WRITE_WORDS : MIN_REWRITE_WORDS;
    checks.push({
      id: 'min_words',
      label: `章节字数 ≥ ${minW}`,
      pass: words >= minW,
      detail: `${words} 字`,
    });
  }

  try {
    const bundle = loadUnderstandingBundle(projectId);
    const hasDna = !!bundle.story_dna?.one_liner?.trim();
    checks.push({
      id: 'understanding_synced',
      label: '作品分析已同步',
      pass: hasDna,
      detail: hasDna ? 'story_dna 有效' : '待快速同步',
    });
  } catch {
    checks.push({
      id: 'understanding_synced',
      label: '作品分析已同步',
      pass: false,
      detail: '读取失败',
    });
  }

  return buildResult({
    kind,
    subject: plan.summary || plan.user_request || plan.id,
    checks,
    taskId: taskId || plan.task_id,
    planId: plan.id,
    chapter,
  });
}

export function verifyTaskCompletion(projectId, task) {
  if (task.type === 'write_chapter') {
    return verifyWriteChapter(projectId, {
      chapter: task.chapter,
      taskId: task.id,
    });
  }
  if (task.plan_id) {
    try {
      const plan = getPlan(projectId, task.plan_id);
      // 使用 plan 的真实状态，不强制设置为 completed
      // 验收应反映 plan 的实际完成情况
      return verifyPlanExecution(projectId, plan, { taskId: task.id });
    } catch {
      /* fall through */
    }
  }
  return buildResult({
    kind: task.type || 'task',
    subject: task.title,
    checks: [{
      id: 'task_marked_done',
      label: '任务已标记完成',
      pass: task.status === 'done',
      detail: task.status,
    }],
    taskId: task.id,
    chapter: task.chapter,
  });
}
