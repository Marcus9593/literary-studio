import { loadCriticContext } from './content-loader.js';
import { syncMemoryAfterApproval } from './memory-sync.js';
import { runEngineCritic } from './run-critic.js';

/**
 * After verify pass / partial — extract facts into studio.db.
 */
export function onContentApproved(projectId, {
  filename,
  chapter,
  content: contentOverride,
  verifyStatus,
} = {}) {
  if (!['pass', 'partial', 'completed'].includes(verifyStatus)) {
    return null;
  }

  const ctx = loadCriticContext(projectId, { filename, chapter });
  const content = contentOverride || ctx.content;
  if (!content?.trim()) return null;

  return syncMemoryAfterApproval(projectId, {
    content,
    unitIndex: Number(chapter) || ctx.chapter || 1,
    characterNames: ctx.character_names,
    title: ctx.title,
    filename: filename || ctx.filename,
  });
}

/**
 * Run rules critic + governor; used by API and optional post-write hook.
 */
export async function onCriticRequested(projectId, options = {}) {
  return runEngineCritic(projectId, options);
}
